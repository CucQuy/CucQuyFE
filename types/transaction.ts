import type { PaymentAccountPurpose } from '@/types/paymentConfig';

export interface Transaction {
  id: string;
  accountNumber: string;
  accumulated: number;
  code: string | null;
  content: string;
  createdAt: string;
  description: string;
  gateway: string;
  orderNumber: string;
  receivedAt: string;
  referenceCode: string;
  sepayId: number;
  subAccount: string;
  transactionDate: string;
  transferAmount: number;
  transferType: string; // 'in' | 'out'
  /** Giao dịch không liên quan đến hệ thống (đánh dấu thủ công) */
  isExternal?: boolean;
  /** Tiền RA đã "kết toán" — dồn từ TK nhận sang TK chi (đánh dấu thủ công) */
  settledOut?: boolean;
  /** Phân loại chi phí (nội dung CK → category; auto hoặc set tay). */
  expenseCategory?: string | null;
  /** Loại khỏi chi phí (nội bộ / trả NCC đã tính COGS...) — không trừ lợi nhuận. */
  costExcluded?: boolean;
  /** Nhận tiền khớp ≥2 đơn cùng số tiền → webhook không auto-PAID, cần đối soát tay. */
  needsReview?: boolean;
  /** Ghi chú lý do cần đối soát (vd "2 đơn cùng số tiền — cần đối soát thủ công"). */
  reviewNote?: string | null;
}

/** Category chi phí vận hành (union — theo types-convention). */
export type ExpenseCategory =
  | 'rent' | 'utilities' | 'internet' | 'marketing' | 'maintenance' | 'salary' | 'facility'
  | 'supplier' | 'shipping' | 'packaging' | 'other'
  // Nhóm PHI-CHI-PHÍ (cost:false) — KHÔNG tính vào P&L quán khi gán.
  | 'personal' | 'owner' | 'internal' | 'sweep';

/** cost=false → không tính vào chi phí quán (cá nhân/rút vốn/nội bộ). Mặc định coi là chi phí. */
export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; cost?: boolean }[] = [
  { value: 'rent', label: 'Thuê mặt bằng' },
  { value: 'utilities', label: 'Điện nước' },
  { value: 'internet', label: 'Internet/ĐT' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'maintenance', label: 'Bảo trì' },
  { value: 'salary', label: 'Lương' },
  { value: 'facility', label: 'CSVC/Thiết bị' },
  { value: 'supplier', label: 'Trả NCC/Nhập hàng' },
  { value: 'shipping', label: 'Vận chuyển/Ship' },
  { value: 'packaging', label: 'Bao bì/Hộp' },
  { value: 'other', label: 'Khác' },
  { value: 'personal', label: 'Cá nhân (không tính)', cost: false },
  { value: 'owner', label: 'Rút vốn/Rút lời (không tính)', cost: false },
  { value: 'internal', label: 'Nội bộ/Nạp ví (không tính)', cost: false },
  // Dồn tiền cuối ngày TK nhận → TK chi: tiền vẫn trong tiệm, không phải thu/chi.
  { value: 'sweep', label: 'Dồn tiền TK nhận → TK chi (không tính)', cost: false },
];

export const expenseCategoryLabel = (c?: string | null): string =>
  EXPENSE_CATEGORIES.find((x) => x.value === c)?.label ?? (c ? 'Khác' : '—');

/**
 * Nhãn tag phân loại cho tiền RA (giống mã đơn của tiền vào).
 * Khác expenseCategoryLabel: giữ nguyên chuỗi free-text (vd "Kết toán SePay (nội bộ)")
 * thay vì gộp về "Khác", và trả '' khi chưa phân loại.
 */
export const expenseCategoryTag = (c?: string | null): string =>
  c && c.trim() ? (EXPENSE_CATEGORIES.find((x) => x.value === c)?.label ?? c) : '';

/** Category này có tính vào chi phí quán không (khớp expense_category_is_cost ở BE). */
export const expenseCategoryIsCost = (c?: string | null): boolean =>
  !!c && c !== 'personal' && c !== 'owner' && c !== 'internal' && c !== 'sweep';

/** Rule phân loại chi phí (nội dung CK chứa keyword → category). */
export interface ExpenseRule {
  id: string;
  keyword: string;
  category: ExpenseCategory | string;
}

/* ─────────────────── Sổ giao dịch thống nhất (Ledger) ─────────────────── */

/**
 * Trạng thái thống nhất 1 giao dịch — BE derive sẵn (transaction_ledger_status),
 * FE KHÔNG tự ghép từ các cờ rời rạc nữa.
 *   Tiền vào: matched | shopee | capital | sweep_in | external | unmatched
 *   Tiền ra:  refund | shipping | sweep_out | settled | excluded | expense | stock | unmatched
 * `sweep_in`/`sweep_out` = 2 đầu của CÙNG 1 cú dồn tiền cuối ngày TK nhận → TK chi
 * (luân chuyển nội bộ, không phải doanh thu/chi phí).
 */
export type LedgerStatus =
  | 'matched' | 'shopee' | 'capital' | 'sweep_in' | 'external' | 'unmatched'
  | 'refund' | 'shipping' | 'sweep_out' | 'settled' | 'excluded' | 'expense' | 'stock'
  | 'test';

/** 1 dòng sổ = Transaction + trạng thái derive + tài khoản của dòng tiền (099). */
export type LedgerTransaction = Transaction & {
  status: LedgerStatus;
  /** payment_accounts.id khớp GD (null = TK chưa khai trong cấu hình). */
  accountId: string | null;
  /** Nhãn ngắn TK, vd "BIDV ·1308". */
  accountLabel: string | null;
  /** TK nhận tiền khách hay TK chi hoá đơn. */
  accountPurpose: PaymentAccountPurpose | null;
};

/** Dòng tiền của 1 tài khoản trong kỳ — "tiền nào của tài khoản nào" ở mục đối soát. */
export interface LedgerAccountFlow {
  accountId: string | null;
  label: string;
  bankCode: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  purpose: PaymentAccountPurpose | null;
  in: number;  // VND
  out: number; // VND
  net: number; // VND (in − out)
  /** Phần in/out chỉ là dồn tiền nội bộ giữa TK nhận ↔ TK chi. */
  sweepIn: number;
  sweepOut: number;
  count: number;
}

/** Tổng kết kỳ (server tính) — thu/chi/số dư ổn định khi đổi tab loại/trạng thái. */
export interface LedgerSummary {
  totalIn: number;
  totalOut: number;
  net: number;
  /** Phần luân chuyển NỘI BỘ (TK nhận → TK chi) — đã nằm trong totalIn/totalOut. */
  sweepIn: number;
  sweepOut: number;
  /** Thu/chi THỰC với bên ngoài = tổng trừ phần luân chuyển nội bộ. */
  externalIn: number;
  externalOut: number;
  netExternal: number;
  count: number;
  inCount: number;
  outCount: number;
  reconciledCount: number;
  unreconciledCount: number;
  reconciledPct: number;
}

export interface LedgerResult {
  items: LedgerTransaction[];
  total: number;
  summary: LedgerSummary;
  /** Dòng tiền tách theo từng tài khoản trong kỳ. */
  byAccount: LedgerAccountFlow[];
}

/** 1 điểm chuỗi thu/chi theo ngày (biểu đồ sổ). */
export interface LedgerSeriesPoint {
  day: string; // yyyy-mm-dd
  in: number;
  out: number;
}

/** Bộ lọc sổ (gửi lên BE). */
export interface LedgerFilters {
  from?: string;
  to?: string;
  type?: 'in' | 'out' | '';
  status?: LedgerStatus | '';
  category?: string;
  gateway?: string;
  /** payment_accounts.id — chỉ xem dòng tiền của 1 tài khoản. */
  account?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

type Tone = 'emerald' | 'amber' | 'rose' | 'violet' | 'blue' | 'slate' | 'orange' | 'teal' | 'indigo' | 'cyan';

/** Nhãn + tone hiển thị badge cho từng trạng thái sổ. */
export const LEDGER_STATUS_META: Record<LedgerStatus, { label: string; tone: Tone }> = {
  matched: { label: 'Khớp đơn', tone: 'emerald' },
  shopee: { label: 'Shopee thanh toán', tone: 'orange' },
  capital: { label: 'Cấp vốn', tone: 'indigo' },
  sweep_in: { label: 'Dồn về TK chi', tone: 'blue' },
  sweep_out: { label: 'Dồn sang TK chi', tone: 'blue' },
  external: { label: 'Ngoài hệ thống', tone: 'slate' },
  unmatched: { label: 'Chưa khớp', tone: 'amber' },
  refund: { label: 'Hoàn tiền', tone: 'violet' },
  shipping: { label: 'Thanh toán ship', tone: 'cyan' },
  settled: { label: 'Kết toán', tone: 'blue' },
  excluded: { label: 'Không tính', tone: 'slate' },
  expense: { label: 'Chi phí', tone: 'amber' },
  stock: { label: 'Đã gắn phiếu', tone: 'teal' },
  test: { label: 'Giao dịch test', tone: 'rose' },
};

/** Class badge theo tone (light + dark). */
export const LEDGER_TONE_CLASS: Record<Tone, { bg: string; text: string; border: string }> = {
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border border-emerald-200 dark:border-emerald-700' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border border-amber-200 dark:border-amber-700' },
  rose: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-300', border: 'border border-rose-200 dark:border-rose-700' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-300', border: 'border border-violet-200 dark:border-violet-700' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', border: 'border border-blue-200 dark:border-blue-700' },
  slate: { bg: 'bg-slate-100 dark:bg-slate-700/40', text: 'text-slate-600 dark:text-slate-300', border: 'border border-slate-200 dark:border-slate-600' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', border: 'border border-orange-200 dark:border-orange-700' },
  teal: { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-700 dark:text-teal-300', border: 'border border-teal-200 dark:border-teal-700' },
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border border-indigo-200 dark:border-indigo-700' },
  cyan: { bg: 'bg-cyan-50 dark:bg-cyan-900/20', text: 'text-cyan-700 dark:text-cyan-300', border: 'border border-cyan-200 dark:border-cyan-700' },
};
