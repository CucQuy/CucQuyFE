import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ExternalLink, FileText, MessageSquare, RefreshCw } from 'lucide-react';
import {
  fetchPagePosts,
  syncFacebookComments,
  syncInstagramComments,
  type PagePost,
  type SocialPlatform,
} from '@/services/facebookService';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Image from '@/components/ui/Image';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import BaseModal from '@/components/BaseModal';
import FacebookCommentsTab from './FacebookCommentsTab';

const at = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

interface Props {
  /** Khoá theo 1 nền tảng (màn Facebook / Instagram riêng). */
  lockPlatform?: SocialPlatform;
}

/**
 * Danh sách bài đã kéo về từ fanpage / Instagram. Mỗi bài hiện số bình luận và
 * số CHƯA trả lời để biết bài nào đang cần chăm; bấm vào bài mở đúng bình luận của bài đó.
 */
const PagePostsTab: React.FC<Props> = ({ lockPlatform }) => {
  const { t } = useLanguage();
  const [items, setItems] = useState<PagePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [openPost, setOpenPost] = useState<PagePost | null>(null);
  /** Chỉ tự kéo 1 lần mỗi lượt mở màn — kênh thật sự chưa có bài thì đừng gọi lại mãi. */
  const autoSynced = useRef(false);

  const load = useCallback(async (): Promise<PagePost[]> => {
    setLoading(true);
    try {
      const rows = await fetchPagePosts(lockPlatform ?? '', 30);
      setItems(rows);
      return rows;
    } catch {
      toast.error(t('channels.postsLoadFailed'));
      return [];
    } finally {
      setLoading(false);
    }
  }, [lockPlatform]);

  // Lần đầu vào màn mà DB chưa có bài nào thì tự kéo từ kênh về, khỏi bắt bấm nút.
  useEffect(() => {
    void (async () => {
      const rows = await load();
      if (rows.length > 0 || autoSynced.current) return;
      autoSynced.current = true;
      setSyncing(true);
      try {
        if (lockPlatform === 'instagram') await syncInstagramComments();
        else await syncFacebookComments();
        await load();
      } catch {
        // chưa cấp quyền / chưa nối kênh → để trạng thái trống + nút kéo tay
      } finally {
        setSyncing(false);
      }
    })();
  }, [load, lockPlatform]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r =
        lockPlatform === 'instagram' ? await syncInstagramComments() : await syncFacebookComments();
      toast.success(
        t('channels.cmtSynced').replace('{c}', String(r.comments)).replace('{p}', String(r.posts)),
      );
      await load();
    } catch {
      toast.error(t('channels.cmtSyncFailed'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Box layoutClassName="space-y-4">
      <Card layoutClassName="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <Typography as="span" size="sm" variant="muted">
          {t('channels.total')}: <b>{items.length}</b>
        </Typography>
        <Typography as="span" size="sm" textClassName="text-amber-600 dark:text-amber-400">
          {t('channels.cmtPending')}: <b>{items.reduce((sum, p) => sum + p.pendingCount, 0)}</b>
        </Typography>
        <Box layoutClassName="ml-auto">
          <Button
            type="button"
            onClick={() => void handleSync()}
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
            {syncing ? t('channels.cmtSyncing') : t('channels.postsSync')}
          </Button>
        </Box>
      </Card>

      {loading && items.length === 0 ? (
        <Card layoutClassName="flex items-center justify-center gap-2 p-8">
          <Spinner size="md" />
          <Typography size="sm" variant="muted">
            {t('channels.loading')}
          </Typography>
        </Card>
      ) : items.length === 0 ? (
        <Card layoutClassName="p-6">
          <EmptyState
            icon={<FileText className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
            title={t('channels.postsEmptyTitle')}
            description={t('channels.postsEmptyDesc')}
          />
        </Card>
      ) : (
        <Box layoutClassName="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {items.map((p) => (
            <Card
              key={p.id}
              layoutClassName="flex cursor-pointer gap-3 p-3"
              hoverClassName="hover:border-primary-300 dark:hover:border-primary-500"
              borderClassName="border border-transparent"
              onClick={() => setOpenPost(p)}
            >
              {p.mediaUrl ? (
                <Image
                  src={p.mediaUrl}
                  alt={t('channels.attachedImageAlt')}
                  layoutClassName="h-16 w-16 shrink-0 object-cover"
                  roundedClassName="rounded"
                />
              ) : (
                <Box
                  layoutClassName="flex h-16 w-16 shrink-0 items-center justify-center"
                  backgroundClassName="bg-slate-50 dark:bg-slate-700/40"
                  roundedClassName="rounded"
                >
                  <FileText className="h-5 w-5 text-slate-300 dark:text-slate-500" />
                </Box>
              )}

              <Box layoutClassName="min-w-0 flex-1 space-y-1">
                <Box layoutClassName="flex flex-wrap items-center gap-2">
                  {lockPlatform ? null : (
                    <Badge
                      size="sm"
                      backgroundClassName={p.platform === 'instagram' ? 'bg-pink-50 dark:bg-pink-900/30' : 'bg-sky-50 dark:bg-sky-900/30'}
                      textClassName={p.platform === 'instagram' ? 'text-pink-700 dark:text-pink-300' : 'text-sky-700 dark:text-sky-300'}
                    >
                      {p.platform === 'instagram' ? t('channels.srcInstagram') : t('channels.srcFacebook')}
                    </Badge>
                  )}
                  <Typography as="span" size="xs" variant="muted">
                    {at(p.createdTime)}
                  </Typography>
                </Box>

                <Typography
                  as="p"
                  size="sm"
                  layoutClassName="line-clamp-2"
                  textClassName="text-slate-700 dark:text-slate-200"
                >
                  {p.message || t('channels.cmtNoText')}
                </Typography>

                <Box layoutClassName="flex flex-wrap items-center gap-2">
                  <Typography as="span" size="xs" variant="muted">
                    <MessageSquare className="mr-1 inline h-3 w-3" />
                    {p.commentCount}
                  </Typography>
                  {p.pendingCount > 0 ? (
                    <Badge
                      size="sm"
                      backgroundClassName="bg-amber-50 dark:bg-amber-900/30"
                      textClassName="text-amber-700 dark:text-amber-300"
                    >
                      {p.pendingCount} {t('channels.postsPendingSuffix')}
                    </Badge>
                  ) : null}
                  {p.permalink ? (
                    <Typography
                      as="span"
                      size="xs"
                      textClassName="text-primary-600 dark:text-primary-300"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        window.open(p.permalink, '_blank', 'noopener');
                      }}
                    >
                      <ExternalLink className="mr-1 inline h-3 w-3" />
                      {t('channels.postsOpenOnPlatform')}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            </Card>
          ))}
        </Box>
      )}

      {/* Bình luận của 1 bài — dùng lại nguyên bộ máy của màn Bình luận */}
      {openPost ? (
        <BaseModal
          isOpen
          onClose={() => {
            setOpenPost(null);
            void load();
          }}
          title={openPost.message.slice(0, 60) || t('channels.postsCommentsTitle')}
          size="xl"
        >
          <FacebookCommentsTab lockPlatform={openPost.platform} postId={openPost.id} />
        </BaseModal>
      ) : null}
    </Box>
  );
};

export default PagePostsTab;
