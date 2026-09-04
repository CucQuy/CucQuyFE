import React, { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { fetchFacebookStatus, type FacebookStatus } from '@/services/facebookService';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

/** 1 dòng "tính năng — dùng được / thiếu quyền". */
const Row: React.FC<{ label: string; ok: boolean; hint?: string }> = ({ label, ok, hint }) => (
  <Box layoutClassName="flex items-start justify-between gap-3 py-1.5">
    <Box layoutClassName="space-y-0.5">
      <Typography as="p" size="sm" textClassName="text-slate-700 dark:text-slate-200">
        {label}
      </Typography>
      {!ok && hint ? (
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
        Dùng được
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
        Thiếu quyền
      </Badge>
    )}
  </Box>
);

/**
 * Tab "Kết nối" của Facebook: page nào, token còn sống không, có quyền gì, webhook đăng ký
 * sự kiện nào. Dựng ra vì đã mất cả buổi mò lỗi "tin không tới" mà hoá ra webhook có URL
 * nhưng KHÔNG đăng ký field nào — nhìn màn này là thấy ngay.
 */
const FacebookConnectionCard: React.FC = () => {
  const [status, setStatus] = useState<FacebookStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setStatus(await fetchFacebookStatus());
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading && !status) {
    return (
      <Card layoutClassName="flex items-center justify-center gap-2 p-8">
        <Spinner size="md" />
        <Typography size="sm" variant="muted">Đang kiểm tra kết nối…</Typography>
      </Card>
    );
  }

  const hasFeed = (status?.webhookFields ?? []).includes('feed');
  const hasMessages = (status?.webhookFields ?? []).includes('messages');

  return (
    <Box layoutClassName="space-y-4">
      <Card layoutClassName="space-y-3 p-4">
        <Box layoutClassName="flex flex-wrap items-center justify-between gap-2">
          <Typography size="sm" layoutClassName="font-semibold" textClassName="text-slate-800 dark:text-slate-100">
            {status?.pageName || 'Chưa kết nối fanpage'}
            {status?.pageId ? (
              <Typography as="span" size="xs" variant="muted" layoutClassName="ml-2">
                id {status.pageId}
              </Typography>
            ) : null}
          </Typography>
          <Button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            leftIcon={loading ? <Spinner size="sm" /> : <RefreshCw className="h-3.5 w-3.5" />}
            variant="secondary"
            borderClassName="border border-slate-200 dark:border-slate-600"
            backgroundClassName="bg-white dark:bg-slate-800"
            textClassName="text-xs font-medium text-slate-700 dark:text-slate-200"
            roundedClassName="rounded-lg"
            sizeClassName="px-2.5 py-1.5"
            layoutClassName="inline-flex items-center gap-1.5"
          >
            Kiểm tra lại
          </Button>
        </Box>

        <Box layoutClassName="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Typography as="span" size="xs" variant="muted">
            Token: {status?.tokenValid ? 'còn hiệu lực' : `lỗi — ${status?.tokenError || 'không hợp lệ'}`}
            {status?.tokenValid && status?.expiresAt === 0 ? ' · không hết hạn' : ''}
          </Typography>
          <Typography as="span" size="xs" variant="muted">
            Webhook: {(status?.webhookFields ?? []).length > 0 ? status?.webhookFields?.join(', ') : 'chưa đăng ký sự kiện nào'}
          </Typography>
        </Box>
      </Card>

      <Card layoutClassName="divide-y divide-slate-100 p-4 dark:divide-slate-700">
        <Row
          label="Nhận tin khách nhắn (webhook)"
          ok={hasMessages}
          hint="Cần đăng ký sự kiện 'messages' cho page trong Meta App."
        />
        <Row
          label="Gửi tin nhắn cho khách"
          ok={status?.can?.messaging ?? false}
          hint="Token cần quyền pages_messaging."
        />
        <Row
          label="Đọc bình luận fanpage"
          ok={status?.can?.readComments ?? false}
          hint="Token cần quyền pages_read_engagement — lấy token mới ở Graph API Explorer."
        />
        <Row
          label="Trả lời / ẩn / xoá bình luận"
          ok={status?.can?.manageComments ?? false}
          hint="Token cần quyền pages_manage_engagement."
        />
        <Row
          label="Nhận bình luận mới theo thời gian thực"
          ok={hasFeed}
          hint="Cần đăng ký thêm sự kiện 'feed' cho page."
        />
      </Card>
    </Box>
  );
};

export default FacebookConnectionCard;
