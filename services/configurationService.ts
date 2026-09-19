/**
 * Configuration service — các config đã chuyển sang BE NestJS
 * (document trong collection 'configurations'):
 *  - screen-visibility      ↔ GET/PUT '/configurations/screen'
 *  - zalo-configuration     ↔ GET/PUT '/configurations/zalo-groups'
 *  - shipping-configuration ↔ GET/PUT '/configurations/shipping'
 *
 * Các hàm resolve* là LOGIC THUẦN — giữ nguyên, chỉ fetch config qua API.
 */

import { apiClient } from '@/services/api/client';
import {
  ScreenConfiguration,
  ScreenVisibilityMap,
  ScreenRolesMap,
  ZaloGroupConfig,
  ZaloGroupsConfiguration,
  ZaloFeatureFlag,
  ZaloOrderEventType,
  zaloFeatureOfOrderEvent,
} from '@/types';
import { DEFAULT_SHIPPING_CONFIG } from '@/types/shippingConfig';
import type { ShippingConfiguration } from '@/types/shippingConfig';
import type {
  CreatePaymentAccountInput,
  PaymentAccount,
  PaymentAccountKind,
} from '@/types/paymentConfig';
export const fetchScreenConfiguration = async (): Promise<ScreenConfiguration> => {
  const { data } = await apiClient.get<ScreenConfiguration>('/configurations/screen');
  return {
    screenVisibility: data?.screenVisibility ?? {},
    screenRoles: data?.screenRoles ?? {},
  };
};

export const saveScreenConfiguration = async (
  screenVisibility: ScreenVisibilityMap,
  screenRoles: ScreenRolesMap,
  updatedBy?: string
): Promise<void> => {
  await apiClient.put('/configurations/screen', { screenVisibility, screenRoles, updatedBy });
};

export const fetchZaloGroupsConfiguration = async (): Promise<ZaloGroupsConfiguration> => {
  const { data } = await apiClient.get<ZaloGroupsConfiguration>('/configurations/zalo-groups');
  return data ?? { groups: [] };
};

/**
 * Nhóm có nhận event đơn này không: phải được gán feature tương ứng, và với event
 * SỬA đơn thì field thay đổi phải nằm trong whitelist (whitelist rỗng = nhận tất).
 */
const groupAcceptsEvent = (
  group: Pick<ZaloGroupConfig, 'features' | 'updateFieldWhitelist'>,
  eventType: ZaloOrderEventType,
  changedFieldIds?: string[],
): boolean => {
  if (!(group.features ?? []).includes(zaloFeatureOfOrderEvent(eventType))) return false;
  if (eventType !== 'update') return true;
  const wl = group.updateFieldWhitelist ?? [];
  if (wl.length === 0) return true;
  if (!changedFieldIds || changedFieldIds.length === 0) return false;
  return changedFieldIds.some((f) => wl.includes(f));
};

const dedupeIds = (ids: string[]): string[] => [...new Set(ids.map((x) => x.trim()).filter(Boolean))];

/**
 * Resolver chính — nhóm nào nhận event này theo feature được gán + (với sửa đơn)
 * field whitelist. Mọi nhóm đều nhận theo cấu hình của chính nó, không phân biệt
 * người tạo đơn.
 */
export const resolveZaloGroupIdsForOrderEvent = async (
  eventType: ZaloOrderEventType,
  changedFieldIds?: string[],
): Promise<string[]> => {
  const cfg = await fetchZaloGroupsConfiguration();
  return dedupeIds(
    cfg.groups
      .filter((g) => groupAcceptsEvent(g, eventType, changedFieldIds))
      .map((g) => g.zaloGroupId),
  );
};

export const saveZaloGroupsConfiguration = async (
  groups: ZaloGroupConfig[],
  updatedBy?: string | null,
  customerSettings?: Partial<Pick<
    ZaloGroupsConfiguration,
    'customerNotifyEnabled' | 'customerNotifyPromotionId' | 'customerNotifyDailyLimit'
  >>,
): Promise<void> => {
  await apiClient.put('/configurations/zalo-groups', {
    groups,
    updatedBy,
    ...(customerSettings ?? {}),
  });
};

// ==================== ZALO FEATURE FLAGS ====================

export const fetchZaloFeatures = async (): Promise<ZaloFeatureFlag[]> => {
  const { data } = await apiClient.get<ZaloFeatureFlag[]>('/configurations/zalo-features');
  return Array.isArray(data) ? data : [];
};

/** Chỉ gửi các feature cần đổi — BE không reset cái khác. */
export const saveZaloFeatures = async (
  features: { feature: string; enabled: boolean }[],
): Promise<void> => {
  await apiClient.put('/configurations/zalo-features', { features });
};

// ==================== SHIPPING CONFIGURATION ====================

export const fetchShippingConfiguration = async (): Promise<ShippingConfiguration> => {
  const { data } = await apiClient.get<ShippingConfiguration>('/configurations/shipping');
  return data ?? DEFAULT_SHIPPING_CONFIG;
};

export const saveShippingConfiguration = async (
  config: ShippingConfiguration,
  updatedBy?: string | null,
): Promise<void> => {
  await apiClient.put('/configurations/shipping', { ...config, updatedBy });
};

// ==================== PAYMENT ACCOUNTS ====================
// Mô hình mới: NHIỀU tài khoản + 1 active. Mọi endpoint trả về danh sách
// PaymentAccount[] (active trước, createdAt desc) — interceptor đã bóc envelope `.data`.

export const fetchPaymentAccounts = async (): Promise<PaymentAccount[]> => {
  const { data } = await apiClient.get<PaymentAccount[]>('/configurations/payment-accounts');
  return Array.isArray(data) ? data : [];
};

export const createPaymentAccount = async (
  input: CreatePaymentAccountInput,
): Promise<PaymentAccount[]> => {
  const { data } = await apiClient.post<PaymentAccount[]>('/configurations/payment-accounts', {
    bankCode: input.bankCode,
    accountNumber: input.accountNumber,
    accountHolder: input.accountHolder,
    ...(input.qrTemplate ? { qrTemplate: input.qrTemplate } : {}),
    ...(input.kind ? { kind: input.kind } : {}),
  });
  return Array.isArray(data) ? data : [];
};

/**
 * Bật/tắt GHI NHẬN giao dịch của TK (tắt → webhook bỏ qua, không lưu gì).
 * BE chặn tắt TK đang dùng (trả lỗi) → caller hiện toast.
 */
export const setTrackedPaymentAccount = async (
  id: string,
  tracked: boolean,
): Promise<PaymentAccount[]> => {
  const { data } = await apiClient.put<PaymentAccount[]>(
    `/configurations/payment-accounts/${encodeURIComponent(id)}/tracked`,
    { tracked },
  );
  return Array.isArray(data) ? data : [];
};

/**
 * Gán loại TK: 'hkd' | 'personal' | 'none'. Mỗi loại thật chỉ 1 TK —
 * gán cho TK này thì TK cũ cùng loại tự rớt về 'none' (BE lo).
 */
export const setKindPaymentAccount = async (
  id: string,
  kind: PaymentAccountKind,
): Promise<PaymentAccount[]> => {
  const { data } = await apiClient.put<PaymentAccount[]>(
    `/configurations/payment-accounts/${encodeURIComponent(id)}/kind`,
    { kind },
  );
  return Array.isArray(data) ? data : [];
};

/**
 * Chốt lại số dư TK theo số đang thấy trên app ngân hàng — BE đóng mốc thời gian = now(),
 * từ đó chỉ cộng/trừ giao dịch mới (bỏ qua sai lệch tích luỹ trước đó).
 */
export const setOpeningPaymentAccount = async (
  id: string,
  amount: number,
): Promise<PaymentAccount[]> => {
  const { data } = await apiClient.put<PaymentAccount[]>(
    `/configurations/payment-accounts/${encodeURIComponent(id)}/opening`,
    { amount },
  );
  return Array.isArray(data) ? data : [];
};

export const deletePaymentAccount = async (id: string): Promise<PaymentAccount[]> => {
  const { data } = await apiClient.delete<PaymentAccount[]>(
    `/configurations/payment-accounts/${encodeURIComponent(id)}`,
  );
  return Array.isArray(data) ? data : [];
};

/** Mục tiêu doanh thu dùng chung cho cả tiệm (lưu ở BE, không còn localStorage). */
export interface RevenueGoals {
  /** Mục tiêu doanh thu CẢ THÁNG (VND). 0 = chưa đặt. */
  monthlyTarget: number;
  dailyMin: number;
  dailyExpected: number;
  updatedAt: string | null;
  updatedBy: string;
}

const numOr0 = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export const fetchRevenueGoals = async (): Promise<RevenueGoals> => {
  const res = await apiClient.get('/configurations/revenue-goals');
  const d = (res.data ?? {}) as Record<string, unknown>;
  return {
    monthlyTarget: numOr0(d.monthlyTarget),
    dailyMin: numOr0(d.dailyMin),
    dailyExpected: numOr0(d.dailyExpected),
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : null,
    updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : '',
  };
};

/** Patch: gửi field nào ghi field đó. */
export const saveRevenueGoals = async (
  patch: Partial<Pick<RevenueGoals, 'monthlyTarget' | 'dailyMin' | 'dailyExpected'>>,
): Promise<void> => {
  await apiClient.put('/configurations/revenue-goals', patch);
};
