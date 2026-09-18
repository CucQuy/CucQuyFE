import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreatePaymentAccountInput,
  PaymentAccount,
  PaymentAccountKind,
} from '@/types/paymentConfig';
import { useAuth } from '@/contexts/AuthContext';
import { qk } from '@/hooks/queryKeys';
import {
  createPaymentAccount,
  deletePaymentAccount,
  fetchPaymentAccounts,
  setKindPaymentAccount,
  setTrackedPaymentAccount,
} from '@/services/configurationService';

export interface UsePaymentAccountsResult {
  accounts: PaymentAccount[];
/**
   * TK HỘ KINH DOANH (kind 'hkd') — mọi QR đơn dùng TK này. Chỉ có tối đa 1.
   * null nếu chưa gán TK nào làm HKD.
   */
  activeAccount: PaymentAccount | null;
  /** TK CÁ NHÂN (kind 'personal') — chi hoá đơn; null nếu chưa gán. */
  personalAccount: PaymentAccount | null;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: CreatePaymentAccountInput) => Promise<PaymentAccount[]>;
  /** Bật/tắt ghi nhận giao dịch của TK (tắt → webhook bỏ qua, không lưu). */
  setTracked: (id: string, tracked: boolean) => Promise<PaymentAccount[]>;
  /** Gán loại TK (hkd/personal/none) — TK cũ cùng loại tự rớt về 'none'. */
  setKind: (id: string, kind: PaymentAccountKind) => Promise<PaymentAccount[]>;
  remove: (id: string) => Promise<PaymentAccount[]>;
}

/**
 * Quản lý danh sách tài khoản ngân hàng (mỗi loại thật đúng 1 TK) qua React Query.
 * - Cache theo `qk.paymentAccounts.all`: mọi consumer mount → fetch 1 lần (dedup).
 * - Mỗi mutation set cache từ response list + invalidate để đồng bộ server.
 * - An toàn khi list rỗng (accounts = [], activeAccount = null).
 */
export const usePaymentAccounts = (): UsePaymentAccountsResult => {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: qk.paymentAccounts.all,
    queryFn: fetchPaymentAccounts,
    enabled: !!currentUser,
  });

  const accounts = useMemo<PaymentAccount[]>(() => query.data ?? [], [query.data]);

  // Mỗi loại đúng 1 TK (BE đảm bảo bằng unique index) → tìm thấy là lấy luôn.
  const activeAccount = useMemo<PaymentAccount | null>(
    () => accounts.find((a) => a.kind === 'hkd') ?? null,
    [accounts],
  );

  const personalAccount = useMemo<PaymentAccount | null>(
    () => accounts.find((a) => a.kind === 'personal') ?? null,
    [accounts],
  );

  const applyList = useCallback(
    (list: PaymentAccount[]) => {
      queryClient.setQueryData(qk.paymentAccounts.all, list);
      queryClient.invalidateQueries({ queryKey: qk.paymentAccounts.all });
    },
    [queryClient],
  );

  const createMutation = useMutation({
    mutationFn: (input: CreatePaymentAccountInput) => createPaymentAccount(input),
    onSuccess: applyList,
  });

  const setTrackedMutation = useMutation({
    mutationFn: ({ id, tracked }: { id: string; tracked: boolean }) =>
      setTrackedPaymentAccount(id, tracked),
    onSuccess: applyList,
  });

  const setKindMutation = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: PaymentAccountKind }) =>
      setKindPaymentAccount(id, kind),
    onSuccess: applyList,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deletePaymentAccount(id),
    onSuccess: applyList,
  });

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const create = useCallback(
    (input: CreatePaymentAccountInput) => createMutation.mutateAsync(input),
    [createMutation],
  );
  const setTracked = useCallback(
    (id: string, tracked: boolean) => setTrackedMutation.mutateAsync({ id, tracked }),
    [setTrackedMutation],
  );
  const setKind = useCallback(
    (id: string, kind: PaymentAccountKind) => setKindMutation.mutateAsync({ id, kind }),
    [setKindMutation],
  );
  const remove = useCallback((id: string) => removeMutation.mutateAsync(id), [removeMutation]);

  const mutating =
    createMutation.isPending ||
    setTrackedMutation.isPending ||
    setKindMutation.isPending ||
    removeMutation.isPending;

  const error = query.error
    ? (query.error as Error)?.message || 'Không tải được danh sách tài khoản thanh toán'
    : createMutation.error ||
        setTrackedMutation.error ||
        setKindMutation.error ||
        removeMutation.error
      ? ((createMutation.error ||
          setTrackedMutation.error ||
          setKindMutation.error ||
          removeMutation.error) as Error)?.message ||
        'Thao tác tài khoản thanh toán thất bại'
      : null;

  return {
    accounts,
    activeAccount,
    personalAccount,
    loading: query.isLoading,
    mutating,
    error,
    refresh,
    create,
    setTracked,
    setKind,
    remove,
  };
};
