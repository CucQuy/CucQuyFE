import { apiClient } from '@/services/api/client';

/** 1 khách đã inbox fanpage. */
/** Nguồn của khách / bình luận: fanpage Facebook hay Instagram (dùng chung page token). */
export type SocialPlatform = 'facebook' | 'instagram';

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
  platform: SocialPlatform;
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
      platform: r.platform === 'instagram' ? 'instagram' : 'facebook',
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

// ── Bình luận fanpage ────────────────────────────────────────
export interface FacebookComment {
  id: string;
  postId: string;
  postMessage: string;
  postPermalink: string;
  psid: string;
  fromName: string;
  message: string;
  isHidden: boolean;
  repliedAt: string | null;
  /** Luật tự động đã chạy: hide_phone | hide_keyword | reply | private_reply */
  autoAction: string;
  createdTime: string | null;
  platform: SocialPlatform;
  /** Ảnh bài (Instagram) để nhận ra bình luận thuộc bài nào. */
  postMediaUrl: string;
}

export interface FacebookCommentList {
  items: FacebookComment[];
  counts: {
    total: number;
    pending: number;
    hidden: number;
    replied: number;
    facebook: number;
    instagram: number;
  };
}

/** Cấu hình luật tự động cho bình luận. */
export interface FacebookCommentConfig {
  autoHidePhone: boolean;
  autoHideKeywords: string[];
  autoReplyEnabled: boolean;
  autoReplyText: string;
  autoPrivateReply: boolean;
  privateReplyText: string;
}

/** Mã lỗi BE trả khi token thiếu quyền đọc/quản lý bình luận. */
export const FB_MISSING_PERMISSION = 'FB_MISSING_PERMISSION';

export const fetchFacebookComments = async (
  filter: '' | 'pending' | 'hidden' | 'replied' = '',
  limit = 50,
  platform: '' | SocialPlatform = '',
): Promise<FacebookCommentList> => {
  const res = await apiClient.get('/facebook/comments', {
    params: { filter: filter || undefined, limit, platform: platform || undefined },
  });
  const d = (res.data ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : [];
  const c = (d.counts ?? {}) as Record<string, unknown>;
  return {
    items: rows.map((r) => ({
      id: str(r.id),
      postId: str(r.postId),
      postMessage: str(r.postMessage),
      postPermalink: str(r.postPermalink),
      psid: str(r.psid),
      fromName: str(r.fromName),
      message: str(r.message),
      isHidden: r.isHidden === true,
      repliedAt: typeof r.repliedAt === 'string' ? r.repliedAt : null,
      autoAction: str(r.autoAction),
      createdTime: typeof r.createdTime === 'string' ? r.createdTime : null,
      platform: r.platform === 'instagram' ? 'instagram' : 'facebook',
      postMediaUrl: str(r.postMediaUrl),
    })),
    counts: {
      total: num(c.total),
      pending: num(c.pending),
      hidden: num(c.hidden),
      replied: num(c.replied),
      facebook: num(c.facebook),
      instagram: num(c.instagram),
    },
  };
};

/** Số liệu fanpage + Instagram trong ngày (thẻ KPI ngoài Dashboard). */
export interface SocialInsights {
  pageViews: number;
  postEngagements: number;
  newFollows: number;
  igReach: number;
}

export const fetchSocialInsights = async (): Promise<SocialInsights> => {
  const res = await apiClient.get('/facebook/insights');
  const d = (res.data ?? {}) as Record<string, unknown>;
  return {
    pageViews: num(d.pageViews),
    postEngagements: num(d.postEngagements),
    newFollows: num(d.newFollows),
    igReach: num(d.igReach),
  };
};

/** Hồ sơ Instagram gắn với fanpage — null nghĩa là page chưa nối tài khoản IG. */
export interface InstagramProfile {
  id: string;
  username: string;
  name: string;
  followers: number;
  following: number;
  mediaCount: number;
  avatar: string;
}

export const fetchInstagramProfile = async (): Promise<InstagramProfile | null> => {
  const res = await apiClient.get('/facebook/instagram');
  const d = res.data as Record<string, unknown> | null;
  if (!d || !d.id) return null;
  return {
    id: str(d.id),
    username: str(d.username),
    name: str(d.name),
    followers: num(d.followers),
    following: num(d.following),
    mediaCount: num(d.mediaCount),
    avatar: str(d.avatar),
  };
};

/** Kéo hội thoại Instagram Direct về danh sách khách. */
export const syncInstagramConversations = async (): Promise<{ contacts: number }> => {
  const res = await apiClient.post('/facebook/instagram/sync', {});
  return { contacts: num((res.data as Record<string, unknown>)?.contacts) };
};

export const syncFacebookComments = async (): Promise<{ posts: number; comments: number }> => {
  const res = await apiClient.post('/facebook/comments/sync', {});
  const d = (res.data ?? {}) as Record<string, unknown>;
  return { posts: num(d.posts), comments: num(d.comments) };
};

export const replyFacebookComment = (id: string, message: string) =>
  apiClient.post(`/facebook/comments/${encodeURIComponent(id)}/reply`, { message });

export const privateReplyFacebookComment = (id: string, message: string) =>
  apiClient.post(`/facebook/comments/${encodeURIComponent(id)}/private-reply`, { message });

export const hideFacebookComment = (id: string, hidden: boolean) =>
  apiClient.post(`/facebook/comments/${encodeURIComponent(id)}/hide`, { hidden });

export const deleteFacebookComment = (id: string) =>
  apiClient.delete(`/facebook/comments/${encodeURIComponent(id)}`);

export const fetchFacebookCommentConfig = async (): Promise<FacebookCommentConfig> => {
  const res = await apiClient.get('/facebook/config');
  const d = (res.data ?? {}) as Record<string, unknown>;
  return {
    autoHidePhone: d.autoHidePhone === true,
    autoHideKeywords: Array.isArray(d.autoHideKeywords) ? (d.autoHideKeywords as string[]) : [],
    autoReplyEnabled: d.autoReplyEnabled === true,
    autoReplyText: str(d.autoReplyText),
    autoPrivateReply: d.autoPrivateReply === true,
    privateReplyText: str(d.privateReplyText),
  };
};

export const saveFacebookCommentConfig = (cfg: Partial<FacebookCommentConfig>) =>
  apiClient.put('/facebook/config', cfg);
