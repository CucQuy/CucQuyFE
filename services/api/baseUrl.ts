/**
 * Base URL của BE. Tách riêng khỏi `client.ts` để tầng phiên (`services/auth/session.ts`)
 * dùng được mà không tạo import vòng — client.ts phải import ngược lại session.ts để
 * tự refresh khi gặp 401.
 */
export const API_BASE_URL: string = (import.meta as any).env?.VITE_API_URL || '';
