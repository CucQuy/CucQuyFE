/**
 * Payment account types + helpers.
 * Mô hình: danh sách TK ngân hàng, LOẠI (`kind`) vừa là nhãn vừa là lựa chọn — mỗi loại
 * thật CHỈ ĐÚNG 1 tài khoản:
 *   - `hkd`      — TK hộ kinh doanh (1): khách CK vào đây, mọi QR đơn dùng TK này.
 *   - `personal` — TK cá nhân (1): cuối ngày TK HKD dồn hết tiền sang, rồi chi hoá đơn
 *                  (NCC / ship / vận hành) từ đây → đối soát tiền ra ở TK cá nhân.
 *   - `none`     — không dùng: TK cũ giữ lại trong danh sách để tra cứu.
 * Runtime data lưu ở BE (`/configurations/payment-accounts`), truy cập qua
 * `usePaymentAccounts()` ở components. File này chỉ chứa types + helper thuần.
 */

/** Template QR của SePay (VietQR). */
export type QrTemplate = 'compact' | 'compact2' | 'qr_only' | 'print';

/** Loại tài khoản: hộ kinh doanh / cá nhân / không dùng. */
export type PaymentAccountKind = 'hkd' | 'personal' | 'none';

/** Lựa chọn loại tài khoản cho dropdown cấu hình (chọn loại = chọn tài khoản). */
export const PAYMENT_ACCOUNT_KINDS: {
  value: PaymentAccountKind;
  label: string;
  hint: string;
}[] = [
  {
    value: 'hkd',
    label: 'TK hộ kinh doanh',
    hint: 'Khách CK vào TK này (QR đơn). Cuối ngày dồn tiền sang TK cá nhân.',
  },
  {
    value: 'personal',
    label: 'TK cá nhân',
    hint: 'Nhận tiền dồn cuối ngày từ TK HKD, rồi chi các hoá đơn.',
  },
  {
    value: 'none',
    label: 'Không dùng',
    hint: 'Chỉ lưu trong danh sách để tra cứu, không dính vào đơn hay hoá đơn.',
  },
];

/** Helper lookup nhãn loại TK (thiếu/không rõ → coi như không dùng). */
export const paymentAccountKindLabel = (k?: PaymentAccountKind | string | null): string =>
  PAYMENT_ACCOUNT_KINDS.find((x) => x.value === k)?.label ?? 'Không dùng';

/** 1 tài khoản ngân hàng đã lưu (BE trả về). */
export interface PaymentAccount {
  /** ID bản ghi (BE). */
  id: string;
  /** Mã ngân hàng theo SePay/Napas, vd "BIDV". */
  bankCode: string;
  /** Số tài khoản nhận tiền. */
  accountNumber: string;
  /** Tên chủ tài khoản (in hoa). */
  accountHolder: string;
  /** Template ảnh QR của SePay (mặc định "compact"). */
  qrTemplate: QrTemplate | string;
  /** Suy ra từ kind (kind !== 'none') — BE tự set, FE không đổi trực tiếp. */
  isActive: boolean;
  /**
   * Có GHI NHẬN giao dịch của TK này không. false → webhook SePay bỏ qua hẳn,
   * không lưu giao dịch nào (TK cá nhân/TK cũ không muốn dính vào sổ).
   */
  isTracked?: boolean;
  /** TK hộ kinh doanh / TK cá nhân / không dùng. Thiếu → coi là `none`. */
  kind?: PaymentAccountKind;
  /** Số dư đã chốt tại `openingBalanceAt` (VND). */
  openingBalance?: number;
  /** Thời điểm chốt số dư (ISO); null = cộng dồn từ giao dịch đầu tiên. */
  openingBalanceAt?: string | null;
  /** Số dư hiện tại = số dư chốt + giao dịch sau mốc (BE tính sẵn). */
  balance?: number;
  /** Thời điểm tạo (ISO string từ BE). */
  createdAt?: string;
}

/**
 * Tài khoản nhận tiền dành riêng cho ĐƠN TEST (isTest). QR của đơn test trỏ vào
 * đây thay vì TK thật → tiền vào TK này được BE đánh dấu `is_test` (loại khỏi
 * doanh thu/đối soát) để test thông luồng thanh toán mà không bẩn sổ.
 */
export const TEST_PAYMENT_ACCOUNT: PaymentAccount = {
  id: '__test__',
  bankCode: 'MBBank',
  accountNumber: '0776750418',
  accountHolder: 'TAI KHOAN TEST',
  qrTemplate: 'compact',
  isActive: false,
  isTracked: false,
  kind: 'none',
  openingBalance: 0,
  balance: 0,
};

/** Body khi tạo tài khoản mới (POST). */
export interface CreatePaymentAccountInput {
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  qrTemplate?: string;
  /** Mặc định BE dùng 'none' nếu không gửi. */
  kind?: PaymentAccountKind;
}

/** Lựa chọn template cho dropdown cấu hình. */
export const QR_TEMPLATES: { value: QrTemplate; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'compact2', label: 'Compact 2' },
  { value: 'qr_only', label: 'QR only' },
  { value: 'print', label: 'Print' },
];

/** Helper lookup label template. */
export const qrTemplateLabel = (t: QrTemplate | string): string =>
  QR_TEMPLATES.find((x) => x.value === t)?.label ?? 'Compact';

/**
 * Danh sách ngân hàng SePay/VietQR hỗ trợ.
 * `value` = mã short-name dùng trong URL QR SePay (`bank=`), label = tên hiển thị.
 */
export const SEPAY_BANKS: { value: string; label: string }[] = [
  { value: 'BIDV', label: 'BIDV - Ngân hàng Đầu tư & Phát triển VN' },
  { value: 'VietinBank', label: 'VietinBank - Ngân hàng Công Thương VN' },
  { value: 'Vietcombank', label: 'Vietcombank - Ngân hàng Ngoại Thương VN' },
  { value: 'MBBank', label: 'MBBank - Ngân hàng Quân Đội' },
  { value: 'Techcombank', label: 'Techcombank - Ngân hàng Kỹ Thương VN' },
  { value: 'ACB', label: 'ACB - Ngân hàng Á Châu' },
  { value: 'VPBank', label: 'VPBank - Ngân hàng Việt Nam Thịnh Vượng' },
  { value: 'TPBank', label: 'TPBank - Ngân hàng Tiên Phong' },
  { value: 'Sacombank', label: 'Sacombank - Ngân hàng Sài Gòn Thương Tín' },
  { value: 'Agribank', label: 'Agribank - Ngân hàng Nông nghiệp & PTNT VN' },
  { value: 'VIB', label: 'VIB - Ngân hàng Quốc Tế' },
  { value: 'SHB', label: 'SHB - Ngân hàng Sài Gòn - Hà Nội' },
  { value: 'HDBank', label: 'HDBank - Ngân hàng Phát triển TP.HCM' },
  { value: 'OCB', label: 'OCB - Ngân hàng Phương Đông' },
  { value: 'MSB', label: 'MSB - Ngân hàng Hàng Hải' },
  { value: 'SeABank', label: 'SeABank - Ngân hàng Đông Nam Á' },
];

/** Helper lookup label ngân hàng theo mã. */
export const bankLabel = (code: string): string =>
  SEPAY_BANKS.find((x) => x.value === code)?.label ?? code;

/** Tập mã ngân hàng có sẵn logo (file tĩnh `public/banks/<code>.png`, tải từ VietQR CDN). */
const BANK_LOGO_CODES = new Set(SEPAY_BANKS.map((x) => x.value));

/**
 * Đường dẫn logo ngân hàng (ảnh tĩnh lưu trong `public/banks/`), phục vụ tại `/banks/<code>.png`.
 * Trả `null` nếu mã ngân hàng chưa có logo → caller tự fallback (vd icon mặc định).
 */
export const bankLogo = (code: string): string | null =>
  BANK_LOGO_CODES.has(code) ? `/banks/${code}.png` : null;

/**
 * Parse link QR SePay (vd `https://qr.sepay.vn/img?acc=...&bank=...&template=...`).
 * Nhận full URL hoặc query string; an toàn (try/catch), KHÔNG throw.
 * Trả về phần parse được (`acc`→accountNumber, `bank`→bankCode, `template`→qrTemplate),
 * hoặc `null` nếu không lấy được field nào.
 */
export const parseSepayQrLink = (
  input: string,
): { bankCode?: string; accountNumber?: string; qrTemplate?: string } | null => {
  const raw = (input ?? '').trim();
  if (!raw) return null;

  let params: URLSearchParams | null = null;
  try {
    // Thử parse như URL đầy đủ (kể cả khi thiếu scheme → prepend https://).
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    const u = new URL(hasScheme ? raw : `https://${raw}`);
    params = u.searchParams;
  } catch {
    params = null;
  }

  // Fallback: nếu URL parse không ra (vd chỉ là query string thuần "acc=..&bank=..").
  if (!params || (!params.has('acc') && !params.has('bank') && !params.has('template'))) {
    try {
      const qs = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : raw;
      params = new URLSearchParams(qs);
    } catch {
      return null;
    }
  }

  const acc = params.get('acc')?.trim();
  const bank = params.get('bank')?.trim();
  const template = params.get('template')?.trim();

  const result: { bankCode?: string; accountNumber?: string; qrTemplate?: string } = {};
  if (acc) result.accountNumber = acc;
  if (bank) result.bankCode = bank;
  if (template) result.qrTemplate = template;

  return Object.keys(result).length > 0 ? result : null;
};
