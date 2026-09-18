/**
 * Lưu/đọc phiên đăng nhập ở FE.
 *
 * Chỉ giữ ACCESS TOKEN (ngắn hạn, mặc định 15 phút) — refresh token nằm trong cookie
 * httpOnly của BE nên JS không đọc được. Access token vẫn để localStorage để mở tab mới
 * hay F5 là dùng được ngay, không phải chờ một vòng refresh; cửa sổ rủi ro nếu bị XSS chỉ
 * còn vài phút thay vì 7 ngày như trước.
 */
const KEY = 'cq_sso_token';
const EXP_KEY = 'cq_sso_exp'; // thời điểm hết hạn (epoch ms)

/** Refresh sớm trước khi token thật sự hết hạn → request không rơi vào khe hở hết hạn. */
export const TOKEN_SKEW_MS = 60_000;

export const getSsoToken = (): string => {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
};

/** Thời điểm access token hết hạn (epoch ms); 0 = không rõ. */
export const getSsoTokenExpiry = (): number => {
  try { return Number(localStorage.getItem(EXP_KEY)) || 0; } catch { return 0; }
};

/** Token còn dùng được ít nhất `skew` ms nữa không. */
export const isSsoTokenFresh = (skew = TOKEN_SKEW_MS): boolean => {
  const exp = getSsoTokenExpiry();
  return Boolean(getSsoToken()) && exp > Date.now() + skew;
};

/** Ghi phiên mới sau khi đăng nhập / refresh. `expiresIn` tính bằng giây. */
export const setSsoSession = (token: string, expiresIn: number): void => {
  try {
    localStorage.setItem(KEY, token);
    localStorage.setItem(EXP_KEY, String(Date.now() + Math.max(0, expiresIn) * 1000));
  } catch { /* noop */ }
};

export const clearSsoToken = (): void => {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(EXP_KEY);
  } catch { /* noop */ }
};
