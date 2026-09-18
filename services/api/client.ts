import axios from 'axios';
import { getSsoToken } from '@/services/auth/ssoToken';
import { ensureAccessToken, refreshAccessToken } from '@/services/auth/session';
import { API_BASE_URL } from '@/services/api/baseUrl';

/**
 * HTTP client gọi BE NestJS. Base URL lấy từ env `VITE_API_URL`. Mỗi request tự gắn
 * access token (RiceService phát sau khi đăng nhập Google) vào header Authorization,
 * và tự làm mới khi token sắp/đã hết hạn — user không bị đá ra giữa chừng.
 */
export { API_BASE_URL };

/** BE đã cấu hình chưa (FE có thể fallback nếu chưa). */
export const isApiEnabled = (): boolean => Boolean(API_BASE_URL);

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Cookie phiên (refresh token, httpOnly) phải được gửi kèm để BE làm mới được token.
apiClient.defaults.withCredentials = true;

/** Route không cần token — gọi trước khi đăng nhập nên đừng kéo theo một vòng refresh. */
const isAuthRoute = (url?: string): boolean => Boolean(url && url.startsWith('/auth/'));

// Gắn access token vào mỗi request; token sắp hết hạn thì làm mới TRƯỚC khi gửi
// (`ensureAccessToken` gom mọi request đồng thời về một lần refresh duy nhất).
apiClient.interceptors.request.use(async (config) => {
  if (isAuthRoute(config.url)) return config;
  let token = getSsoToken();
  if (token) {
    try {
      token = await ensureAccessToken();
    } catch {
      // Refresh hỏng → cứ gửi token cũ, để 401 bên dưới quyết định đăng xuất.
    }
  }
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

/**
 * BE cũ serialize Timestamp thành { _seconds, _nanoseconds }
 * (mất method .toDate()). Component FE cũ vẫn gọi `x.createdAt.toDate()` → revive
 * lại các object đó thành "Timestamp-like" có .toDate()/.toMillis() để tương thích.
 */
const isTsLike = (v: any): boolean =>
  v && typeof v === 'object' &&
  (typeof v._seconds === 'number' || typeof v.seconds === 'number') &&
  (typeof v._nanoseconds === 'number' || typeof v.nanoseconds === 'number');

// Chuỗi ISO datetime do Postgres (timestamptz) sinh ra: có 'T' + giây + offset/Z.
// (date-only "yyyy-mm-dd" hoặc chuỗi SePay tự do KHÔNG khớp → giữ nguyên string.)
const PG_ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

const tsLikeFromMs = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const nanoseconds = (ms % 1000) * 1e6;
  return {
    seconds,
    nanoseconds,
    _seconds: seconds,
    _nanoseconds: nanoseconds,
    toDate: () => new Date(ms),
    toMillis: () => ms,
  };
};

const reviveTimestamps = (input: any): any => {
  // Postgres trả timestamp dạng ISO string → hồi sinh thành Timestamp-like (có .toDate())
  // để tương thích code FE cũ (giống hệt khi BE còn trả {_seconds}).
  if (typeof input === 'string') {
    // Guard rẻ TRƯỚC regex: chuỗi ISO PG_ISO_TS LUÔN có 'T' (code 84) ở index 10 và dài ≥ 20.
    // Guard là superset của regex → không bỏ sót timestamp nào, chỉ bỏ regex cho phần lớn
    // chuỗi thường (tên, nội dung, mã đơn...) → tránh chạy regex trên MỌI field string.
    if (input.length >= 20 && input.charCodeAt(10) === 84 && PG_ISO_TS.test(input)) {
      const ms = Date.parse(input);
      if (!Number.isNaN(ms)) return tsLikeFromMs(ms);
    }
    return input;
  }
  if (Array.isArray(input)) {
    // Chỉ cấp phát mảng mới nếu có phần tử thật sự đổi; nếu không → giữ nguyên reference.
    let changed = false;
    const arr = new Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const r = reviveTimestamps(input[i]);
      if (r !== input[i]) changed = true;
      arr[i] = r;
    }
    return changed ? arr : input;
  }
  if (input && typeof input === 'object') {
    if (isTsLike(input)) {
      const seconds = input._seconds ?? input.seconds;
      const nanoseconds = input._nanoseconds ?? input.nanoseconds ?? 0;
      const ms = seconds * 1000 + Math.floor(nanoseconds / 1e6);
      return {
        seconds,
        nanoseconds,
        _seconds: seconds,
        _nanoseconds: nanoseconds,
        toDate: () => new Date(ms),
        toMillis: () => ms,
      };
    }
    // Chỉ cấp phát object mới nếu có field thật sự đổi; nếu không → giữ nguyên reference
    // (giảm GC + không tạo clone thừa cho subtree không chứa timestamp).
    let changed = false;
    const out: Record<string, any> = {};
    for (const k of Object.keys(input)) {
      const r = reviveTimestamps(input[k]);
      if (r !== input[k]) changed = true;
      out[k] = r;
    }
    return changed ? out : input;
  }
  return input;
};

// BE trả envelope { data, message, statusCode, success }. Tự bóc `.data` cho
// các response thành công; lỗi → reject kèm message từ envelope.
apiClient.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body === 'object' && 'success' in body) {
      response.data = reviveTimestamps(body.data);
    }
    return response;
  },
  async (error) => {
    // 401 = access token hết hạn/không hợp lệ → làm mới MỘT lần rồi gửi lại request.
    // `_retried` chặn vòng lặp khi BE vẫn trả 401 sau khi đã có token mới.
    const req = error?.config;
    if (error?.response?.status === 401 && req && !req._retried && !isAuthRoute(req.url)) {
      req._retried = true;
      let refreshed = false;
      try {
        await refreshAccessToken();
        refreshed = true;
      } catch {
        // Refresh cũng hỏng → phiên chết thật; rơi xuống nhánh báo lỗi bên dưới
        // (session.ts đã dọn token + báo cho AuthProvider đưa user về trang đăng nhập).
      }
      // Gọi lại NGOÀI try: lỗi của lần gửi lại phải nổi lên cho caller đúng như nó là,
      // không bị nuốt rồi báo nhầm thành lỗi 401 ban đầu.
      // `request` chạy lại interceptor phía trên → tự gắn token mới, không cần set tay.
      if (refreshed) return apiClient.request(req);
    }
    const env = error?.response?.data;
    const message =
      (env && typeof env === 'object' && typeof env.message === 'string' && env.message) ||
      error?.message ||
      'Lỗi không xác định';
    return Promise.reject(new Error(String(message)));
  },
);
