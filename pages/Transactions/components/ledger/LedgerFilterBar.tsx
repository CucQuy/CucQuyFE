import React, { useMemo } from 'react';
import { RefreshCw, ArrowDownCircle, ArrowUpCircle, Tags, Landmark, CreditCard, Scale, Wand2 } from 'lucide-react';
import { LedgerFilters, LedgerStatus, LEDGER_STATUS_META, EXPENSE_CATEGORIES } from '@/types';
import Box from '@/components/ui/Box';
import IconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';
import Typography from '@/components/ui/Typography';
import Tabs, { type TabsItem } from '@/components/ui/Tabs';
import FilterToolbar, { PillDropdown, type ToolbarPill, type ToolbarOption } from '@/components/shared/FilterToolbar';

interface LedgerFilterBarProps {
  filters: LedgerFilters;
  search: string;
  gatewayOptions: string[];
  isFetching: boolean;
  onSearchChange: (v: string) => void;
  onTypeChange: (v: LedgerFilters['type']) => void;
  onStatusChange: (v: LedgerFilters['status']) => void;
  onCategoryChange: (v: string) => void;
  onGatewayChange: (v: string) => void;
  /** Số GD theo trạng thái trong kỳ (+ 'all') — badge trên tab, BE trả sẵn. */
  statusCounts: Record<string, number>;
  /** Tài khoản đã khai (099) cho dropdown lọc theo TK nhận / TK chi. */
  accountOptions: { value: string; label: string }[];
  onAccountChange: (v: string) => void;
  onRefresh: () => void;
  /** Mở modal đối soát gộp (nút "Đối soát"). */
  onReconcile: () => void;
  /** Mở modal đối soát TỰ ĐỘNG (nút "Tự động") — quét kỳ đang xem, gợi ý cặp chắc chắn. */
  onAutoReconcile: () => void;
}

const IN_STATUSES: LedgerStatus[] = ['matched', 'shopee', 'capital', 'sweep_in', 'expense_credit', 'other_in', 'external', 'unmatched'];
const OUT_STATUSES: LedgerStatus[] = ['refund', 'shipping', 'sweep_out', 'settled', 'expense', 'stock', 'excluded', 'unmatched'];

/**
 * Toolbar lọc sổ giao dịch — dùng chung FilterToolbar (chuẩn như trang Đơn hàng):
 * tìm kiếm + pill nhanh Tiền vào/Tiền ra + dropdown trạng thái/danh mục/ngân hàng.
 */
const LedgerFilterBar: React.FC<LedgerFilterBarProps> = ({
  filters, search, gatewayOptions, accountOptions, statusCounts, isFetching,
  onSearchChange, onTypeChange, onStatusChange, onCategoryChange, onGatewayChange,
  onAccountChange, onRefresh, onReconcile, onAutoReconcile,
}) => {
  // Trạng thái khả dụng theo loại đang chọn (thu ≠ chi).
  const statusOptions = useMemo<LedgerStatus[]>(() => {
    if (filters.type === 'in') return IN_STATUSES;
    if (filters.type === 'out') return OUT_STATUSES;
    return [...IN_STATUSES, ...OUT_STATUSES.filter((s) => s !== 'unmatched')];
  }, [filters.type]);

  // Pill nhanh: Tiền vào / Tiền ra (loại trừ nhau, bấm lại để bỏ).
  const pills: ToolbarPill[] = [
    {
      id: 'in',
      label: 'Tiền vào',
      active: filters.type === 'in',
      onClick: () => onTypeChange(filters.type === 'in' ? '' : 'in'),
      icon: ArrowDownCircle,
    },
    {
      id: 'out',
      label: 'Tiền ra',
      active: filters.type === 'out',
      onClick: () => onTypeChange(filters.type === 'out' ? '' : 'out'),
      icon: ArrowUpCircle,
    },
  ];

  // Tab trạng thái (như màn Đơn hàng): "Tất cả" + các trạng thái CÓ giao dịch trong kỳ.
  // Ẩn trạng thái rỗng để dải tab không dài lê thê — trừ tab đang chọn (phải thấy để bỏ chọn).
  const statusTabs: TabsItem[] = useMemo(() => {
    const badge = (n: number, active: boolean) => (
      <Typography
        as="span"
        size="xs"
        layoutClassName="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5"
        backgroundClassName={active ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-slate-100 dark:bg-slate-700'}
        textClassName={active ? 'text-primary-600 dark:text-primary-300' : 'text-slate-500 dark:text-slate-400'}
      >
        {n}
      </Typography>
    );
    const current = filters.status || 'all';
    const items: TabsItem[] = [
      { id: 'all', label: 'Tất cả', badge: badge(statusCounts.all ?? 0, current === 'all') },
    ];
    statusOptions.forEach((st) => {
      const n = statusCounts[st] ?? 0;
      if (n === 0 && current !== st) return;
      items.push({ id: st, label: LEDGER_STATUS_META[st].label, badge: badge(n, current === st) });
    });
    return items;
  }, [statusOptions, statusCounts, filters.status]);

  // Options cho pill dropdown (mục đầu value '' = "Mọi …" hiển thị nhạt, không tính là filter).
  const categoryOpts: ToolbarOption[] = [
    { value: '', label: 'Mọi danh mục' },
    ...EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
  ];
  const gatewayOpts: ToolbarOption[] = [
    { value: '', label: 'Mọi ngân hàng' },
    ...gatewayOptions.map((g) => ({ value: g, label: g })),
  ];
  const accountOpts: ToolbarOption[] = [
    { value: '', label: 'Mọi tài khoản' },
    ...accountOptions,
  ];

  const hasAnyFilter = Boolean(
    filters.type || filters.status || filters.category || filters.gateway || filters.account || search,
  );

  return (
    <Box layoutClassName="flex flex-col gap-3">
      <Box layoutClassName="-mb-1 overflow-x-auto scrollbar-hide">
        <Tabs
          items={statusTabs}
          value={filters.status || 'all'}
          onChange={(v) => onStatusChange((v === 'all' ? '' : v) as LedgerFilters['status'])}
        />
      </Box>
      <FilterToolbar
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Tìm nội dung, mã đơn, số TK..."
      pills={pills}
      customFilters={
        <>
          <PillDropdown
            icon={Tags}
            value={filters.category || ''}
            options={categoryOpts}
            onChange={onCategoryChange}
            ariaLabel="Danh mục"
          />
          {gatewayOptions.length > 0 && (
            <PillDropdown
              icon={Landmark}
              value={filters.gateway || ''}
              options={gatewayOpts}
              onChange={onGatewayChange}
              ariaLabel="Ngân hàng"
            />
          )}
          {accountOptions.length > 0 && (
            <PillDropdown
              icon={CreditCard}
              value={filters.account || ''}
              options={accountOpts}
              onChange={onAccountChange}
              ariaLabel="Tài khoản"
            />
          )}
        </>
      }
      actions={
        <>
          {/* Tự động đứng TRƯỚC: quét 1 phát xong phần dễ, còn lại mới cần đối soát tay. */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onAutoReconcile}
            leftIcon={<Wand2 className="h-4 w-4" />}
            layoutClassName="inline-flex items-center gap-1.5"
            roundedClassName="rounded-lg"
            sizeClassName="px-3 py-2 text-sm"
            backgroundClassName="bg-white dark:bg-slate-800"
            borderClassName="border border-slate-200 dark:border-slate-700"
            textClassName="font-medium text-slate-700 dark:text-slate-200"
            hoverClassName="hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Tự động
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onReconcile}
            leftIcon={<Scale className="h-4 w-4" />}
            layoutClassName="inline-flex items-center gap-1.5"
            roundedClassName="rounded-lg"
            sizeClassName="px-3 py-2 text-sm"
            backgroundClassName="bg-primary-600"
            hoverClassName="hover:bg-primary-700"
            textClassName="font-medium text-white"
            disableVariantHover
          >
            Đối soát
          </Button>
          <IconButton
            type="button"
            label="Làm mới"
            onClick={onRefresh}
            disabled={isFetching}
            variant="secondary"
            layoutClassName="rounded-lg p-2.5"
            backgroundClassName="bg-white dark:bg-slate-800"
            borderClassName="border border-slate-200 dark:border-slate-700"
            textClassName="text-slate-600 dark:text-slate-400"
            hoverClassName="hover:bg-slate-50 dark:hover:bg-slate-700"
            stateClassName="transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </IconButton>
        </>
      }
      showClearAll={hasAnyFilter}
      onClearAll={() => {
        onTypeChange('');
        onStatusChange('');
        onCategoryChange('');
        onGatewayChange('');
        onAccountChange('');
        onSearchChange('');
      }}
      />
    </Box>
  );
};

export default LedgerFilterBar;
