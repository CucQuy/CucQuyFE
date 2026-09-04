import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Send } from 'lucide-react';
import {
  fetchFacebookThread,
  sendFacebookMessage,
  type FacebookThread,
  type SocialPlatform,
} from '@/services/facebookService';
import { useLanguage } from '@/contexts/LanguageContext';
import BaseModal from '@/components/BaseModal';
import Box from '@/components/ui/Box';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Textarea from '@/components/ui/Textarea';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';

const at = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

interface Props {
  psid: string;
  name: string;
  platform: SocialPlatform;
  onClose: () => void;
}

/**
 * Cửa sổ hội thoại với 1 người: tin cũ ở trên, mới ở dưới, tin của tiệm nằm bên phải.
 * BE kéo thêm lịch sử từ Graph khi mở (webhook chỉ có tin mới), nên xem được cả
 * đoạn khách nhắn từ trước khi nối app.
 *
 * Hết cửa sổ 24h (Messenger) thì Meta chặn gửi tự do — ô soạn tin bị khoá kèm giải thích,
 * thay vì để bấm gửi rồi nhận lỗi #10.
 */
const ConversationModal: React.FC<Props> = ({ psid, name, platform, onClose }) => {
  const { t } = useLanguage();
  const [thread, setThread] = useState<FacebookThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      setThread(await fetchFacebookThread(psid, platform));
    } catch {
      toast.error(t('channels.threadLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [psid, platform]);

  useEffect(() => {
    void load();
  }, [load]);

  // Cuộn xuống tin mới nhất mỗi khi danh sách đổi.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [thread]);

  const inWindow = thread?.contact?.inWindow ?? false;

  const submit = async () => {
    const body = text.trim();
    if (!body) {
      toast.error(t('channels.noContent'));
      return;
    }
    setSending(true);
    try {
      const r = await sendFacebookMessage({ psids: [psid], text: body });
      const failed = r.results.find((x) => !x.sent);
      if (failed) toast.error(failed.error || t('channels.sendFailed'));
      else toast.success(t('channels.threadSent'));
      setText('');
      await load();
    } catch {
      toast.error(t('channels.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <BaseModal isOpen onClose={onClose} title={name || psid} size="lg">
      <Box layoutClassName="space-y-3">
        <Box layoutClassName="flex flex-wrap items-center gap-2">
          <Badge
            size="sm"
            backgroundClassName={platform === 'instagram' ? 'bg-pink-50 dark:bg-pink-900/30' : 'bg-sky-50 dark:bg-sky-900/30'}
            textClassName={platform === 'instagram' ? 'text-pink-700 dark:text-pink-300' : 'text-sky-700 dark:text-sky-300'}
          >
            {platform === 'instagram' ? t('channels.srcInstagram') : t('channels.srcFacebook')}
          </Badge>
          <Badge
            size="sm"
            backgroundClassName={inWindow ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-slate-100 dark:bg-slate-700'}
            textClassName={inWindow ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}
          >
            {inWindow ? t('channels.canSend') : t('channels.windowClosed')}
          </Badge>
          <Typography as="span" size="xs" variant="muted">
            {t('channels.colLastInbound')}: {at(thread?.contact?.lastInboundAt)}
          </Typography>
        </Box>

        {/* Khung tin nhắn */}
        <Box
          layoutClassName="max-h-80 space-y-2 overflow-y-auto p-3"
          backgroundClassName="bg-slate-50 dark:bg-slate-900/40"
          roundedClassName="rounded-lg"
        >
          {loading ? (
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

        {/* Soạn tin */}
        <Box layoutClassName="space-y-2">
          <Textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!inWindow}
            placeholder={inWindow ? t('channels.threadPlaceholder') : t('channels.threadClosedHint')}
          />
          <Box layoutClassName="flex justify-end">
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={sending || !inWindow}
              leftIcon={sending ? <Spinner size="sm" /> : <Send className="h-3.5 w-3.5" />}
              sizeClassName="px-3 py-1.5"
              textClassName="text-xs font-semibold"
              roundedClassName="rounded-lg"
              layoutClassName="inline-flex items-center gap-1.5"
            >
              {t('channels.send')}
            </Button>
          </Box>
        </Box>
      </Box>
    </BaseModal>
  );
};

export default ConversationModal;
