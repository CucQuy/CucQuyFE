import { apiClient } from '@/services/api/client';
import {
  Transaction,
  ExpenseRule,
  LedgerAccountFlow,
  LedgerResult,
  LedgerSummary,
  LedgerFilters,
  LedgerStatus,
  LedgerTransaction,
  LedgerSeriesPoint,
} from '@/types';
import type { PaymentAccountKind } from '@/types/paymentConfig';

/** Danh sách giao dịch (BE sắp theo ngày giảm dần). */
export const fetchTransactions = async (): Promise<Transaction[]> => {
  const res = await apiClient.get<Transaction[]>('/transactions');
  return res.data;
};

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const LEDGER_STATUSES: LedgerStatus[] = [
  'matched', 'shopee', 'capital', 'sweep_in', 'external', 'unmatched',
  'refund', 'shipping', 'sweep_out', 'settled', 'excluded', 'expense', 'stock', 'test',
];

/** Loại TK từ API — chỉ nhận 2 giá trị hợp lệ, còn lại coi là chưa khai. */
const kindOf = (v: unknown): PaymentAccountKind | null =>
  v === 'hkd' || v === 'personal' ? v : null;

/** Chuẩn hoá 1 dòng sổ trả từ API — coi mọi field untrusted (data-safety). */
const mapLedgerItem = (r: Record<string, unknown>): LedgerTransaction => ({
  id: str(r.id),
  accountNumber: str(r.accountNumber),
  accumulated: num(r.accumulated),
  code: typeof r.code === 'string' ? r.code : null,
  content: str(r.content),
  createdAt: str(r.createdAt),
  description: str(r.description),
  gateway: str(r.gateway),
  orderNumber: str(r.orderNumber),
  receivedAt: str(r.receivedAt),
  referenceCode: str(r.referenceCode),
  sepayId: num(r.sepayId),
  subAccount: str(r.subAccount),
  transactionDate: str(r.transactionDate),
  transferType: r.transferType === 'out' ? 'out' : 'in',
  transferAmount: num(r.transferAmount),
  isExternal: r.isExternal === true,
  settledOut: r.settledOut === true,
  expenseCategory: typeof r.expenseCategory === 'string' ? r.expenseCategory : null,
  costExcluded: r.costExcluded === true,
  needsReview: r.needsReview === true,
  reviewNote: typeof r.reviewNote === 'string' ? r.reviewNote : null,
  status: LEDGER_STATUSES.includes(r.status as LedgerStatus) ? (r.status as LedgerStatus) : 'unmatched',
  accountId: typeof r.accountId === 'string' ? r.accountId : null,
  accountLabel: typeof r.accountLabel === 'string' ? r.accountLabel : null,
  accountKind: kindOf(r.accountKind),
});

/** Chuẩn hoá 1 dòng "dòng tiền theo tài khoản" (byAccount) — mọi field untrusted. */
const mapAccountFlow = (r: Record<string, unknown>): LedgerAccountFlow => ({
  accountId: typeof r.accountId === 'string' ? r.accountId : null,
  label: str(r.label) || 'TK chưa khai',
  bankCode: typeof r.bankCode === 'string' ? r.bankCode : null,
  accountNumber: typeof r.accountNumber === 'string' ? r.accountNumber : null,
  accountHolder: typeof r.accountHolder === 'string' ? r.accountHolder : null,
  kind: kindOf(r.kind),
  in: num(r.in),
  out: num(r.out),
  net: num(r.net),
  sweepIn: num(r.sweepIn),
  sweepOut: num(r.sweepOut),
  count: num(r.count),
});

/** Sổ giao dịch thống nhất: list phân trang + total + summary (thu+chi 1 sổ). */
export const fetchLedger = async (filters: LedgerFilters): Promise<LedgerResult> => {
  const res = await apiClient.get<{
    items?: unknown[];
    total?: unknown;
    summary?: Record<string, unknown>;
    byAccount?: unknown[];
  }>(
    '/transactions/ledger',
    {
      params: {
        from: filters.from || undefined,
        to: filters.to || undefined,
        type: filters.type || undefined,
        status: filters.status || undefined,
        category: filters.category || undefined,
        gateway: filters.gateway || undefined,
        account: filters.account || undefined,
        search: filters.search || undefined,
        limit: filters.limit,
        offset: filters.offset,
      },
    },
  );
  const d = res.data ?? {};
  const s = (d.summary ?? {}) as Record<string, unknown>;
  const summary: LedgerSummary = {
    totalIn: num(s.totalIn),
    totalOut: num(s.totalOut),
    net: num(s.net),
    sweepIn: num(s.sweepIn),
    sweepOut: num(s.sweepOut),
    externalIn: num(s.externalIn),
    externalOut: num(s.externalOut),
    netExternal: num(s.netExternal),
    count: num(s.count),
    inCount: num(s.inCount),
    outCount: num(s.outCount),
    reconciledCount: num(s.reconciledCount),
    unreconciledCount: num(s.unreconciledCount),
    reconciledPct: num(s.reconciledPct),
  };
  return {
    items: Array.isArray(d.items) ? d.items.map((it) => mapLedgerItem((it ?? {}) as Record<string, unknown>)) : [],
    total: num(d.total),
    summary,
    byAccount: Array.isArray(d.byAccount)
      ? d.byAccount.map((a) => mapAccountFlow((a ?? {}) as Record<string, unknown>))
      : [],
  };
};

/** Chuỗi thu/chi theo ngày trong kỳ (biểu đồ sổ). */
export const fetchLedgerSeries = async (
  fromISO: string,
  toISO: string,
): Promise<LedgerSeriesPoint[]> => {
  const res = await apiClient.get<unknown[]>('/transactions/ledger/series', {
    params: { from: fromISO || undefined, to: toISO || undefined },
  });
  return Array.isArray(res.data)
    ? res.data.map((raw) => {
        const p = (raw ?? {}) as Record<string, unknown>;
        return { day: str(p.day), in: num(p.in), out: num(p.out) };
      })
    : [];
};

/** Set tay phân loại chi phí cho 1 giao dịch (category + cờ loại khỏi chi phí). */
export const setTransactionExpense = async (
  transactionId: string,
  category: string | null,
  excluded: boolean,
  note?: string | null,
): Promise<void> => {
  await apiClient.patch(`/transactions/${transactionId}/expense`, { category, excluded, note: note ?? null });
};

/**
 * Đánh dấu / gỡ 1 giao dịch TIỀN VÀO là "Cấp vốn" (chủ bơm vốn — không phải doanh thu).
 * Tái dùng cột expense_category (value 'capital') — BE derive status 'capital'.
 */
export const markTransactionCapital = async (
  transactionId: string,
  isCapital: boolean,
): Promise<void> => {
  await setTransactionExpense(transactionId, isCapital ? 'capital' : null, false);
};

/**
 * Đánh dấu / gỡ đánh dấu 1 giao dịch TIỀN VÀO là "Shopee thanh toán".
 * Tái dùng cột expense_category (value 'shopee') — BE derive status 'shopee'.
 * Gỡ: set null (nếu nội dung CK vẫn chứa "shopee" thì BE tự nhận lại — auto-detect).
 */
export const markTransactionShopee = async (
  transactionId: string,
  isShopee: boolean,
): Promise<void> => {
  await setTransactionExpense(transactionId, isShopee ? 'shopee' : null, false);
};

/** Danh sách rule phân loại chi phí (nội dung CK → category). */
export const fetchExpenseRules = async (): Promise<ExpenseRule[]> => {
  const res = await apiClient.get<ExpenseRule[]>('/transactions/expense-rules');
  return Array.isArray(res.data) ? res.data : [];
};

/** Thay toàn bộ rule; trả list mới. */
export const saveExpenseRules = async (
  items: { keyword: string; category: string }[],
): Promise<ExpenseRule[]> => {
  const res = await apiClient.put<ExpenseRule[]>('/transactions/expense-rules', { items });
  return Array.isArray(res.data) ? res.data : [];
};

/** Auto phân loại bank-out theo rule; trả số bản ghi đã gán. */
export const applyExpenseRules = async (): Promise<number> => {
  const res = await apiClient.post<{ classified: number }>('/transactions/expense/apply-rules');
  return typeof res.data?.classified === 'number' ? res.data.classified : 0;
};

/** Tổng hợp chi phí (OPEX) theo category trong kỳ. */
export const fetchExpenseSummary = async (
  fromISO: string,
  toISO: string,
): Promise<{ category: string; amount: number }[]> => {
  const res = await apiClient.get<{ category: string; amount: number }[]>('/transactions/expense-summary', {
    params: { from: fromISO, to: toISO },
  });
  return Array.isArray(res.data)
    ? res.data.map((x) => ({ category: String(x.category), amount: typeof x.amount === 'number' ? x.amount : 0 }))
    : [];
};

/** Bank-out trong kỳ (kèm phân loại) — màn Chi phí vận hành. */
export const fetchExpenseOut = async (fromISO: string, toISO: string): Promise<Transaction[]> => {
  const res = await apiClient.get<Transaction[]>('/transactions/expense-out', {
    params: { from: fromISO, to: toISO },
  });
  return Array.isArray(res.data) ? res.data : [];
};

/** Đánh dấu giao dịch là không liên quan đến hệ thống (hoặc bỏ đánh dấu). */
export const markTransactionExternal = async (
  transactionId: string,
  isExternal: boolean,
): Promise<void> => {
  await apiClient.patch(`/transactions/${transactionId}/external`, { isExternal });
};

/** Liên kết giao dịch với 1 đơn: ghi orderNumber xuống transaction để khớp đối soát.
 *  Truyền orderNumber rỗng để gỡ liên kết. */
export const linkTransactionOrder = async (
  transactionId: string,
  orderNumber: string,
): Promise<void> => {
  await apiClient.patch(`/transactions/${transactionId}/link`, { orderNumber });
};

/** Giao dịch SePay tiền ra (transferType='out') CHƯA gắn phiếu hoàn nào —
 *  để chọn khi đối soát phiếu hoàn (#186). BE sắp theo ngày giảm dần. */
export const fetchOutUnlinkedTransactions = async (): Promise<Transaction[]> => {
  const res = await apiClient.get<Transaction[]>('/transactions/out-unlinked');
  return res.data;
};

export const fetchTransactionsByOrderNumber = async (
  orderNumber: string,
): Promise<Transaction[]> => {
  const res = await apiClient.get<Transaction[]>('/transactions/by-order', {
    params: { orderNumber },
  });
  return res.data;
};

/* ───────────────────────── Đối soát hàng loạt ─────────────────────────── */

/** 1 cặp GD↔đơn khớp tự động (BE trả ở preview). */
export interface ReconcileMatch {
  transactionId: string;
  sepayId: number;
  orderId: string;
  orderNumber: string;
  amount: number;
  transactionDate: string;
  orderCreatedAt: string;
}

export interface ReconcilePreviewResult {
  /** Các cặp GD↔đơn khớp DUY NHẤT (sẽ ghi nếu user confirm). */
  matched: ReconcileMatch[];
  /** GD có ≥2 đơn ứng viên / tranh chấp → bỏ qua, khớp tay. */
  skippedAmbiguous: number;
  /** GD không tìm được đơn nào khớp. */
  skippedNoMatch: number;
  /** Tổng GD chưa khớp đã quét. */
  totalUnmatched: number;
}

/** Preview (dry-run): quét toàn bộ GD chưa khớp → trả các cặp sẽ map. KHÔNG ghi. */
export const reconcileTransactionsPreview = async (): Promise<ReconcilePreviewResult> => {
  const res = await apiClient.post<ReconcilePreviewResult>('/transactions/reconcile/preview');
  return res.data;
};

/** Apply: ghi map cho danh sách cặp user đã confirm (BE atomic + idempotent). */
export const reconcileTransactionsApply = async (
  pairs: ReconcileMatch[],
): Promise<{ applied: number; skipped: number }> => {
  const res = await apiClient.post<{ applied: number; skipped: number }>(
    '/transactions/reconcile/apply',
    { pairs },
  );
  return res.data;
};

// ── Đối soát CHI PHÍ: tiền RA ↔ chi phí thủ công (chống đếm trùng) ──

/** 1 cặp GD tiền-ra ↔ chi phí tay khớp tự động (từ preview). */
export interface ExpenseReconcileMatch {
  transactionId: string;
  expenseId: string;
  amount: number;
  transactionDate: string;
  expenseDate: string;
  category: string | null;
  note: string | null;
  description: string | null;
}

export interface ExpenseReconcilePreviewResult {
  /** Các cặp tiền-ra ↔ chi phí khớp DUY NHẤT (số tiền + gần ngày). */
  matched: ExpenseReconcileMatch[];
  /** GD có ≥2 chi phí ứng viên / tranh chấp → bỏ qua, khớp tay. */
  skippedAmbiguous: number;
  /** GD không tìm được chi phí nào khớp. */
  skippedNoMatch: number;
  /** Tổng GD tiền-ra chưa gắn đã quét. */
  totalUnlinkedTx: number;
  /** Tổng khoản chi tay chưa gắn. */
  totalUnlinkedExpense: number;
}

/** Preview (dry-run): gợi ý cặp tiền-ra ↔ chi phí tay theo số tiền + ngày. KHÔNG ghi. */
export const expenseReconcilePreview = async (): Promise<ExpenseReconcilePreviewResult> => {
  const res = await apiClient.post<ExpenseReconcilePreviewResult>(
    '/transactions/expense-reconcile/preview',
  );
  return res.data;
};

/** Apply: gắn danh sách cặp user đã confirm (BE atomic + idempotent). */
export const expenseReconcileApply = async (
  pairs: { transactionId: string; expenseId: string }[],
): Promise<{ applied: number; skipped: number }> => {
  const res = await apiClient.post<{ applied: number; skipped: number }>(
    '/transactions/expense-reconcile/apply',
    { pairs },
  );
  return res.data;
};

/** Khớp tay 1 GD tiền-ra với 1 khoản chi phí có sẵn. */
export const linkTransactionExpense = async (
  transactionId: string,
  expenseId: string,
): Promise<{ ok: boolean }> => {
  const res = await apiClient.post<{ ok: boolean }>(
    `/transactions/${transactionId}/expense-link`,
    { expenseId },
  );
  return res.data;
};

/** Bỏ khớp khoản chi khỏi 1 GD tiền-ra (quay lại tính OPEX auto). */
export const unlinkTransactionExpense = async (
  transactionId: string,
): Promise<{ unlinked: number }> => {
  const res = await apiClient.delete<{ unlinked: number }>(
    `/transactions/${transactionId}/expense-link`,
  );
  return res.data;
};

// ─── Rải 1 GD tiền-ra ↔ NHIỀU phiếu nhập (transaction-first, quan hệ n:n) ─────

/** 1 phiếu GD tiền-ra đang gắn (kèm alloc id để gỡ). */
export interface TxReceiptAllocation {
  id: string;
  receiptId: string;
  amount: number;
  receiptTotal: number | null;
  receiptDate: string | null;
  supplier: string | null;
  invoice: string | null;
  receiptReconciled: boolean;
}

/** 1 phiếu ứng viên để rải. */
export interface TxReceiptCandidate {
  receiptId: string;
  total: number | null;
  paid: number;
  remaining: number;
  receiptDate: string | null;
  supplier: string | null;
  invoice: string | null;
}

/** Tổng hợp rải 1 GD tiền-ra ↔ nhiều phiếu nhập. */
export interface TxReceiptAllocSummary {
  transactionId: string;
  txAmount: number;
  allocated: number;
  remaining: number;
  allocations: TxReceiptAllocation[];
  candidates: TxReceiptCandidate[];
}

const numN = (v: unknown): number | null =>
  v == null ? null : typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0;

/** Chuẩn hoá summary trả từ API — coi mọi field untrusted (data-safety). */
const mapTxReceiptAllocSummary = (r: unknown): TxReceiptAllocSummary => {
  const o = (r ?? {}) as Record<string, unknown>;
  const arr = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
  return {
    transactionId: str(o.transactionId),
    txAmount: num(o.txAmount),
    allocated: num(o.allocated),
    remaining: num(o.remaining),
    allocations: arr(o.allocations).map((a) => ({
      id: str(a.id),
      receiptId: str(a.receiptId),
      amount: num(a.amount),
      receiptTotal: numN(a.receiptTotal),
      receiptDate: typeof a.receiptDate === 'string' ? a.receiptDate : null,
      supplier: typeof a.supplier === 'string' ? a.supplier : null,
      invoice: typeof a.invoice === 'string' ? a.invoice : null,
      receiptReconciled: a.receiptReconciled === true,
    })),
    candidates: arr(o.candidates).map((c) => ({
      receiptId: str(c.receiptId),
      total: numN(c.total),
      paid: num(c.paid),
      remaining: num(c.remaining),
      receiptDate: typeof c.receiptDate === 'string' ? c.receiptDate : null,
      supplier: typeof c.supplier === 'string' ? c.supplier : null,
      invoice: typeof c.invoice === 'string' ? c.invoice : null,
    })),
  };
};

/** Summary rải 1 GD tiền-ra ↔ nhiều phiếu (đã gắn + phiếu ứng viên). */
export const fetchTxReceiptAllocations = async (
  transactionId: string,
): Promise<TxReceiptAllocSummary> => {
  const res = await apiClient.get<unknown>(`/transactions/${transactionId}/receipt-allocations`);
  return mapTxReceiptAllocSummary(res.data);
};

/** Rải 1 GD tiền-ra vào NHIỀU phiếu 1 lượt (amount rỗng = auto = còn nợ phiếu). */
export const addTxReceiptAllocations = async (
  transactionId: string,
  items: { receiptId: string; amount?: number | null }[],
): Promise<TxReceiptAllocSummary> => {
  const res = await apiClient.post<unknown>(
    `/transactions/${transactionId}/receipt-allocations`,
    { items },
  );
  return mapTxReceiptAllocSummary(res.data);
};

/** Gỡ 1 phân bổ GD↔phiếu (theo alloc id) → trả summary GD mới. */
export const removeTxReceiptAllocation = async (
  allocId: string,
): Promise<TxReceiptAllocSummary> => {
  const res = await apiClient.delete<unknown>(`/transactions/receipt-allocations/${allocId}`);
  return mapTxReceiptAllocSummary(res.data);
};

/* ───────── Đối soát tay: ứng viên đơn (tiền vào) + thanh toán ship (tiền ra) ───────── */

/** 1 đơn ứng viên để khớp 1 GD tiền vào (BE tính điều kiện chặt: tổng/còn thiếu/cọc, ~10 ngày). */
export interface InCandidateOrder {
  orderId: string;
  orderNumber: string | null;
  customer: string | null;
  total: number | null;
  paid: number;
  remaining: number;
  deposit: number;
  status: string | null;
  paymentStatus: string | null;
  createdAt: string | null;
  match: 'total' | 'remaining' | 'deposit' | null;
}

/** Ứng viên đơn cho 1 GD tiền vào. Type-guard từng field (untrusted). */
export const fetchInCandidateOrders = async (transactionId: string): Promise<InCandidateOrder[]> => {
  const res = await apiClient.get<unknown>(`/transactions/${transactionId}/in-candidate-orders`);
  const arr = Array.isArray(res.data) ? res.data : [];
  const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
  return arr.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const m = o.match;
    return {
      orderId: typeof o.orderId === 'string' ? o.orderId : '',
      orderNumber: typeof o.orderNumber === 'string' ? o.orderNumber : null,
      customer: typeof o.customer === 'string' ? o.customer : null,
      total: o.total == null ? null : num(o.total),
      paid: num(o.paid),
      remaining: num(o.remaining),
      deposit: num(o.deposit),
      status: typeof o.status === 'string' ? o.status : null,
      paymentStatus: typeof o.paymentStatus === 'string' ? o.paymentStatus : null,
      createdAt: typeof o.createdAt === 'string' ? o.createdAt : null,
      match: m === 'total' || m === 'remaining' || m === 'deposit' ? m : null,
    };
  });
};

/** Thanh toán ship đang gắn với 1 GD tiền ra (đơn hoặc nhà xe). */
export interface ShippingPayment {
  id: string;
  amount: number;
  note: string | null;
  orderId: string | null;
  orderNumber: string | null;
  customer: string | null;
  carrierId: string | null;
  carrierName: string | null;
}
export interface ShippingPaymentSummary {
  transactionId: string;
  txAmount: number;
  payment: ShippingPayment | null;
}

const mapShipping = (data: unknown): ShippingPaymentSummary => {
  const o = (data ?? {}) as Record<string, unknown>;
  const p = o.payment as Record<string, unknown> | null | undefined;
  const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
  const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
  return {
    transactionId: typeof o.transactionId === 'string' ? o.transactionId : '',
    txAmount: num(o.txAmount),
    payment: p
      ? {
          id: typeof p.id === 'string' ? p.id : '',
          amount: num(p.amount),
          note: str(p.note),
          orderId: str(p.orderId),
          orderNumber: str(p.orderNumber),
          customer: str(p.customer),
          carrierId: str(p.carrierId),
          carrierName: str(p.carrierName),
        }
      : null,
  };
};

/** Link ship hiện tại của 1 GD tiền ra. */
export const fetchTxShipping = async (transactionId: string): Promise<ShippingPaymentSummary> => {
  const res = await apiClient.get<unknown>(`/transactions/${transactionId}/shipping`);
  return mapShipping(res.data);
};

/** Gắn ship (đơn / nhà xe) cho 1 GD tiền ra → trả link mới. */
export const setTxShipping = async (
  transactionId: string,
  input: { orderId?: string; carrierId?: string; amount?: number; note?: string },
): Promise<ShippingPaymentSummary> => {
  const res = await apiClient.post<unknown>(`/transactions/${transactionId}/shipping`, input);
  return mapShipping(res.data);
};

/** Gỡ ship khỏi 1 GD tiền ra. */
export const removeTxShipping = async (transactionId: string): Promise<{ unlinked: number }> => {
  const res = await apiClient.delete<{ unlinked?: number }>(`/transactions/${transactionId}/shipping`);
  return { unlinked: Number(res.data?.unlinked) || 0 };
};

// ── Đối soát TỰ ĐỘNG (gộp 3 loại, theo kỳ đang xem trên màn Sổ) ──

/** 1 cặp gợi ý: GD tiền VÀO ↔ đơn hàng. */
export interface AutoReconcileInOrder {
  transactionId: string;
  sepayId: number | string;
  orderId: string;
  orderNumber: string;
  customer: string;
  orderTotal: number;
  amount: number;
  transactionDate: string | null;
  orderCreatedAt: string | null;
  description: string;
}

/** 1 cặp gợi ý: GD tiền RA ↔ phiếu nhập kho. */
export interface AutoReconcileOutReceipt {
  transactionId: string;
  receiptId: string;
  amount: number;
  transactionDate: string | null;
  receiptDate: string | null;
  receiptTotal: number;
  receiptRemaining: number;
  supplier: string;
  invoice: string;
  description: string;
}

/** 1 cặp gợi ý: GD tiền RA ↔ khoản chi nhập tay. */
export interface AutoReconcileOutExpense {
  transactionId: string;
  expenseId: string;
  amount: number;
  transactionDate: string | null;
  expenseDate: string | null;
  category: string | null;
  note: string;
  description: string;
}

export interface AutoReconcilePreviewResult {
  inOrders: AutoReconcileInOrder[];
  outReceipts: AutoReconcileOutReceipt[];
  outExpenses: AutoReconcileOutExpense[];
  counts: {
    unmatchedIn: number;
    unmatchedOut: number;
    /** Có ứng viên nhưng không 1–1 → phải đối soát tay. */
    ambiguousIn: number;
    ambiguousOut: number;
    /** GD ra khớp CẢ phiếu nhập lẫn chi phí tay → bỏ qua để khỏi đếm trùng chi phí. */
    conflictOut: number;
  };
}

export interface AutoReconcileApplyResult {
  inOrders: { applied: number; skipped: number };
  outReceipts: { applied: number; skipped: number };
  outExpenses: { applied: number; skipped: number };
  applied: number;
  skipped: number;
}

const autoInOrder = (r: Record<string, unknown>): AutoReconcileInOrder => ({
  transactionId: str(r.transactionId),
  sepayId: typeof r.sepayId === 'number' || typeof r.sepayId === 'string' ? r.sepayId : '',
  orderId: str(r.orderId),
  orderNumber: str(r.orderNumber),
  customer: str(r.customer),
  orderTotal: num(r.orderTotal),
  amount: num(r.amount),
  transactionDate: typeof r.transactionDate === 'string' ? r.transactionDate : null,
  orderCreatedAt: typeof r.orderCreatedAt === 'string' ? r.orderCreatedAt : null,
  description: str(r.description),
});

const autoOutReceipt = (r: Record<string, unknown>): AutoReconcileOutReceipt => ({
  transactionId: str(r.transactionId),
  receiptId: str(r.receiptId),
  amount: num(r.amount),
  transactionDate: typeof r.transactionDate === 'string' ? r.transactionDate : null,
  receiptDate: typeof r.receiptDate === 'string' ? r.receiptDate : null,
  receiptTotal: num(r.receiptTotal),
  receiptRemaining: num(r.receiptRemaining),
  supplier: str(r.supplier),
  invoice: str(r.invoice),
  description: str(r.description),
});

const autoOutExpense = (r: Record<string, unknown>): AutoReconcileOutExpense => ({
  transactionId: str(r.transactionId),
  expenseId: str(r.expenseId),
  amount: num(r.amount),
  transactionDate: typeof r.transactionDate === 'string' ? r.transactionDate : null,
  expenseDate: typeof r.expenseDate === 'string' ? r.expenseDate : null,
  category: typeof r.category === 'string' ? r.category : null,
  note: str(r.note),
  description: str(r.description),
});

/**
 * Preview (dry-run) đối soát tự động cho khoảng ngày đang xem. KHÔNG ghi gì —
 * chỉ trả các cặp CHẮC CHẮN (1–1) để user duyệt trước.
 */
export const autoReconcilePreview = async (
  from: string,
  to: string,
): Promise<AutoReconcilePreviewResult> => {
  const res = await apiClient.post('/transactions/auto-reconcile/preview', { from, to });
  const d = (res.data ?? {}) as Record<string, unknown>;
  const rows = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
  const c = (d.counts ?? {}) as Record<string, unknown>;
  return {
    inOrders: rows(d.inOrders).map(autoInOrder),
    outReceipts: rows(d.outReceipts).map(autoOutReceipt),
    outExpenses: rows(d.outExpenses).map(autoOutExpense),
    counts: {
      unmatchedIn: num(c.unmatchedIn),
      unmatchedOut: num(c.unmatchedOut),
      ambiguousIn: num(c.ambiguousIn),
      ambiguousOut: num(c.ambiguousOut),
      conflictOut: num(c.conflictOut),
    },
  };
};

/** Apply: ghi các cặp user còn tick ở modal (BE atomic + idempotent). */
export const autoReconcileApply = async (payload: {
  inOrders: AutoReconcileInOrder[];
  outReceipts: AutoReconcileOutReceipt[];
  outExpenses: AutoReconcileOutExpense[];
}): Promise<AutoReconcileApplyResult> => {
  const res = await apiClient.post('/transactions/auto-reconcile/apply', {
    // Chỉ gửi field BE cần — payload gọn, và không lỡ đẩy dữ liệu hiển thị lên server.
    inOrders: payload.inOrders.map((m) => ({
      transactionId: m.transactionId,
      orderId: m.orderId,
      orderNumber: m.orderNumber,
      sepayId: m.sepayId,
    })),
    outReceipts: payload.outReceipts.map((m) => ({
      transactionId: m.transactionId,
      receiptId: m.receiptId,
      amount: m.amount,
    })),
    outExpenses: payload.outExpenses.map((m) => ({
      transactionId: m.transactionId,
      expenseId: m.expenseId,
    })),
  });
  const d = (res.data ?? {}) as Record<string, unknown>;
  const part = (v: unknown) => {
    const o = (v ?? {}) as Record<string, unknown>;
    return { applied: num(o.applied), skipped: num(o.skipped) };
  };
  return {
    inOrders: part(d.inOrders),
    outReceipts: part(d.outReceipts),
    outExpenses: part(d.outExpenses),
    applied: num(d.applied),
    skipped: num(d.skipped),
  };
};
