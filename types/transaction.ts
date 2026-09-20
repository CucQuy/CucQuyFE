import type { PaymentAccountKind } from '@/types/paymentConfig';

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
  /** Tiền RA đã "kết toán" — dồn từ TK HKD sang TK cá nhân (đánh dấu thủ công) */
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
  // Dồn tiền cuối ngày TK HKD → TK cá nhân: tiền vẫn trong tiệm, không phải thu/chi.
  { value: 'sweep', label: 'Dồn tiền HKD → cá nhân (không tính)', cost: false },
];

/** Nhãn của các category chỉ dùng cho TIỀN VÀO (không nằm trong dropdown chi phí). */
const IN_CATEGORY_LABELS: Record<string, string> = {
  capital: 'Cấp vốn',
  shopee: 'Shopee thanh toán',
  other_in: 'Thu khác',
};

export const expenseCategoryLabel = (c?: string | null): string =>
  EXPENSE_CATEGORIES.find((x) => x.value === c)?.label
  ?? (c ? (IN_CATEGORY_LABELS[c] ?? 'Khác') : '—');

/**
 * Nhãn tag phân loại cho tiền RA (giống mã đơn của tiền vào).
 * Khác expenseCategoryLabel: giữ nguyên chuỗi free-text (vd "Kết toán SePay (nội bộ)")
 * thay vì gộp về "Khác", và trả '' khi chưa phân loại.
 */
export const expenseCategoryTag = (c?: string | null): string =>
  c && c.trim()
    ? (EXPENSE_CATEGORIES.find((x) => x.value === c)?.label ?? IN_CATEGORY_LABELS[c] ?? c)
    : '';

/**
 * Category thuộc DANH SÁCH CHUẨN của dropdown chi phí (khớp expense_category_is_known_cost ở BE).
 * Chặt hơn expenseCategoryIsCost — hàm kia coi mọi chuỗi lạ (ghi chú gõ tay cũ) là chi phí.
 * Dùng khi cần biết tiền VÀO có phải "thu bù chi phí" không.
 */
export const expenseCategoryIsKnownCost = (c?: string | null): boolean =>
  EXPENSE_CATEGORIES.some((x) => x.value === c && x.cost !== false);

/** Category này có tính vào chi phí quán không (khớp expense_category_is_cost ở BE).
 *  Nhãn riêng của tiền vào (capital/shopee/other_in) cũng KHÔNG phải chi phí. */
export const expenseCategoryIsCost = (c?: string | null): boolean =>
  !!c && !['personal', 'owner', 'internal', 'sweep'].includes(c) && !(c in IN_CATEGORY_LABELS);

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
 *   Tiền vào: matched | shopee | capital | sweep_in | expense_credit | other_in | external | unmatched
 *   Tiền ra:  refund | shipping | sweep_out | settled | excluded | expense | stock | unmatched
 * `sweep_in`/`sweep_out` = 2 đầu của CÙNG 1 cú dồn tiền cuối ngày TK HKD → TK cá nhân
 * (luân chuyển nội bộ, không phải doanh thu/chi phí).
 */
export type LedgerStatus =
  | 'matched' | 'shopee' | 'capital' | 'sweep_in' | 'expense_credit' | 'other_in' | 'external' | 'unmatched'
  | 'refund' | 'shipping' | 'sweep_out' | 'settled' | 'excluded' | 'expense' | 'stock'
  | 'test';

/** 1 dòng sổ = Transaction + trạng thái derive + tài khoản của dòng tiền (100). */
export type LedgerTransaction = Transaction & {
  status: LedgerStatus;
  /** payment_accounts.id khớp GD (null = TK chưa khai trong cấu hình). */
  accountId: string | null;
  /** Nhãn ngắn TK, vd "BIDV ·1308". */
  accountLabel: string | null;
  /** TK hộ kinh doanh hay TK cá nhân. */
  accountKind: PaymentAccountKind | null;
};

/** Dòng tiền của 1 tài khoản trong kỳ — "tiền nào của tài khoản nào" ở mục đối soát. */
export interface LedgerAccountFlow {
  accountId: string | null;
  label: string;
  bankCode: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  kind: PaymentAccountKind | null;
  /** Số dư hiện tại của TK (toàn thời gian, KHÔNG theo kỳ lọc); null nếu TK chưa khai. */
  balance: number | null;
  in: number;  // VND
  out: number; // VND
  net: number; // VND (in − out)
  /** Phần in/out chỉ là dồn tiền nội bộ giữa TK HKD ↔ TK cá nhân. */
  sweepIn: number;
  sweepOut: number;
  count: number;
}

/** Tổng kết kỳ (server tính) — thu/chi/số dư ổn định khi đổi tab loại/trạng thái. */
export interface LedgerSummary {
  totalIn: number;
  totalOut: number;
  net: number;
  /** Phần luân chuyển NỘI BỘ (TK HKD → TK cá nhân) — đã nằm trong totalIn/totalOut. */
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
  /** Số GD theo từng trạng thái trong kỳ (+ khoá 'all') — badge trên dải tab trạng thái. */
  statusCounts: Record<string, number>;
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
  sweep_in: { label: 'Dồn về TK cá nhân', tone: 'blue' },
  expense_credit: { label: 'Thu bù chi phí', tone: 'teal' },
  other_in: { label: 'Thu khác', tone: 'slate' },
  sweep_out: { label: 'Dồn sang TK cá nhân', tone: 'blue' },
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
