import { apiClient } from '@/services/api/client';

/** Kênh gửi thông báo (khớp NOTIFY_CHANNELS ở BE). */
export type NotifyChannelId = 'zalo' | 'facebook' | 'instagram' | 'tiktok';

export type NotifyFeatureSection = 'order' | 'payment' | 'daily' | 'other';

export interface NotifyFeatureDef {
  key: string;
  label: string;
  section: NotifyFeatureSection;
}

export interface NotifyFlag {
  feature: string;
  enabled: boolean;
}

/** 1 nơi nhận của 1 kênh: nhóm Zalo / page Facebook / tài khoản TikTok… */
export interface NotifyTarget {
  id: string;
  name: string;
  avatar: string;
  members: number;
  features: string[];
  updateFieldWhitelist: string[];
  /** Còn trong cấu hình nhưng kênh không thấy nữa. */
  missing: boolean;
}

export interface NotifyCustomerConfig {
  enabled: boolean;
  promotionId: string;
  dailyLimit: number;
}

export interface NotifyChannelSettings {
  channel: NotifyChannelId;
  label: string;
  connected: boolean;
  /** Kênh đã có provider thật chưa (false = "sắp có"). */
  supported: boolean;
  note: string;
  targets: NotifyTarget[];
  customer: NotifyCustomerConfig | null;
}

export interface NotifySettings {
  features: NotifyFeatureDef[];
  flags: NotifyFlag[];
  channels: NotifyChannelSettings[];
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : [];

const toTarget = (raw: unknown): NotifyTarget => {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(r.id),
    name: str(r.name),
    avatar: str(r.avatar),
    members: num(r.members),
    features: strList(r.features),
    updateFieldWhitelist: strList(r.updateFieldWhitelist),
    missing: r.missing === true,
  };
};

const toCustomer = (raw: unknown): NotifyCustomerConfig | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    enabled: r.enabled === true,
    promotionId: str(r.promotionId),
    dailyLimit: typeof r.dailyLimit === 'number' ? r.dailyLimit : 40,
  };
};

/**
 * Toàn bộ cấu hình thông báo (mọi kênh) → GET /notify-settings.
 * Dữ liệu untrusted nên type-guard từng field; kênh thiếu target vẫn trả mảng rỗng.
 */
export async function fetchNotifySettings(): Promise<NotifySettings> {
  const res = await apiClient.get<unknown>('/notify-settings');
  const d = (res.data ?? {}) as Record<string, unknown>;
  return {
    features: Array.isArray(d.features)
      ? d.features.map((raw) => {
          const r = (raw ?? {}) as Record<string, unknown>;
          const section = str(r.section);
          return {
            key: str(r.key),
            label: str(r.label),
            section: (['order', 'payment', 'daily', 'other'].includes(section)
              ? section
              : 'other') as NotifyFeatureSection,
          };
        }).filter((f) => f.key)
      : [],
    flags: Array.isArray(d.flags)
      ? d.flags.map((raw) => {
          const r = (raw ?? {}) as Record<string, unknown>;
          return { feature: str(r.feature), enabled: r.enabled !== false };
        }).filter((f) => f.feature)
      : [],
    channels: Array.isArray(d.channels)
      ? d.channels.map((raw) => {
          const r = (raw ?? {}) as Record<string, unknown>;
          return {
            channel: str(r.channel) as NotifyChannelId,
            label: str(r.label),
            connected: r.connected === true,
            supported: r.supported === true,
            note: str(r.note),
            targets: Array.isArray(r.targets) ? r.targets.map(toTarget).filter((t) => t.id) : [],
            customer: toCustomer(r.customer),
          };
        }).filter((c) => c.channel)
      : [],
  };
}

/** Bật/tắt cờ tổng (áp cho mọi kênh) → PUT /notify-settings/flags. */
export async function saveNotifyFlags(flags: NotifyFlag[]): Promise<void> {
  await apiClient.put('/notify-settings/flags', { flags });
}

/** Ghi cấu hình 1 nơi nhận → PUT /notify-settings/:channel/targets/:targetId. */
export async function saveNotifyTarget(
  channel: NotifyChannelId,
  targetId: string,
  input: { name?: string; features?: string[]; updateFieldWhitelist?: string[] },
): Promise<void> {
  await apiClient.put(
    `/notify-settings/${channel}/targets/${encodeURIComponent(targetId)}`,
    input,
  );
}

/** Ghi cài đặt tin gửi khách của 1 kênh → PUT /notify-settings/:channel/customer. */
export async function saveNotifyCustomer(
  channel: NotifyChannelId,
  input: Partial<NotifyCustomerConfig>,
): Promise<void> {
  await apiClient.put(`/notify-settings/${channel}/customer`, input);
}
