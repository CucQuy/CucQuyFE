import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock, ImagePlus, RefreshCw, Send, Users, XCircle } from 'lucide-react';
import {
  fetchFacebookContacts,
  sendFacebookMessage,
  syncFacebookContacts,
  syncInstagramConversations,
  type FacebookContact,
  type SocialPlatform,
  type FacebookSendResult,
} from '@/services/facebookService';
import { uploadImage } from '@/services/imageService';
import ConversationModal from '@/pages/Channels/components/ConversationModal';
import ConfirmModal from '@/components/ConfirmModal';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Checkbox from '@/components/ui/Checkbox';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Label from '@/components/ui/Label';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import PageContainer from '@/components/ui/PageContainer';
import Image from '@/components/ui/Image';
import {
  Table,
  TableBody,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableCell,
} from '@/components/ui/Table';

/** Chỗ chèn tên khách trong nội dung — mỗi người nhận đúng tên của họ. */
const NAME_TOKEN = '{tên}';

const at = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Số phút còn lại → "còn 3h20" cho dễ đọc (nhãn lấy từ i18n). */
const left = (minutes: number, t: (k: string) => string): string => {
  if (minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0
    ? t('channels.windowLeftHours').replace('{h}', String(h)).replace('{m}', String(m).padStart(2, '0'))
    : t('channels.windowLeftMinutes').replace('{m}', String(m));
};

/**
 * Màn "Khách Facebook": danh sách người đã inbox fanpage + gửi tin hàng loạt.
 *
 * ⚠️ Messenger chỉ cho nhắn tự do trong 24h kể từ tin CUỐI của khách (Meta đã bỏ
 * Recurring Notifications ở VN và đang khai tử message tags), nên màn này mặc định
 * lọc nhóm "còn nhắn được" — gửi cho người ngoài 24h sẽ bị Meta từ chối và BE trả lý do.
 */
interface Props {
  /** Khoá màn theo 1 nền tảng (Facebook / Instagram); bỏ trống = cả hai. */
  platform?: SocialPlatform;
}

const FacebookCustomersPage: React.FC<Props> = ({ platform }) => {
  const { t } = useLanguage();
  const [onlyWindow, setOnlyWindow] = useState(true);
  const [contacts, setContacts] = useState<FacebookContact[]>([]);
  const [counts, setCounts] = useState({ total: 0, inWindow: 0, optIn: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [text, setText] = useState(
    `Chào ${NAME_TOKEN} 👋\nTiệm Bánh Cúc Quy có ưu đãi mới nè!\n\n`,
  );
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [openChat, setOpenChat] = useState<FacebookContact | null>(null);
  /** Chỉ tự kéo 1 lần mỗi lượt mở màn. */
  const autoSynced = useRef(false);
  const [buttonTitle, setButtonTitle] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [sending, setSending] = useState(false);
  /** Xác nhận gửi hàng loạt — ConfirmModal của app thay confirm() trình duyệt. */
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [results, setResults] = useState<FacebookSendResult[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (): Promise<number> => {
    setLoading(true);
    try {
      const r = await fetchFacebookContacts(onlyWindow ? 'window' : '', 300, platform ?? '');
      setContacts(r.items);
      setCounts(r.counts);
      setSelected((prev) => new Set([...prev].filter((p) => r.items.some((c) => c.psid === p))));
      return r.items.length;
    } catch {
      toast.error(t('channels.loadContactsFailed'));
      return 0;
    } finally {
      setLoading(false);
    }
  }, [onlyWindow, platform]);

  // Chưa có ai trong DB thì tự kéo hội thoại từ kênh về lần đầu, khỏi bắt bấm nút.
  useEffect(() => {
    void (async () => {
      const n = await load();
      if (n > 0 || autoSynced.current) return;
      autoSynced.current = true;
      setSyncing(true);
      try {
        if (platform === 'instagram') await syncInstagramConversations();
        else await syncFacebookContacts();
        await load();
      } catch {
        // chưa nối kênh → giữ trạng thái trống + nút đồng bộ tay
      } finally {
        setSyncing(false);
      }
    })();
  }, [load, platform]);

  const nameByPsid = useMemo(
    () => new Map(contacts.map((c) => [c.psid, c.name || 'bạn'])),
    [contacts],
  );

  const toggle = (psid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(psid)) next.delete(psid);
      else next.add(psid);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === contacts.length ? new Set() : new Set(contacts.map((c) => c.psid)),
    );
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      if (platform === 'instagram') {
        const ig = await syncInstagramConversations();
        toast.success(t('channels.igSynced').replace('{n}', String(ig.contacts)));
      } else {
        const r = await syncFacebookContacts();
        toast.success(t('channels.syncedConversations').replace('{n}', String(r.synced)));
        // Màn "cả hai nguồn" kéo luôn Instagram; lỗi bên IG không làm hỏng phần Facebook.
        if (!platform) {
          try {
            const ig = await syncInstagramConversations();
            if (ig.contacts > 0) {
              toast.success(t('channels.igSynced').replace('{n}', String(ig.contacts)));
            }
          } catch {
            // fanpage chưa nối Instagram — bỏ qua
          }
        }
      }
      await load();
    } catch {
      toast.error(t('channels.syncFailed'));
    } finally {
      setSyncing(false);
    }
  };

  const handlePickImage = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, 'facebook-broadcast');
      setImageUrl(url);
      toast.success(t('channels.imageUploaded'));
    } catch {
      toast.error(t('channels.imageUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    const psids = [...selected];
    if (psids.length === 0) {
      toast.error(t('channels.noSelection'));
      return;
    }
    if (!text.trim() && !imageUrl) {
      toast.error(t('channels.noContent'));
      return;
    }
    setConfirmBulk(true);
  };

  const doSend = async () => {
    setConfirmBulk(false);
    const psids = [...selected];

    setSending(true);
    setResults(null);
    try {
      // Tên khác nhau từng người → gửi theo nhóm cùng tên đã thay, đơn giản là gửi lẻ.
      const all: FacebookSendResult[] = [];
      for (const psid of psids) {
        const personal = text.replaceAll(NAME_TOKEN, nameByPsid.get(psid) ?? 'bạn');
        const r = await sendFacebookMessage({
          psids: [psid],
          text: personal,
          imageUrl: imageUrl || undefined,
          buttonTitle: buttonTitle.trim() || undefined,
          buttonUrl: buttonUrl.trim() || undefined,
        });
        all.push(...r.results);
      }
      setResults(all);
      const ok = all.filter((r) => r.sent).length;
      const fail = all.length - ok;
      if (fail === 0) toast.success(t('channels.sentToN').replace('{n}', String(ok)));
      else
        toast.error(
          t('channels.partialSend').replace('{ok}', String(ok)).replace('{fail}', String(fail)),
        );
      await load();
    } catch {
      toast.error(t('channels.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  const failed = results?.filter((r) => !r.sent) ?? [];

  return (
    <PageContainer>
      {/* Tổng quan + đồng bộ */}
      <Card layoutClassName="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <Box layoutClassName="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#1877F2]" />
          <Heading level={2} textClassName="text-base font-semibold text-slate-900 dark:text-white">
            {t('channels.fbCustomers')}
          </Heading>
        </Box>
        <Box layoutClassName="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <Typography as="span" size="sm" variant="muted">
            {t('channels.total')}: <b>{counts.total}</b>
          </Typography>
          <Typography as="span" size="sm" textClassName="text-emerald-600 dark:text-emerald-400">
            {t('channels.inWindow')}: <b>{counts.inWindow}</b>
          </Typography>
          <Typography as="span" size="sm" variant="muted">
            {t('channels.selected')}: <b>{selected.size}</b>
          </Typography>
        </Box>
        <Box layoutClassName="ml-auto flex flex-wrap items-center gap-2">
          <Checkbox
            checked={onlyWindow}
            onChange={(e) => setOnlyWindow(e.target.checked)}
            label={t('channels.onlyInWindow')}
            labelClassName="text-xs text-slate-600 dark:text-slate-300"
          />
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
            {syncing ? t('channels.syncing') : t('channels.syncFromFb')}
          </Button>
        </Box>
      </Card>

      {/* Soạn tin */}
      <Card layoutClassName="space-y-3 p-4">
        <Typography size="xs" layoutClassName="font-bold uppercase tracking-wider" textClassName="text-slate-500 dark:text-slate-400">
          {t('channels.composeTitle')}
        </Typography>
        <Box layoutClassName="space-y-1">
          <Label className="mb-0">{t('channels.messageLabel')}</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder="Chào {tên} 👋 …"
          />
          <Typography size="xs" variant="muted">
            {t('channels.namePlaceholderHint').replace('{token}', NAME_TOKEN)}
          </Typography>
        </Box>

        <Box layoutClassName="grid gap-3 sm:grid-cols-2">
          <Box layoutClassName="space-y-1">
            <Label className="mb-0">{t('channels.imageLabel')}</Label>
            <Box layoutClassName="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                leftIcon={uploading ? <Spinner size="sm" /> : <ImagePlus className="h-3.5 w-3.5" />}
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
              {imageUrl ? (
                <>
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
                    textClassName="text-xs text-rose-600 dark:text-rose-400"
                    sizeClassName="px-1.5 py-1"
                    backgroundClassName="bg-transparent"
                    borderClassName="border-transparent"
                  >
                    {t('channels.removeImage')}
                  </Button>
                </>
              ) : null}
            </Box>
            <Input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              containerClassName="hidden"
              onChange={(e) => void handlePickImage(e.target.files?.[0])}
            />
          </Box>
          <Box layoutClassName="grid grid-cols-2 gap-2">
            <Box layoutClassName="space-y-1">
              <Label className="mb-0">{t('channels.buttonLabel')}</Label>
              <Input
                value={buttonTitle}
                onChange={(e) => setButtonTitle(e.target.value)}
                placeholder="Xem video"
                containerClassName="w-full"
              />
            </Box>
            <Box layoutClassName="space-y-1">
              <Label className="mb-0">{t('channels.buttonUrlLabel')}</Label>
              <Input
                value={buttonUrl}
                onChange={(e) => setButtonUrl(e.target.value)}
                placeholder="https://…"
                containerClassName="w-full"
              />
            </Box>
          </Box>
        </Box>

        <Box layoutClassName="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || selected.size === 0}
            leftIcon={sending ? <Spinner size="sm" textClassName="text-white" borderClassName="border-white" /> : <Send className="h-4 w-4" />}
            backgroundClassName="bg-[#1877F2]"
            hoverClassName="hover:bg-[#166FE5]"
            textClassName="text-sm font-semibold text-white"
            roundedClassName="rounded-xl"
            sizeClassName="px-4 py-2"
            layoutClassName="inline-flex items-center gap-1.5"
            stateClassName="transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            variant="primary"
            disableVariantHover
            disableVariantTextColor
          >
            {sending ? t('channels.sending') : t('channels.sendToN').replace('{n}', String(selected.size))}
          </Button>
          <Typography size="xs" variant="muted">
            {t('channels.sendHint')}
          </Typography>
        </Box>

        {failed.length > 0 ? (
          <Box
            layoutClassName="space-y-1 rounded-lg p-3"
            backgroundClassName="bg-rose-50 dark:bg-rose-900/20"
            borderClassName="border border-rose-200 dark:border-rose-800"
          >
            <Typography size="xs" layoutClassName="font-semibold" textClassName="text-rose-700 dark:text-rose-300">
              {t('channels.notSentList').replace('{n}', String(failed.length))}
            </Typography>
            {failed.slice(0, 8).map((r) => (
              <Typography key={r.psid} as="p" size="xs" textClassName="text-rose-600 dark:text-rose-400">
                {nameByPsid.get(r.psid) ?? r.psid}: {r.error}
              </Typography>
            ))}
          </Box>
        ) : null}
      </Card>

      {/* Danh sách khách */}
      {loading && contacts.length === 0 ? (
        <Card layoutClassName="flex items-center justify-center gap-2 p-8">
          <Spinner size="md" />
          <Typography size="sm" variant="muted">{t('channels.loading')}</Typography>
        </Card>
      ) : contacts.length === 0 ? (
        <Card layoutClassName="p-6">
          <EmptyState
            icon={<Users className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
            title={t('channels.noContactsTitle')}
            description={t('channels.noContactsDesc')}
          />
        </Card>
      ) : (
        <Card
          padding="none"
          layoutClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
          borderClassName="border-slate-100 dark:border-slate-700"
        >
          <Box layoutClassName="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHead
                backgroundClassName="bg-slate-50 dark:bg-slate-700/60"
                borderClassName="border-b border-slate-200 dark:border-slate-600"
              >
                <TableRow textClassName="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  <TableHeaderCell layoutClassName="w-10 px-4 py-3">
                    <Checkbox checked={selected.size === contacts.length && contacts.length > 0} onChange={toggleAll} />
                  </TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3">{t('channels.colCustomer')}</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3">{t('channels.colLastInbound')}</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3">{t('channels.colStatus')}</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3">{t('channels.colMessages')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow
                    key={c.psid}
                    onClick={() => toggle(c.psid)}
                    stateClassName="cursor-pointer"
                    hoverClassName="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                    borderClassName="border-b border-slate-100 last:border-0 dark:border-slate-700/60"
                  >
                    <TableCell layoutClassName="px-4 py-3">
                      <Checkbox checked={selected.has(c.psid)} onChange={() => toggle(c.psid)} />
                    </TableCell>
                    <TableCell layoutClassName="px-4 py-3" textClassName="text-sm text-slate-800 dark:text-slate-100">
                      <Box layoutClassName="flex items-center gap-1.5">
                        {platform ? null : (
                        <Badge
                          size="sm"
                          backgroundClassName={c.platform === 'instagram' ? 'bg-pink-50 dark:bg-pink-900/30' : 'bg-sky-50 dark:bg-sky-900/30'}
                          textClassName={c.platform === 'instagram' ? 'text-pink-700 dark:text-pink-300' : 'text-sky-700 dark:text-sky-300'}
                        >
                          {c.platform === 'instagram' ? t('channels.srcInstagram') : t('channels.srcFacebook')}
                        </Badge>
                        )}
                        <Typography
                          as="span"
                          size="sm"
                          layoutClassName="cursor-pointer"
                          textClassName="text-primary-600 hover:underline dark:text-primary-300"
                          onClick={() => setOpenChat(c)}
                        >
                          {c.name || t('channels.cmtUnknownName')}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell layoutClassName="whitespace-nowrap px-4 py-3" textClassName="text-xs text-slate-500 dark:text-slate-400">
                      {at(c.lastInboundAt)}
                    </TableCell>
                    <TableCell layoutClassName="whitespace-nowrap px-4 py-3">
                      {c.inWindow ? (
                        <Badge
                          size="sm"
                          backgroundClassName="bg-emerald-50 dark:bg-emerald-900/20"
                          textClassName="text-emerald-700 dark:text-emerald-300"
                          borderClassName="border border-emerald-200 dark:border-emerald-800"
                          layoutClassName="inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {t('channels.canSend')} · {left(c.minutesLeft, t)}
                        </Badge>
                      ) : (
                        <Badge
                          size="sm"
                          backgroundClassName="bg-slate-100 dark:bg-slate-700/50"
                          textClassName="text-slate-500 dark:text-slate-400"
                          borderClassName="border border-slate-200 dark:border-slate-600"
                          layoutClassName="inline-flex items-center gap-1"
                        >
                          <Clock className="h-3 w-3" />
                          {t('channels.windowClosed')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell layoutClassName="px-4 py-3" textClassName="text-xs text-slate-500 dark:text-slate-400">
                      {c.messageCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Card>
      )}
      <ConfirmModal
        isOpen={confirmBulk}
        title={t('channels.sendToN').replace('{n}', String(selected.size))}
        message={t('channels.confirmSend').replace('{n}', String(selected.size))}
        isLoading={sending}
        onConfirm={() => void doSend()}
        onCancel={() => setConfirmBulk(false)}
      />

      {openChat ? (
        <ConversationModal
          psid={openChat.psid}
          name={openChat.name}
          platform={openChat.platform}
          onClose={() => {
            setOpenChat(null);
            void load();
          }}
        />
      ) : null}
    </PageContainer>
  );
};

export default FacebookCustomersPage;
