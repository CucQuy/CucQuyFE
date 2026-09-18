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
  setActivePaymentAccount,
  setKindPaymentAccount,
  setTrackedPaymentAccount,
} from '@/services/configurationService';

export interface UsePaymentAccountsResult {
  accounts: PaymentAccount[];
  /**
   * TK HỘ KINH DOANH đang dùng (kind 'hkd' + isActive) — mọi QR đơn dùng TK này.
   * Fallback: TK HKD đầu tiên → TK đầu tiên trong list; null nếu list rỗng.
   */
  activeAccount: PaymentAccount | null;
  /** TK CÁ NHÂN đang dùng (kind 'personal' + isActive) — chi hoá đơn; null nếu chưa khai. */
  personalAccount: PaymentAccount | null;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: CreatePaymentAccountInput) => Promise<PaymentAccount[]>;
  /** Bật/tắt TK đang dùng của loại đó (bật → TK cùng loại tự tắt). */
  setActive: (id: string, active?: boolean) => Promise<PaymentAccount[]>;
  /** Bật/tắt ghi nhận giao dịch của TK (tắt → webhook bỏ qua, không lưu). */
  setTracked: (id: string, tracked: boolean) => Promise<PaymentAccount[]>;
  /** Đổi loại TK: hộ kinh doanh ↔ cá nhân. */
  setKind: (id: string, kind: PaymentAccountKind) => Promise<PaymentAccount[]>;
  remove: (id: string) => Promise<PaymentAccount[]>;
}

/**
 * Quản lý danh sách tài khoản ngân hàng (mỗi loại 1 TK đang dùng) qua React Query.
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

  // TK cũ (chưa khai loại) → coi là TK HKD để không đổi hành vi QR đơn.
  const isHkd = (a: PaymentAccount) => (a.kind ?? 'hkd') === 'hkd';

  const activeAccount = useMemo<PaymentAccount | null>(() => {
    if (accounts.length === 0) return null;
    const hkd = accounts.filter(isHkd);
    return (
      hkd.find((a) => a.isActive) ?? hkd[0] ?? accounts.find((a) => a.isActive) ?? accounts[0] ?? null
    );
  }, [accounts]);

  const personalAccount = useMemo<PaymentAccount | null>(() => {
    const personal = accounts.filter((a) => a.kind === 'personal');
    return personal.find((a) => a.isActive) ?? personal[0] ?? null;
  }, [accounts]);

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

  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setActivePaymentAccount(id, active),
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
  const setActive = useCallback(
    (id: string, active = true) => setActiveMutation.mutateAsync({ id, active }),
    [setActiveMutation],
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
    setActiveMutation.isPending ||
    setTrackedMutation.isPending ||
    setKindMutation.isPending ||
    removeMutation.isPending;

  const error = query.error
    ? (query.error as Error)?.message || 'Không tải được danh sách tài khoản thanh toán'
    : createMutation.error ||
        setActiveMutation.error ||
        setTrackedMutation.error ||
        setKindMutation.error ||
        removeMutation.error
      ? ((createMutation.error ||
          setActiveMutation.error ||
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
    setActive,
    setTracked,
    setKind,
    remove,
  };
};
