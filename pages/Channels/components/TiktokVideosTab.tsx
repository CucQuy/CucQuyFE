import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, ExternalLink, Heart, MessageCircle, RefreshCw, Share2, Video } from 'lucide-react';
import {
  fetchTiktokVideos,
  syncTiktokVideos,
  type TiktokVideoList,
} from '@/services/tiktokService';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Image from '@/components/ui/Image';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';

const EMPTY: TiktokVideoList = {
  items: [],
  totals: { videos: 0, views: 0, likes: 0, comments: 0, shares: 0, syncedAt: null },
};

const at = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** 90 → "1:30" (TikTok trả độ dài bằng giây). */
const dur = (seconds: number): string => {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const n = (v: number): string => v.toLocaleString('vi-VN');

/**
 * Video của tài khoản TikTok + chỉ số từng bài.
 *
 * Dữ liệu đọc từ cache trong DB (BE kéo về bằng Display API) nên màn mở ra là có ngay;
 * bấm "Kéo video mới" mới thực sự gọi TikTok — rate limit của Display API khá chặt,
 * không gọi mỗi lần vào màn.
 */
const TiktokVideosTab: React.FC = () => {
  const { t } = useLanguage();
  const [data, setData] = useState<TiktokVideoList>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchTiktokVideos(60));
    } catch {
      toast.error(t('channels.ttVideosLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      const { synced } = await syncTiktokVideos(40);
      toast.success(t('channels.ttVideosSynced').replace('{n}', String(synced)));
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('channels.ttVideosSyncFailed'));
    } finally {
      setSyncing(false);
    }
  };

  const totals: { labelKey: string; value: number; icon: React.ReactNode }[] = [
    { labelKey: 'channels.ttTotalVideos', value: data.totals.videos, icon: <Video className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> },
    { labelKey: 'channels.ttTotalViews', value: data.totals.views, icon: <Eye className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> },
    { labelKey: 'channels.ttTotalLikes', value: data.totals.likes, icon: <Heart className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> },
    { labelKey: 'channels.ttTotalComments', value: data.totals.comments, icon: <MessageCircle className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> },
    { labelKey: 'channels.ttTotalShares', value: data.totals.shares, icon: <Share2 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> },
  ];

  return (
    <Box layoutClassName="space-y-4">
      <Card layoutClassName="space-y-3 p-4">
        <Box layoutClassName="flex flex-wrap items-center justify-between gap-2">
          <Typography size="xs" variant="muted">
            {data.totals.syncedAt
              ? `${t('channels.ttLastSync')}: ${at(data.totals.syncedAt)}`
              : t('channels.ttNeverSynced')}
          </Typography>
          <Button
            type="button"
            onClick={() => void sync()}
            disabled={syncing}
            leftIcon={syncing ? <Spinner size="sm" /> : <RefreshCw className="h-3.5 w-3.5" />}
            variant="secondary"
            borderClassName="border border-slate-200 dark:border-slate-600"
            backgroundClassName="bg-white dark:bg-slate-800"
            textClassName="text-xs font-medium text-slate-700 dark:text-slate-200"
            roundedClassName="rounded-lg"
            sizeClassName="px-2.5 py-1.5"
            layoutClassName="inline-flex items-center gap-1.5"
          >
            {t('channels.ttSyncVideos')}
          </Button>
        </Box>

        <Box layoutClassName="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {totals.map((s) => (
            <Box
              key={s.labelKey}
              layoutClassName="space-y-1 p-3"
              backgroundClassName="bg-slate-50 dark:bg-slate-700/30"
              roundedClassName="rounded-lg"
            >
              <Box layoutClassName="flex items-center gap-1.5">
                {s.icon}
                <Typography as="span" size="xs" variant="muted">
                  {t(s.labelKey)}
                </Typography>
              </Box>
              <Typography
                as="p"
                size="lg"
                layoutClassName="font-bold"
                textClassName="text-slate-900 dark:text-slate-50"
              >
                {n(s.value)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Card>

      {loading && data.items.length === 0 ? (
        <Card layoutClassName="flex items-center justify-center gap-2 p-8">
          <Spinner size="md" />
          <Typography size="sm" variant="muted">
            {t('channels.loading')}
          </Typography>
        </Card>
      ) : data.items.length === 0 ? (
        <Card layoutClassName="p-6">
          <EmptyState
            icon={<Video className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
            title={t('channels.ttVideosEmptyTitle')}
            description={t('channels.ttVideosEmptyDesc')}
          />
        </Card>
      ) : (
        <Box layoutClassName="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((v) => (
            <Card key={v.id} layoutClassName="flex gap-3 p-3">
              {v.coverUrl ? (
                <Box layoutClassName="relative shrink-0">
                  <Image
                    src={v.coverUrl}
                    alt={v.title || v.description}
                    layoutClassName="h-24 w-16 object-cover"
                    roundedClassName="rounded"
                  />
                  {v.duration ? (
                    <Typography
                      as="span"
                      size="xs"
                      layoutClassName="absolute bottom-0.5 right-0.5 px-1"
                      backgroundClassName="bg-black/60"
                      textClassName="text-white"
                      roundedClassName="rounded"
                    >
                      {dur(v.duration)}
                    </Typography>
                  ) : null}
                </Box>
              ) : null}

              <Box layoutClassName="min-w-0 flex-1 space-y-1.5">
                <Typography
                  as="p"
                  size="sm"
                  layoutClassName="line-clamp-2 font-medium"
                  textClassName="text-slate-800 dark:text-slate-100"
                >
                  {v.title || v.description || t('channels.ttNoCaption')}
                </Typography>
                <Typography as="p" size="xs" variant="muted">
                  {at(v.createdTime)}
                </Typography>

                <Box layoutClassName="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Typography as="span" size="xs" variant="muted">
                    <Eye className="mr-1 inline h-3 w-3" />
                    {n(v.viewCount)}
                  </Typography>
                  <Typography as="span" size="xs" variant="muted">
                    <Heart className="mr-1 inline h-3 w-3" />
                    {n(v.likeCount)}
                  </Typography>
                  <Typography as="span" size="xs" variant="muted">
                    <MessageCircle className="mr-1 inline h-3 w-3" />
                    {n(v.commentCount)}
                  </Typography>
                  <Typography as="span" size="xs" variant="muted">
                    <Share2 className="mr-1 inline h-3 w-3" />
                    {n(v.shareCount)}
                  </Typography>
                </Box>

                {v.shareUrl ? (
                  <Typography
                    as="span"
                    size="xs"
                    textClassName="text-primary-600 dark:text-primary-300"
                    onClick={() => window.open(v.shareUrl, '_blank', 'noopener')}
                  >
                    <ExternalLink className="mr-1 inline h-3 w-3" />
                    {t('channels.ttOpenVideo')}
                  </Typography>
                ) : null}
              </Box>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default TiktokVideosTab;
