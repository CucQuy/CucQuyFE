import React, { useMemo } from 'react';
import { RefreshCw, ArrowDownCircle, ArrowUpCircle, Tags, Landmark, CreditCard, Scale, Wand2 } from 'lucide-react';
import { LedgerFilters, LedgerStatus, EXPENSE_CATEGORIES } from '@/types';
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

/**
 * Tab của màn Số dư tài khoản = NHÓM "khoản này là gì", không phải từng trạng thái kỹ thuật
 * (13 trạng thái thì dải tab chạy dài mà vẫn khó đọc). Mỗi nhóm gộp vài status; giá trị gửi
 * xuống BE là danh sách status nối bằng dấu phẩy, BE lọc `status = ANY(...)`.
 */
interface StatusGroup {
  id: string;
  label: string;
  statuses: LedgerStatus[];
  /** Nhóm này thuộc chiều tiền nào (để dải tab đổi theo pill Tiền vào/Tiền ra). */
  side: 'in' | 'out' | 'both';
  /** Chỉ hiện khi có giao dịch (dành cho nhóm không phải nghiệp vụ thường ngày). */
  hideWhenEmpty?: boolean;
}

const STATUS_GROUPS: StatusGroup[] = [
  // ── Tiền vào ──
  { id: 'order',    label: 'Khách trả đơn',        statuses: ['matched'],                                side: 'in' },
  { id: 'shopee',   label: 'Shopee',               statuses: ['shopee'],                                 side: 'in' },
  { id: 'capital',  label: 'Cấp vốn',              statuses: ['capital'],                                side: 'in' },
  { id: 'otherIn',  label: 'Thu khác',             statuses: ['external', 'other_in', 'expense_credit'], side: 'in' },
  // ── Tiền ra ──
  { id: 'stock',    label: 'Nhập hàng',            statuses: ['stock', 'supplier'],                      side: 'out' },
  { id: 'opex',     label: 'Chi phí vận hành',     statuses: ['expense', 'shipping'],                    side: 'out' },
  { id: 'refund',   label: 'Hoàn tiền khách',      statuses: ['refund'],                                 side: 'out' },
  // ── Hai chiều ──
  // Tiền cá nhân và luân chuyển nội bộ (dồn TK, nạp ví, kết toán) cùng một kiểu: tiền không
  // ra/vào tiệm nên KHÔNG đụng tới lợi nhuận → 1 tab, khỏi bắt người xem phân biệt.
  { id: 'personal', label: 'Cá nhân / nội bộ',
    statuses: ['excluded', 'sweep_in', 'sweep_out', 'settled'], side: 'both' },
  { id: 'todo',     label: 'Chưa xử lý',           statuses: ['unmatched'],                              side: 'both' },
  { id: 'test',     label: 'GD test',              statuses: ['test'],                                   side: 'both', hideWhenEmpty: true },
];

/** Nhãn riêng khi đang lọc 1 chiều tiền — nói rõ hơn "Nội bộ"/"Chưa xử lý" chung. */
const SIDE_LABEL: Record<string, { in?: string; out?: string }> = {
  todo: { in: 'Chưa khớp', out: 'Chưa phân loại' },
};

/**
 * Toolbar lọc sổ giao dịch — dùng chung FilterToolbar (chuẩn như trang Đơn hàng):
 * dải tab nhóm giao dịch + tìm kiếm + pill nhanh Tiền vào/Tiền ra + dropdown danh mục/ngân hàng.
 */
const LedgerFilterBar: React.FC<LedgerFilterBarProps> = ({
  filters, search, gatewayOptions, accountOptions, statusCounts, isFetching,
  onSearchChange, onTypeChange, onStatusChange, onCategoryChange, onGatewayChange,
  onAccountChange, onRefresh, onReconcile, onAutoReconcile,
}) => {
  // Nhóm khả dụng theo chiều tiền đang chọn (thu ≠ chi).
  const groups = useMemo<StatusGroup[]>(() => {
    if (filters.type === 'in') return STATUS_GROUPS.filter((g) => g.side !== 'out');
    if (filters.type === 'out') return STATUS_GROUPS.filter((g) => g.side !== 'in');
    return STATUS_GROUPS;
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

  // Tab đang chọn: BE nhận danh sách status, nên id tab là chuỗi 'a,b' — khớp ngược lại đây.
  const currentKey = filters.status || 'all';

  // Tab nhóm (như màn Đơn hàng): "Tất cả" + ĐỦ các nhóm, kể cả nhóm 0 giao dịch — dải tab
  // phải đứng yên để biết hệ thống chia tiền thành những nhóm nào, không nhảy theo kỳ lọc.
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
    const items: TabsItem[] = [
      { id: 'all', label: 'Tất cả', badge: badge(statusCounts.all ?? 0, currentKey === 'all') },
    ];
    groups.forEach((g) => {
      const key = g.statuses.join(',');
      const n = g.statuses.reduce((sum, st) => sum + (statusCounts[st] ?? 0), 0);
      if (n === 0 && g.hideWhenEmpty && currentKey !== key) return;
      const side = filters.type === 'in' || filters.type === 'out' ? filters.type : undefined;
      const label = (side && SIDE_LABEL[g.id]?.[side]) || g.label;
      items.push({ id: key, label, badge: badge(n, currentKey === key) });
    });
    return items;
  }, [groups, statusCounts, currentKey, filters.type]);

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
          value={currentKey}
          onChange={(v) => onStatusChange(v === 'all' ? '' : v)}
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
