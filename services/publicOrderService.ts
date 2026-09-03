import axios from 'axios';

/**
 * Tra cứu đơn CÔNG KHAI (khách mở link trong tin Zalo, KHÔNG đăng nhập).
 * Dùng axios trần thay vì `apiClient` vì apiClient gắn Bearer token SSO + interceptor
 * redirect /login khi 401 — trang này phải chạy được khi chưa đăng nhập.
 */
export interface PublicOrderItem {
  name: string;
  quantity: number;
}

export interface PublicOrder {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  deliveryDate: string | null;
  deliveryTime: string | null;
  deliveryType: string;
  customerName: string;
  /** SĐT đã che giữa (0912***678) — chỉ để khách nhận ra đơn của mình. */
  phoneMasked: string;
  items: PublicOrderItem[];
  total: number;
  paidAmount: number;
  trackingNumber: string;
  createdAt: string | null;
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Lấy đơn theo token. Token sai / đơn không tồn tại → null (BE trả 404). */
export const fetchPublicOrder = async (token: string): Promise<PublicOrder | null> => {
  try {
    const { data } = await axios.get(`${API_BASE}/public/orders/${encodeURIComponent(token)}`);
    // BE bọc response trong envelope {data,...} — nhận cả 2 dạng.
    const r = ((data as Record<string, unknown>)?.data ?? data) as Record<string, unknown>;
    if (!r || typeof r !== 'object') return null;
    return {
      orderNumber: str(r.orderNumber),
      status: str(r.status),
      paymentStatus: str(r.paymentStatus),
      deliveryDate: typeof r.deliveryDate === 'string' ? r.deliveryDate : null,
      deliveryTime: typeof r.deliveryTime === 'string' ? r.deliveryTime : null,
      deliveryType: str(r.deliveryType),
      customerName: str(r.customerName),
      phoneMasked: str(r.phoneMasked),
      items: Array.isArray(r.items)
        ? (r.items as Record<string, unknown>[]).map((it) => ({
            name: str(it?.name),
            quantity: num(it?.quantity),
          }))
        : [],
      total: num(r.total),
      paidAmount: num(r.paidAmount),
      trackingNumber: str(r.trackingNumber),
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : null,
    };
  } catch {
    return null;
  }
};
