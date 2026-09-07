/**
 * Configuration service — các config đã chuyển sang BE NestJS
 * (document trong collection 'configurations'):
 *  - screen-visibility      ↔ GET/PUT '/configurations/screen'
 *  - zalo-configuration     ↔ GET/PUT '/configurations/zalo-groups'
 *  - shipping-configuration ↔ GET/PUT '/configurations/shipping'
 *  - collaboratorHasZaloGroup ↔ GET '/configurations/collaborator-has-zalo/:uid'
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
  UpsertZaloFeatureInput,
  ZaloFeatureFlag,
  ZaloOrderEventType,
  ZaloTemplateVar,
  zaloFeatureOfOrderEvent,
} from '@/types';
import { DEFAULT_SHIPPING_CONFIG } from '@/types/shippingConfig';
import type { ShippingConfiguration } from '@/types/shippingConfig';
import type { CreatePaymentAccountInput, PaymentAccount } from '@/types/paymentConfig';
import { UserRole } from '@/types/user';
import { getUserByUid } from '@/services/userService';

/** CTV tạo đơn nhưng chưa được gán nhóm Zalo — chặn & báo rõ. */
export class CollaboratorZaloGroupMissingError extends Error {
  constructor() {
    super('Bạn chưa được thêm vào nhóm Zalo. Hãy liên hệ quản trị viên.');
    this.name = 'CollaboratorZaloGroupMissingError';
  }
}

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
 * Resolver chinh — filter group nao nhan event nay theo toggle + (cho update) field whitelist.
 */
export const resolveZaloGroupIdsForOrderEvent = async (
  eventType: ZaloOrderEventType,
  createdByUid: string | undefined,
  changedFieldIds?: string[],
): Promise<string[]> => {
  const cfg = await fetchZaloGroupsConfiguration();

  // Nhóm KHÔNG có member = nhóm nội bộ → nhận theo feature được gán (095).
  // Nhóm CÓ member = nhóm CTV → chỉ nhận đơn do chính member đó tạo (xử lý bên dưới).
  const targets = cfg.groups
    .filter((g) => (g.memberUids ?? []).length === 0)
    .filter((g) => groupAcceptsEvent(g, eventType, changedFieldIds))
    .map((g) => g.zaloGroupId);

  if (createdByUid) {
    const user = await getUserByUid(createdByUid);
    if (user?.role === UserRole.COLABORATOR) {
      let ctvGroupId = user.zaloCtvGroupChatId?.trim() ?? '';
      let ctvGroupConfig: ZaloGroupConfig | undefined;
      if (ctvGroupId) {
        ctvGroupConfig = cfg.groups.find((g) => g.zaloGroupId.trim() === ctvGroupId);
      } else {
        const found = cfg.groups.find((g) => g.zaloGroupId.trim() && g.memberUids.includes(createdByUid));
        if (!found) {
          if (eventType === 'create') throw new CollaboratorZaloGroupMissingError();
        } else {
          ctvGroupId = found.zaloGroupId.trim();
          ctvGroupConfig = found;
        }
      }
      if (ctvGroupId && ctvGroupConfig && groupAcceptsEvent(ctvGroupConfig, eventType, changedFieldIds)) {
        targets.push(ctvGroupId);
      }
    }
  }

  return dedupeIds(targets);
};

/** @deprecated Dung resolveZaloGroupIdsForOrderEvent. */
export const resolveZaloGroupIdsForNewOrder = async (
  createdByUid: string | undefined,
): Promise<string[]> => resolveZaloGroupIdsForOrderEvent('create', createdByUid);

export const collaboratorHasZaloGroup = async (uid: string): Promise<boolean> => {
  const { data } = await apiClient.get<boolean>(
    `/configurations/collaborator-has-zalo/${encodeURIComponent(uid)}`
  );
  return data === true;
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

/** Biến chèn được vào tin tự soạn (danh sách do BE khai, FE không hardcode). */
export const fetchZaloTemplateVars = async (): Promise<ZaloTemplateVar[]> => {
  const { data } = await apiClient.get<ZaloTemplateVar[]>('/configurations/zalo-features/vars');
  return Array.isArray(data) ? data : [];
};

/** Tạo (feature trống) hoặc sửa 1 chức năng TỰ SOẠN. */
export const upsertZaloFeature = async (input: UpsertZaloFeatureInput): Promise<void> => {
  await apiClient.post('/configurations/zalo-features', input);
};

export const deleteZaloFeature = async (feature: string): Promise<void> => {
  await apiClient.delete(`/configurations/zalo-features/${encodeURIComponent(feature)}`);
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
  });
  return Array.isArray(data) ? data : [];
};

export const setActivePaymentAccount = async (id: string): Promise<PaymentAccount[]> => {
  const { data } = await apiClient.put<PaymentAccount[]>(
    `/configurations/payment-accounts/${encodeURIComponent(id)}/active`,
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
