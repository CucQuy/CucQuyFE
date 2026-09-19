import { DeliveryType, PaymentMethod, PaymentStatus } from './enums';

/** 1 món AI đọc được từ ảnh khách đặt (đã cố khớp với danh mục sản phẩm). */
export interface AiOrderItem {
  /** Id sản phẩm khớp danh mục; null = AI không chắc, user tự chọn trong form. */
  productId: string | null;
  /** Tên món như khách viết trên ảnh. */
  productName: string;
  quantity: number;
  /** Tên size khớp danh mục của SP đó (null nếu không có / không rõ). */
  size: string | null;
  flavors: string[];
  /** Giá 1 đơn vị khách chốt trên ảnh; null → dùng giá bảng. */
  unitPrice: number | null;
  note: string | null;
}

/** Kết quả quét ảnh đơn bằng AI — dữ liệu gợi ý điền sẵn form tạo đơn. */
export interface AiOrderExtracted {
  customerName: string | null;
  phone: string | null;
  address: string | null;
  /** yyyy-mm-dd */
  deliveryDate: string | null;
  /** HH:mm */
  deliveryTime: string | null;
  deliveryType: DeliveryType | null;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus | null;
  /** VND */
  depositAmount: number | null;
  /** VND */
  shippingCost: number | null;
  note: string | null;
  items: AiOrderItem[];
  /** 0..1 — dưới 0.5 nên nhắc user soát kỹ. */
  confidence: number;
  /** Chỗ AI đoán / không đọc được (tiếng Việt). */
  warningsVi: string[];
}
