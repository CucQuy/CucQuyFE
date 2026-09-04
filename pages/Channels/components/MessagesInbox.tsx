import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, MessageSquare, RefreshCw, Search, Send, Users } from 'lucide-react';
import {
  fetchFacebookContacts,
  fetchFacebookThread,
  sendFacebookMessage,
  syncFacebookContacts,
  syncInstagramConversations,
  type FacebookContact,
  type FacebookThread,
  type SocialPlatform,
} from '@/services/facebookService';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import AvatarImage from '@/components/ui/AvatarImage';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import BaseModal from '@/components/BaseModal';
import FacebookCustomers from '@/pages/FacebookCustomers/index';

/** Giờ:phút nếu là hôm nay, còn lại dd/mm — như các app chat. */
const shortTime = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return sameDay ? `${p(d.getHours())}:${p(d.getMinutes())}` : `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
};

const at = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Chữ cái đầu làm avatar khi Facebook không trả ảnh (URL ảnh có hạn dùng). */
const initials = (name: string): string =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

interface Props {
  /** Khoá theo 1 kênh (màn Tin nhắn của Facebook / Instagram). */
  platform: SocialPlatform;
}

/**
 * Hộp thư 2 cột như Messenger: trái là danh sách hội thoại (ảnh khách, tên, trích đoạn
 * tin cuối, thời gian), phải là khung chat + ô soạn tin.
 *
 * Trên điện thoại chỉ hiện 1 cột: chọn người thì mở khung chat, có nút quay lại.
 * Hết cửa sổ 24h của Meta thì ô soạn bị khoá kèm giải thích, thay vì để bấm gửi rồi lỗi.
 */
const MessagesInbox: React.FC<Props> = ({ platform }) => {
  const { t } = useLanguage();
  const [contacts, setContacts] = useState<FacebookContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [q, setQ] = useState('');
  const [activePsid, setActivePsid] = useState<string | null>(null);
  const [thread, setThread] = useState<FacebookThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  /** Mở màn gửi tin hàng loạt (chọn nhiều người + ảnh + nút bấm) trong 1 modal. */
  const [bulkOpen, setBulkOpen] = useState(false);
  const autoSynced = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (): Promise<number> => {
    setLoading(true);
    try {
      const r = await fetchFacebookContacts('', 300, platform);
      setContacts(r.items);
      return r.items.length;
    } catch {
      toast.error(t('channels.loadContactsFailed'));
      return 0;
    } finally {
      setLoading(false);
    }
  }, [platform]);

  // Hộp thư trống ở lần đầu vào → tự kéo hội thoại về, khỏi bắt bấm nút.
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
        // chưa nối kênh → để trạng thái trống + nút đồng bộ tay
      } finally {
        setSyncing(false);
      }
    })();
  }, [load, platform]);

  const openThread = useCallback(
    async (psid: string) => {
      setActivePsid(psid);
      setThreadLoading(true);
      setText('');
      try {
        setThread(await fetchFacebookThread(psid, platform));
      } catch {
        toast.error(t('channels.threadLoadFailed'));
        setThread(null);
      } finally {
        setThreadLoading(false);
      }
    },
    [platform],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [thread]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      if (platform === 'instagram') {
        const r = await syncInstagramConversations();
        toast.success(t('channels.igSynced').replace('{n}', String(r.contacts)));
      } else {
        const r = await syncFacebookContacts();
        toast.success(t('channels.syncedConversations').replace('{n}', String(r.synced)));
      }
      await load();
    } catch {
      toast.error(t('channels.syncFailed'));
    } finally {
      setSyncing(false);
    }
  };

  const submit = async () => {
    const body = text.trim();
    if (!activePsid || !body) return;
    setSending(true);
    try {
      const r = await sendFacebookMessage({ psids: [activePsid], text: body });
      const failed = r.results.find((x) => !x.sent);
      if (failed) toast.error(failed.error || t('channels.sendFailed'));
      else toast.success(t('channels.threadSent'));
      setText('');
      await openThread(activePsid);
      await load();
    } catch {
      toast.error(t('channels.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return contacts;
    return contacts.filter((c) => (c.name || '').toLowerCase().includes(kw) || c.psid.includes(kw));
  }, [contacts, q]);

  const active = contacts.find((c) => c.psid === activePsid) ?? null;
  const inWindow = thread?.contact?.inWindow ?? active?.inWindow ?? false;

  return (
    <Card
      padding="none"
      layoutClassName="flex h-full min-h-[28rem] overflow-hidden"
      borderClassName="border-slate-100 dark:border-slate-700"
    >
      {/* ── Cột trái: danh sách hội thoại ── */}
      <Box
        layoutClassName={`${activePsid ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col md:w-80`}
        borderClassName="border-r border-slate-100 dark:border-slate-700"
      >
        <Box
          layoutClassName="flex shrink-0 items-center gap-2 px-3 py-2.5"
          borderClassName="border-b border-slate-100 dark:border-slate-700"
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('channels.inboxSearch')}
            leftIcon={<Search className="h-3.5 w-3.5 text-slate-400" />}
            sizeClassName="px-2 py-1.5 text-xs"
            containerClassName="flex-1"
          />
          <Button
            type="button"
            onClick={() => setBulkOpen(true)}
            variant="ghost"
            leftIcon={<Users className="h-3.5 w-3.5" />}
            sizeClassName="px-2 py-1.5"
            textClassName="text-xs text-slate-500 dark:text-slate-400"
            layoutClassName="inline-flex shrink-0 items-center"
            title={t('channels.bulkSend')}
          />
          <Button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing}
            variant="ghost"
            leftIcon={
              syncing ? <Spinner size="sm" /> : <RefreshCw className="h-3.5 w-3.5" />
            }
            sizeClassName="px-2 py-1.5"
            textClassName="text-xs text-slate-500 dark:text-slate-400"
            layoutClassName="inline-flex shrink-0 items-center"
            title={t('channels.syncFromFb')}
          />
        </Box>

        <Box layoutClassName="min-h-0 flex-1 overflow-y-auto">
          {loading && contacts.length === 0 ? (
            <Box layoutClassName="flex items-center justify-center gap-2 py-8">
              <Spinner size="md" />
              <Typography size="sm" variant="muted">
                {t('channels.loading')}
              </Typography>
            </Box>
          ) : filtered.length === 0 ? (
            <Box layoutClassName="p-4">
              <EmptyState
                icon={<Users className="h-7 w-7 text-slate-300 dark:text-slate-600" />}
                title={t('channels.noContactsTitle')}
                description={t('channels.noContactsDesc')}
              />
            </Box>
          ) : (
            filtered.map((c) => {
              const on = c.psid === activePsid;
              return (
                <Box
                  key={c.psid}
                  layoutClassName="flex cursor-pointer items-center gap-2.5 px-3 py-2.5"
                  backgroundClassName={on ? 'bg-primary-50 dark:bg-primary-900/20' : undefined}
                  hoverClassName={on ? undefined : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}
                  borderClassName="border-b border-slate-50 last:border-0 dark:border-slate-700/40"
                  onClick={() => void openThread(c.psid)}
                >
                  <AvatarImage
                    src={c.profilePic || undefined}
                    alt={c.name}
                    size="md"
                    fallback={
                      <Typography
                        as="span"
                        size="xs"
                        layoutClassName="font-semibold"
                        textClassName="text-slate-500 dark:text-slate-300"
                      >
                        {initials(c.name)}
                      </Typography>
                    }
                    containerClassName="shrink-0"
                  />
                  <Box layoutClassName="min-w-0 flex-1">
                    <Box layoutClassName="flex items-baseline justify-between gap-2">
                      <Typography
                        as="span"
                        size="sm"
                        layoutClassName="truncate font-semibold"
                        textClassName="text-slate-800 dark:text-slate-100"
                      >
                        {c.name || t('channels.cmtUnknownName')}
                      </Typography>
                      <Typography as="span" size="xs" variant="muted" layoutClassName="shrink-0">
                        {shortTime(c.lastMessage?.createdAt ?? c.lastInboundAt)}
                      </Typography>
                    </Box>
                    <Box layoutClassName="flex items-center gap-1.5">
                      <Typography
                        as="span"
                        size="xs"
                        layoutClassName="truncate"
                        textClassName="text-slate-500 dark:text-slate-400"
                      >
                        {c.lastMessage
                          ? `${c.lastMessage.direction === 'out' ? t('channels.inboxYou') + ': ' : ''}${c.lastMessage.text || `[${t('channels.threadAttachment')}]`}`
                          : t('channels.inboxNoSnippet')}
                      </Typography>
                      {c.inWindow ? (
                        <Box
                          layoutClassName="h-1.5 w-1.5 shrink-0"
                          backgroundClassName="bg-emerald-500"
                          roundedClassName="rounded-full"
                          title={t('channels.canSend')}
                        />
                      ) : null}
                    </Box>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      </Box>

      {/* ── Cột phải: khung chat ── */}
      <Box layoutClassName={`${activePsid ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
        {!active ? (
          <Box layoutClassName="flex flex-1 items-center justify-center p-6">
            <EmptyState
              icon={<MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
              title={t('channels.inboxPickTitle')}
              description={t('channels.inboxPickDesc')}
            />
          </Box>
        ) : (
          <>
            {/* Đầu khung chat */}
            <Box
              layoutClassName="flex shrink-0 items-center gap-2 px-3 py-2.5"
              borderClassName="border-b border-slate-100 dark:border-slate-700"
            >
              <Button
                type="button"
                onClick={() => setActivePsid(null)}
                variant="ghost"
                leftIcon={<ArrowLeft className="h-4 w-4" />}
                sizeClassName="px-1.5 py-1"
                layoutClassName="inline-flex md:hidden"
                textClassName="text-slate-500"
              />
              <AvatarImage
                src={active.profilePic || undefined}
                alt={active.name}
                size="sm"
                fallback={
                  <Typography
                    as="span"
                    size="xs"
                    layoutClassName="font-semibold"
                    textClassName="text-slate-500 dark:text-slate-300"
                  >
                    {initials(active.name)}
                  </Typography>
                }
                containerClassName="shrink-0"
              />
              <Box layoutClassName="min-w-0 flex-1">
                <Typography
                  as="p"
                  size="sm"
                  layoutClassName="truncate font-semibold"
                  textClassName="text-slate-800 dark:text-slate-100"
                >
                  {active.name || active.psid}
                </Typography>
                <Typography size="xs" variant="muted">
                  {t('channels.colLastInbound')}: {at(active.lastInboundAt)}
                </Typography>
              </Box>
              <Badge
                size="sm"
                backgroundClassName={inWindow ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-slate-100 dark:bg-slate-700'}
                textClassName={inWindow ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}
              >
                {inWindow ? t('channels.canSend') : t('channels.windowClosed')}
              </Badge>
            </Box>

            {/* Dòng tin nhắn */}
            <Box
              layoutClassName="min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
              backgroundClassName="bg-slate-50 dark:bg-slate-900/40"
            >
              {threadLoading ? (
                <Box layoutClassName="flex items-center justify-center gap-2 py-6">
                  <Spinner size="md" />
                  <Typography size="sm" variant="muted">
                    {t('channels.loading')}
                  </Typography>
                </Box>
              ) : (thread?.items.length ?? 0) === 0 ? (
                <EmptyState
                  icon={<Send className="h-7 w-7 text-slate-300 dark:text-slate-600" />}
                  title={t('channels.threadEmptyTitle')}
                  description={t('channels.threadEmptyDesc')}
                />
              ) : (
                (thread?.items ?? []).map((m) => (
                  <Box
                    key={m.id}
                    layoutClassName={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}
                  >
                    <Box
                      layoutClassName="max-w-[75%] space-y-0.5 px-3 py-2"
                      backgroundClassName={
                        m.direction === 'out'
                          ? 'bg-primary-500 dark:bg-primary-600'
                          : 'bg-white dark:bg-slate-800'
                      }
                      roundedClassName="rounded-xl"
                      shadowClassName="shadow-sm"
                    >
                      <Typography
                        as="p"
                        size="sm"
                        textClassName={m.direction === 'out' ? 'text-white' : 'text-slate-700 dark:text-slate-200'}
                      >
                        {m.text || `[${t('channels.threadAttachment')}]`}
                      </Typography>
                      <Typography
                        as="p"
                        size="xs"
                        textClassName={m.direction === 'out' ? 'text-primary-100' : 'text-slate-400 dark:text-slate-500'}
                      >
                        {at(m.createdAt)}
                        {m.error ? ` · ${m.error}` : ''}
                      </Typography>
                    </Box>
                  </Box>
                ))
              )}
              <Box layoutClassName="h-px" ref={endRef} />
            </Box>

            {/* Ô soạn tin */}
            <Box
              layoutClassName="flex shrink-0 items-end gap-2 p-3"
              borderClassName="border-t border-slate-100 dark:border-slate-700"
            >
              <Textarea
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  // Enter gửi, Shift+Enter xuống dòng — thói quen của mọi app chat.
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                disabled={!inWindow}
                placeholder={inWindow ? t('channels.threadPlaceholder') : t('channels.threadClosedHint')}
                containerClassName="flex-1"
              />
              <Button
                type="button"
                onClick={() => void submit()}
                disabled={sending || !inWindow || !text.trim()}
                leftIcon={sending ? <Spinner size="sm" /> : <Send className="h-3.5 w-3.5" />}
                sizeClassName="px-3 py-2"
                textClassName="text-xs font-semibold"
                roundedClassName="rounded-lg"
                layoutClassName="inline-flex shrink-0 items-center gap-1.5"
              >
                {t('channels.send')}
              </Button>
            </Box>
          </>
        )}
      </Box>

      {/* Gửi tin hàng loạt — dùng lại nguyên màn cũ (chọn nhiều người, ảnh, nút bấm) */}
      <BaseModal
        isOpen={bulkOpen}
        onClose={() => {
          setBulkOpen(false);
          void load();
        }}
        title={t('channels.bulkSend')}
        size="2xl"
      >
        <FacebookCustomers platform={platform} />
      </BaseModal>
    </Card>
  );
};

export default MessagesInbox;
