import axios from 'axios';
import { API_BASE_URL } from '@/services/api/baseUrl';
import { clearSsoToken, getSsoToken, isSsoTokenFresh, setSsoSession, TOKEN_SKEW_MS } from './ssoToken';

/**
 * Vòng đời phiên ở FE: giữ access token luôn còn hạn, tự làm mới ngầm.
 *
 * Refresh token nằm trong cookie httpOnly (`withCredentials` để trình duyệt gửi kèm),
 * BE chuyển tiếp sang RiceService và xoay vòng. Còn dùng app là phiên còn sống — user
 * không bị đá ra, giống Facebook. Chỉ mất phiên khi bấm đăng xuất, bị admin thu hồi,
 * hoặc bỏ không dùng quá lâu (mặc định 90 ngày).
 *
 * Dùng client axios RIÊNG, không qua `apiClient`: interceptor 401 của apiClient lại gọi
 * vào đây → đệ quy vô tận.
 */
const authClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  withCredentials: true, // bắt buộc: không có cái này trình duyệt không gửi cookie phiên
});

/** BE bọc response thành { data, ... } — bóc ra, đồng thời chịu được dạng trần. */
const unwrap = (body: any): any => (body && typeof body === 'object' && 'success' in body ? body.data : body);

/** Gom mọi lời gọi refresh đồng thời về MỘT request (nhiều API cùng 401 một lúc). */
let inflight: Promise<string> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let onExpired: (() => void) | null = null;

/** AuthProvider đăng ký hàm này để dọn state khi phiên chết hẳn. */
export const setSessionExpiredHandler = (fn: (() => void) | null): void => {
  onExpired = fn;
};

const cancelScheduledRefresh = (): void => {
  if (timer) clearTimeout(timer);
  timer = null;
};

/**
 * Hẹn refresh NGẦM trước khi token hết hạn → user đang thao tác không bao giờ gặp 401.
 * Tối thiểu 10s để token hạn cực ngắn không tạo vòng lặp refresh liên tục.
 */
const scheduleRefresh = (expiresIn: number): void => {
  cancelScheduledRefresh();
  const delay = Math.max(10_000, expiresIn * 1000 - TOKEN_SKEW_MS);
  timer = setTimeout(() => { void refreshAccessToken().catch(() => undefined); }, delay);
};

/** Ép làm mới access token. Thất bại → phiên coi như chết, dọn sạch rồi ném lỗi. */
export const refreshAccessToken = async (): Promise<string> => {
  if (!inflight) {
    inflight = authClient
      .post('/auth/refresh')
      .then((res) => {
        const body = unwrap(res.data);
        const token = typeof body?.accessToken === 'string' ? body.accessToken : '';
        const expiresIn = typeof body?.expiresIn === 'number' ? body.expiresIn : 0;
        if (!token) throw new Error('Phiên không hợp lệ');
        setSsoSession(token, expiresIn);
        scheduleRefresh(expiresIn);
        return token;
      })
      .catch((err) => {
        clearSsoToken();
        cancelScheduledRefresh();
        onExpired?.();
        throw err;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
};

/** Token còn hạn thì trả luôn, sắp hết thì làm mới. Dùng cho socket + mọi chỗ cần token. */
export const ensureAccessToken = async (): Promise<string> => {
  if (isSsoTokenFresh()) return getSsoToken();
  return refreshAccessToken();
};

/** Khôi phục phiên lúc mở app; false = chưa/không còn đăng nhập. */
export const restoreSession = async (): Promise<boolean> => {
  try {
    await ensureAccessToken();
    return true;
  } catch {
    return false;
  }
};

/** Đăng xuất: thu hồi phiên ở BE (kể cả khi lỗi mạng vẫn dọn sạch phía FE). */
export const endSession = async (): Promise<void> => {
  cancelScheduledRefresh();
  try {
    await authClient.post('/auth/logout');
  } catch { /* vẫn đăng xuất ở FE */ }
  clearSsoToken();
};

/**
 * Máy ngủ dậy / tab quay lại: timer trong lúc máy sleep có thể đã lỡ nhịp → kiểm lại ngay.
 * Chỉ refresh khi ĐANG có phiên, tránh gọi thừa ở màn hình đăng nhập.
 */
export const watchSessionFreshness = (): (() => void) => {
  const check = (): void => {
    if (document.visibilityState !== 'visible') return;
    if (!getSsoToken() || isSsoTokenFresh()) return;
    void refreshAccessToken().catch(() => undefined);
  };
  document.addEventListener('visibilitychange', check);
  window.addEventListener('online', check);
  return () => {
    document.removeEventListener('visibilitychange', check);
    window.removeEventListener('online', check);
  };
};
