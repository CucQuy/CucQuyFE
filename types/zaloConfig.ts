export type ZaloOrderEventType = 'create' | 'update' | 'delete';

/** Danh sách field keys của order được hỗ trợ trong whitelist filter (match diffOrders.TRACKED_FIELDS) */
export const ZALO_TRACKABLE_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'status', label: 'Trạng thái' },
  { key: 'paymentStatus', label: 'Thanh toán' },
  { key: 'paymentMethod', label: 'Phương thức TT' },
  { key: 'deliveryType', label: 'Hình thức nhận hàng' },
  { key: 'total', label: 'Tổng tiền' },
  { key: 'shippingCost', label: 'Phí ship' },
  { key: 'deliveryDate', label: 'Ngày giao' },
  { key: 'deliveryTime', label: 'Giờ giao' },
  { key: 'note', label: 'Ghi chú' },
  { key: 'customer.name', label: 'Tên khách' },
  { key: 'customer.phone', label: 'SĐT khách' },
  { key: 'customer.address', label: 'Địa chỉ' },
  { key: 'items', label: 'Sản phẩm' },
];

/** Tính năng thông báo Zalo — nhóm nào nhận loại nào (khớp ZALO_NOTIFY_FEATURES ở BE). */
export type ZaloNotifyFeature =
  | 'order_create'
  | 'order_update'
  | 'order_delete'
  | 'payment'
  | 'unpaid'
  | 'pending'
  | 'delivery_due'
  | 'production_tomorrow'
  | 'stuck_pending'
  | 'daily_summary'
  | 'custom'
  | 'health_check';

export const ZALO_NOTIFY_FEATURES: { value: ZaloNotifyFeature; label: string }[] = [
  { value: 'order_create', label: 'Tạo đơn' },
  { value: 'order_update', label: 'Sửa đơn' },
  { value: 'order_delete', label: 'Xoá đơn' },
  { value: 'payment', label: 'Thanh toán' },
  { value: 'unpaid', label: 'Đơn chưa thanh toán' },
  { value: 'pending', label: 'Đơn chờ xử lý' },
  { value: 'delivery_due', label: 'Đơn cần giao' },
  { value: 'production_tomorrow', label: 'Sản xuất ngày mai' },
  { value: 'stuck_pending', label: 'Đơn treo lâu' },
  { value: 'daily_summary', label: 'Tổng kết ngày' },
  { value: 'custom', label: 'Tin tuỳ chỉnh' },
  { value: 'health_check', label: 'Kiểm tra kết nối' },
];

export const zaloFeatureLabel = (f: string): string =>
  ZALO_NOTIFY_FEATURES.find((x) => x.value === f)?.label ?? f;

/** Feature của event đơn (create/update/delete) — dùng khi resolve nhóm nhận tin. */
export const zaloFeatureOfOrderEvent = (e: ZaloOrderEventType): ZaloNotifyFeature =>
  e === 'create' ? 'order_create' : e === 'delete' ? 'order_delete' : 'order_update';

export interface ZaloGroupConfig {
  id: string;
  name: string;
  zaloGroupId: string;
  /** CTV thuộc nhóm — nhóm CÓ member chỉ nhận đơn của member đó (nhóm CTV). */
  memberUids: string[];
  /** Tính năng thông báo nhóm này nhận. */
  features: ZaloNotifyFeature[];
  updateFieldWhitelist?: string[];
}

export interface ZaloGroupsConfiguration {
  groups: ZaloGroupConfig[];
  updatedAt?: string;
  updatedBy?: string | null;
  // ── Thông báo Zalo cho KHÁCH HÀNG (cảm ơn + trạng thái đơn) ──
  /** Bật gửi tin cảm ơn cho khách sau khi tạo đơn. */
  customerNotifyEnabled?: boolean;
  /** Chiến dịch khuyến mãi (dạng MÃ) để chèn mã vào tin — rỗng = không chèn. */
  customerNotifyPromotionId?: string;
  /** Trần số tin gửi khách mỗi ngày (bridge Zalo giới hạn tin cho người lạ). */
  customerNotifyDailyLimit?: number;
}
