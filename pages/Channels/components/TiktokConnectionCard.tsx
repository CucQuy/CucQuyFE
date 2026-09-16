import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, ExternalLink, Heart, LogIn, RefreshCw, Unplug, Users, Video, XCircle } from 'lucide-react';
import {
  disconnectTiktok,
  fetchTiktokAuthUrl,
  fetchTiktokStatus,
  syncTiktokProfile,
  type TiktokStatus,
} from '@/services/tiktokService';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import Heading from '@/components/ui/Heading';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import AvatarImage from '@/components/ui/AvatarImage';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmModal from '@/components/ConfirmModal';
import TikTokIcon from '@/components/ui/TikTokIcon';

const at = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 1 dòng "tính năng — dùng được / thiếu quyền" (giống thẻ kết nối Facebook). */
const Row: React.FC<{ label: string; hint: string; ok: boolean; okText: string; missText: string }> = ({
  label,
  hint,
  ok,
  okText,
  missText,
}) => (
  <Box layoutClassName="flex items-start justify-between gap-3 py-1.5">
    <Box layoutClassName="space-y-0.5">
      <Typography as="p" size="sm" textClassName="text-slate-700 dark:text-slate-200">
        {label}
      </Typography>
      {!ok ? (
        <Typography as="p" size="xs" variant="muted">
          {hint}
        </Typography>
      ) : null}
    </Box>
    {ok ? (
      <Badge
        size="sm"
        backgroundClassName="bg-emerald-50 dark:bg-emerald-900/20"
        textClassName="text-emerald-700 dark:text-emerald-300"
        borderClassName="border border-emerald-200 dark:border-emerald-800"
        layoutClassName="inline-flex shrink-0 items-center gap-1"
      >
        <CheckCircle2 className="h-3 w-3" />
        {okText}
      </Badge>
    ) : (
      <Badge
        size="sm"
        backgroundClassName="bg-amber-50 dark:bg-amber-900/20"
        textClassName="text-amber-700 dark:text-amber-300"
        borderClassName="border border-amber-200 dark:border-amber-800"
        layoutClassName="inline-flex shrink-0 items-center gap-1"
      >
        <XCircle className="h-3 w-3" />
        {missText}
      </Badge>
    )}
  </Box>
);

/**
 * Nối / ngắt tài khoản TikTok + xem token đang có quyền gì.
 *
 * TikTok không cho dán token sẵn như fanpage: phải bấm "Nối TikTok" → sang trang cấp
 * quyền của TikTok → quay lại đây kèm `?tiktok=connected`. Quyền cấp được tới đâu là
 * do app đã qua review của TikTok tới đó, nên bảng quyền bên dưới là chỗ nhìn ra ngay
 * vì sao màn Video hay Đăng video báo thiếu quyền.
 */
const TiktokConnectionCard: React.FC = () => {
  const { t } = useLanguage();
  const [status, setStatus] = useState<TiktokStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await fetchTiktokStatus());
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // TikTok đá người dùng về đây kèm ?tiktok=... — báo kết quả rồi dọn URL cho sạch.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('tiktok');
    if (!result) return;
    if (result === 'connected') toast.success(t('channels.ttConnected'));
    else if (result === 'cancelled') toast.error(t('channels.ttCancelled'));
    else toast.error(params.get('reason') || t('channels.ttConnectFailed'));
    window.history.replaceState({}, '', window.location.pathname);
  }, [t]);

  const connect = async () => {
    setBusy(true);
    try {
      const url = await fetchTiktokAuthUrl();
      if (!url) throw new Error('no url');
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('channels.ttConnectFailed'));
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    try {
      await syncTiktokProfile();
      toast.success(t('channels.ttProfileSynced'));
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('channels.ttSyncFailed'));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await disconnectTiktok();
      toast.success(t('channels.ttDisconnected'));
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('channels.ttSyncFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !status) {
    return (
      <Card layoutClassName="flex items-center justify-center gap-2 p-8">
        <Spinner size="md" />
        <Typography size="sm" variant="muted">
          {t('channels.connChecking')}
        </Typography>
      </Card>
    );
  }

  if (!status?.configured) {
    return (
      <Card layoutClassName="p-6">
        <EmptyState
          icon={<TikTokIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
          title={t('channels.ttNotConfiguredTitle')}
          description={t('channels.ttNotConfigured')}
        />
      </Card>
    );
  }

  const acc = status.account;

  if (!acc) {
    return (
      <Card layoutClassName="space-y-4 p-6">
        <EmptyState
          icon={<TikTokIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
          title={t('channels.ttNotConnectedTitle')}
          description={t('channels.ttNotConnected')}
        />
        <Box layoutClassName="flex justify-center">
          <Button
            type="button"
            onClick={() => void connect()}
            disabled={busy}
            leftIcon={busy ? <Spinner size="sm" /> : <LogIn className="h-3.5 w-3.5" />}
            sizeClassName="px-3 py-1.5"
            textClassName="text-xs font-semibold"
            roundedClassName="rounded-lg"
            layoutClassName="inline-flex items-center gap-1.5"
          >
            {t('channels.ttConnect')}
          </Button>
        </Box>
      </Card>
    );
  }

  const stats: { labelKey: string; value: number; icon: React.ReactNode }[] = [
    { labelKey: 'channels.ttFollowers', value: acc.followerCount, icon: <Users className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> },
    { labelKey: 'channels.ttLikes', value: acc.likesCount, icon: <Heart className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> },
    { labelKey: 'channels.ttVideos', value: acc.videoCount, icon: <Video className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> },
  ];

  return (
    <Box layoutClassName="space-y-4">
      <Card layoutClassName="space-y-4 p-4">
        <Box layoutClassName="flex flex-wrap items-center gap-3">
          {acc.avatarUrl ? (
            <AvatarImage src={acc.avatarUrl} alt={acc.displayName || acc.username} size="lg" />
          ) : (
            <Box
              layoutClassName="flex h-12 w-12 items-center justify-center"
              backgroundClassName="bg-slate-900 dark:bg-slate-700"
              roundedClassName="rounded-full"
            >
              <TikTokIcon className="h-5 w-5 text-white" />
            </Box>
          )}
          <Box layoutClassName="min-w-0">
            <Heading level={4} textClassName="text-slate-800 dark:text-slate-100">
              {acc.displayName || acc.username}
            </Heading>
            <Typography size="sm" variant="muted">
              {acc.username ? `@${acc.username}` : acc.openId}
              {acc.isVerified ? ` · ${t('channels.ttVerified')}` : ''}
            </Typography>
          </Box>

          <Box layoutClassName="ml-auto flex flex-wrap items-center gap-2">
            {acc.profileUrl ? (
              <Button
                type="button"
                onClick={() => window.open(acc.profileUrl, '_blank', 'noopener')}
                variant="ghost"
                leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
                textClassName="text-xs font-medium text-slate-600 dark:text-slate-300"
                sizeClassName="px-2 py-1"
                layoutClassName="inline-flex items-center gap-1"
              >
                {t('channels.ttOpenProfile')}
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => void sync()}
              disabled={busy}
              leftIcon={busy ? <Spinner size="sm" /> : <RefreshCw className="h-3.5 w-3.5" />}
              variant="secondary"
              borderClassName="border border-slate-200 dark:border-slate-600"
              backgroundClassName="bg-white dark:bg-slate-800"
              textClassName="text-xs font-medium text-slate-700 dark:text-slate-200"
              roundedClassName="rounded-lg"
              sizeClassName="px-2.5 py-1.5"
              layoutClassName="inline-flex items-center gap-1.5"
            >
              {t('channels.ttRefreshProfile')}
            </Button>
            <Button
              type="button"
              onClick={() => setConfirmOff(true)}
              disabled={busy}
              variant="ghost"
              leftIcon={<Unplug className="h-3.5 w-3.5" />}
              textClassName="text-xs font-medium text-rose-600 dark:text-rose-400"
              sizeClassName="px-2 py-1"
              layoutClassName="inline-flex items-center gap-1"
            >
              {t('channels.ttDisconnect')}
            </Button>
          </Box>
        </Box>

        <Box layoutClassName="grid grid-cols-3 gap-3">
          {stats.map((s) => (
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
                {s.value.toLocaleString('vi-VN')}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box layoutClassName="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Typography as="span" size="xs" variant="muted">
            {t('channels.ttConnectedBy')}: {acc.connectedBy || '—'}
          </Typography>
          <Typography as="span" size="xs" variant="muted">
            {t('channels.ttLastSync')}: {at(acc.syncedAt) || '—'}
          </Typography>
          {/* Refresh token TikTok sống 365 ngày — hết hạn là phải bấm nối lại. */}
          <Typography as="span" size="xs" variant="muted">
            {t('channels.ttRefreshExpires')}: {at(acc.refreshExpiresAt) || '—'}
          </Typography>
        </Box>
      </Card>

      <Card layoutClassName="divide-y divide-slate-100 p-4 dark:divide-slate-700">
        <Row
          okText={t('channels.connOk')}
          missText={t('channels.connMissing')}
          label={t('channels.ttFeatProfile')}
          hint={t('channels.ttFeatProfileHint')}
          ok={status.can.profile}
        />
        <Row
          okText={t('channels.connOk')}
          missText={t('channels.connMissing')}
          label={t('channels.ttFeatStats')}
          hint={t('channels.ttFeatStatsHint')}
          ok={status.can.stats}
        />
        <Row
          okText={t('channels.connOk')}
          missText={t('channels.connMissing')}
          label={t('channels.ttFeatVideoList')}
          hint={t('channels.ttFeatVideoListHint')}
          ok={status.can.videoList}
        />
        <Row
          okText={t('channels.connOk')}
          missText={t('channels.connMissing')}
          label={t('channels.ttFeatUpload')}
          hint={t('channels.ttFeatUploadHint')}
          ok={status.can.upload}
        />
        <Row
          okText={t('channels.connOk')}
          missText={t('channels.connMissing')}
          label={t('channels.ttFeatPublish')}
          hint={t('channels.ttFeatPublishHint')}
          ok={status.can.publish}
        />
        <Box layoutClassName="pt-2">
          <Typography size="xs" variant="muted">
            {t('channels.ttScopeHint')}
          </Typography>
        </Box>
      </Card>

      <ConfirmModal
        isOpen={confirmOff}
        title={t('channels.ttDisconnect')}
        message={t('channels.ttConfirmDisconnect')}
        onConfirm={() => {
          setConfirmOff(false);
          void disconnect();
        }}
        onCancel={() => setConfirmOff(false)}
      />
    </Box>
  );
};

export default TiktokConnectionCard;
