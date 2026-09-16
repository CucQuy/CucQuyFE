import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarClock, RefreshCw, Send, Trash2, Upload, Video, X } from 'lucide-react';
import {
  deleteTiktokPublish,
  fetchTiktokCreatorInfo,
  fetchTiktokPublishes,
  fetchTiktokStatus,
  publishTiktokVideo,
  refreshTiktokPublish,
  saveTiktokPublish,
  type TiktokCreatorInfo,
  type TiktokPrivacyLevel,
  type TiktokPublish,
  type TiktokPublishMode,
} from '@/services/tiktokService';
import { uploadVideo } from '@/services/imageService';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Checkbox from '@/components/ui/Checkbox';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Label from '@/components/ui/Label';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmModal from '@/components/ConfirmModal';

const at = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Màu badge theo trạng thái bài (giống bảng bài Facebook/Instagram cho quen mắt). */
const STATUS_STYLE: Record<TiktokPublish['status'], { bg: string; text: string; key: string }> = {
  draft: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300', key: 'channels.postDraft' },
  scheduled: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', key: 'channels.postScheduled' },
  processing: { bg: 'bg-sky-50 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-300', key: 'channels.ttProcessing' },
  published: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', key: 'channels.postPublished' },
  failed: { bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', key: 'channels.postFailed' },
};

const PRIVACY_KEYS: Record<TiktokPrivacyLevel, string> = {
  PUBLIC_TO_EVERYONE: 'channels.ttPrivacyPublic',
  MUTUAL_FOLLOW_FRIENDS: 'channels.ttPrivacyFriends',
  FOLLOWER_OF_CREATOR: 'channels.ttPrivacyFollowers',
  SELF_ONLY: 'channels.ttPrivacyPrivate',
};

/**
 * Đăng video lên TikTok từ app.
 *
 * Hai chế độ theo quyền TikTok đã duyệt cho app:
 * - "Gửi vào nháp TikTok" (`video.upload`) — video vào hộp nháp trong app TikTok, chủ tiệm
 *   mở app bấm đăng. App mới chỉ xin được quyền này.
 * - "Đăng thẳng" (`video.publish`) — lên profile luôn, phải qua audit của TikTok.
 *
 * Video upload lên RiceService rồi đưa TikTok cái link — TikTok tự tải về (PULL_FROM_URL).
 * Đăng là bất đồng bộ nên bài nằm ở "Đang xử lý" tới khi worker hỏi lại được kết quả.
 */
const TiktokPublishTab: React.FC = () => {
  const { t } = useLanguage();
  const [items, setItems] = useState<TiktokPublish[]>([]);
  const [creator, setCreator] = useState<TiktokCreatorInfo | null>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [canUpload, setCanUpload] = useState(false);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [mode, setMode] = useState<TiktokPublishMode>('inbox');
  const [privacy, setPrivacy] = useState<TiktokPrivacyLevel>('SELF_ONLY');
  const [disableComment, setDisableComment] = useState(false);
  const [disableDuet, setDisableDuet] = useState(false);
  const [disableStitch, setDisableStitch] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [delPost, setDelPost] = useState<TiktokPublish | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchTiktokPublishes(50));
    } catch {
      toast.error(t('channels.postLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Quyền quyết định chế độ mặc định; creator info là điều kiện TikTok BẮT BUỘC hiện
  // trước khi cho đăng (mức riêng tư được phép, độ dài tối đa).
  useEffect(() => {
    void (async () => {
      try {
        const status = await fetchTiktokStatus();
        setCanPublish(status.can.publish);
        setCanUpload(status.can.upload);
        setMode(status.can.publish ? 'direct' : 'inbox');
      } catch {
        setCanPublish(false);
        setCanUpload(false);
      }
      try {
        setCreator(await fetchTiktokCreatorInfo());
      } catch {
        setCreator(null);
      }
    })();
  }, []);

  const privacyOptions: TiktokPrivacyLevel[] =
    creator?.privacyOptions.length ? creator.privacyOptions : ['SELF_ONLY'];

  const handlePickVideo = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      setVideoUrl(await uploadVideo(file, 'tiktok-videos'));
      toast.success(t('channels.ttVideoUploaded'));
    } catch {
      toast.error(t('channels.ttVideoUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (publishNow: boolean) => {
    if (!videoUrl) {
      toast.error(t('channels.ttNeedVideo'));
      return;
    }
    setSending(true);
    try {
      await saveTiktokPublish({
        title,
        videoUrl,
        mode,
        privacyLevel: privacy,
        disableComment,
        disableDuet,
        disableStitch,
        scheduledAt: !publishNow && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        publishNow,
      });
      toast.success(publishNow ? t('channels.ttSentToTiktok') : t('channels.postSaved'));
      setTitle('');
      setVideoUrl('');
      setScheduledAt('');
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('channels.postFailedToast'));
    } finally {
      setSending(false);
    }
  };

  const act = async (id: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(okMsg);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('channels.cmtActionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box layoutClassName="space-y-4">
      <Card layoutClassName="space-y-3 p-4">
        <Box layoutClassName="space-y-1">
          <Label className="mb-0">{t('channels.ttCaption')}</Label>
          <Textarea
            rows={3}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('channels.ttCaptionPlaceholder')}
          />
        </Box>

        <Box layoutClassName="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => document.getElementById('tiktok-video-file')?.click()}
            disabled={uploading}
            leftIcon={uploading ? <Spinner size="sm" /> : <Upload className="h-3.5 w-3.5" />}
            variant="secondary"
            borderClassName="border border-slate-200 dark:border-slate-600"
            backgroundClassName="bg-white dark:bg-slate-800"
            textClassName="text-xs font-medium text-slate-700 dark:text-slate-200"
            roundedClassName="rounded-lg"
            sizeClassName="px-2.5 py-1.5"
            layoutClassName="inline-flex items-center gap-1.5"
          >
            {uploading ? t('channels.uploading') : t('channels.ttPickVideo')}
          </Button>
          <Input
            id="tiktok-video-file"
            type="file"
            accept="video/*"
            layoutClassName="hidden"
            onChange={(e) => void handlePickVideo(e.target.files?.[0])}
          />
          {videoUrl ? (
            <Box layoutClassName="flex min-w-0 items-center gap-2">
              <Video className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              <Typography as="span" size="xs" variant="muted" layoutClassName="truncate">
                {videoUrl}
              </Typography>
              <Button
                type="button"
                onClick={() => setVideoUrl('')}
                variant="ghost"
                leftIcon={<X className="h-3.5 w-3.5" />}
                textClassName="text-xs text-slate-500 dark:text-slate-400"
                sizeClassName="px-2 py-1"
                layoutClassName="inline-flex shrink-0 items-center gap-1"
              >
                {t('channels.removeImage')}
              </Button>
            </Box>
          ) : null}
        </Box>

        <Box layoutClassName="grid gap-3 sm:grid-cols-2">
          <Box layoutClassName="space-y-1">
            <Label className="mb-0">{t('channels.ttMode')}</Label>
            <Select
              value={mode}
              onChange={(e) => setMode(e.target.value === 'direct' ? 'direct' : 'inbox')}
              size="sm"
              fullWidth
            >
              <option value="inbox">{t('channels.ttModeInbox')}</option>
              {/* Đăng thẳng cần scope video.publish — app chưa duyệt thì khoá lại cho khỏi lỗi. */}
              <option value="direct" disabled={!canPublish}>
                {t('channels.ttModeDirect')}
              </option>
            </Select>
          </Box>

          <Box layoutClassName="space-y-1">
            <Label className="mb-0">{t('channels.ttPrivacy')}</Label>
            <Select
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value as TiktokPrivacyLevel)}
              size="sm"
              fullWidth
              disabled={mode !== 'direct'}
            >
              {privacyOptions.map((p) => (
                <option key={p} value={p}>
                  {t(PRIVACY_KEYS[p])}
                </option>
              ))}
            </Select>
          </Box>
        </Box>

        {mode === 'direct' ? (
          <Box layoutClassName="flex flex-wrap items-center gap-3">
            <Checkbox
              checked={disableComment}
              onChange={(e) => setDisableComment(e.target.checked)}
              disabled={creator?.commentDisabled}
              label={t('channels.ttDisableComment')}
              labelClassName="text-sm text-slate-700 dark:text-slate-200"
            />
            <Checkbox
              checked={disableDuet}
              onChange={(e) => setDisableDuet(e.target.checked)}
              disabled={creator?.duetDisabled}
              label={t('channels.ttDisableDuet')}
              labelClassName="text-sm text-slate-700 dark:text-slate-200"
            />
            <Checkbox
              checked={disableStitch}
              onChange={(e) => setDisableStitch(e.target.checked)}
              disabled={creator?.stitchDisabled}
              label={t('channels.ttDisableStitch')}
              labelClassName="text-sm text-slate-700 dark:text-slate-200"
            />
          </Box>
        ) : null}

        <Box layoutClassName="flex flex-wrap items-center gap-2">
          <Typography size="xs" variant="muted">
            {creator?.maxVideoSeconds
              ? t('channels.ttMaxDuration').replace('{s}', String(creator.maxVideoSeconds))
              : t('channels.ttPullHint')}
          </Typography>

          <Box layoutClassName="ml-auto flex flex-wrap items-center gap-2">
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              sizeClassName="px-2 py-1.5 text-xs"
            />
            <Button
              type="button"
              onClick={() => void submit(false)}
              disabled={sending || !scheduledAt}
              leftIcon={<CalendarClock className="h-3.5 w-3.5" />}
              variant="secondary"
              borderClassName="border border-slate-200 dark:border-slate-600"
              backgroundClassName="bg-white dark:bg-slate-800"
              textClassName="text-xs font-medium text-slate-700 dark:text-slate-200"
              roundedClassName="rounded-lg"
              sizeClassName="px-2.5 py-1.5"
              layoutClassName="inline-flex items-center gap-1.5"
            >
              {t('channels.postSchedule')}
            </Button>
            <Button
              type="button"
              onClick={() => void submit(true)}
              disabled={sending || (!canUpload && !canPublish)}
              leftIcon={sending ? <Spinner size="sm" /> : <Send className="h-3.5 w-3.5" />}
              sizeClassName="px-3 py-1.5"
              textClassName="text-xs font-semibold"
              roundedClassName="rounded-lg"
              layoutClassName="inline-flex items-center gap-1.5"
            >
              {mode === 'direct' ? t('channels.postNow') : t('channels.ttSendToDrafts')}
            </Button>
          </Box>
        </Box>

        {!canUpload && !canPublish ? (
          <Typography size="xs" textClassName="text-amber-600 dark:text-amber-400">
            {t('channels.ttNoPublishScope')}
          </Typography>
        ) : null}
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
            icon={<Send className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
            title={t('channels.postEmptyTitle')}
            description={t('channels.ttPublishEmptyDesc')}
          />
        </Card>
      ) : (
        <Box layoutClassName="space-y-2">
          {items.map((p) => (
            <Card key={p.id} layoutClassName="flex gap-3 p-3">
              <Box layoutClassName="min-w-0 flex-1 space-y-1">
                <Box layoutClassName="flex flex-wrap items-center gap-2">
                  <Badge
                    size="sm"
                    backgroundClassName={STATUS_STYLE[p.status].bg}
                    textClassName={STATUS_STYLE[p.status].text}
                  >
                    {t(STATUS_STYLE[p.status].key)}
                  </Badge>
                  <Badge
                    size="sm"
                    backgroundClassName="bg-slate-100 dark:bg-slate-700"
                    textClassName="text-slate-600 dark:text-slate-300"
                  >
                    {p.mode === 'direct' ? t('channels.ttModeDirect') : t('channels.ttModeInbox')}
                  </Badge>
                  <Typography as="span" size="xs" variant="muted">
                    {p.publishedAt
                      ? at(p.publishedAt)
                      : p.scheduledAt
                        ? `${t('channels.postScheduledFor')} ${at(p.scheduledAt)}`
                        : at(p.createdAt)}
                  </Typography>
                </Box>
                <Typography as="p" size="sm" textClassName="text-slate-700 dark:text-slate-200">
                  {p.title || t('channels.ttNoCaption')}
                </Typography>
                {p.error ? (
                  <Typography as="p" size="xs" textClassName="text-rose-600 dark:text-rose-400">
                    {p.error}
                  </Typography>
                ) : null}
              </Box>

              <Box layoutClassName="flex shrink-0 items-start gap-1">
                {/* Đang xử lý → hỏi lại TikTok ngay, khỏi đợi tick mỗi phút. */}
                {p.status === 'processing' ? (
                  <Button
                    type="button"
                    onClick={() => void act(p.id, () => refreshTiktokPublish(p.id), t('channels.ttStatusRefreshed'))}
                    disabled={busyId === p.id}
                    variant="ghost"
                    leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                    textClassName="text-xs font-medium text-slate-600 dark:text-slate-300"
                    sizeClassName="px-2 py-1"
                    layoutClassName="inline-flex items-center gap-1"
                  >
                    {t('channels.ttCheckStatus')}
                  </Button>
                ) : null}
                {p.status !== 'published' && p.status !== 'processing' ? (
                  <>
                    <Button
                      type="button"
                      onClick={() => void act(p.id, () => publishTiktokVideo(p.id), t('channels.ttSentToTiktok'))}
                      disabled={busyId === p.id}
                      variant="ghost"
                      leftIcon={<Send className="h-3.5 w-3.5" />}
                      textClassName="text-xs font-medium text-primary-600 dark:text-primary-300"
                      sizeClassName="px-2 py-1"
                      layoutClassName="inline-flex items-center gap-1"
                    >
                      {t('channels.postNow')}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setDelPost(p)}
                      disabled={busyId === p.id}
                      variant="ghost"
                      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                      textClassName="text-xs font-medium text-rose-600 dark:text-rose-400"
                      sizeClassName="px-2 py-1"
                      layoutClassName="inline-flex items-center gap-1"
                    >
                      {t('channels.cmtDelete')}
                    </Button>
                  </>
                ) : null}
              </Box>
            </Card>
          ))}
        </Box>
      )}

      <ConfirmModal
        isOpen={!!delPost}
        title={t('channels.cmtDelete')}
        message={t('channels.postConfirmDelete')}
        onConfirm={() => {
          const p = delPost;
          setDelPost(null);
          if (p) void act(p.id, () => deleteTiktokPublish(p.id), t('channels.postDeleted'));
        }}
        onCancel={() => setDelPost(null)}
      />
    </Box>
  );
};

export default TiktokPublishTab;
