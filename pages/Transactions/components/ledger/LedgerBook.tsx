import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import { LedgerFilters, LedgerTransaction } from '@/types';
import { useLedger } from '@/hooks/queries/useTransactionsQuery';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Typography from '@/components/ui/Typography';
import LedgerSummaryBar from './LedgerSummaryBar';
import LedgerAccountFlowCard from './LedgerAccountFlowCard';
import LedgerFilterBar from './LedgerFilterBar';
import LedgerDesktopTable from './LedgerDesktopTable';
import LedgerMobileList from './LedgerMobileList';
import TransactionDetailModal from '../TransactionDetailModal';
import LedgerReconcileModal from './LedgerReconcileModal';
import LedgerAutoReconcileModal from './LedgerAutoReconcileModal';

const PAGE_SIZE = 50;

const formatDate = (dateStr: string): string => {
  try {
    // né Invalid Date iOS: 'YYYY-MM-DD HH:mm:ss' → thay ' ' bằng 'T'.
    const d = new Date((dateStr || '').replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
};

/** Sổ giao dịch thống nhất: summary + filter (chuẩn như Orders) + bảng phân trang server-side. */
const LedgerBook: React.FC<{ fromDate: string; toDate: string }> = ({ fromDate, toDate }) => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [type, setType] = useState<LedgerFilters['type']>('');
  const [status, setStatus] = useState<LedgerFilters['status']>('');
  const [category, setCategory] = useState('');
  const [gateway, setGateway] = useState('');
  // 099: lọc theo TÀI KHOẢN (payment_accounts.id) — xem riêng dòng tiền TK nhận / TK chi.
  const [account, setAccount] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<LedgerTransaction | null>(null);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);

  // Debounce ô tìm kiếm (350ms) → tránh gọi API mỗi ký tự.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  // Đổi filter/kỳ → về trang đầu.
  useEffect(() => { setPage(0); }, [debouncedSearch, type, status, category, gateway, account, fromDate, toDate]);

  const filters = useMemo<LedgerFilters>(() => ({
    from: fromDate,
    to: toDate ? `${toDate.slice(0, 10)} 23:59:59` : '',
    type,
    status,
    category,
    gateway,
    account,
    search: debouncedSearch,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [fromDate, toDate, type, status, category, gateway, account, debouncedSearch, page]);

  const { data, loading, isFetching, error, refetch } = useLedger(filters);

  useEffect(() => {
    if (error) toast.error('Không tải được sổ giao dịch');
  }, [error]);

  // Options ngân hàng: gom từ trang đang xem + giữ giá trị đang chọn.
  const gatewayOptions = useMemo(() => {
    const set = new Set<string>();
    data.items.forEach((it) => { if (it.gateway) set.add(it.gateway); });
    if (gateway) set.add(gateway);
    return Array.from(set).sort();
  }, [data.items, gateway]);

  // Options tài khoản cho dropdown lọc: lấy từ byAccount (chỉ TK đã khai trong cấu hình).
  const accountOptions = useMemo(
    () =>
      data.byAccount
        .filter((a) => !!a.accountId)
        .map((a) => ({ value: a.accountId as string, label: a.label })),
    [data.byAccount],
  );

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const from = data.total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, data.total);

  const handleRefresh = async () => {
    try { await refetch(); toast.success('Đã làm mới'); } catch { toast.error('Làm mới thất bại'); }
  };

  return (
    <Box layoutClassName="space-y-4">
      <LedgerSummaryBar summary={data.summary} />

      {/* Tiền nào của TK nào: bấm 1 thẻ để lọc sổ theo tài khoản đó. */}
      <LedgerAccountFlowCard accounts={data.byAccount} selected={account} onSelect={setAccount} />

      {/* 1 card bọc toolbar + bảng (giống Orders) */}
      <Card padding="none" layoutClassName="flex flex-col overflow-hidden">
        <Box
          layoutClassName="p-4 sm:p-5"
          borderClassName="border-b border-slate-100 dark:border-slate-700"
        >
          <LedgerFilterBar
            filters={filters}
            search={search}
            gatewayOptions={gatewayOptions}
            isFetching={isFetching}
            onSearchChange={setSearch}
            onTypeChange={setType}
            onStatusChange={setStatus}
            onCategoryChange={setCategory}
            onGatewayChange={setGateway}
            accountOptions={accountOptions}
            onAccountChange={setAccount}
            onRefresh={handleRefresh}
            onReconcile={() => setReconcileOpen(true)}
            onAutoReconcile={() => setAutoOpen(true)}
          />
        </Box>

        {loading ? (
          <Box layoutClassName="flex flex-1 items-center justify-center py-16">
            <Spinner size="lg" textClassName="text-primary-500" />
          </Box>
        ) : data.items.length === 0 ? (
          <Box layoutClassName="flex flex-1 flex-col items-center justify-center gap-3 py-16" textClassName="text-slate-400 dark:text-slate-500">
            <Box layoutClassName="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <Inbox className="h-8 w-8 opacity-40" />
            </Box>
            <Typography size="sm" variant="muted">Không có giao dịch phù hợp bộ lọc</Typography>
          </Box>
        ) : (
          <>
            <Box layoutClassName="p-3 lg:hidden">
              <LedgerMobileList transactions={data.items} formatDate={formatDate} onRowClick={setSelected} />
            </Box>
            <LedgerDesktopTable transactions={data.items} formatDate={formatDate} onRowClick={setSelected} />

            {/* Phân trang (footer trong card) */}
            <Box
              layoutClassName="flex items-center justify-between gap-3 px-4 py-3"
              borderClassName="border-t border-slate-100 dark:border-slate-700"
            >
              <Typography as="span" size="xs" variant="muted">
                {from}–{to} / {data.total} giao dịch
              </Typography>
            <Box layoutClassName="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                disableVariantHover
                disableVariantTextColor
                disabled={page === 0 || isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                layoutClassName="flex items-center gap-1"
                roundedClassName="rounded-lg"
                sizeClassName="px-2.5 py-1.5 text-xs"
                borderClassName="border border-slate-200 dark:border-slate-600"
                backgroundClassName="bg-white dark:bg-slate-700"
                textClassName="font-medium text-slate-600 dark:text-slate-300"
                stateClassName="transition-colors disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Trước
              </Button>
              <Typography as="span" size="xs" layoutClassName="font-semibold" textClassName="text-slate-700 dark:text-slate-200">
                {page + 1}/{totalPages}
              </Typography>
              <Button
                type="button"
                variant="ghost"
                disableVariantHover
                disableVariantTextColor
                disabled={page + 1 >= totalPages || isFetching}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                layoutClassName="flex items-center gap-1"
                roundedClassName="rounded-lg"
                sizeClassName="px-2.5 py-1.5 text-xs"
                borderClassName="border border-slate-200 dark:border-slate-600"
                backgroundClassName="bg-white dark:bg-slate-700"
                textClassName="font-medium text-slate-600 dark:text-slate-300"
                stateClassName="transition-colors disabled:opacity-40"
              >
                Sau
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Box>
            </Box>
          </>
        )}
      </Card>

      <TransactionDetailModal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        transaction={selected}
        formatDate={formatDate}
        onChanged={refetch}
      />

      <LedgerReconcileModal
        isOpen={reconcileOpen}
        onClose={() => setReconcileOpen(false)}
        fromDate={fromDate}
        toDate={toDate}
        onChanged={refetch}
      />

      <LedgerAutoReconcileModal
        isOpen={autoOpen}
        onClose={() => setAutoOpen(false)}
        fromDate={fromDate}
        toDate={toDate}
        onChanged={refetch}
      />
    </Box>
  );
};

export default LedgerBook;
