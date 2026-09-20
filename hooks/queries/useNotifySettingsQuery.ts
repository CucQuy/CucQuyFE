import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { qk } from '@/hooks/queryKeys';
import {
  fetchNotifySettings,
  saveNotifyCustomer,
  saveNotifyFlags,
  saveNotifyTarget,
  type NotifyChannelId,
  type NotifyCustomerConfig,
  type NotifyFlag,
  type NotifySettings,
} from '@/services/notifySettingsService';

export interface UseNotifySettingsResult {
  data: NotifySettings | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/** Cấu hình thông báo của mọi kênh (màn Kết nối đa kênh → Thông báo). */
export const useNotifySettings = (): UseNotifySettingsResult => {
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: qk.notifySettings.all,
    queryFn: fetchNotifySettings,
    enabled: !!currentUser,
  });
  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
  };
};

export interface UseNotifySettingsMutationsResult {
  setFlags: (flags: NotifyFlag[]) => Promise<void>;
  setTarget: (args: {
    channel: NotifyChannelId;
    targetId: string;
    name?: string;
    features?: string[];
    updateFieldWhitelist?: string[];
  }) => Promise<void>;
  setCustomer: (args: {
    channel: NotifyChannelId;
    patch: Partial<NotifyCustomerConfig>;
  }) => Promise<void>;
}

/** Ghi cấu hình thông báo — mọi mutation đều invalidate lại payload tổng. */
export const useNotifySettingsMutations = (): UseNotifySettingsMutationsResult => {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.notifySettings.all });
  };

  const flagsMutation = useMutation({
    mutationFn: (flags: NotifyFlag[]) => saveNotifyFlags(flags),
    onSuccess: invalidate,
  });

  const targetMutation = useMutation({
    mutationFn: ({
      channel,
      targetId,
      ...input
    }: {
      channel: NotifyChannelId;
      targetId: string;
      name?: string;
      features?: string[];
      updateFieldWhitelist?: string[];
    }) => saveNotifyTarget(channel, targetId, input),
    onSuccess: invalidate,
  });

  const customerMutation = useMutation({
    mutationFn: ({
      channel,
      patch,
    }: {
      channel: NotifyChannelId;
      patch: Partial<NotifyCustomerConfig>;
    }) => saveNotifyCustomer(channel, patch),
    onSuccess: invalidate,
  });

  return {
    setFlags: (flags) => flagsMutation.mutateAsync(flags),
    setTarget: (args) => targetMutation.mutateAsync(args),
    setCustomer: (args) => customerMutation.mutateAsync(args),
  };
};
