import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Bell, CheckCircle2, Facebook, MessageCircle, RefreshCw, Send, Tag, XCircle } from 'lucide-react';
import {
  fetchOrderNotifyMatrix,
  notifyCustomerZalo,
  type NotifyCellState,
  type OrderNotifyRow,
} from '@/services/orderService';
import { formatVND } from '@/utils/format/currencyUtil';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import PageContainer from '@/components/ui/PageContainer';
import {
  Table,
  TableBody,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableCell,
} from '@/components/ui/Table';

type Filter = '' | 'sent' | 'failed' | 'none';

const FILTERS: { id: Filter; label: string }[] = [
  { id: '', label: 'Tất cả' },
  { id: 'sent', label: 'Đã gửi' },
  { id: 'failed', label: 'Lỗi' },
  { id: 'none', label: 'Chưa gửi' },
];

/** ISO → 'dd/mm HH:MM' theo giờ máy. */
const at = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 1 ô trạng thái thông báo: đã gửi (kèm giờ) / lỗi (kèm lý do) / chưa gửi / chưa hỗ trợ. */
const NotifyCell: React.FC<{ cell: NotifyCellState; unsupported?: boolean }> = ({ cell, unsupported }) => {
  if (unsupported) {
    return (
      <Typography as="span" size="xs" variant="muted">
        Chưa hỗ trợ
      </Typography>
    );
  }
  if (cell.status === 'sent') {
    return (
      <Box layoutClassName="space-y-0.5">
        <Badge
          size="sm"
          backgroundClassName="bg-emerald-50 dark:bg-emerald-900/20"
          textClassName="text-emerald-700 dark:text-emerald-300"
          borderClassName="border border-emerald-200 dark:border-emerald-800"
          layoutClassName="inline-flex items-center gap-1"
        >
          <CheckCircle2 className="h-3 w-3" />
          Đã gửi
        </Badge>
        <Typography as="p" size="xs" variant="muted">
          {at(cell.at)}
        </Typography>
      </Box>
    );
  }
  if (cell.status === 'failed') {
    return (
      <Box layoutClassName="space-y-0.5">
        <Badge
          size="sm"
          backgroundClassName="bg-rose-50 dark:bg-rose-900/20"
          textClassName="text-rose-700 dark:text-rose-300"
          borderClassName="border border-rose-200 dark:border-rose-800"
          layoutClassName="inline-flex items-center gap-1"
        >
          <XCircle className="h-3 w-3" />
          Lỗi
        </Badge>
        {cell.error ? (
          <Typography as="p" size="xs" textClassName="max-w-[220px] text-rose-600 dark:text-rose-400">
            {cell.error}
          </Typography>
        ) : null}
      </Box>
    );
  }
  return (
    <Typography as="span" size="xs" variant="muted">
      Chưa gửi
    </Typography>
  );
};

/**
 * Màn "Thông báo" của khu vực Đơn hàng: bảng ĐƠN × các kênh thông báo cho khách —
 * mỗi dòng 1 đơn, mỗi cột 1 loại tin (Zalo đơn hàng, Zalo khuyến mãi, Facebook sau này).
 * Bấm "Gửi"/"Gửi lại" ở từng dòng để bắn tin Zalo đơn hàng cho khách của đơn đó.
 */
const OrderNotifyPage: React.FC = () => {
  const [filter, setFilter] = useState<Filter>('');
  const [rows, setRows] = useState<OrderNotifyRow[]>([]);
  const [counts, setCounts] = useState({ total: 0, sent: 0, failed: 0, none: 0 });
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchOrderNotifyMatrix({ filter, limit: 100 });
      setRows(r.items);
      setCounts(r.counts);
    } catch {
      toast.error('Không tải được danh sách thông báo');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSend = async (row: OrderNotifyRow) => {
    if (row.zaloOrder.status === 'sent' && !window.confirm(`Đơn ${row.orderNumber} đã gửi. Gửi lại?`)) return;
    setSendingId(row.id);
    try {
      const r = await notifyCustomerZalo(row.id, true);
      if (r.sent) {
        toast.success(`Đã xếp gửi Zalo cho khách đơn ${row.orderNumber}`);
      } else {
        const why: Record<string, string> = {
          no_phone: 'Đơn không có số điện thoại khách',
          opt_out: 'Khách đã chọn không nhận thông báo',
          daily_limit: 'Đã đạt hạn mức tin/ngày',
          already_sent: 'Đơn này đã gửi rồi',
          disabled: 'Tính năng đang tắt ở Cài đặt Zalo',
          no_order: 'Không tìm thấy đơn',
          test_order: 'Đơn test — không gửi cho khách',
        };
        toast.error(why[r.reason ?? ''] ?? 'Không gửi được tin');
      }
      await load();
    } catch {
      toast.error('Không gửi được tin');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <PageContainer>
      <Card layoutClassName="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <Box layoutClassName="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary-500" />
          <Heading level={2} textClassName="text-base font-semibold text-slate-900 dark:text-white">
            Thông báo cho khách
          </Heading>
        </Box>
        <Box layoutClassName="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <Typography as="span" size="sm" variant="muted">
            Tổng đơn: <b>{counts.total}</b>
          </Typography>
          <Typography as="span" size="sm" textClassName="text-emerald-600 dark:text-emerald-400">
            Đã gửi: <b>{counts.sent}</b>
          </Typography>
          <Typography as="span" size="sm" textClassName="text-rose-600 dark:text-rose-400">
            Lỗi: <b>{counts.failed}</b>
          </Typography>
          <Typography as="span" size="sm" variant="muted">
            Chưa gửi: <b>{counts.none}</b>
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
              borderClassName={filter === f.id
                ? 'border border-primary-400 dark:border-primary-500'
                : 'border border-slate-200 dark:border-slate-600'}
              backgroundClassName={filter === f.id
                ? 'bg-primary-50 dark:bg-primary-900/30'
                : 'bg-white dark:bg-slate-800'}
              textClassName={filter === f.id
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
            Đang tải…
          </Typography>
        </Card>
      ) : rows.length === 0 ? (
        <Card layoutClassName="p-6">
          <EmptyState
            icon={<Send className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
            title="Không có đơn nào"
            description="Đổi bộ lọc để xem các đơn khác."
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
                  <TableHeaderCell layoutClassName="px-4 py-3">Đơn</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3">Khách · SĐT</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3">
                    <Box layoutClassName="inline-flex items-center gap-1.5">
                      <MessageCircle className="h-3.5 w-3.5 text-[#0068FF]" />
                      Zalo · Đơn hàng
                    </Box>
                  </TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3">
                    <Box layoutClassName="inline-flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-amber-500" />
                      Zalo · Khuyến mãi
                    </Box>
                  </TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3">
                    <Box layoutClassName="inline-flex items-center gap-1.5">
                      <Facebook className="h-3.5 w-3.5 text-[#1877F2]" />
                      Facebook
                    </Box>
                  </TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3 text-right">Thao tác</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.id}
                    borderClassName="border-b border-slate-100 last:border-0 dark:border-slate-700/60"
                  >
                    <TableCell layoutClassName="whitespace-nowrap px-4 py-3">
                      <Typography as="p" size="sm" layoutClassName="font-medium" textClassName="text-slate-800 dark:text-slate-100">
                        {r.orderNumber || '—'}
                      </Typography>
                      <Typography as="p" size="xs" variant="muted">
                        {formatVND(r.total)} · {at(r.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell layoutClassName="px-4 py-3" textClassName="text-sm text-slate-700 dark:text-slate-200">
                      {r.customerName || '—'}
                      <Typography as="p" size="xs" variant="muted">
                        {r.phone || 'không có SĐT'}
                      </Typography>
                    </TableCell>
                    <TableCell layoutClassName="px-4 py-3">
                      <NotifyCell cell={r.zaloOrder} />
                    </TableCell>
                    <TableCell layoutClassName="px-4 py-3">
                      <NotifyCell cell={r.zaloPromo} />
                    </TableCell>
                    <TableCell layoutClassName="px-4 py-3">
                      <NotifyCell cell={r.facebook} unsupported />
                    </TableCell>
                    <TableCell layoutClassName="whitespace-nowrap px-4 py-3 text-right">
                      <Button
                        type="button"
                        onClick={() => void handleSend(r)}
                        disabled={sendingId === r.id || !r.phone}
                        leftIcon={sendingId === r.id ? <Spinner size="sm" /> : <Send className="h-3.5 w-3.5" />}
                        variant="secondary"
                        borderClassName="border border-slate-200 dark:border-slate-600"
                        backgroundClassName="bg-white dark:bg-slate-800"
                        textClassName="text-xs font-medium text-slate-700 dark:text-slate-200"
                        roundedClassName="rounded-lg"
                        sizeClassName="px-2.5 py-1.5"
                        layoutClassName="inline-flex items-center gap-1.5"
                        stateClassName="disabled:opacity-50"
                      >
                        {r.zaloOrder.status === 'sent' ? 'Gửi lại' : 'Gửi'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Card>
      )}
    </PageContainer>
  );
};

export default OrderNotifyPage;
