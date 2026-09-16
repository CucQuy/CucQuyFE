import { apiClient } from '@/services/api/client';

/** Tài khoản TikTok đang nối (không bao giờ kèm token — BE giữ riêng). */
export interface TiktokAccount {
  openId: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  profileUrl: string;
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
  scopes: string[];
  expiresAt: string | null;
  refreshExpiresAt: string | null;
  connectedBy: string;
  syncedAt: string | null;
  connectedAt: string | null;
}

/** Quyền token thực sự có — app chưa được TikTok duyệt thì thiếu bớt. */
export interface TiktokCapabilities {
  profile: boolean;
  stats: boolean;
  videoList: boolean;
  upload: boolean;
  publish: boolean;
}

export interface TiktokStatus {
  /** false = chưa khai TIKTOK_CLIENT_KEY/SECRET/REDIRECT_URI ở backend. */
  configured: boolean;
  account: TiktokAccount | null;
  can: TiktokCapabilities;
}

export interface TiktokVideo {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  shareUrl: string;
  embedLink: string;
  duration: number; // giây
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdTime: string | null;
}

export interface TiktokVideoList {
  items: TiktokVideo[];
  totals: {
    videos: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    syncedAt: string | null;
  };
}

/** 'direct' = đăng thẳng lên profile; 'inbox' = đẩy vào hộp nháp của app TikTok. */
export type TiktokPublishMode = 'direct' | 'inbox';

export type TiktokPublishStatus =
  | 'draft'
  | 'scheduled'
  | 'processing'
  | 'published'
  | 'failed';

export type TiktokPrivacyLevel =
  | 'PUBLIC_TO_EVERYONE'
  | 'MUTUAL_FOLLOW_FRIENDS'
  | 'FOLLOWER_OF_CREATOR'
  | 'SELF_ONLY';

export interface TiktokPublish {
  id: string;
  title: string;
  videoUrl: string;
  mode: TiktokPublishMode;
  privacyLevel: TiktokPrivacyLevel;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
  scheduledAt: string | null;
  status: TiktokPublishStatus;
  publishId: string;
  videoId: string;
  error: string;
  createdBy: string;
  publishedAt: string | null;
  createdAt: string | null;
}

/** Điều kiện đăng do TikTok trả về — bắt buộc hiện trước khi cho bấm đăng. */
export interface TiktokCreatorInfo {
  nickname: string;
  username: string;
  avatarUrl: string;
  privacyOptions: TiktokPrivacyLevel[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoSeconds: number;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const iso = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];

const PUBLISH_STATUSES: TiktokPublishStatus[] = [
  'draft',
  'scheduled',
  'processing',
  'published',
  'failed',
];

const PRIVACY_LEVELS: TiktokPrivacyLevel[] = [
  'PUBLIC_TO_EVERYONE',
  'MUTUAL_FOLLOW_FRIENDS',
  'FOLLOWER_OF_CREATOR',
  'SELF_ONLY',
];

const toAccount = (r: Record<string, unknown> | null): TiktokAccount | null => {
  if (!r || r.connected !== true) return null;
  return {
    openId: str(r.openId),
    displayName: str(r.displayName),
    username: str(r.username),
    avatarUrl: str(r.avatarUrl),
    profileUrl: str(r.profileUrl),
    isVerified: r.isVerified === true,
    followerCount: num(r.followerCount),
    followingCount: num(r.followingCount),
    likesCount: num(r.likesCount),
    videoCount: num(r.videoCount),
    scopes: strList(r.scopes),
    expiresAt: iso(r.expiresAt),
    refreshExpiresAt: iso(r.refreshExpiresAt),
    connectedBy: str(r.connectedBy),
    syncedAt: iso(r.syncedAt),
    connectedAt: iso(r.connectedAt),
  };
};

const toVideo = (r: Record<string, unknown>): TiktokVideo => ({
  id: str(r.id),
  title: str(r.title),
  description: str(r.description),
  coverUrl: str(r.coverUrl),
  shareUrl: str(r.shareUrl),
  embedLink: str(r.embedLink),
  duration: num(r.duration),
  viewCount: num(r.viewCount),
  likeCount: num(r.likeCount),
  commentCount: num(r.commentCount),
  shareCount: num(r.shareCount),
  createdTime: iso(r.createdTime),
});

const toPublish = (r: Record<string, unknown>): TiktokPublish => ({
  id: str(r.id),
  title: str(r.title),
  videoUrl: str(r.videoUrl),
  mode: r.mode === 'direct' ? 'direct' : 'inbox',
  privacyLevel: PRIVACY_LEVELS.includes(r.privacyLevel as TiktokPrivacyLevel)
    ? (r.privacyLevel as TiktokPrivacyLevel)
    : 'SELF_ONLY',
  disableComment: r.disableComment === true,
  disableDuet: r.disableDuet === true,
  disableStitch: r.disableStitch === true,
  scheduledAt: iso(r.scheduledAt),
  status: PUBLISH_STATUSES.includes(r.status as TiktokPublishStatus)
    ? (r.status as TiktokPublishStatus)
    : 'draft',
  publishId: str(r.publishId),
  videoId: str(r.videoId),
  error: str(r.error),
  createdBy: str(r.createdBy),
  publishedAt: iso(r.publishedAt),
  createdAt: iso(r.createdAt),
});

// ── Kết nối ────────────────────────────────────────────────
export const fetchTiktokStatus = async (): Promise<TiktokStatus> => {
  const res = await apiClient.get('/tiktok/status');
  const d = (res.data ?? {}) as Record<string, unknown>;
  const can = (d.can ?? {}) as Record<string, unknown>;
  return {
    configured: d.configured === true,
    account: toAccount((d.account ?? null) as Record<string, unknown> | null),
    can: {
      profile: can.profile === true,
      stats: can.stats === true,
      videoList: can.videoList === true,
      upload: can.upload === true,
      publish: can.publish === true,
    },
  };
};

/** URL màn cấp quyền của TikTok — FE chuyển hướng cả tab sang đây. */
export const fetchTiktokAuthUrl = async (): Promise<string> => {
  const res = await apiClient.get('/tiktok/auth-url');
  const d = (res.data ?? {}) as Record<string, unknown>;
  return str(d.url);
};

export const syncTiktokProfile = async (): Promise<TiktokAccount | null> => {
  const res = await apiClient.post('/tiktok/sync-profile', {});
  return toAccount((res.data ?? null) as Record<string, unknown> | null);
};

export const disconnectTiktok = async (): Promise<void> => {
  await apiClient.delete('/tiktok/connection');
};

// ── Video ──────────────────────────────────────────────────
export const fetchTiktokVideos = async (limit = 30, offset = 0): Promise<TiktokVideoList> => {
  const res = await apiClient.get('/tiktok/videos', { params: { limit, offset } });
  const d = (res.data ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : [];
  const t = (d.totals ?? {}) as Record<string, unknown>;
  return {
    items: rows.map(toVideo),
    totals: {
      videos: num(t.videos),
      views: num(t.views),
      likes: num(t.likes),
      comments: num(t.comments),
      shares: num(t.shares),
      syncedAt: iso(t.syncedAt),
    },
  };
};

export const syncTiktokVideos = async (max = 40): Promise<{ synced: number }> => {
  const res = await apiClient.post('/tiktok/videos/sync', { max });
  const d = (res.data ?? {}) as Record<string, unknown>;
  return { synced: num(d.synced) };
};

// ── Đăng video ─────────────────────────────────────────────
export const fetchTiktokCreatorInfo = async (): Promise<TiktokCreatorInfo> => {
  const res = await apiClient.get('/tiktok/creator-info');
  const d = (res.data ?? {}) as Record<string, unknown>;
  return {
    nickname: str(d.nickname),
    username: str(d.username),
    avatarUrl: str(d.avatarUrl),
    privacyOptions: strList(d.privacyOptions).filter((p): p is TiktokPrivacyLevel =>
      PRIVACY_LEVELS.includes(p as TiktokPrivacyLevel),
    ),
    commentDisabled: d.commentDisabled === true,
    duetDisabled: d.duetDisabled === true,
    stitchDisabled: d.stitchDisabled === true,
    maxVideoSeconds: num(d.maxVideoSeconds),
  };
};

export const fetchTiktokPublishes = async (limit = 50): Promise<TiktokPublish[]> => {
  const res = await apiClient.get('/tiktok/publishes', { params: { limit } });
  const rows = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : [];
  return rows.map(toPublish);
};

export const saveTiktokPublish = async (payload: {
  id?: string;
  title?: string;
  videoUrl: string;
  mode: TiktokPublishMode;
  privacyLevel?: TiktokPrivacyLevel;
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
  scheduledAt?: string;
  publishNow?: boolean;
}): Promise<TiktokPublish | null> => {
  const res = await apiClient.post('/tiktok/publishes', payload);
  return res.data ? toPublish(res.data as Record<string, unknown>) : null;
};

export const publishTiktokVideo = async (id: string): Promise<TiktokPublish | null> => {
  const res = await apiClient.post(`/tiktok/publishes/${id}/publish`, {});
  return res.data ? toPublish(res.data as Record<string, unknown>) : null;
};

/** Hỏi lại TikTok kết quả của bài đang xử lý (TikTok đăng bất đồng bộ). */
export const refreshTiktokPublish = async (id: string): Promise<TiktokPublish | null> => {
  const res = await apiClient.post(`/tiktok/publishes/${id}/refresh`, {});
  return res.data ? toPublish(res.data as Record<string, unknown>) : null;
};

export const deleteTiktokPublish = async (id: string): Promise<void> => {
  await apiClient.delete(`/tiktok/publishes/${id}`);
};
