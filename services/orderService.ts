import { Order, DeliveryType } from "@/types";
import { UserRole } from "@/types/user";
import { apiClient } from "@/services/api/client";
import { resolveZaloGroupIdsForOrderEvent } from "./configurationService";
import {
  sendOrderDeleteNotification,
  sendOrderUpdateNotification,
} from "./zaloService";
import { enqueueOrderShare } from "./zaloShareQueue";

/** Nem khi CTV co cap nhat don khong phai do ho tao (FE van can de so message). */
export const ORDER_EDIT_DENIED = "ORDER_EDIT_DENIED";

/**
 * Lay danh sach don hang. Phan ghi/doc da chuyen sang BE
 * (GET /orders) — BE da enrich createdBy = ten hien thi va sort theo orderNumber.
 */
export const fetchOrders = async (): Promise<Order[]> => {
  try {
    const res = await apiClient.get("/orders");
    return (res.data as Order[]) ?? [];
  } catch (error) {
    console.error("Error fetching orders from API:", error);
    return [];
  }
};

/**
 * 1 đơn ĐẦY ĐỦ theo id (GET /orders/:id). List trả bản NHẸ (bỏ history/refunds/
 * decorations/appliedPromotions/giftItems); màn chi tiết/sửa gọi cái này để lấy đủ.
 */
export const fetchOrder = async (id: string): Promise<Order | null> => {
  const res = await apiClient.get(`/orders/${id}`);
  return (res.data as Order) ?? null;
};

/**
 * Sinh so don ke tiep (BE: GET /orders/next-number → { orderNumber }).
 * Loi/mat mang → tra CHUOI RONG, KHONG tu che ma o FE: order_create cua BE se goi
 * order_next_number() luc luu. Truoc day fallback `ORD-${Date.now().slice(-6)}` da
 * de ra ORD-307123 (10/09/2026, luc mat mang) khien ca day so nhay vot tu 765 len 307k.
 */
export const getNextOrderNumber = async (): Promise<string> => {
  try {
    const res = await apiClient.get("/orders/next-number");
    const num = (res.data as { orderNumber?: string } | undefined)?.orderNumber;
    return typeof num === "string" && num.length > 0 ? num : "";
  } catch (e) {
    console.warn("Khong lay duoc so don tu API — de BE tu sinh luc luu.", e);
    return "";
  }
};

/**
 * Tao don. BE ghi DB (sinh orderNumber neu thieu) va tra ve order da tao.
 * SAU KHI BE thanh cong → gui thong bao Zalo (goi API ngoai, GIU NGUYEN tren FE).
 * Loi Zalo duoc nuot de khong lam fail viec tao don.
 */
export const addOrder = async (orderData: Order): Promise<void> => {
  let created: any;
  try {
    const res = await apiClient.post("/orders", orderData);
    created = res.data;
  } catch (error) {
    console.error("Error adding order:", error);
    throw error;
  }

  // ── Làm mịn địa chỉ SPX: nền, không chặn (đơn ship tỉnh) ──
  triggerSpxResolve(created);

  // ── Zalo: FIRE-AND-FORGET (không chặn caller) ──
  void (async () => {
    try {
      const createdByUid =
        (orderData.createdBy as string | undefined) ??
        (created?.createdBy as string | undefined);
      const zaloGroupIds = await resolveZaloGroupIdsForOrderEvent("create");
      // Đơn mới → đẩy HÀNG ĐỢI gửi ẢNH thẻ chia sẻ vào Zalo (ZaloShareQueueHost xử lý
      // nền: render → chụp → upload → gửi; lỗi thì fallback text). Không chặn tạo đơn.
      enqueueOrderShare(created, zaloGroupIds);
    } catch (notifErr) {
      console.error("New order Zalo notify error (ignored):", notifErr);
    }
  })();
};

export interface OrderUpdateEditor {
  uid: string;
  role: UserRole | undefined;
  displayName?: string;
  email?: string;
}

/**
 * Cap nhat don. BE check quyen (CTV chi sua don cua minh) + tinh diff + ghi history,
 * tra ve order sau cap nhat (kem `changes` de FE biet co gi doi → gui Zalo).
 * Neu BE tra 403 → throw error message ORDER_EDIT_DENIED (UI hien thi nhu cu).
 */
export const updateOrder = async (
  orderId: string,
  orderData: any,
  editor?: OrderUpdateEditor
): Promise<void> => {
  let updated: any;
  try {
    const res = await apiClient.patch(`/orders/${orderId}`, orderData);
    updated = res.data;
  } catch (error: any) {
    const msg = String(error?.message ?? "");
    if (msg.includes(ORDER_EDIT_DENIED)) {
      throw new Error(ORDER_EDIT_DENIED);
    }
    console.error("Error updating order:", error);
    throw error;
  }

  // ── Làm mịn địa chỉ SPX: nền, không chặn (BE bỏ qua nếu địa chỉ chưa đổi) ──
  triggerSpxResolve({ ...updated, id: orderId });

  // ── Zalo update: FIRE-AND-FORGET (không chặn caller) ──
  const changes: any[] = Array.isArray(updated?.changes) ? updated.changes : [];
  const prevOrder = updated?.prevOrder;
  if (changes.length > 0) {
    void (async () => {
      try {
        const uidShort = editor?.uid ? "User-" + editor.uid.slice(0, 6) : null;
        const editorName = editor?.displayName || editor?.email || uidShort || "Unknown";
        const changedFieldIds = changes.map((c: any) => c.field).filter(Boolean);
        const zaloGroupIds = await resolveZaloGroupIdsForOrderEvent(
          "update",
          changedFieldIds,
        );
        const orderForMsg = { ...updated, id: orderId };
        const { diffOrderItems } = await import("@/utils/order/itemsDiff");
        const itemsDiff = diffOrderItems(prevOrder?.items as any, updated?.items as any);
        await sendOrderUpdateNotification(
          orderForMsg,
          changes,
          { name: editorName, uid: editor?.uid },
          zaloGroupIds,
          itemsDiff,
          prevOrder,
        );
      } catch (notifErr) {
        console.error("Update Zalo notify error (ignored):", notifErr);
      }
    })();
  }
};

/**
 * Đánh dấu đơn ĐÃ IN BILL cho khách (PATCH /orders/:id/print → order_mark_bill_printed).
 * BE set bill_printed_at = now(). Trả order đã cập nhật (có billPrintedAt) để cập nhật badge.
 */
export const markOrderBillPrinted = async (orderId: string): Promise<Order> => {
  const res = await apiClient.patch(`/orders/${orderId}/print`);
  return res.data as Order;
};

/**
 * Đổi TRẠNG THÁI đơn — đường NHẸ & NHANH (PATCH /orders/:id/status, chỉ gửi { status }).
 * BE dùng order_update_status (không tính lại KM / ghi lại items). Zalo gửi
 * FIRE-AND-FORGET (KHÔNG await) → UI không phải chờ mạng Zalo. Trả order đã cập nhật.
 */
export const updateOrderStatus = async (
  orderId: string,
  status: string,
  editor?: OrderUpdateEditor,
): Promise<any> => {
  const res = await apiClient.patch(`/orders/${orderId}/status`, { status });
  const updated = res.data;

  // Zalo: chạy nền, không chặn caller (khác updateOrder cũ await Zalo).
  const changes: any[] = Array.isArray(updated?.changes) ? updated.changes : [];
  const prevOrder = updated?.prevOrder;
  if (changes.length > 0) {
    void (async () => {
      try {
        const uidShort = editor?.uid ? 'User-' + editor.uid.slice(0, 6) : null;
        const editorName = editor?.displayName || editor?.email || uidShort || 'Unknown';
        const changedFieldIds = changes.map((c: any) => c.field).filter(Boolean);
        const zaloGroupIds = await resolveZaloGroupIdsForOrderEvent(
          'update',
          changedFieldIds,
        );
        await sendOrderUpdateNotification(
          { ...updated, id: orderId },
          changes,
          { name: editorName, uid: editor?.uid },
          zaloGroupIds,
          undefined,
          prevOrder,
        );
      } catch (notifErr) {
        console.error('Status Zalo notify error (ignored):', notifErr);
      }
    })();
  }
  return updated;
};

/**
 * Patch NHẸ field nhanh (paymentStatus/paymentMethod/deliveryType) — PATCH /orders/:id/fields.
 * BE dùng order_patch_fields (chỉ đụng field gửi lên). Zalo FIRE-AND-FORGET.
 */
export const patchOrderFields = async (
  orderId: string,
  patch: Record<string, any>,
  editor?: OrderUpdateEditor,
): Promise<any> => {
  const res = await apiClient.patch(`/orders/${orderId}/fields`, patch);
  const updated = res.data;

  const changes: any[] = Array.isArray(updated?.changes) ? updated.changes : [];
  const prevOrder = updated?.prevOrder;
  if (changes.length > 0) {
    void (async () => {
      try {
        const uidShort = editor?.uid ? 'User-' + editor.uid.slice(0, 6) : null;
        const editorName = editor?.displayName || editor?.email || uidShort || 'Unknown';
        const changedFieldIds = changes.map((c: any) => c.field).filter(Boolean);
        const zaloGroupIds = await resolveZaloGroupIdsForOrderEvent(
          'update',
          changedFieldIds,
        );
        await sendOrderUpdateNotification(
          { ...updated, id: orderId },
          changes,
          { name: editorName, uid: editor?.uid },
          zaloGroupIds,
          undefined,
          prevOrder,
        );
      } catch (notifErr) {
        console.error('Patch Zalo notify error (ignored):', notifErr);
      }
    })();
  }
  return updated;
};

/* ───────────────── Đối soát phiếu hoàn ↔ giao dịch SePay (#186) ───────────────── */

/** Hạng mục hoàn tiền (khớp order_refunds.category ở BE). */
export type RefundCategory = 'overcollected_cod' | 'ship_refund' | 'cancel' | 'reduce_qty' | 'other';

/** Nhãn hạng mục hoàn tiền cho dropdown. */
export const REFUND_CATEGORIES: { value: RefundCategory; label: string }[] = [
  { value: 'overcollected_cod', label: 'Thu COD dư' },
  { value: 'ship_refund', label: 'Hoàn phí ship' },
  { value: 'cancel', label: 'Huỷ đơn' },
  { value: 'reduce_qty', label: 'Giảm số lượng' },
  { value: 'other', label: 'Khác' },
];

/**
 * Tạo phiếu hoàn TAY cho 1 đơn, gắn luôn 1 giao dịch tiền ra (đối soát hoàn tiền từ Sổ).
 * BE trả Order đầy đủ. transactionId → BE gắn + đánh dấu reconciled (method 'sepay').
 */
export const createOrderRefund = async (
  orderId: string,
  input: { amount: number; category?: RefundCategory; reason?: string; transactionId?: string },
): Promise<Order> => {
  const res = await apiClient.post(`/orders/${orderId}/refunds`, input);
  return res.data as Order;
};

/**
 * Gắn 1 giao dịch SePay tiền ra cho 1 phiếu hoàn.
 * BE trả về Order ĐẦY ĐỦ (đã refresh refunds) → caller set lại state đơn.
 * Lỗi (message=code): 404 REFUND_NOT_FOUND/TRANSACTION_NOT_FOUND,
 * 409 TRANSACTION_ALREADY_LINKED, 400 TRANSACTION_NOT_OUTGOING.
 */
export const reconcileRefund = async (
  orderId: string,
  refundId: string,
  transactionId: string,
): Promise<Order> => {
  const res = await apiClient.post(
    `/orders/${orderId}/refunds/${refundId}/reconcile`,
    { transactionId },
  );
  return res.data as Order;
};

/** Đánh dấu phiếu hoàn đã trả bằng tiền mặt. BE trả Order đầy đủ. */
export const markRefundCash = async (
  orderId: string,
  refundId: string,
): Promise<Order> => {
  const res = await apiClient.post(`/orders/${orderId}/refunds/${refundId}/cash`);
  return res.data as Order;
};

/** Gỡ đối soát phiếu hoàn (về trạng thái chưa đối soát). BE trả Order đầy đủ. */
export const unreconcileRefund = async (
  orderId: string,
  refundId: string,
): Promise<Order> => {
  const res = await apiClient.post(
    `/orders/${orderId}/refunds/${refundId}/unreconcile`,
  );
  return res.data as Order;
};

/**
 * Đối soát 1 giao dịch (tiền vào/ra) với đơn ngay từ form: in → cộng, out → trừ
 * paidAmount rồi BE tự suy payment_status (UNPAID/DEPOSITED/PAID) + gắn order_number
 * cho GD. Idempotent (GD đã gắn đơn này thì không cộng lại). BE trả Order đã cập nhật.
 */
export const reconcileOrderTransaction = async (
  orderId: string,
  transactionId: string,
): Promise<Order> => {
  const res = await apiClient.post(`/orders/${orderId}/reconcile-transaction`, {
    transactionId,
  });
  return res.data as Order;
};

/** 1 dòng vận đơn từ file 3PL (SPX/GHTK…). */
export interface TrackingRow {
  tracking: string;
  link?: string;
  status?: string;
  name?: string;
  phone?: string;
  /** Mã khách hàng SPX = order_number của mình (khớp chắc hơn SĐT). */
  orderRef?: string;
  /** Thời gian tạo mã (để chọn mã mới nhất khi 1 đơn có nhiều mã). */
  createTime?: string;
}

export interface TrackingSyncResult {
  matched: { tracking: string; link?: string; status?: string; orderNumber: string; orderCustomer: string; receiverName?: string; hadTracking: boolean; replaced?: boolean }[];
  unmatched: { tracking: string; receiverName?: string; phone?: string }[];
  /** Đơn khớp nhưng ĐÃ CÓ mã vận đơn active khác → bỏ qua, không ghi đè. */
  skipped: { tracking: string; orderNumber: string; orderCustomer: string; receiverName?: string; existingTracking: string; sameTracking?: boolean }[];
  /** Đơn đang giữ mã ĐÃ HUỶ, chưa có mã mới → đánh dấu 'Đã hủy', chờ tạo lại. */
  cancelled: { orderNumber: string; orderCustomer: string; receiverName?: string; cancelledTracking: string }[];
  applied: boolean;
  matchedCount: number;
  unmatchedCount: number;
  skippedCount: number;
  cancelledCount: number;
}

/** Đồng bộ vận đơn từ file 3PL. apply=false → preview match; true → ghi vào đơn. */
export const syncOrderTracking = async (
  rows: TrackingRow[],
  apply: boolean,
): Promise<TrackingSyncResult> => {
  const res = await apiClient.post('/orders/sync-tracking', { rows, apply });
  return res.data as TrackingSyncResult;
};

/** 1 dòng "Tiền thu hộ" (COD) từ file giao dịch ví SPX. */
export interface CodRow {
  txId: string;    // Mã giao dịch ví SPX (khóa chống trùng)
  tracking: string; // Mã vận đơn SPXVN
  amount: number;  // Số tiền thu hộ (VND)
  date?: string;   // Thời gian giao dịch (text)
}

export interface CodSyncResult {
  matched: {
    txId: string; tracking: string; amount: number;
    orderNumber: string; orderCustomer: string;
    total: number; paidBefore: number; paidAfter: number; remainingAfter: number;
    statusAfter: string;
  }[];
  unmatched: { txId: string; tracking: string; amount: number }[];
  duplicate: { txId: string; tracking: string; amount: number; orderNumber?: string }[];
  applied: boolean;
  matchedCount: number;
  unmatchedCount: number;
  duplicateCount: number;
}

/** Đồng bộ tiền thu hộ (COD) từ file ví SPX. apply=false → preview; true → tạo GD + cộng paid. */
export const syncOrderCod = async (
  rows: CodRow[],
  apply: boolean,
): Promise<CodSyncResult> => {
  const res = await apiClient.post('/orders/sync-cod', { rows, apply });
  return res.data as CodSyncResult;
};

/** Nhờ Claude AI tách địa chỉ lộn xộn → Tỉnh/Xã chuẩn 2025 (theo thứ tự đầu vào). */
export const aiMatchSpxAddresses = async (
  addresses: string[],
): Promise<{ province: string; ward: string }[]> => {
  const res = await apiClient.post('/ai/spx-address', { addresses });
  const items = (res.data as { items?: unknown })?.items;
  return Array.isArray(items)
    ? items.map((r) => {
        const o = (r ?? {}) as { province?: unknown; ward?: unknown };
        return {
          province: typeof o.province === 'string' ? o.province : '',
          ward: typeof o.ward === 'string' ? o.ward : '',
        };
      })
    : [];
};

/**
 * Nhờ Claude AI CHỌN Xã chuẩn 2025 từ danh mục hợp lệ của tỉnh (grounded — AI chỉ được
 * chép trong `wards`, không bịa). Dùng cho đơn đã ra Tỉnh nhưng còn thiếu Xã (tên xã cũ).
 * Trả mảng tên Xã đúng thứ tự đầu vào (rỗng nếu AI không chọn được).
 */
export const aiPickSpxWard = async (
  items: { address: string; province: string; wards: string[] }[],
): Promise<string[]> => {
  const res = await apiClient.post('/ai/spx-ward', { items });
  const wards = (res.data as { wards?: unknown })?.wards;
  return Array.isArray(wards) ? wards.map((w) => (typeof w === 'string' ? w : '')) : [];
};

/**
 * Tách địa chỉ khách → Tỉnh/Quận/Xã hệ CŨ 3 cấp (danh mục SPX cũ trong DB) để xuất file
 * SPX "địa chỉ cũ". BE làm rule-based (grounded DB) + Claude AI. Trả đúng thứ tự đầu vào.
 */
export const resolveSpxOldAddresses = async (
  addresses: string[],
  useAi: boolean,
): Promise<{ state: string; city: string; ward: string }[]> => {
  const res = await apiClient.post('/ai/spx-address-old', { addresses, useAi });
  const items = (res.data as { items?: unknown })?.items;
  return Array.isArray(items)
    ? items.map((r) => {
        const o = (r ?? {}) as { state?: unknown; city?: unknown; ward?: unknown };
        return {
          state: typeof o.state === 'string' ? o.state : '',
          city: typeof o.city === 'string' ? o.city : '',
          ward: typeof o.ward === 'string' ? o.ward : '',
        };
      })
    : [];
};

/** Cấp địa chỉ cần làm mịn: 3 = Tỉnh/Quận/Xã (hệ cũ), 2 = Tỉnh/Xã (hệ mới), 'both' = cả hai. */
export type SpxResolveLevel = 3 | 2 | 'both';

/**
 * Làm mịn địa chỉ SPX cho 1 đơn: BE resolve (danh mục + AI) → lưu trên đơn.
 * force=true (nút "Làm mịn lại") luôn chạy; false (auto) bỏ qua nếu đã sửa tay / địa chỉ chưa đổi.
 * level=3 → cột spxState/spxCity/spxWard; level=2 → spx2Province/spx2Ward; 'both' → cả hai.
 */
export const resolveOrderSpx = async (
  id: string,
  force = false,
  level: SpxResolveLevel = 3,
): Promise<Order> => {
  const res = await apiClient.post(`/orders/${id}/resolve-spx`, { force, level });
  return res.data as Order;
};

/** Lưu địa chỉ SPX user CHỌN TAY (dropdown Tỉnh/Quận/Xã) — BE set spx_manual=true. */
export const setOrderSpxAddress = async (
  id: string,
  patch: { state?: string; city?: string; ward?: string; detail?: string },
): Promise<Order> => {
  const res = await apiClient.patch(`/orders/${id}/spx-address`, patch);
  return res.data as Order;
};

/** Lý do BE không gửi được tin Zalo cho khách (để FE hiện toast đúng nguyên nhân). */
export type CustomerNotifySkipReason =
  | 'disabled'
  | 'no_order'
  | 'no_phone'
  | 'opt_out'
  | 'already_sent'
  | 'daily_limit'
  | 'test_order';

export interface CustomerNotifyResult {
  sent: boolean;
  reason?: CustomerNotifySkipReason;
  notifiedAt?: string;
}

/**
 * Gửi tin Zalo cảm ơn + trạng thái đơn CHO KHÁCH (nút ở chi tiết đơn).
 * force=true → gửi lại dù đơn đã gửi trước đó.
 */
export const notifyCustomerZalo = async (
  orderId: string,
  force = false,
): Promise<CustomerNotifyResult> => {
  const res = await apiClient.post(`/orders/${orderId}/notify-customer`, { force });
  const d = (res.data ?? {}) as Partial<CustomerNotifyResult>;
  return {
    sent: d.sent === true,
    reason: d.reason,
    notifiedAt: typeof d.notifiedAt === 'string' ? d.notifiedAt : undefined,
  };
};

/** Trạng thái 1 loại thông báo của 1 đơn (null status = chưa gửi). */
export interface NotifyCellState {
  status: 'sent' | 'failed' | null;
  at: string | null;
  error?: string;
  notifId?: string | null;
}

/** 1 dòng trong màn "Thông báo" (khu vực Đơn hàng): 1 đơn × các kênh thông báo. */
export interface OrderNotifyRow {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  status: string;
  deliveryType: string;
  total: number;
  paidAmount: number;
  createdAt: string;
  notifiedAt: string | null;
  zaloOrder: NotifyCellState;
  zaloPromo: NotifyCellState;
}

export interface OrderNotifyMatrix {
  items: OrderNotifyRow[];
  counts: { total: number; sent: number; failed: number; none: number };
}

/** Ma trận đơn × kênh thông báo cho màn "Thông báo" trong khu vực Đơn hàng. */
export const fetchOrderNotifyMatrix = async (
  params: { filter?: 'sent' | 'failed' | 'none' | ''; limit?: number; offset?: number } = {},
): Promise<OrderNotifyMatrix> => {
  const res = await apiClient.get('/orders/notify-matrix', {
    params: {
      filter: params.filter || undefined,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
  });
  const d = (res.data ?? {}) as Record<string, unknown>;
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const s = (v: unknown): string => (typeof v === 'string' ? v : '');
  const cell = (v: unknown): NotifyCellState => {
    const c = (v ?? {}) as Record<string, unknown>;
    return {
      status: c.status === 'sent' || c.status === 'failed' ? c.status : null,
      at: typeof c.at === 'string' ? c.at : null,
      error: s(c.error),
      notifId: typeof c.notifId === 'string' ? c.notifId : null,
    };
  };
  const rows = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : [];
  const c = (d.counts ?? {}) as Record<string, unknown>;
  return {
    items: rows.map((r) => ({
      id: s(r.id),
      orderNumber: s(r.orderNumber),
      customerName: s(r.customerName),
      phone: s(r.phone),
      status: s(r.status),
      deliveryType: s(r.deliveryType),
      total: n(r.total),
      paidAmount: n(r.paidAmount),
      createdAt: s(r.createdAt),
      notifiedAt: typeof r.notifiedAt === 'string' ? r.notifiedAt : null,
      zaloOrder: cell(r.zaloOrder),
      zaloPromo: cell(r.zaloPromo),
    })),
    counts: { total: n(c.total), sent: n(c.sent), failed: n(c.failed), none: n(c.none) },
  };
};

/** 1 dòng nhật ký gửi tin Zalo cho khách. */
export interface CustomerNotifyLogRow {
  id: string;
  createdAt: string;
  status: 'sent' | 'failed' | 'pending';
  error: string;
  phone: string;
  orderId: string | null;
  orderNumber: string;
  customerName: string;
  total: number;
  body: string;
}

export interface CustomerNotifyLogResult {
  items: CustomerNotifyLogRow[];
  counts: { sent: number; failed: number; total: number };
}

/** Nhật ký gửi tin cho khách: đơn nào gửi OK / lỗi (màn "Trạng thái thông báo"). */
export const fetchCustomerNotifyLog = async (
  params: { status?: 'sent' | 'failed' | ''; limit?: number; offset?: number } = {},
): Promise<CustomerNotifyLogResult> => {
  const res = await apiClient.get('/orders/customer-notify-log', {
    params: {
      status: params.status || undefined,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
  });
  const d = (res.data ?? {}) as Record<string, unknown>;
  const rawItems = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : [];
  const c = (d.counts ?? {}) as Record<string, unknown>;
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const s = (v: unknown): string => (typeof v === 'string' ? v : '');
  return {
    items: rawItems.map((r) => ({
      id: s(r.id),
      createdAt: s(r.createdAt),
      status: r.status === 'sent' || r.status === 'failed' ? r.status : 'pending',
      error: s(r.error),
      phone: s(r.phone),
      orderId: typeof r.orderId === 'string' ? r.orderId : null,
      orderNumber: s(r.orderNumber),
      customerName: s(r.customerName),
      total: n(r.total),
      body: s(r.body),
    })),
    counts: { sent: n(c.sent), failed: n(c.failed), total: n(c.total) },
  };
};

/** Xem trước nội dung tin gửi khách (Cài đặt Zalo). */
export const fetchCustomerNotifyPreview = async (): Promise<{ message: string; promoCode: string }> => {
  const res = await apiClient.get('/orders/customer-notify-preview');
  const d = (res.data ?? {}) as { message?: unknown; promoCode?: unknown };
  return {
    message: typeof d.message === 'string' ? d.message : '',
    promoCode: typeof d.promoCode === 'string' ? d.promoCode : '',
  };
};

/** Lưu địa chỉ SPX 2 CẤP user CHỌN TAY (dropdown Tỉnh/Xã) — BE set spx2_manual=true. */
export const setOrderSpx2Address = async (
  id: string,
  patch: { province?: string; ward?: string },
): Promise<Order> => {
  const res = await apiClient.patch(`/orders/${id}/spx2-address`, patch);
  return res.data as Order;
};

/**
 * Đơn ship tỉnh → nền làm mịn địa chỉ SPX (FIRE-AND-FORGET, không chặn caller).
 * BE tự bỏ qua nếu địa chỉ chưa đổi hoặc user đã sửa tay.
 */
const triggerSpxResolve = (order: { id?: string; deliveryType?: string } | undefined): void => {
  if (!order?.id || order.deliveryType !== DeliveryType.SHIP_PROVINCE) return;
  // 'both': làm mịn CẢ 3 cấp (sheet "địa chỉ cũ") lẫn 2 cấp (sheet "địa chỉ mới").
  void resolveOrderSpx(String(order.id), false, 'both').catch((e) => {
    console.error("Auto resolve SPX address error (ignored):", e);
  });
};

/** Danh mục hành chính CŨ của SPX (Tỉnh → Quận/Huyện → Xã/Phường) cho dropdown sửa tay. */
export interface SpxOldCatalog {
  states: string[];
  citiesByState: Record<string, string[]>;
  wardsByCity: Record<string, string[]>;
}

let spxOldCatalogCache: SpxOldCatalog | null = null;

/** Lấy danh mục 3 cấp cũ (cache 1 lần cho phiên). Dùng cho dropdown sửa tay ở chi tiết đơn. */
export const fetchSpxOldCatalog = async (): Promise<SpxOldCatalog> => {
  if (spxOldCatalogCache) return spxOldCatalogCache;
  const res = await apiClient.get("/orders/spx-old-catalog");
  const d = (res.data ?? {}) as Partial<SpxOldCatalog>;
  spxOldCatalogCache = {
    states: Array.isArray(d.states) ? d.states : [],
    citiesByState:
      d.citiesByState && typeof d.citiesByState === "object"
        ? (d.citiesByState as Record<string, string[]>)
        : {},
    wardsByCity:
      d.wardsByCity && typeof d.wardsByCity === "object"
        ? (d.wardsByCity as Record<string, string[]>)
        : {},
  };
  return spxOldCatalogCache;
};

export interface TrackingEvent { time: number; label: string; location?: string }
export interface TrackingTimeline { tn: string; status: string | null; events: TrackingEvent[] }

/** Tra cứu LIVE hành trình vận đơn (SPX) theo mã — BE proxy. */
export const fetchTrackingTimeline = async (tn: string): Promise<TrackingTimeline> => {
  const res = await apiClient.get('/orders/tracking', { params: { tn } });
  return res.data as TrackingTimeline;
};

/** Refresh mốc VĐ mới nhất cho các đơn SPX đang chạy → lưu DB (hiện ở order list). */
export const refreshOrderTracking = async (): Promise<{ updated: number; total: number }> => {
  const res = await apiClient.post('/orders/refresh-tracking');
  return res.data as { updated: number; total: number };
};

/**
 * Xoa don hang. BE xoa DB (DELETE /orders/:id). SAU DO gui Zalo notify
 * (GIU NGUYEN tren FE). Loi Zalo duoc nuot.
 */
export const deleteOrder = async (
  orderId: string,
  editor?: OrderUpdateEditor,
): Promise<void> => {
  if (!orderId) throw new Error("Order ID is required");
  let deleted: any;
  try {
    const res = await apiClient.delete(`/orders/${orderId}`);
    deleted = res.data;
  } catch (error) {
    console.error("Error deleting order:", error);
    throw error;
  }

  // ── Zalo delete: FIRE-AND-FORGET (không chặn caller) ──
  const existing = deleted?.prevOrder;
  if (existing) {
    void (async () => {
      try {
        const uidShort = editor?.uid ? "User-" + editor.uid.slice(0, 6) : null;
        const editorName = editor?.displayName || editor?.email || uidShort || "Unknown";
        const zaloGroupIds = await resolveZaloGroupIdsForOrderEvent("delete");
        await sendOrderDeleteNotification(
          { ...existing, id: orderId },
          { name: editorName, uid: editor?.uid },
          zaloGroupIds,
        );
      } catch (notifErr) {
        console.error("Delete Zalo notify error (ignored):", notifErr);
      }
    })();
  }
};
