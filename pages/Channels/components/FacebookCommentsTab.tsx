import React, { useCallback, useEffect, useState } from 'react';
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
  fetchFacebookCommentConfig,
  fetchFacebookComments,
  hideFacebookComment,
  privateReplyFacebookComment,
  replyFacebookComment,
  saveFacebookCommentConfig,
  syncFacebookComments,
  type FacebookComment,
  type FacebookCommentConfig,
} from '@/services/facebookService';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Checkbox from '@/components/ui/Checkbox';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Label from '@/components/ui/Label';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';

type Filter = '' | 'pending' | 'hidden' | 'replied';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'pending', label: 'Chưa trả lời' },
  { id: '', label: 'Tất cả' },
  { id: 'replied', label: 'Đã trả lời' },
  { id: 'hidden', label: 'Đã ẩn' },
];

/** Nhãn cho luật tự động đã chạy trên bình luận. */
const AUTO_LABEL: Record<string, string> = {
  hide_phone: 'tự ẩn: có SĐT',
  hide_keyword: 'tự ẩn: từ khoá',
  reply: 'tự trả lời',
  private_reply: 'tự nhắn riêng',
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
const FacebookCommentsTab: React.FC = () => {
  const [filter, setFilter] = useState<Filter>('pending');
  const [items, setItems] = useState<FacebookComment[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, hidden: 0, replied: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [noPermission, setNoPermission] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyPrivate, setReplyPrivate] = useState(false);

  const [cfg, setCfg] = useState<FacebookCommentConfig | null>(null);
  const [keywordText, setKeywordText] = useState('');
  const [savingCfg, setSavingCfg] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchFacebookComments(filter, 100);
      setItems(r.items);
      setCounts(r.counts);
    } catch {
      toast.error('Không tải được bình luận');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const c = await fetchFacebookCommentConfig();
        setCfg(c);
        setKeywordText(c.autoHideKeywords.join(', '));
      } catch {
        // cấu hình lỗi không chặn danh sách
      }
    })();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await syncFacebookComments();
      toast.success(`Đã kéo ${r.comments} bình luận từ ${r.posts} bài`);
      setNoPermission(false);
      await load();
    } catch (e: any) {
      if (isPermissionError(e)) setNoPermission(true);
      else toast.error('Đồng bộ bình luận thất bại');
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
        toast.error('Token Facebook chưa có quyền quản lý bình luận');
      } else {
        toast.error(e?.response?.data?.message || 'Thao tác thất bại');
      }
    } finally {
      setBusyId(null);
    }
  };

  const submitReply = async (c: FacebookComment) => {
    const text = replyText.trim();
    if (!text) {
      toast.error('Chưa nhập nội dung');
      return;
    }
    await act(
      c.id,
      () =>
        replyPrivate
          ? privateReplyFacebookComment(c.id, text)
          : replyFacebookComment(c.id, text),
      replyPrivate ? 'Đã nhắn riêng người bình luận' : 'Đã trả lời bình luận',
    );
    setReplyFor(null);
    setReplyText('');
  };

  const saveCfg = async (patch: Partial<FacebookCommentConfig>) => {
    if (!cfg) return;
    const next = { ...cfg, ...patch };
    setCfg(next);
    setSavingCfg(true);
    try {
      await saveFacebookCommentConfig(patch);
    } catch {
      toast.error('Không lưu được cấu hình');
    } finally {
      setSavingCfg(false);
    }
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
              Token Facebook chưa có quyền cho bình luận
            </Typography>
            <Typography as="p" size="xs" textClassName="text-amber-700 dark:text-amber-300">
              Vào Graph API Explorer, tạo Page Access Token mới có thêm{' '}
              <b>pages_read_engagement</b> (đọc) và <b>pages_manage_engagement</b> (trả lời / ẩn / xoá),
              rồi cập nhật vào cấu hình hệ thống. Xem thêm ở tab “Kết nối”.
            </Typography>
          </Box>
        </Card>
      ) : null}

      {/* Luật tự động */}
      {cfg ? (
        <Card layoutClassName="space-y-3 p-4">
          <Box layoutClassName="flex items-center justify-between gap-2">
            <Typography size="xs" layoutClassName="font-bold uppercase tracking-wider" textClassName="text-slate-500 dark:text-slate-400">
              Tự động xử lý bình luận mới
            </Typography>
            {savingCfg ? <Spinner size="sm" /> : null}
          </Box>

          <Box layoutClassName="grid gap-3 sm:grid-cols-2">
            <Box layoutClassName="space-y-2">
              <Checkbox
                checked={cfg.autoHidePhone}
                onChange={(e) => void saveCfg({ autoHidePhone: e.target.checked })}
                label="Tự ẩn bình luận có số điện thoại"
                labelClassName="text-sm text-slate-700 dark:text-slate-200"
              />
              <Box layoutClassName="space-y-1">
                <Label className="mb-0">Tự ẩn theo từ khoá (cách nhau dấu phẩy)</Label>
                <Input
                  value={keywordText}
                  onChange={(e) => setKeywordText(e.target.value)}
                  onBlur={() =>
                    void saveCfg({
                      autoHideKeywords: keywordText
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="spam, shop khác, …"
                  containerClassName="w-full"
                />
              </Box>
            </Box>

            <Box layoutClassName="space-y-2">
              <Checkbox
                checked={cfg.autoReplyEnabled}
                onChange={(e) => void saveCfg({ autoReplyEnabled: e.target.checked })}
                label="Tự trả lời công khai bình luận mới"
                labelClassName="text-sm text-slate-700 dark:text-slate-200"
              />
              <Input
                value={cfg.autoReplyText}
                onChange={(e) => setCfg({ ...cfg, autoReplyText: e.target.value })}
                onBlur={() => void saveCfg({ autoReplyText: cfg.autoReplyText })}
                placeholder="Cúc Quy đã nhận, bạn inbox shop nhé ạ!"
                containerClassName="w-full"
              />
              <Checkbox
                checked={cfg.autoPrivateReply}
                onChange={(e) => void saveCfg({ autoPrivateReply: e.target.checked })}
                label="Tự nhắn riêng người bình luận (mở 24h để bán tiếp)"
                labelClassName="text-sm text-slate-700 dark:text-slate-200"
              />
              <Input
                value={cfg.privateReplyText}
                onChange={(e) => setCfg({ ...cfg, privateReplyText: e.target.value })}
                onBlur={() => void saveCfg({ privateReplyText: cfg.privateReplyText })}
                placeholder="Chào bạn, Cúc Quy gửi bạn menu nhé…"
                containerClassName="w-full"
              />
            </Box>
          </Box>
        </Card>
      ) : null}

      {/* Bộ lọc + đồng bộ */}
      <Card layoutClassName="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <Box layoutClassName="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <Typography as="span" size="sm" variant="muted">
            Tổng: <b>{counts.total}</b>
          </Typography>
          <Typography as="span" size="sm" textClassName="text-amber-600 dark:text-amber-400">
            Chưa trả lời: <b>{counts.pending}</b>
          </Typography>
          <Typography as="span" size="sm" variant="muted">
            Đã ẩn: <b>{counts.hidden}</b>
          </Typography>
        </Box>
        <Box layoutClassName="ml-auto flex flex-wrap items-center gap-2">
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
              {f.label}
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
            {syncing ? 'Đang kéo…' : 'Kéo bình luận mới'}
          </Button>
        </Box>
      </Card>

      {/* Danh sách bình luận */}
      {loading && items.length === 0 ? (
        <Card layoutClassName="flex items-center justify-center gap-2 p-8">
          <Spinner size="md" />
          <Typography size="sm" variant="muted">Đang tải…</Typography>
        </Card>
      ) : items.length === 0 ? (
        <Card layoutClassName="p-6">
          <EmptyState
            icon={<MessageSquareReply className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
            title="Chưa có bình luận nào"
            description="Bấm “Kéo bình luận mới” để lấy từ fanpage về."
          />
        </Card>
      ) : (
        <Box layoutClassName="space-y-2">
          {items.map((c) => (
            <Card key={c.id} layoutClassName="space-y-2 p-3">
              <Box layoutClassName="flex flex-wrap items-center gap-2">
                <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-800 dark:text-slate-100">
                  {c.fromName || '(không rõ tên)'}
                </Typography>
                <Typography as="span" size="xs" variant="muted">
                  {at(c.createdTime)}
                </Typography>
                {c.isHidden ? (
                  <Badge size="sm" backgroundClassName="bg-slate-100 dark:bg-slate-700/50" textClassName="text-slate-600 dark:text-slate-300" borderClassName="border border-slate-200 dark:border-slate-600">
                    Đã ẩn
                  </Badge>
                ) : null}
                {c.repliedAt ? (
                  <Badge size="sm" backgroundClassName="bg-emerald-50 dark:bg-emerald-900/20" textClassName="text-emerald-700 dark:text-emerald-300" borderClassName="border border-emerald-200 dark:border-emerald-800">
                    Đã trả lời
                  </Badge>
                ) : null}
                {c.autoAction ? (
                  <Typography as="span" size="xs" variant="muted">
                    · {AUTO_LABEL[c.autoAction] ?? c.autoAction}
                  </Typography>
                ) : null}
              </Box>

              <Typography as="p" size="sm" textClassName="text-slate-700 dark:text-slate-200">
                {c.message || '(không có nội dung chữ)'}
              </Typography>
              {c.postMessage ? (
                <Typography as="p" size="xs" variant="muted">
                  Bài: {c.postMessage.slice(0, 70)}
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
                  Trả lời
                </Button>
                <Button
                  type="button"
                  onClick={() => void act(c.id, () => hideFacebookComment(c.id, !c.isHidden), c.isHidden ? 'Đã bỏ ẩn' : 'Đã ẩn bình luận')}
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
                  {c.isHidden ? 'Bỏ ẩn' : 'Ẩn'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Xoá hẳn bình luận này? Không hoàn tác được.')) {
                      void act(c.id, () => deleteFacebookComment(c.id), 'Đã xoá bình luận');
                    }
                  }}
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
                  Xoá
                </Button>
                {busyId === c.id ? <Spinner size="sm" /> : null}
              </Box>

              {replyFor === c.id ? (
                <Box layoutClassName="space-y-2 pt-1">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={2}
                    placeholder="Nhập nội dung trả lời…"
                  />
                  <Box layoutClassName="flex flex-wrap items-center gap-3">
                    <Checkbox
                      checked={replyPrivate}
                      onChange={(e) => setReplyPrivate(e.target.checked)}
                      label="Nhắn riêng thay vì trả lời công khai"
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
                      Gửi
                    </Button>
                  </Box>
                </Box>
              ) : null}
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default FacebookCommentsTab;
