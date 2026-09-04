import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarClock, Image as ImageIcon, Send, Trash2, X } from 'lucide-react';
import {
  deleteSocialPost,
  fetchSocialPosts,
  publishSocialPost,
  saveSocialPost,
  type SocialPlatform,
  type SocialPost,
} from '@/services/facebookService';
import { uploadImage } from '@/services/imageService';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Checkbox from '@/components/ui/Checkbox';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Label from '@/components/ui/Label';
import Image from '@/components/ui/Image';
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

/** Màu badge theo trạng thái bài. */
const STATUS_STYLE: Record<SocialPost['status'], { bg: string; text: string; key: string }> = {
  draft: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300', key: 'channels.postDraft' },
  scheduled: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', key: 'channels.postScheduled' },
  published: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', key: 'channels.postPublished' },
  failed: { bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', key: 'channels.postFailed' },
};

/**
 * Soạn 1 bài rồi đăng lên fanpage và/hoặc Instagram — đăng ngay hoặc hẹn giờ.
 * Instagram bắt buộc có ảnh (Meta tự tải ảnh về từ URL), nên form chặn trước khi gửi.
 */
const SocialPostsTab: React.FC = () => {
  const { t } = useLanguage();
  const [items, setItems] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [toFacebook, setToFacebook] = useState(true);
  const [toInstagram, setToInstagram] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Bài chờ xác nhận xoá — dùng ConfirmModal của app, không dùng confirm() trình duyệt. */
  const [delPost, setDelPost] = useState<SocialPost | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchSocialPosts(50));
    } catch {
      toast.error(t('channels.postLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const targets = (): SocialPlatform[] => {
    const list: SocialPlatform[] = [];
    if (toFacebook) list.push('facebook');
    if (toInstagram) list.push('instagram');
    return list;
  };

  const handlePickImage = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      setImageUrl(await uploadImage(file, 'social-posts'));
      toast.success(t('channels.imageUploaded'));
    } catch {
      toast.error(t('channels.imageUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (publishNow: boolean) => {
    const list = targets();
    if (list.length === 0) {
      toast.error(t('channels.postNoTarget'));
      return;
    }
    if (!message.trim() && !imageUrl) {
      toast.error(t('channels.noContent'));
      return;
    }
    if (list.includes('instagram') && !imageUrl) {
      toast.error(t('channels.postIgNeedsImage'));
      return;
    }
    setSending(true);
    try {
      await saveSocialPost({
        message,
        imageUrl: imageUrl || undefined,
        targets: list,
        scheduledAt: !publishNow && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        publishNow,
      });
      toast.success(publishNow ? t('channels.postPublishedOk') : t('channels.postSaved'));
      setMessage('');
      setImageUrl('');
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
      {/* Soạn bài */}
      <Card layoutClassName="space-y-3 p-4">
        <Box layoutClassName="space-y-1">
          <Label className="mb-0">{t('channels.postContent')}</Label>
          <Textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('channels.postPlaceholder')}
          />
        </Box>

        <Box layoutClassName="flex flex-wrap items-center gap-3">
          <Checkbox
            checked={toFacebook}
            onChange={(e) => setToFacebook(e.target.checked)}
            label={t('channels.srcFacebook')}
            labelClassName="text-sm text-slate-700 dark:text-slate-200"
          />
          <Checkbox
            checked={toInstagram}
            onChange={(e) => setToInstagram(e.target.checked)}
            label={t('channels.srcInstagram')}
            labelClassName="text-sm text-slate-700 dark:text-slate-200"
          />
          <Typography size="xs" variant="muted">
            {t('channels.postIgHint')}
          </Typography>
        </Box>

        <Box layoutClassName="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => document.getElementById('social-post-image')?.click()}
            disabled={uploading}
            leftIcon={uploading ? <Spinner size="sm" /> : <ImageIcon className="h-3.5 w-3.5" />}
            variant="secondary"
            borderClassName="border border-slate-200 dark:border-slate-600"
            backgroundClassName="bg-white dark:bg-slate-800"
            textClassName="text-xs font-medium text-slate-700 dark:text-slate-200"
            roundedClassName="rounded-lg"
            sizeClassName="px-2.5 py-1.5"
            layoutClassName="inline-flex items-center gap-1.5"
          >
            {uploading ? t('channels.uploading') : t('channels.pickImage')}
          </Button>
          <Input
            id="social-post-image"
            type="file"
            accept="image/*"
            layoutClassName="hidden"
            onChange={(e) => void handlePickImage(e.target.files?.[0])}
          />
          {imageUrl ? (
            <Box layoutClassName="flex items-center gap-2">
              <Image
                src={imageUrl}
                alt={t('channels.attachedImageAlt')}
                layoutClassName="h-10 w-10 object-cover"
                roundedClassName="rounded"
              />
              <Button
                type="button"
                onClick={() => setImageUrl('')}
                variant="ghost"
                leftIcon={<X className="h-3.5 w-3.5" />}
                textClassName="text-xs text-slate-500 dark:text-slate-400"
                sizeClassName="px-2 py-1"
                layoutClassName="inline-flex items-center gap-1"
              >
                {t('channels.removeImage')}
              </Button>
            </Box>
          ) : null}

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
              disabled={sending}
              leftIcon={sending ? <Spinner size="sm" /> : <Send className="h-3.5 w-3.5" />}
              sizeClassName="px-3 py-1.5"
              textClassName="text-xs font-semibold"
              roundedClassName="rounded-lg"
              layoutClassName="inline-flex items-center gap-1.5"
            >
              {t('channels.postNow')}
            </Button>
          </Box>
        </Box>
      </Card>

      {/* Danh sách bài */}
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
            description={t('channels.postEmptyDesc')}
          />
        </Card>
      ) : (
        <Box layoutClassName="space-y-2">
          {items.map((p) => (
            <Card key={p.id} layoutClassName="flex gap-3 p-3">
              {p.imageUrl ? (
                <Image
                  src={p.imageUrl}
                  alt={t('channels.attachedImageAlt')}
                  layoutClassName="h-14 w-14 shrink-0 object-cover"
                  roundedClassName="rounded"
                />
              ) : null}
              <Box layoutClassName="min-w-0 flex-1 space-y-1">
                <Box layoutClassName="flex flex-wrap items-center gap-2">
                  <Badge
                    size="sm"
                    backgroundClassName={STATUS_STYLE[p.status].bg}
                    textClassName={STATUS_STYLE[p.status].text}
                  >
                    {t(STATUS_STYLE[p.status].key)}
                  </Badge>
                  {p.targets.map((tg) => (
                    <Badge
                      key={tg}
                      size="sm"
                      backgroundClassName={tg === 'instagram' ? 'bg-pink-50 dark:bg-pink-900/30' : 'bg-sky-50 dark:bg-sky-900/30'}
                      textClassName={tg === 'instagram' ? 'text-pink-700 dark:text-pink-300' : 'text-sky-700 dark:text-sky-300'}
                    >
                      {tg === 'instagram' ? t('channels.srcInstagram') : t('channels.srcFacebook')}
                    </Badge>
                  ))}
                  <Typography as="span" size="xs" variant="muted">
                    {p.publishedAt
                      ? at(p.publishedAt)
                      : p.scheduledAt
                        ? `${t('channels.postScheduledFor')} ${at(p.scheduledAt)}`
                        : at(p.createdAt)}
                  </Typography>
                </Box>
                <Typography as="p" size="sm" textClassName="text-slate-700 dark:text-slate-200">
                  {p.message || t('channels.cmtNoText')}
                </Typography>
                {p.error ? (
                  <Typography as="p" size="xs" textClassName="text-rose-600 dark:text-rose-400">
                    {p.error}
                  </Typography>
                ) : null}
              </Box>

              {p.status !== 'published' ? (
                <Box layoutClassName="flex shrink-0 items-start gap-1">
                  <Button
                    type="button"
                    onClick={() => void act(p.id, () => publishSocialPost(p.id), t('channels.postPublishedOk'))}
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
                </Box>
              ) : null}
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
          if (p) void act(p.id, () => deleteSocialPost(p.id), t('channels.postDeleted'));
        }}
        onCancel={() => setDelPost(null)}
      />
    </Box>
  );
};

export default SocialPostsTab;
