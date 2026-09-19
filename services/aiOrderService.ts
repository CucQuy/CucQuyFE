import { apiClient } from '@/services/api/client';
import { compressImageFile } from '@/utils/io/imageCompress';
import { DeliveryType, PaymentMethod, PaymentStatus, Product } from '@/types/index';
import { AiOrderExtracted, AiOrderItem } from '@/types/aiOrder';

/** Số ảnh tối đa 1 lần quét (khớp giới hạn BE). */
export const AI_ORDER_MAX_IMAGES = 4;

const DELIVERY_TYPES = Object.values(DeliveryType) as string[];
const PAYMENT_METHODS = Object.values(PaymentMethod) as string[];
const PAYMENT_STATUSES = Object.values(PaymentStatus) as string[];

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const pick = <T extends string>(v: unknown, allowed: string[]): T | null =>
  typeof v === 'string' && allowed.includes(v) ? (v as T) : null;

const toItem = (raw: unknown): AiOrderItem | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const productName = str(r.productName);
  if (!productName) return null;
  return {
    productId: str(r.productId),
    productName,
    quantity: typeof r.quantity === 'number' && r.quantity > 0 ? Math.round(r.quantity) : 1,
    size: str(r.size),
    flavors: Array.isArray(r.flavors)
      ? r.flavors.filter((f): f is string => typeof f === 'string' && !!f.trim())
      : [],
    unitPrice: num(r.unitPrice),
    note: str(r.note),
  };
};

/** Danh mục rút gọn gửi kèm ảnh để AI map đúng sản phẩm (chỉ SP đang bán). */
const buildCatalog = (products: Product[]) =>
  products
    .filter((p) => p.status === 'active')
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      sizes: p.sizes?.map((s) => s.name),
      flavors: p.flavorVariants?.length
        ? p.flavorVariants.map((f) => f.name)
        : p.flavors,
    }));

/**
 * Quét (tối đa 4) ảnh khách đặt hàng bằng AI → dữ liệu điền sẵn form tạo đơn.
 * Ảnh được nén trước khi gửi (ảnh chat dài giữ 2000px cho chữ nhỏ vẫn đọc được).
 * Vision chạy vài chục giây nên timeout riêng 120s.
 */
export async function extractOrderFromImages(
  files: File[],
  products: Product[],
): Promise<AiOrderExtracted> {
  const images = await Promise.all(
    files.slice(0, AI_ORDER_MAX_IMAGES).map(async (f) => {
      const { base64, mimeType } = await compressImageFile(f, { maxDim: 2000 });
      return { base64, mimeType };
    }),
  );

  const res = await apiClient.post(
    '/ai/extract-order',
    { images, catalog: buildCatalog(products) },
    { timeout: 120000 },
  );
  const d = (res.data ?? {}) as Record<string, unknown>;

  return {
    customerName: str(d.customerName),
    phone: str(d.phone),
    address: str(d.address),
    deliveryDate: str(d.deliveryDate),
    deliveryTime: str(d.deliveryTime),
    deliveryType: pick<DeliveryType>(d.deliveryType, DELIVERY_TYPES),
    paymentMethod: pick<PaymentMethod>(d.paymentMethod, PAYMENT_METHODS),
    paymentStatus: pick<PaymentStatus>(d.paymentStatus, PAYMENT_STATUSES),
    depositAmount: num(d.depositAmount),
    shippingCost: num(d.shippingCost),
    note: str(d.note),
    items: Array.isArray(d.items)
      ? d.items.map(toItem).filter((i): i is AiOrderItem => i !== null)
      : [],
    confidence: typeof d.confidence === 'number' ? d.confidence : 0,
    warningsVi: Array.isArray(d.warningsVi)
      ? d.warningsVi.filter((w): w is string => typeof w === 'string')
      : [],
  };
}
