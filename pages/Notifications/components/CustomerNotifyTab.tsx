import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, RefreshCw, RotateCcw, Send, XCircle } from 'lucide-react';
import {
  fetchCustomerNotifyLog,
  type CustomerNotifyLogRow,
} from '@/services/orderService';
import { resendNotification } from '@/services/notificationService';
import { formatVND } from '@/utils/format/currencyUtil';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import {
  Table,
  TableBody,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableCell,
} from '@/components/ui/Table';

type StatusFilter = '' | 'sent' | 'failed';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: '', label: 'Tất cả' },
  { id: 'sent', label: 'Thành công' },
  { id: 'failed', label: 'Thất bại' },
];

/** ISO → 'dd/mm HH:MM' theo giờ máy (đủ cho nhật ký vận hành). */
const at = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * Tab "Trạng thái thông báo": mỗi dòng = 1 lần gửi tin Zalo cho KHÁCH theo SĐT —
 * đơn nào gửi thành công, đơn nào lỗi (kèm nguyên văn lý do từ bridge Zalo) và
 * nút gửi lại cho dòng lỗi. Dữ liệu từ nhật ký `notifications` (category customer_order).
 */
const CustomerNotifyTab: React.FC = () => {
  const [status, setStatus] = useState<StatusFilter>('');
  const [rows, setRows] = useState<CustomerNotifyLogRow[]>([]);
  const [counts, setCounts] = useState({ sent: 0, failed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchCustomerNotifyLog({ status, limit: 100 });
      setRows(r.items);
      setCounts(r.counts);
    } catch {
      toast.error('Không tải được nhật ký gửi tin');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleResend = async (row: CustomerNotifyLogRow) => {
    setResendingId(row.id);
    try {
      await resendNotification(row.id);
      toast.success(`Đã gửi lại tin cho ${row.phone}`);
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Gửi lại thất bại';
      toast.error(String(msg));
    } finally {
      setResendingId(null);
    }
  };

  const summary = useMemo(
    () => [
      { label: 'Tổng đã gửi', value: counts.total, tone: 'text-slate-700 dark:text-slate-200' },
      { label: 'Thành công', value: counts.sent, tone: 'text-emerald-600 dark:text-emerald-400' },
      { label: 'Thất bại', value: counts.failed, tone: 'text-rose-600 dark:text-rose-400' },
    ],
    [counts],
  );

  return (
    <Box layoutClassName="space-y-4">
      <Card layoutClassName="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        {summary.map((s) => (
          <Box key={s.label} layoutClassName="flex items-baseline gap-1.5">
            <Typography as="span" size="sm" variant="muted">
              {s.label}:
            </Typography>
            <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName={s.tone}>
              {s.value}
            </Typography>
          </Box>
        ))}
        <Box layoutClassName="ml-auto flex items-center gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.id || 'all'}
              type="button"
              onClick={() => setStatus(f.id)}
              variant="secondary"
              disableVariantHover
              disableVariantTextColor
              borderClassName={status === f.id
                ? 'border border-primary-400 dark:border-primary-500'
                : 'border border-slate-200 dark:border-slate-600'}
              backgroundClassName={status === f.id
                ? 'bg-primary-50 dark:bg-primary-900/30'
                : 'bg-white dark:bg-slate-800'}
              textClassName={status === f.id
                ? 'text-xs font-semibold text-primary-700 dark:text-primary-200'
                : 'text-xs font-medium text-slate-600 dark:text-slate-300'}
              roundedClassName="rounded-lg"
              sizeClassName="px-2.5 py-1.5"
            >
              {f.label}
            </Button>
          ))}
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
            Làm mới
          </Button>
        </Box>
      </Card>

      {loading && rows.length === 0 ? (
        <Card layoutClassName="flex items-center justify-center gap-2 p-8">
          <Spinner size="md" />
          <Typography size="sm" variant="muted">
            Đang tải nhật ký…
          </Typography>
        </Card>
      ) : rows.length === 0 ? (
        <Card layoutClassName="p-6">
          <EmptyState
            icon={<Send className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
            title="Chưa có tin nào gửi cho khách"
            description="Tin sẽ xuất hiện khi bật gửi tự động ở Cài đặt → Zalo, hoặc khi bấm “Gửi cho khách” ở chi tiết đơn."
          />
        </Card>
      ) : (
        <Card padding="none" layoutClassName="overflow-hidden">
          <Box layoutClassName="overflow-x-auto">
            <Table>
              <TableHead
                backgroundClassName="bg-slate-50 dark:bg-slate-700/60"
                borderClassName="border-b border-slate-200 dark:border-slate-600"
              >
                <TableRow textClassName="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  <TableHeaderCell layoutClassName="px-4 py-3">Thời điểm</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3">Đơn</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3">Khách · SĐT</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3">Trạng thái</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3">Lý do lỗi</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3 text-right">Thao tác</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.id}
                    borderClassName="border-b border-slate-100 last:border-0 dark:border-slate-700/60"
                  >
                    <TableCell layoutClassName="whitespace-nowrap px-4 py-3" textClassName="text-xs text-slate-500 dark:text-slate-400">
                      {at(r.createdAt)}
                    </TableCell>
                    <TableCell layoutClassName="whitespace-nowrap px-4 py-3">
                      <Typography as="span" size="sm" layoutClassName="font-medium" textClassName="text-slate-800 dark:text-slate-100">
                        {r.orderNumber || '—'}
                      </Typography>
                      {r.total > 0 ? (
                        <Typography as="span" size="xs" variant="muted" layoutClassName="ml-1.5">
                          {formatVND(r.total)}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell layoutClassName="px-4 py-3" textClassName="text-sm text-slate-700 dark:text-slate-200">
                      {[r.customerName, r.phone].filter(Boolean).join(' · ') || '—'}
                    </TableCell>
                    <TableCell layoutClassName="whitespace-nowrap px-4 py-3">
                      {r.status === 'sent' ? (
                        <Badge
                          size="sm"
                          backgroundClassName="bg-emerald-50 dark:bg-emerald-900/20"
                          textClassName="text-emerald-700 dark:text-emerald-300"
                          borderClassName="border border-emerald-200 dark:border-emerald-800"
                          layoutClassName="inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Thành công
                        </Badge>
                      ) : (
                        <Badge
                          size="sm"
                          backgroundClassName="bg-rose-50 dark:bg-rose-900/20"
                          textClassName="text-rose-700 dark:text-rose-300"
                          borderClassName="border border-rose-200 dark:border-rose-800"
                          layoutClassName="inline-flex items-center gap-1"
                        >
                          <XCircle className="h-3 w-3" />
                          Thất bại
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell layoutClassName="max-w-xs px-4 py-3" textClassName="text-xs text-rose-600 dark:text-rose-400">
                      {r.error || ''}
                    </TableCell>
                    <TableCell layoutClassName="whitespace-nowrap px-4 py-3 text-right">
                      {r.status === 'failed' ? (
                        <Button
                          type="button"
                          onClick={() => void handleResend(r)}
                          disabled={resendingId === r.id}
                          leftIcon={resendingId === r.id ? <Spinner size="sm" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          variant="secondary"
                          borderClassName="border border-slate-200 dark:border-slate-600"
                          backgroundClassName="bg-white dark:bg-slate-800"
                          textClassName="text-xs font-medium text-slate-700 dark:text-slate-200"
                          roundedClassName="rounded-lg"
                          sizeClassName="px-2.5 py-1.5"
                          layoutClassName="inline-flex items-center gap-1.5"
                        >
                          Gửi lại
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Card>
      )}
    </Box>
  );
};

export default CustomerNotifyTab;
