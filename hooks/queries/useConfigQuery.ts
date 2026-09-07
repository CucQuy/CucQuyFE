/**
 * React Query hooks cho domain Config/Settings (epic #58 — P8).
 *
 * - Screen visibility config: useScreenConfigQuery() + useSaveScreenConfig().
 *   Provider ScreenConfigContext dùng useScreenConfigQuery() bên trong (giữ context API).
 * - Zalo groups config: useZaloGroups() + useSaveZaloGroups().
 * - queryFn/mutationFn GỌI THẲNG service hiện có (configurationService) — KHÔNG viết lại HTTP.
 * - Query `enabled: !!currentUser` để tránh gọi API 401 ở màn login.
 * - Mutation invalidate key liên quan. KHÔNG nuốt lỗi: caller bắt error → toast.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ScreenConfiguration,
  ScreenVisibilityMap,
  ScreenRolesMap,
  ZaloGroupConfig,
  ZaloGroupsConfiguration,
} from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { qk } from '@/hooks/queryKeys';
import {
  fetchScreenConfiguration,
  fetchZaloGroupsConfiguration,
  saveScreenConfiguration,
  saveZaloGroupsConfiguration,
} from '@/services/configurationService';

// ==================== SCREEN VISIBILITY ====================

export interface UseScreenConfigResult {
  config: ScreenConfiguration | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/** Query screen-visibility config. Dùng bởi ScreenConfigProvider. */
export const useScreenConfigQuery = (): UseScreenConfigResult => {
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: qk.screenConfig.all,
    queryFn: fetchScreenConfiguration,
    enabled: !!currentUser,
  });
  return {
    config: query.data,
    loading: query.isLoading,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
  };
};

export interface SaveScreenConfigArgs {
  screenVisibility: ScreenVisibilityMap;
  screenRoles: ScreenRolesMap;
  updatedBy?: string;
}

export interface UseSaveScreenConfigResult {
  save: (args: SaveScreenConfigArgs) => Promise<void>;
  saving: boolean;
}

export const useSaveScreenConfig = (): UseSaveScreenConfigResult => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ screenVisibility, screenRoles, updatedBy }: SaveScreenConfigArgs) =>
      saveScreenConfiguration(screenVisibility, screenRoles, updatedBy),
    onSuccess: (_data, { screenVisibility, screenRoles }) => {
      // Cập nhật cache ngay (tránh nháy data cũ) + invalidate đồng bộ server.
      queryClient.setQueryData<ScreenConfiguration>(qk.screenConfig.all, { screenVisibility, screenRoles });
      queryClient.invalidateQueries({ queryKey: qk.screenConfig.all });
    },
  });
  return {
    save: (args) => mutation.mutateAsync(args),
    saving: mutation.isPending,
  };
};

// ==================== ZALO GROUPS ====================

export interface UseZaloGroupsResult {
  data: ZaloGroupsConfiguration | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useZaloGroups = (): UseZaloGroupsResult => {
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: qk.zaloConfig.groups,
    queryFn: fetchZaloGroupsConfiguration,
    enabled: !!currentUser,
  });
  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
  };
};

export interface SaveZaloGroupsArgs {
  groups: ZaloGroupConfig[];
  updatedBy?: string | null;
  /** Cài đặt tin gửi KHÁCH (màn riêng /channels/zalo/customer). */
  customerSettings?: Partial<
    Pick<
      ZaloGroupsConfiguration,
      'customerNotifyEnabled' | 'customerNotifyPromotionId' | 'customerNotifyDailyLimit'
    >
  >;
}

export interface UseSaveZaloGroupsResult {
  save: (args: SaveZaloGroupsArgs) => Promise<void>;
  saving: boolean;
}

export const useSaveZaloGroups = (): UseSaveZaloGroupsResult => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ groups, updatedBy, customerSettings }: SaveZaloGroupsArgs) =>
      saveZaloGroupsConfiguration(groups, updatedBy ?? null, customerSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.zaloConfig.groups });
    },
  });
  return {
    save: (args) => mutation.mutateAsync(args),
    saving: mutation.isPending,
  };
};
