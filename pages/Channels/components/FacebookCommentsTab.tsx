import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Eye,
  EyeOff,
  MessageSquareReply,
  RefreshCw,
  Send,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  deleteFacebookComment,
  fetchFacebookComments,
  hideFacebookComment,
  privateReplyFacebookComment,
  replyFacebookComment,
  syncFacebookComments,
  syncInstagramComments,
  type FacebookComment,
  type SocialPlatform,
} from '@/services/facebookService';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Checkbox from '@/components/ui/Checkbox';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmModal from '@/components/ConfirmModal';

type Filter = '' | 'pending' | 'hidden' | 'replied';

const FILTERS: { id: Filter; labelKey: string }[] = [
  { id: 'pending', labelKey: 'channels.cmtPending' },
  { id: '', labelKey: 'channels.all' },
  { id: 'replied', labelKey: 'channels.cmtReplied' },
  { id: 'hidden', labelKey: 'channels.cmtHidden' },
];

/** Nguồn bình luận — Instagram dùng chung page token nên nằm chung danh sách. */
const PLATFORMS: { id: '' | SocialPlatform; labelKey: string }[] = [
  { id: '', labelKey: 'channels.allSources' },
  { id: 'facebook', labelKey: 'channels.srcFacebook' },
  { id: 'instagram', labelKey: 'channels.srcInstagram' },
];

/** Nhãn cho luật tự động đã chạy trên bình luận. */
const AUTO_LABEL_KEY: Record<string, string> = {
  hide_phone: 'channels.autoHidePhoneTag',
  hide_keyword: 'channels.autoHideKeywordTag',
  reply: 'channels.autoReplyTag',
  private_reply: 'channels.autoPrivateReplyTag',
};

const at = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Lỗi thiếu quyền → chỉ dẫn lấy token mới, thay vì báo đỏ chung chung. */
const isPermissionError = (e: any): boolean =>
  String(e?.response?.data?.message ?? e?.message ?? '').includes('FB_MISSING_PERMISSION');

/**
 * Tab "Bình luận" của Facebook: xem bình luận fanpage, trả lời công khai, nhắn riêng
 * người bình luận (mở cửa sổ 24h), ẩn/bỏ ẩn, xoá; kèm các luật tự động.
 * Abit không có API cho phần này nên mọi thao tác đi thẳng Graph API của Meta.
 */
interface Props {
  /** Khoá màn theo 1 nền tảng; bỏ trống = hiện cả hai kèm hàng chọn nguồn. */
  lockPlatform?: SocialPlatform;
  /** Chỉ bình luận của 1 bài (dùng khi mở từ màn Bài viết). */
  postId?: string;
}

const FacebookCommentsTab: React.FC<Props> = ({ lockPlatform, postId }) => {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Filter>('pending');
  const [platform, setPlatform] = useState<'' | SocialPlatform>(lockPlatform ?? '');
  const [items, setItems] = useState<FacebookComment[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    hidden: 0,
    replied: 0,
    facebook: 0,
    instagram: 0,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [noPermission, setNoPermission] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyPrivate, setReplyPrivate] = useState(false);
  /** Bình luận chờ xác nhận xoá (xoá trên Facebook/Instagram là KHÔNG hoàn tác được). */
  const [delCmt, setDelCmt] = useState<FacebookComment | null>(null);

  /** Chỉ tự kéo 1 lần mỗi lượt mở màn. */
  const autoSynced = useRef(false);

  const load = useCallback(async (): Promise<number> => {
    setLoading(true);
    try {
      const r = await fetchFacebookComments(filter, 100, platform, postId ?? '');
      setItems(r.items);
      setCounts(r.counts);
      return r.counts.total;
    } catch {
      toast.error(t('channels.cmtLoadFailed'));
      return 0;
    } finally {
      setLoading(false);
    }
  }, [filter, platform, postId]);

  // Chưa có bình luận nào trong DB thì tự kéo về lần đầu (khi mở từ 1 bài thì thôi —
  // màn Bài viết đã kéo trước đó rồi).
  useEffect(() => {
    void (async () => {
      const total = await load();
      if (total > 0 || postId || autoSynced.current) return;
      autoSynced.current = true;
      setSyncing(true);
      try {
        if (lockPlatform === 'instagram') await syncInstagramComments();
        else await syncFacebookComments();
        await load();
      } catch (e) {
        if (isPermissionError(e)) setNoPermission(true);
      } finally {
        setSyncing(false);
      }
    })();
  }, [load, lockPlatform, postId]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = lockPlatform === 'instagram'
        ? await syncInstagramComments()
        : await syncFacebookComments();
      toast.success(t('channels.cmtSynced').replace('{c}', String(r.comments)).replace('{p}', String(r.posts)));
      setNoPermission(false);
      await load();
    } catch (e: any) {
      if (isPermissionError(e)) setNoPermission(true);
      else toast.error(t('channels.cmtSyncFailed'));
    } finally {
      setSyncing(false);
    }
  };

  const act = async (id: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(okMsg);
      await load();
    } catch (e: any) {
      if (isPermissionError(e)) {
        setNoPermission(true);
        toast.error(t('channels.cmtNoPermission'));
      } else {
        toast.error(e?.response?.data?.message || t('channels.cmtActionFailed'));
      }
    } finally {
      setBusyId(null);
    }
  };

  const submitReply = async (c: FacebookComment) => {
    const text = replyText.trim();
    if (!text) {
      toast.error(t('channels.cmtNoContent'));
      return;
    }
    await act(
      c.id,
      () =>
        replyPrivate
          ? privateReplyFacebookComment(c.id, text)
          : replyFacebookComment(c.id, text),
      replyPrivate ? t('channels.cmtPrivateRepliedDone') : t('channels.cmtRepliedDone'),
    );
    setReplyFor(null);
    setReplyText('');
  };

  return (
    <Box layoutClassName="space-y-4">
      {noPermission ? (
        <Card
          layoutClassName="flex items-start gap-2 p-4"
          backgroundClassName="bg-amber-50 dark:bg-amber-900/20"
          borderClassName="border border-amber-200 dark:border-amber-800"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <Box layoutClassName="space-y-1">
            <Typography as="p" size="sm" layoutClassName="font-semibold" textClassName="text-amber-800 dark:text-amber-200">
              {t('channels.permTitle')}
            </Typography>
            <Typography as="p" size="xs" textClassName="text-amber-700 dark:text-amber-300">
              {t('channels.permDesc')}
            </Typography>
          </Box>
        </Card>
      ) : null}

      {/* Bộ lọc + đồng bộ */}
      <Card layoutClassName="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <Box layoutClassName="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <Typography as="span" size="sm" variant="muted">
            {t('channels.total')}: <b>{counts.total}</b>
          </Typography>
          <Typography as="span" size="sm" textClassName="text-amber-600 dark:text-amber-400">
            {t('channels.cmtPending')}: <b>{counts.pending}</b>
          </Typography>
          <Typography as="span" size="sm" variant="muted">
            {t('channels.cmtHidden')}: <b>{counts.hidden}</b>
          </Typography>
        </Box>
        <Box layoutClassName="ml-auto flex flex-wrap items-center gap-2">
          {(lockPlatform ? [] : PLATFORMS).map((p) => (
            <Button
              key={p.id || 'both'}
              type="button"
              onClick={() => setPlatform(p.id)}
              variant="secondary"
              disableVariantHover
              disableVariantTextColor
              borderClassName={platform === p.id ? 'border border-primary-400 dark:border-primary-500' : 'border border-slate-200 dark:border-slate-600'}
              backgroundClassName={platform === p.id ? 'bg-primary-50 dark:bg-primary-900/30' : 'bg-white dark:bg-slate-800'}
              textClassName={platform === p.id ? 'text-xs font-semibold text-primary-700 dark:text-primary-200' : 'text-xs font-medium text-slate-600 dark:text-slate-300'}
              roundedClassName="rounded-lg"
              sizeClassName="px-2.5 py-1.5"
            >
              {t(p.labelKey)}
            </Button>
          ))}
          {lockPlatform ? null : (
            <Box layoutClassName="h-4 w-px" backgroundClassName="bg-slate-200 dark:bg-slate-600" />
          )}
          {FILTERS.map((f) => (
            <Button
              key={f.id || 'all'}
              type="button"
              onClick={() => setFilter(f.id)}
              variant="secondary"
              disableVariantHover
              disableVariantTextColor
              borderClassName={filter === f.id ? 'border border-primary-400 dark:border-primary-500' : 'border border-slate-200 dark:border-slate-600'}
              backgroundClassName={filter === f.id ? 'bg-primary-50 dark:bg-primary-900/30' : 'bg-white dark:bg-slate-800'}
              textClassName={filter === f.id ? 'text-xs font-semibold text-primary-700 dark:text-primary-200' : 'text-xs font-medium text-slate-600 dark:text-slate-300'}
              roundedClassName="rounded-lg"
              sizeClassName="px-2.5 py-1.5"
            >
              {t(f.labelKey)}
            </Button>
          ))}
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
            {syncing ? t('channels.cmtSyncing') : t('channels.cmtSync')}
          </Button>
        </Box>
      </Card>

      {/* Danh sách bình luận */}
      {loading && items.length === 0 ? (
        <Card layoutClassName="flex items-center justify-center gap-2 p-8">
          <Spinner size="md" />
          <Typography size="sm" variant="muted">{t('channels.loading')}</Typography>
        </Card>
      ) : items.length === 0 ? (
        <Card layoutClassName="p-6">
          <EmptyState
            icon={<MessageSquareReply className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
            title={t('channels.cmtEmptyTitle')}
            description={t('channels.cmtEmptyDesc')}
          />
        </Card>
      ) : (
        <Box layoutClassName="space-y-2">
          {items.map((c) => (
            <Card key={c.id} layoutClassName="space-y-2 p-3">
              <Box layoutClassName="flex flex-wrap items-center gap-2">
                {lockPlatform ? null : (
                <Badge
                  backgroundClassName={c.platform === 'instagram' ? 'bg-pink-50 dark:bg-pink-900/30' : 'bg-sky-50 dark:bg-sky-900/30'}
                  textClassName={c.platform === 'instagram' ? 'text-pink-700 dark:text-pink-300' : 'text-sky-700 dark:text-sky-300'}
                  size="sm"
                >
                  {c.platform === 'instagram' ? t('channels.srcInstagram') : t('channels.srcFacebook')}
                </Badge>
                )}
                <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-800 dark:text-slate-100">
                  {c.fromName || t('channels.cmtUnknownName')}
                </Typography>
                <Typography as="span" size="xs" variant="muted">
                  {at(c.createdTime)}
                </Typography>
                {c.isHidden ? (
                  <Badge size="sm" backgroundClassName="bg-slate-100 dark:bg-slate-700/50" textClassName="text-slate-600 dark:text-slate-300" borderClassName="border border-slate-200 dark:border-slate-600">
                    {t('channels.cmtHidden')}
                  </Badge>
                ) : null}
                {c.repliedAt ? (
                  <Badge size="sm" backgroundClassName="bg-emerald-50 dark:bg-emerald-900/20" textClassName="text-emerald-700 dark:text-emerald-300" borderClassName="border border-emerald-200 dark:border-emerald-800">
                    {t('channels.cmtReplied')}
                  </Badge>
                ) : null}
                {c.autoAction ? (
                  <Typography as="span" size="xs" variant="muted">
                    · {AUTO_LABEL_KEY[c.autoAction] ? t(AUTO_LABEL_KEY[c.autoAction]) : c.autoAction}
                  </Typography>
                ) : null}
              </Box>

              <Typography as="p" size="sm" textClassName="text-slate-700 dark:text-slate-200">
                {c.message || t('channels.cmtNoText')}
              </Typography>
              {c.postMessage ? (
                <Typography as="p" size="xs" variant="muted">
                  {t('channels.cmtPost')}: {c.postMessage.slice(0, 70)}
                  {c.postMessage.length > 70 ? '…' : ''}
                </Typography>
              ) : null}

              <Box layoutClassName="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  onClick={() => {
                    setReplyFor(replyFor === c.id ? null : c.id);
                    setReplyText('');
                    setReplyPrivate(false);
                  }}
                  disabled={busyId === c.id}
                  leftIcon={<MessageSquareReply className="h-3.5 w-3.5" />}
                  variant="secondary"
                  borderClassName="border border-slate-200 dark:border-slate-600"
                  backgroundClassName="bg-white dark:bg-slate-800"
                  textClassName="text-xs font-medium text-slate-700 dark:text-slate-200"
                  roundedClassName="rounded-lg"
                  sizeClassName="px-2.5 py-1.5"
                  layoutClassName="inline-flex items-center gap-1.5"
                >
                  {t('channels.cmtReply')}
                </Button>
                <Button
                  type="button"
                  onClick={() => void act(c.id, () => hideFacebookComment(c.id, !c.isHidden), c.isHidden ? t('channels.cmtUnhiddenDone') : t('channels.cmtHiddenDone'))}
                  disabled={busyId === c.id}
                  leftIcon={c.isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  variant="secondary"
                  borderClassName="border border-slate-200 dark:border-slate-600"
                  backgroundClassName="bg-white dark:bg-slate-800"
                  textClassName="text-xs font-medium text-slate-700 dark:text-slate-200"
                  roundedClassName="rounded-lg"
                  sizeClassName="px-2.5 py-1.5"
                  layoutClassName="inline-flex items-center gap-1.5"
                >
                  {c.isHidden ? t('channels.cmtUnhide') : t('channels.cmtHide')}
                </Button>
                <Button
                  type="button"
                  onClick={() => setDelCmt(c)}
                  disabled={busyId === c.id}
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                  variant="secondary"
                  borderClassName="border border-rose-200 dark:border-rose-800"
                  backgroundClassName="bg-white dark:bg-slate-800"
                  textClassName="text-xs font-medium text-rose-600 dark:text-rose-400"
                  roundedClassName="rounded-lg"
                  sizeClassName="px-2.5 py-1.5"
                  layoutClassName="inline-flex items-center gap-1.5"
                >
                  {t('channels.cmtDelete')}
                </Button>
                {busyId === c.id ? <Spinner size="sm" /> : null}
              </Box>

              {replyFor === c.id ? (
                <Box layoutClassName="space-y-2 pt-1">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={2}
                    placeholder={t('channels.cmtReplyPlaceholder')}
                  />
                  <Box layoutClassName="flex flex-wrap items-center gap-3">
                    <Checkbox
                      checked={replyPrivate}
                      onChange={(e) => setReplyPrivate(e.target.checked)}
                      label={t('channels.cmtPrivateOption')}
                      labelClassName="text-xs text-slate-600 dark:text-slate-300"
                    />
                    <Button
                      type="button"
                      onClick={() => void submitReply(c)}
                      disabled={busyId === c.id}
                      leftIcon={<Send className="h-3.5 w-3.5" />}
                      backgroundClassName="bg-[#1877F2]"
                      hoverClassName="hover:bg-[#166FE5]"
                      textClassName="text-xs font-semibold text-white"
                      roundedClassName="rounded-lg"
                      sizeClassName="px-3 py-1.5"
                      layoutClassName="inline-flex items-center gap-1.5"
                      variant="primary"
                      disableVariantHover
                      disableVariantTextColor
                    >
                      {t('channels.send')}
                    </Button>
                  </Box>
                </Box>
              ) : null}
            </Card>
          ))}
        </Box>
      )}
      <ConfirmModal
        isOpen={!!delCmt}
        title={t('channels.cmtDelete')}
        message={t('channels.cmtConfirmDelete')}
        onConfirm={() => {
          const c = delCmt;
          setDelCmt(null);
          if (c) void act(c.id, () => deleteFacebookComment(c.id), t('channels.cmtDeleted'));
        }}
        onCancel={() => setDelCmt(null)}
      />
    </Box>
  );
};

export default FacebookCommentsTab;
