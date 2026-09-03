import { OrderStatus, PaymentStatus, PaymentMethod, DeliveryType } from './enums';
import { Customer } from './customer';
import { AppliedPromotion, GiftItem } from './promotion';

export interface OrderItem {
  id: string;
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  image: string;
  /** Các vị đã chọn cho dòng này (nếu sản phẩm có vị) */
  flavors?: string[];
  /** Size đã chọn (nếu sản phẩm có size) */
  size?: string;
  /** Option gói đã chọn (nếu sản phẩm có packagingOptions) — phí đã tính vào price. */
  packagingOption?: string;
  /** Nhiều size + số lượng trong 1 dòng (vd 2 Gia Đình + 1 Lẻ).
   *  `units`: vị RIÊNG của từng đơn vị (mỗi combo 1 rổ vị); units.length = qty. `flavors` là gộp phẳng. */
  sizeCounts?: { name: string; qty: number; units?: string[][] }[];
  /** HH của cả dòng (qty × đơn giá HH), tính lúc hiển thị — KHÔNG lưu DB */
  commissionAmount?: number;
  /** Tên nhóm hoa hồng sản phẩm rơi vào (tính lúc hiển thị) */
  commissionGroupName?: string;
  /** Tổng SL của nhóm đó trong tháng (quyết định bậc) */
  commissionGroupQty?: number;
  /** % lợi nhuận (rate) đã áp theo bậc */
  commissionRate?: number;
}

export interface OrderDecoration {
  materialId: string;
  name: string;
  quantity: number;
  price: number; // đơn giá VND (có thể đã sửa tay)
}

/** 1 dòng phụ thu: nhãn (key tag động, optional) + số tiền riêng (VND). */
export interface SurchargeLine {
  tag?: string;
  /** Tổng phụ thu của dòng (VND). Khi có perUnit → = perUnit × tổng SL sản phẩm (tự tính). */
  amount: number;
  /** Nếu set (>0) → phụ thu TÍNH THEO SỐ LƯỢNG: amount = perUnit × tổng SL sản phẩm. */
  perUnit?: number;
}

/** 1 dòng giảm giá TAY: ghi chú tự do + số tiền giảm (VND). Trừ vào total sau khuyến mãi. */
export interface DiscountLine {
  note?: string;
  amount: number; // VND
}

/**
 * Nhãn phụ thu cho đơn — nay là tag ĐỘNG quản lý trong Cài đặt đơn hàng.
 * Đơn chỉ lưu `key` (string). Định nghĩa + helper ở `@/types/surchargeTag`.
 * Re-export helper + fallback tĩnh để các consumer cũ import từ `@/types/order` vẫn chạy.
 */
export {
  surchargeTagLabel,
  DEFAULT_SURCHARGE_TAGS,
  type SurchargeTag as SurchargeTagDef,
} from './surchargeTag';

/**
 * Key i18n hiển thị ở CHỖ địa chỉ khi đơn KHÔNG có địa chỉ thật.
 * PICKUP → "Khách tới lấy", SHIP_PROVINCE → "Ship tỉnh", còn lại (SHIP/undefined) → "Chưa có địa chỉ".
 * Dùng chung cho list (desktop/mobile) + chi tiết đơn — gom logic, tránh lặp.
 */
export const orderAddressFallbackKey = (dt?: DeliveryType): string => {
  if (dt === DeliveryType.PICKUP) return 'deliveryType.pickup';
  if (dt === DeliveryType.SHIP_PROVINCE) return 'deliveryType.shipProvince';
  if (dt === DeliveryType.DINE_IN) return 'deliveryType.dineIn';
  return 'deliveryType.noAddress';
};

/** Đơn vị vận chuyển của đơn: SPX (Shopee Express) hay Cúc Quý tự giao. */
export type OrderCarrier = 'SPX' | 'CUCQUY';

/**
 * Suy ra đơn vị vận chuyển: ship tỉnh hoặc có mã vận đơn SPX → giao qua Shopee Express;
 * còn lại (giao nội thành / khách tới lấy / tự giao) → Cúc Quý.
 */
export const orderCarrier = (order: Order): OrderCarrier =>
  order.deliveryType === DeliveryType.SHIP_PROVINCE || /^SPX/i.test(order.trackingNumber ?? '')
    ? 'SPX'
    : 'CUCQUY';

export interface OrderFieldChange {
  field: string;
  label?: string;
  oldValue: string | number | null;
  newValue: string | number | null;
}

export interface OrderHistoryEntry {
  at: any;
  by?: string;
  byUid?: string;
  changes: OrderFieldChange[];
}

/** 1 dòng item được hoàn trong 1 lần hoàn tiền (khớp BE). */
export interface OrderRefundItem {
  productName: string;
  qtyRefunded: number;
  unitPrice: number; // VND
  amount: number; // VND = qtyRefunded × unitPrice (BE chuẩn KM/phụ thu)
}

/** Cách đối soát phiếu hoàn với dòng tiền ra (khớp BE). */
export type RefundReconcileMethod = 'sepay' | 'cash';

/** Hạng mục hoàn tiền (khớp BE order_refunds.category). */
export type RefundCategory =
  | 'overcollected_cod' // đã cọc mà SPX vẫn thu COD → thu hộ trùng
  | 'ship_refund'       // KH đổi ship → tới lấy, hoàn phí ship
  | 'cancel'            // huỷ đơn
  | 'reduce_qty'        // giảm số lượng (tự sinh #179)
  | 'other';            // khác

/** Danh mục hạng mục hoàn cho dropdown (types-convention). */
export const REFUND_CATEGORIES: { value: RefundCategory; label: string }[] = [
  { value: 'overcollected_cod', label: 'Thu hộ trùng (đã cọc còn thu COD)' },
  { value: 'ship_refund', label: 'Hoàn phí ship (đổi qua tới lấy)' },
  { value: 'cancel', label: 'Huỷ đơn' },
  { value: 'reduce_qty', label: 'Giảm số lượng' },
  { value: 'other', label: 'Khác' },
];

/** Nhãn hạng mục hoàn tiền; rỗng/không rõ → 'Khác'. */
export const refundCategoryLabel = (c?: string | null): string =>
  REFUND_CATEGORIES.find((x) => x.value === c)?.label ?? 'Khác';

/** 1 bản ghi hoàn tiền của đơn (khớp BE). Mảng refunds sắp mới→cũ. */
export interface OrderRefund {
  id: string;
  amount: number; // VND
  reason?: string;
  /** Hạng mục hoàn tiền (thu hộ trùng / hoàn ship / huỷ / giảm SL / khác). */
  category?: RefundCategory | string;
  items: OrderRefundItem[];
  createdAt?: any;
  createdBy?: string;
  /** Đối soát (#186): id giao dịch SePay tiền ra đã gắn cho phiếu hoàn (null nếu chưa/tiền mặt). */
  transactionId?: string | null;
  /** Phiếu hoàn đã được đối soát (gắn GD SePay hoặc đánh dấu tiền mặt). */
  reconciled?: boolean;
  /** Cách đối soát: 'sepay' (gắn GD) / 'cash' (tiền mặt) / null khi chưa đối soát. */
  reconcileMethod?: RefundReconcileMethod | null;
  /** Thời điểm đối soát (ISO / Timestamp-like). */
  reconciledAt?: any;
  /** Người thực hiện đối soát (tên hiển thị). */
  reconciledBy?: string | null;
}

/** Nhãn hiển thị cách đối soát phiếu hoàn (types-convention). */
export const reconcileMethodLabel = (m?: RefundReconcileMethod | null): string => {
  if (m === 'sepay') return 'Ngân hàng';
  if (m === 'cash') return 'Tiền mặt';
  return 'Chưa đối soát';
};

export interface Order {
  id: string;
  orderNumber?: string;
  sepayId?: number;
  customer: Customer;
  items: OrderItem[];
  /** Vật phẩm trang trí thêm (chọn từ materials) — cộng vào total. Đơn cũ (backward compat). */
  decorations?: OrderDecoration[];
  /** TỔNG phụ thu cả đơn (VND) = sum(surcharges.amount). Cộng vào subtotal TRƯỚC giảm. */
  surchargeAmount?: number;
  /** Nhãn phụ thu dòng đầu (legacy/tương thích cũ) — `key` của tag động. */
  surchargeTag?: string;
  /** Phụ thu nhiều dòng: mỗi nhãn 1 số tiền riêng. Tổng = sum(amount) = surchargeAmount. */
  surcharges?: SurchargeLine[];
  /** Tổng tiền hàng TRƯỚC giảm (items + decorations + surchargeAmount). */
  subtotal?: number;
  /** Tổng tiền đã giảm bởi khuyến mãi. */
  discountAmount?: number;
  /** Giảm giá TAY nhiều dòng {note, amount} — trừ vào total sau khuyến mãi. */
  discounts?: DiscountLine[];
  /** TỔNG giảm giá tay (VND) = sum(discounts.amount). */
  manualDiscountAmount?: number;
  /** Các khuyến mãi đã áp vào đơn. */
  appliedPromotions?: AppliedPromotion[];
  /** Quà tặng (Mua X tặng Y) — giá 0. */
  giftItems?: GiftItem[];
  /** = subtotal + shippingCost − discountAmount. */
  total: number;
  /** Tiền cọc thoả thuận (VND). */
  depositAmount?: number;
  /** Đã nhận thực tế (cọc + trả thêm, webhook cộng dồn). */
  paidAmount?: number;
  /** Còn lại = total − paidAmount (BE tính, read-only). */
  remaining?: number;
  shippingCost?: number;
  /** Cache shipping info từ AddressMapInput — tránh fetch SerpApi khi edit */
  shipInfo?: {
    distanceKm?: number;
    distanceDisplay?: string;
    destLat?: number;
    destLng?: number;
    pickedAddress?: string;
  };
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  deliveryType?: DeliveryType;
  /** Order theo bàn (dine-in): id bàn đang gắn. */
  tableId?: string | null;
  /** Số khách ngồi bàn. */
  guestCount?: number | null;
  /** Giờ vào (ISO) — set khi mở bàn. */
  seatedAt?: string | null;
  /** Giờ ra (ISO) — set khi đóng bàn; null = đang ngồi. */
  leftAt?: string | null;
  date: string;
  orderDate?: any;
  deliveryDate?: string;
  deliveryTime?: string;
  trackingNumber?: string;
  /** Link tra cứu vận đơn (3PL) — bấm để xem trạng thái mới nhất. */
  trackingLink?: string;
  /** Trạng thái vận chuyển từ file 3PL (đồng bộ lúc upload). */
  trackingStatus?: string;
  note?: string;
  /** ISO thời điểm in bill cho khách gần nhất — undefined/null = chưa in. */
  billPrintedAt?: string | null;
  createdByUid?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: any;
  updatedAt?: any;
  history?: OrderHistoryEntry[];
  isTest?: boolean;
  commissionAmount?: number;
  commissionStatus?: 'pending' | 'paid';
  commissionPaidAt?: string;
  badgeIds?: string[];
  cancelReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  refundedAt?: string;
  refundedAmount?: number;
  refundReason?: string;
  refundedBy?: string;
  /** Lịch sử hoàn tiền (mới→cũ) — mỗi lần giảm SL trên đơn PAID sinh 1 bản ghi. */
  refunds?: OrderRefund[];
  // ── Địa chỉ SPX đã "làm mịn" (resolve 1 lần lúc tạo/sửa → xuất tái dùng) ──
  /** Tỉnh chuẩn danh mục SPX cũ (vd "HÀ NỘI", "TP. HỒ CHÍ MINH"). */
  spxState?: string | null;
  /** Quận/Huyện chuẩn danh mục SPX cũ. */
  spxCity?: string | null;
  /** Xã/Phường chuẩn danh mục SPX cũ. */
  spxWard?: string | null;
  /** Địa chỉ chi tiết (số nhà + đường) — mặc định = address gốc. */
  spxDetail?: string | null;
  /** Trạng thái làm mịn: đủ 3 cấp / thiếu / chưa khớp. */
  spxStatus?: SpxAddressStatus | null;
  /** true = user đã sửa tay → auto-resolve KHÔNG ghi đè. */
  spxManual?: boolean;
  /** Snapshot địa chỉ gốc đã resolve — đổi thì mới chạy lại. */
  spxSource?: string | null;
  /** ISO thời điểm resolve gần nhất. */
  spxResolvedAt?: string | null;
  // ── ĐVVC đã gửi (danh bạ carriers) — để thống kê số đơn theo hãng ──
  /** id hãng vận chuyển (carriers.id) đơn được gửi qua. */
  carrierId?: string | null;
  /** Tên hãng vận chuyển (BE join sẵn, chỉ để hiển thị). */
  carrierName?: string | null;
  /** Tuyến của nhà xe đơn đi (vd "Huế → Hải Phòng") — chỉ với ĐVVC dạng coach. */
  carrierRoute?: string | null;
  /** Văn phòng nhận của nhà xe (vd "VP1 Hà Nội") — chỉ với ĐVVC dạng coach. */
  carrierOffice?: string | null;
}

/** Trạng thái "làm mịn" địa chỉ SPX của đơn. */
export type SpxAddressStatus = 'matched' | 'partial' | 'unmatched';

export const SPX_ADDRESS_STATUSES: { value: SpxAddressStatus; label: string }[] = [
  { value: 'matched', label: 'Địa chỉ mịn' },
  { value: 'partial', label: 'Thiếu một phần' },
  { value: 'unmatched', label: 'Chưa khớp' },
];

/** Nhãn hiển thị trạng thái làm mịn địa chỉ (types-convention). */
export const spxAddressStatusLabel = (s?: SpxAddressStatus | null): string =>
  SPX_ADDRESS_STATUSES.find((x) => x.value === s)?.label ?? 'Chưa làm mịn';

/** Tên khách mặc định cho đơn khách vãng lai (khách không để lại tên/SĐT). */
export const WALK_IN_CUSTOMER_NAME = 'Khách vãng lai';

/** Đơn khách vãng lai: tên đúng bằng nhãn mặc định + không có SĐT. */
export const isWalkInCustomer = (name?: string | null, phone?: string | null): boolean =>
  !phone?.trim() && name?.trim() === WALK_IN_CUSTOMER_NAME;
