import { apiClient } from '@/services/api/client';
import { Order, DeliveryType, OrderStatus } from '@/types';
import { getOrderTotal } from '@/utils/order/orderUtils';
import { snapProvince } from '@/utils/order/spxAddressMatch';

/** Định dạng địa chỉ SPX: 'new' = 2 cấp (Tỉnh/Xã), 'old' = 3 cấp (Tỉnh/Quận/Xã). */
export type SpxAddressMode = 'new' | 'old';

/**
 * Sheet "địa chỉ mới" (2 cấp) của SPX nhận tên tỉnh ĐẦY ĐỦ theo danh mục State_list(2) của
 * template hiện hành: "Thành phố Hà Nội", "Tỉnh Lạng Sơn", "Thành phố Hồ Chí Minh".
 * (Template cũ dùng tên bỏ tiền tố — SPX đã đổi lại từ bản 2026-09.)
 * Snap về đúng chuỗi trong SPX_PROVINCES; không khớp thì giữ nguyên để người dùng tự sửa.
 */
export const toSpxProvinceLabel = (s: string): string => snapProvince(s || '') || (s || '').trim();

/**
 * Địa chỉ đã giải sẵn cho 1 đơn (hệ CŨ, giải ở BE): `state` = Tỉnh ("TP. HỒ CHÍ MINH"),
 * `city` = Quận/Huyện, `ward` = Xã/Phường. Khi xuất vào sheet "địa chỉ mới" chỉ dùng state + ward.
 */
export interface ResolvedAddress {
  province?: string;
  state?: string;
  city?: string;
  ward: string;
}

/** Mã vận đơn (ĐVVC) đã bị HUỶ → coi như chưa có mã, cần tạo lại. */
export const isTrackingCancelled = (o: Order): boolean => {
  const s = (o.trackingStatus ?? '').trim().toLowerCase();
  return s.includes('hủy') || s.includes('huỷ') || s.includes('cancel');
};

/**
 * Đơn cần tạo vận đơn SPX: CHỈ giao ship TỈNH, ĐÃ CỌC (đã nhận tiền), chưa huỷ/giao/hoàn ở
 * mức ĐƠN, và (chưa có mã vận đơn HOẶC mã vận đơn đã bị ĐVVC huỷ → cần tạo lại).
 */
export const isSpxShippable = (o: Order): boolean => {
  const isShipProvince = o.deliveryType === DeliveryType.SHIP_PROVINCE;
  const deposited = (Number(o.paidAmount) || 0) > 0; // đã cọc/trả một phần
  const done =
    o.status === OrderStatus.CANCELLED ||
    o.status === OrderStatus.DELIVERED ||
    o.status === OrderStatus.RETURNED;
  return isShipProvince && deposited && !done && (!o.trackingNumber || isTrackingCancelled(o));
};

/** COD cần thu = còn lại = total − đã trả (đơn cọc trước + ship COD). */
export const codRemaining = (o: Order): number =>
  Math.max(0, getOrderTotal(o) - (Number(o.paidAmount) || 0));

/**
 * 1 dòng đơn theo đúng thứ tự cột template SPX. Số tiền (Giá tiền/Giá trị đơn/COD) đều = phần
 * THU HỘ còn lại (đã trừ cọc); đơn không COD dùng tổng. Cột A = MÃ ĐƠN HÀNG (mã đơn shop); Mã KH = SĐT.
 * - mode 'new' (2 cấp): D=Tỉnh, E=Quận/Huyện — sheet "Tạo đơn (địa chỉ mới)" (29 cột).
 * - mode 'old' (3 cấp): D=Tỉnh, E=Quận/Huyện, F=Xã/Phường — sheet "Tạo đơn (địa chỉ cũ)" (30 cột).
 */
const buildRow = (
  o: Order,
  seq: number,
  weightKg: number,
  mode: SpxAddressMode,
  resolved?: ResolvedAddress,
): (string | number)[] => {
  const cod = codRemaining(o);
  const money = cod > 0 ? cod : getOrderTotal(o); // Giá tiền = Giá trị đơn = số thu hộ
  const codFlag = cod > 0 ? 'Y' : 'N';
  const codAmt: string | number = cod > 0 ? cod : '';
  const productName = (o.items || []).map((i) => `${i.name} x${i.quantity}`).join(', ');
  const detailAddress = [o.customer.address, o.customer.city].filter(Boolean).join(', ');
  const name = o.customer.name || '';
  const phone = String(o.customer.phone || '');
  const orderCode = o.orderNumber || String(seq); // Cột A: MÃ ĐƠN HÀNG (mã đơn shop, thay STT)
  const st = resolved?.state ?? '';
  const city = resolved?.city ?? '';
  const ward = resolved?.ward ?? '';

  if (mode === 'old') {
    // 3 cấp — khớp cột sheet "Tạo đơn (địa chỉ cũ)"/example (A..AD, 30 cột).
    return [
      orderCode,      // A Mã đơn hàng (mã đơn shop, thay STT)
      name,           // B Tên
      phone,          // C SĐT
      st,             // D Tỉnh
      city,           // E Quận/Huyện
      ward,           // F Xã/Phường
      detailAddress,  // G Địa chỉ chi tiết
      '',             // H Lưu ý địa chỉ
      '',             // I Mã bưu chính
      productName,    // J Tên sản phẩm
      1,              // K Số lượng
      money,          // L Giá tiền
      weightKg,       // M Tổng cân nặng
      '',             // N Chiều dài
      '',             // O Chiều cao
      '',             // P Chiều rộng
      phone,          // Q Mã khách hàng = SĐT
      money,          // R Giá trị đơn hàng
      'N',            // S Giao hàng một phần
      'N',            // T Cho phép thử
      'Y',            // U Cho xem, không thử
      'N',            // V Thu phí từ chối
      '',             // W Phí từ chối
      codFlag,        // X Thu COD
      codAmt,         // Y Số tiền COD
      'N',            // Z bưu gửi giá trị cao
      'Người gửi trả',// AA Hình thức thanh toán
      o.note || '',   // AB Lưu ý giao hàng
      '',             // AC Nhắc nhở COD (công thức)
      '',             // AD Đủ điều kiện (công thức)
    ];
  }

  // 2 cấp — sheet "Tạo đơn (địa chỉ mới)" (A..AC, 29 cột). Hệ MỚI: D=Tỉnh, E=Phường/Xã (KHÔNG Quận).
  // Tỉnh ghi ĐẦY ĐỦ theo State_list(2) (vd "Thành phố Hà Nội", "Tỉnh Lạng Sơn").
  const province = toSpxProvinceLabel(resolved?.province ?? '');
  return [
    orderCode,      // A Mã đơn hàng (mã đơn shop, thay STT)
    name,           // B Tên
    phone,          // C SĐT
    province,       // D Tỉnh (hệ mới, vd "Thành phố Hà Nội" — ĐẦY ĐỦ tiền tố)
    ward,           // E Phường/Xã (hệ mới, vd "Phường An Đông")
    detailAddress,  // F Địa chỉ chi tiết
    '',             // G Lưu ý địa chỉ
    '',             // H Mã bưu chính
    productName,    // I Tên sản phẩm
    1,              // J Số lượng
    money,          // K Giá tiền
    weightKg,       // L Tổng cân nặng
    '',             // M Chiều dài
    '',             // N Chiều rộng
    '',             // O Chiều cao
    phone,          // P Mã khách hàng = SĐT
    money,          // Q Giá trị đơn hàng
    'N',            // R Giao hàng một phần
    'N',            // S Cho phép thử
    'Y',            // T Cho xem, không thử
    'N',            // U Thu phí từ chối
    '',             // V Phí từ chối
    codFlag,        // W Thu COD
    codAmt,         // X Số tiền COD
    'N',            // Y bưu gửi giá trị cao
    'Người gửi trả',// Z Hình thức thanh toán
    o.note || '',   // AA Lưu ý giao hàng
    '',             // AB Nhắc nhở COD (công thức)
    '',             // AC Đủ điều kiện (công thức)
  ];
};

const MAX_ROWS = 2000;

/**
 * Xuất đơn ra file tạo đơn hàng loạt SPX. FE dựng các DÒNG data (đã có Tỉnh/Xã giải sẵn từ
 * rule-based + AI) rồi gửi BE (`POST /orders/spx-file`) — BE mổ file nền đã upload-OK, nén
 * DEFLATE (<5MB) và trả file .xlsx. Trả về số đơn đã xuất.
 */
export const exportOrdersToSpx = async (
  orders: Order[],
  opts: { weightKg?: number; addressMode?: SpxAddressMode; resolved?: ResolvedAddress[] } = {},
): Promise<number> => {
  const { weightKg = 1, addressMode = 'old', resolved } = opts;
  const list = orders.slice(0, MAX_ROWS);
  const rows = list.map((o, i) => buildRow(o, i + 1, weightKg, addressMode, resolved?.[i]));

  // 'old' → sheet "Tạo đơn (địa chỉ cũ)" (sheet1, 3 cấp); 'new' → "địa chỉ mới" (sheet2, 2 cấp).
  const res = await apiClient.post(
    '/orders/spx-file',
    { rows, addressMode },
    { responseType: 'blob' },
  );

  const blob = res.data as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SPX_TaoDon_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return list.length;
};
