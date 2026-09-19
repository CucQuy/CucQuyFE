/**
 * React Query hooks cho domain Transactions + Revenue (epic #58 — P7).
 *
 * - queryFn/mutationFn GỌI THẲNG service hiện có (transactionService/revenueService) —
 *   KHÔNG viết lại HTTP, giữ nguyên revive Timestamp ở tầng dưới.
 * - Mọi query `enabled: !!currentUser` để tránh chạy trước khi auth ready → 401.
 * - Sau mutation (markExternal/linkOrder) invalidate `qk.transactions.all`.
 * - KHÔNG nuốt lỗi: caller (component) bắt error / dùng `error` để toast.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Transaction, LedgerFilters, LedgerResult, LedgerSeriesPoint } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { qk } from '@/hooks/queryKeys';
import {
  fetchTransactions,
  fetchTransactionsByOrderNumber,
  fetchLedger,
  fetchLedgerSeries,
  linkTransactionOrder,
  markTransactionExternal,
  reconcileTransactionsPreview,
  reconcileTransactionsApply,
  ReconcileMatch,
  ReconcilePreviewResult,
} from '@/services/transactionService';
import { fetchRevenueReport, RevenueReport } from '@/services/revenueService';

/* ───────────────────────── Transactions ──────────────────────────────── */
export interface UseTransactionsResult {
  transactions: Transaction[];
  loading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

export const useTransactions = (): UseTransactionsResult => {
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: qk.transactions.all,
    queryFn: fetchTransactions,
    enabled: !!currentUser,
  });
  return {
    transactions: query.data ?? [],
    loading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    error: query.error,
    refetch: () => query.refetch(),
  };
};

/* ───────────────────────── Ledger (sổ giao dịch) ─────────────────────── */
export interface UseLedgerResult {
  data: LedgerResult;
  loading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

const EMPTY_LEDGER: LedgerResult = {
  items: [],
  total: 0,
  summary: {
    totalIn: 0, totalOut: 0, net: 0,
    sweepIn: 0, sweepOut: 0, externalIn: 0, externalOut: 0, netExternal: 0,
    count: 0, inCount: 0, outCount: 0,
    reconciledCount: 0, unreconciledCount: 0, reconciledPct: 100,
  },
  byAccount: [],
};

/**
 * Sổ giao dịch thống nhất — list phân trang + summary server-side.
 * placeholderData=keepPreviousData: khi đổi trang/filter, giữ data cũ hiển thị
 * (không nháy loading) tới khi trang mới về.
 *
 * Sổ là màn THEO DÕI (chỉ đọc) và có kèm SỐ DƯ tài khoản → bật tự làm mới 60s một
 * lần + khi quay lại tab, để số dư/giao dịch bám theo webhook SePay mà không phải
 * bấm "Làm mới". Ghi đè mặc định toàn app (refetchOnWindowFocus: false) — mặc định
 * đó đặt ra để form đang nhập không bị refetch đè, không áp dụng cho màn này.
 */
export const useLedger = (filters: LedgerFilters): UseLedgerResult => {
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: qk.transactions.ledger(filters),
    queryFn: () => fetchLedger(filters),
    enabled: !!currentUser,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
  return {
    data: query.data ?? EMPTY_LEDGER,
    loading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => query.refetch(),
  };
};

/** Chuỗi thu/chi theo ngày (biểu đồ sổ) — cùng kỳ với ledger. */
export const useLedgerSeries = (from: string, to: string): { series: LedgerSeriesPoint[]; loading: boolean } => {
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: qk.transactions.ledger({ series: true, from, to }),
    queryFn: () => fetchLedgerSeries(from, to),
    enabled: !!currentUser,
    placeholderData: keepPreviousData,
  });
  return { series: query.data ?? [], loading: query.isLoading };
};

export interface UseTransactionsByOrderResult {
  transactions: Transaction[];
  loading: boolean;
  error: Error | null;
}

export const useTransactionsByOrderNumber = (
  orderNumber: string | undefined,
  enabled = true,
): UseTransactionsByOrderResult => {
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: qk.transactions.byOrderNumber(orderNumber ?? ''),
    queryFn: () => fetchTransactionsByOrderNumber(orderNumber as string),
    enabled: !!orderNumber && !!currentUser && enabled,
  });
  return {
    transactions: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
  };
};

/* ───────────────────────── Mutations ─────────────────────────────────── */
export interface MarkExternalArgs {
  transactionId: string;
  isExternal: boolean;
}

export interface LinkOrderArgs {
  transactionId: string;
  orderNumber: string;
}

export interface UseTransactionMutationsResult {
  markExternal: (args: MarkExternalArgs) => Promise<void>;
  linkOrder: (args: LinkOrderArgs) => Promise<void>;
  /** Đối soát: preview (dry-run) các cặp GD↔đơn sẽ khớp tự động. */
  reconcilePreview: () => Promise<ReconcilePreviewResult>;
  /** Đối soát: ghi map cho danh sách cặp đã confirm. */
  reconcileApply: (pairs: ReconcileMatch[]) => Promise<{ applied: number; skipped: number }>;
}

export const useTransactionMutations = (): UseTransactionMutationsResult => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.transactions.all });
  // Đối soát ghi cả transaction (orderNumber) lẫn đơn (sepayId/PAID) → refresh cả 2 cache.
  const invalidateBoth = () => {
    queryClient.invalidateQueries({ queryKey: qk.transactions.all });
    queryClient.invalidateQueries({ queryKey: qk.orders.all });
  };

  const markExternalMutation = useMutation({
    mutationFn: ({ transactionId, isExternal }: MarkExternalArgs) =>
      markTransactionExternal(transactionId, isExternal),
    onSuccess: invalidate,
  });
  const linkOrderMutation = useMutation({
    mutationFn: ({ transactionId, orderNumber }: LinkOrderArgs) =>
      linkTransactionOrder(transactionId, orderNumber),
    onSuccess: invalidate,
  });
  const reconcileApplyMutation = useMutation({
    mutationFn: (pairs: ReconcileMatch[]) => reconcileTransactionsApply(pairs),
    onSuccess: invalidateBoth,
  });

  return {
    markExternal: (args) => markExternalMutation.mutateAsync(args),
    linkOrder: (args) => linkOrderMutation.mutateAsync(args),
    reconcilePreview: () => reconcileTransactionsPreview(),
    reconcileApply: (pairs) => reconcileApplyMutation.mutateAsync(pairs),
  };
};

/* ───────────────────────── Revenue report ────────────────────────────── */
export interface UseRevenueReportParams {
  from: string;
  to: string;
}

export interface UseRevenueReportResult {
  report: RevenueReport | null;
  loading: boolean;
  error: Error | null;
}

export const useRevenueReport = (params: UseRevenueReportParams): UseRevenueReportResult => {
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: qk.revenue.report(params),
    queryFn: () => fetchRevenueReport(params.from, params.to),
    enabled: !!currentUser,
  });
  return {
    report: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
  };
};
