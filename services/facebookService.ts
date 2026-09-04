import { apiClient } from '@/services/api/client';

/** 1 khách đã inbox fanpage. */
export interface FacebookContact {
  psid: string;
  name: string;
  profilePic: string;
  customerId: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  messageCount: number;
  optedInAt: string | null;
  /** Còn trong cửa sổ 24h kể từ tin cuối của khách → nhắn tự do được. */
  inWindow: boolean;
  minutesLeft: number;
}

export interface FacebookContactList {
  items: FacebookContact[];
  counts: { total: number; inWindow: number; optIn: number };
}

/** Kết quả gửi cho từng người. */
export interface FacebookSendResult {
  psid: string;
  sent: boolean;
  error?: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Danh sách khách Facebook. filter: 'window' (còn 24h) | 'optin' | '' (tất cả). */
export const fetchFacebookContacts = async (
  filter: '' | 'window' | 'optin' = '',
  limit = 300,
): Promise<FacebookContactList> => {
  const res = await apiClient.get('/facebook/contacts', {
    params: { filter: filter || undefined, limit },
  });
  const d = (res.data ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : [];
  const c = (d.counts ?? {}) as Record<string, unknown>;
  return {
    items: rows.map((r) => ({
      psid: str(r.psid),
      name: str(r.name),
      profilePic: str(r.profilePic),
      customerId: typeof r.customerId === 'string' ? r.customerId : null,
      lastInboundAt: typeof r.lastInboundAt === 'string' ? r.lastInboundAt : null,
      lastOutboundAt: typeof r.lastOutboundAt === 'string' ? r.lastOutboundAt : null,
      messageCount: num(r.messageCount),
      optedInAt: typeof r.optedInAt === 'string' ? r.optedInAt : null,
      inWindow: r.inWindow === true,
      minutesLeft: num(r.minutesLeft),
    })),
    counts: { total: num(c.total), inWindow: num(c.inWindow), optIn: num(c.optIn) },
  };
};

/** Kéo lại danh sách hội thoại từ Facebook (khách mới + cập nhật mốc 24h). */
export const syncFacebookContacts = async (): Promise<{ synced: number }> => {
  const res = await apiClient.post('/facebook/sync', {});
  const d = (res.data ?? {}) as { synced?: unknown };
  return { synced: num(d.synced) };
};

/**
 * Gửi tin cho nhiều khách: chữ và/hoặc ảnh (URL https), kèm nút thì thành thẻ bấm được.
 * BE tự chặn người ngoài 24h và trả lý do cho từng người.
 */
export const sendFacebookMessage = async (payload: {
  psids: string[];
  text?: string;
  imageUrl?: string;
  buttonTitle?: string;
  buttonUrl?: string;
}): Promise<{ results: FacebookSendResult[] }> => {
  const res = await apiClient.post('/facebook/send', payload);
  const d = (res.data ?? {}) as { results?: unknown };
  const rows = Array.isArray(d.results) ? (d.results as Record<string, unknown>[]) : [];
  return {
    results: rows.map((r) => ({
      psid: str(r.psid),
      sent: r.sent === true,
      error: str(r.error),
    })),
  };
};

/** Trạng thái kết nối fanpage (cho tab "Kết nối"). */
export interface FacebookStatus {
  configured: boolean;
  pageId?: string;
  pageName?: string;
  tokenValid?: boolean;
  tokenError?: string;
  scopes?: string[];
  /** 0 = token không hết hạn. */
  expiresAt?: number;
  webhookFields?: string[];
  can?: { messaging: boolean; readComments: boolean; manageComments: boolean };
}

export const fetchFacebookStatus = async (): Promise<FacebookStatus> => {
  const res = await apiClient.get('/facebook/status');
  const d = (res.data ?? {}) as Record<string, unknown>;
  const can = (d.can ?? {}) as Record<string, unknown>;
  return {
    configured: d.configured === true,
    pageId: str(d.pageId),
    pageName: str(d.pageName),
    tokenValid: d.tokenValid === true,
    tokenError: str(d.tokenError),
    scopes: Array.isArray(d.scopes) ? (d.scopes as string[]) : [],
    expiresAt: num(d.expiresAt),
    webhookFields: Array.isArray(d.webhookFields) ? (d.webhookFields as string[]) : [],
    can: {
      messaging: can.messaging === true,
      readComments: can.readComments === true,
      manageComments: can.manageComments === true,
    },
  };
};
