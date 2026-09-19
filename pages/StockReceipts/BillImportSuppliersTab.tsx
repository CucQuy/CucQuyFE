import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ChevronDown,
  ChevronRight,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Pin,
  Plus,
  ReceiptText,
  Store,
  Tag,
  TrendingUp,
  Truck,
  User,
} from 'lucide-react';
import type { ImportedSupplierSummary } from '@/types/billReceipt';
import {
  SUPPLIER_CHANNELS,
  supplierChannelBadgeColor,
  supplierChannelLabel,
} from '@/types/billReceipt';
import { setSupplierPinned } from '@/services/stockReceiptService';
import StatsBanner from '@/components/ui/StatsBanner';
import { filterByPeriod, PERIOD_OPTIONS, type DatePeriod } from '@/pages/StockReceipts/dateFilter';
import FilterToolbar from '@/components/shared/FilterToolbar';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import Badge from '@/components/ui/Badge';
import { formatVNDOrDash } from '@/utils/format/currencyUtil';
import SupplierEditModal from '@/pages/StockReceipts/SupplierEditModal';
import EmptyState from '@/components/ui/EmptyState';
import { formatDateISO } from '@/utils/format/dateUtil';
/** Bậc màu nền/viền theo tổng chi (VND) — primary đậm dần. */
const supplierAmountTier = (
  amount: number,
): { backgroundClassName: string; borderClassName: string } => {
  if (amount >= 20_000_000)
    return {
      backgroundClassName: 'bg-primary-100 dark:bg-primary-900/40',
      borderClassName: 'border-primary-400 dark:border-primary-600',
    };
  if (amount >= 5_000_000)
    return {
      backgroundClassName: 'bg-primary-50 dark:bg-primary-950/40',
      borderClassName: 'border-primary-300 dark:border-primary-700',
    };
  if (amount >= 1_000_000)
    return {
      backgroundClassName: 'bg-primary-50/50 dark:bg-primary-950/20',
      borderClassName: 'border-primary-200 dark:border-primary-800',
    };
  return {
    backgroundClassName: 'bg-white dark:bg-slate-900',
    borderClassName: 'border-slate-200 dark:border-slate-700',
  };
};

export interface BillImportSuppliersTabProps {
  supplierSearch: string;
  onSupplierSearchChange: (value: string) => void;
  masterLoading: boolean;
  onRefresh: () => void;
  filteredSuppliers: ImportedSupplierSummary[];
}

const BillImportSuppliersTab: React.FC<BillImportSuppliersTabProps> = ({
  supplierSearch,
  onSupplierSearchChange,
  masterLoading,
  onRefresh,
  filteredSuppliers,
}) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<ImportedSupplierSummary | null>(null);
  const [adding, setAdding] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'amount' | 'name' | 'count'>('recent');
  const [period, setPeriod] = useState<DatePeriod>('all');
  const [pinningId, setPinningId] = useState<string | null>(null);
  // '' = tất cả loại; 'none' = chưa phân loại; còn lại = 1 SupplierChannel.
  const [channelFilter, setChannelFilter] = useState<string>('');

  const periodFiltered = useMemo(
    () => filterByPeriod(filteredSuppliers, period),
    [filteredSuppliers, period],
  );

  const channelFiltered = useMemo(() => {
    if (!channelFilter) return periodFiltered;
    if (channelFilter === 'none') return periodFiltered.filter((sp) => !sp.channel);
    return periodFiltered.filter((sp) => sp.channel === channelFilter);
  }, [periodFiltered, channelFilter]);

  const sortedSuppliers = useMemo(() => {
    // NCC đã ghim LUÔN lên đầu (bất kể sort), trong mỗi nhóm mới theo tiêu chí sort.
    // 'recent' giữ nguyên thứ tự BE (đã pinned desc, updated desc).
    const byKey = (a: ImportedSupplierSummary, b: ImportedSupplierSummary): number => {
      if (sortBy === 'amount') return (b.totalAmount || 0) - (a.totalAmount || 0);
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'count') return (b.receiptCount || 0) - (a.receiptCount || 0);
      return 0;
    };
    return [...channelFiltered].sort((a, b) => {
      const pin = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
      return pin !== 0 ? pin : byKey(a, b);
    });
  }, [channelFiltered, sortBy]);

  const stats = useMemo(() => {
    const totalAmount = channelFiltered.reduce((s, sp) => s + (sp.totalAmount || 0), 0);
    const totalReceipts = channelFiltered.reduce((s, sp) => s + (sp.receiptCount || 0), 0);
    return { totalAmount, totalReceipts };
  }, [channelFiltered]);

  /** Chip lọc theo Loại: Tất cả + từng channel + Chưa phân loại. */
  const channelPills = useMemo(
    () => [
      { id: 'all', label: 'Tất cả loại', active: channelFilter === '', onClick: () => setChannelFilter('') },
      ...SUPPLIER_CHANNELS.map((c) => ({
        id: c.value,
        label: c.label,
        active: channelFilter === c.value,
        onClick: () => setChannelFilter(c.value),
      })),
      {
        id: 'none',
        label: 'Chưa phân loại',
        active: channelFilter === 'none',
        onClick: () => setChannelFilter('none'),
      },
    ],
    [channelFilter],
  );

  const handleTogglePin = async (row: ImportedSupplierSummary) => {
    setPinningId(row.id);
    try {
      await setSupplierPinned(row.id, !row.pinned);
      await onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ghim NCC thất bại');
    } finally {
      setPinningId(null);
    }
  };

  // Nút hành động đặt trong toolbar (giống slot actions của trang Products).
  const toolbarActions = (
    <>
      <Button
        type="button"
        onClick={() => setAdding(true)}
        variant="primary"
        leftIcon={<Plus />}
        iconClassName="inline-flex shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5"
        sizeClassName="px-3 py-2 text-xs"
        roundedClassName="rounded-xl"
        layoutClassName="inline-flex items-center gap-1.5"
        disableVariantHover
      >
        Thêm NCC
      </Button>
      <Button
        type="button"
        variant="secondary"
        sizeClassName="px-3 py-1.5 text-xs"
        onClick={() => void onRefresh()}
        disabled={masterLoading}
      >
        {masterLoading ? 'Đang tải...' : 'Làm mới'}
      </Button>
    </>
  );

  return (
    <Box layoutClassName="space-y-3">
      <StatsBanner
        items={[
          {
            icon: Store,
            label: 'NCC',
            value: String(channelFiltered.length),
            accent: '#4abab9',
          },
          {
            icon: ReceiptText,
            label: 'Phiếu',
            value: String(stats.totalReceipts),
            accent: '#0ea5e9',
          },
          {
            icon: TrendingUp,
            label: 'Tổng chi',
            value: formatVNDOrDash(stats.totalAmount),
            accent: '#16a34a',
          },
        ]}
      />
      <FilterToolbar
        search={supplierSearch}
        onSearchChange={onSupplierSearchChange}
        searchPlaceholder={t('billImport.suppliersSearch')}
        period={period}
        periodOptions={PERIOD_OPTIONS as any}
        onPeriodChange={(v) => setPeriod(v as DatePeriod)}
        sortBy={sortBy}
        sortOptions={[
          { value: 'recent', label: t('billImport.sort.recent') },
          { value: 'amount', label: t('billImport.sort.amount') },
          { value: 'count', label: t('billImport.sort.supplierCount') },
          { value: 'name', label: t('billImport.sort.name') },
        ]}
        onSortChange={(v) => setSortBy(v as any)}
        pills={channelPills}
        actions={toolbarActions}
        stats={
          <Typography size="xs" variant="muted" layoutClassName="text-right">
            {sortedSuppliers.length} / {filteredSuppliers.length} NCC
          </Typography>
        }
        onClearAll={() => {
          setPeriod('all');
          setChannelFilter('');
          onSupplierSearchChange('');
        }}
      />
      {/* ===== CARD GRID (mobile + desktop đồng nhất) ===== */}
      <Box layoutClassName="max-h-[640px] overflow-auto p-1">
          {sortedSuppliers.length === 0 ? (
            <EmptyState
              icon={<Truck className="h-6 w-6" />}
              title="Không có nhà cung cấp phù hợp."
            />
          ) : (
            <Box layoutClassName="grid gap-3 p-1 sm:grid-cols-2 xl:grid-cols-3">
              {sortedSuppliers.map((row) => {
                const open = expanded === row.id;
                const tier = supplierAmountTier(row.totalAmount || 0);
                return (
                  <Card
                    key={row.id}
                    padding="md"
                    layoutClassName="space-y-2"
                    backgroundClassName={tier.backgroundClassName}
                    borderClassName={
                      row.pinned
                        ? 'border border-amber-300 dark:border-amber-700'
                        : tier.borderClassName
                    }
                  >
                    {/* Đầu danh bạ: tên (to) + badge Loại + badge danh mục */}
                    <Box layoutClassName="flex items-start gap-2">
                      <Box layoutClassName="min-w-0 flex-1 space-y-1">
                        <Typography size="base" layoutClassName="break-words font-semibold">
                          {row.name}
                        </Typography>
                        <Box layoutClassName="flex flex-wrap items-center gap-1.5">
                          {row.pinned ? (
                            <Badge
                              size="sm"
                              borderClassName="border-transparent"
                              backgroundClassName="bg-amber-100 dark:bg-amber-950/50"
                              textClassName="text-amber-700 dark:text-amber-300"
                            >
                              <Pin className="h-3 w-3 fill-current" /> Ghim
                            </Badge>
                          ) : null}
                          {row.channel ? (
                            <Badge
                              size="sm"
                              borderClassName="border-transparent"
                              backgroundClassName={supplierChannelBadgeColor(row.channel).backgroundClassName}
                              textClassName={supplierChannelBadgeColor(row.channel).textClassName}
                            >
                              {supplierChannelLabel(row.channel)}
                            </Badge>
                          ) : null}
                          {row.category ? (
                            <Badge
                              size="sm"
                              borderClassName="border-transparent"
                              backgroundClassName="bg-slate-100 dark:bg-slate-700"
                              textClassName="text-slate-700 dark:text-slate-200"
                            >
                              <Tag className="h-3 w-3" /> {row.category}
                            </Badge>
                          ) : null}
                        </Box>
                      </Box>
                    </Box>

                    {/* Liên hệ nổi bật: 📞 phone · người liên hệ */}
                    <Box
                      layoutClassName="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-2 py-1.5"
                      backgroundClassName="bg-white/60 dark:bg-slate-900/40"
                    >
                      <Box layoutClassName="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-primary-500" />
                        <Typography
                          as="span"
                          size="sm"
                          layoutClassName="font-medium"
                          textClassName={row.phone ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}
                        >
                          {row.phone || 'Chưa có SĐT'}
                        </Typography>
                      </Box>
                      {row.contactPerson ? (
                        <>
                          <Typography as="span" size="xs" textClassName="text-slate-300 dark:text-slate-600">·</Typography>
                          <Typography as="span" size="xs" variant="muted" layoutClassName="truncate">
                            {row.contactPerson}
                          </Typography>
                        </>
                      ) : null}
                    </Box>

                    {/* Stats phụ: N phiếu · tổng chi · lần cuối */}
                    <Box layoutClassName="flex flex-wrap gap-x-3 gap-y-0.5">
                      <Typography size="xs" variant="muted">
                        {row.receiptCount} phiếu
                      </Typography>
                      <Typography size="xs" variant="muted" layoutClassName="font-semibold">
                        {formatVNDOrDash(row.totalAmount)}
                      </Typography>
                      {row.lastReceiptDate ? (
                        <Typography size="xs" variant="muted">
                          🕒 {formatDateISO(row.lastReceiptDate)}
                        </Typography>
                      ) : null}
                    </Box>

                    <Box layoutClassName="flex gap-2 border-t border-slate-100 pt-2 dark:border-slate-700/60">
                      <Button
                        type="button"
                        variant="ghost"
                        sizeClassName="px-2 py-1 text-xs"
                        onClick={() => setExpanded(open ? null : row.id)}
                        leftIcon={open ? <ChevronDown /> : <ChevronRight />}
                        iconClassName="inline-flex shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5"
                        layoutClassName="inline-flex items-center gap-1"
                      >
                        {open ? 'Thu gọn' : 'Chi tiết'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        sizeClassName="px-2 py-1 text-xs"
                        onClick={() => setEditing(row)}
                        leftIcon={<Pencil />}
                        iconClassName="inline-flex shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5"
                        layoutClassName="inline-flex items-center gap-1"
                      >
                        Sửa
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        sizeClassName="px-2 py-1 text-xs"
                        onClick={() => void handleTogglePin(row)}
                        disabled={pinningId === row.id}
                        leftIcon={<Pin />}
                        iconClassName={`inline-flex shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5 ${row.pinned ? '[&_svg]:fill-current' : ''}`}
                        layoutClassName="ml-auto inline-flex items-center gap-1"
                        textClassName={row.pinned ? 'text-amber-600 dark:text-amber-400' : ''}
                      >
                        {row.pinned ? 'Bỏ ghim' : 'Ghim'}
                      </Button>
                    </Box>

                    {open ? (
                      <Box
                        layoutClassName="grid gap-2 rounded-md p-2 text-xs"
                        backgroundClassName="bg-slate-50 dark:bg-slate-800/50"
                      >
                        <Box layoutClassName="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                          <Typography as="span" size="xs">{row.phone || '—'}</Typography>
                        </Box>
                        <Box layoutClassName="flex items-center gap-1.5">
                          <User className="h-3 w-3 shrink-0 text-slate-400" />
                          <Typography as="span" size="xs">{row.contactPerson || '—'}</Typography>
                        </Box>
                        {row.channel ? (
                          <Box layoutClassName="flex items-center gap-1.5">
                            <Tag className="h-3 w-3 shrink-0 text-slate-400" />
                            <Typography as="span" size="xs">Loại: {supplierChannelLabel(row.channel)}</Typography>
                          </Box>
                        ) : null}
                        {row.email ? (
                          <Box layoutClassName="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                            <Typography as="span" size="xs">{row.email}</Typography>
                          </Box>
                        ) : null}
                        {row.taxCode ? (
                          <Box layoutClassName="flex items-center gap-1.5">
                            <Tag className="h-3 w-3 shrink-0 text-slate-400" />
                            <Typography as="span" size="xs">MST: {row.taxCode}</Typography>
                          </Box>
                        ) : null}
                        {row.address ? (
                          <Box layoutClassName="flex items-start gap-1.5">
                            <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                            <Typography as="span" size="xs" layoutClassName="break-words">{row.address}</Typography>
                          </Box>
                        ) : null}
                        {row.notes ? (
                          <Box
                            layoutClassName="rounded p-1.5"
                            backgroundClassName="bg-amber-50 dark:bg-amber-950/40"
                          >
                            <Typography as="span" size="xs">💬 {row.notes}</Typography>
                          </Box>
                        ) : null}
                      </Box>
                    ) : null}
                  </Card>
                );
              })}
            </Box>
          )}
        </Box>

      <SupplierEditModal
        open={editing !== null || adding}
        supplier={editing}
        onClose={() => {
          setEditing(null);
          setAdding(false);
        }}
        onSaved={() => {
          setEditing(null);
          setAdding(false);
          void onRefresh();
        }}
      />
    </Box>
  );
};

export default BillImportSuppliersTab;
