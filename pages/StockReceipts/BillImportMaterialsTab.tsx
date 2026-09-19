import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Package, Plus, ShoppingBag, TrendingUp, Truck } from 'lucide-react';
import type { ImportedMaterialSummary } from '@/types/billReceipt';
import { createMaterial } from '@/services/stockReceiptService';
import StatsBanner from '@/components/ui/StatsBanner';
import { filterByPeriod, PERIOD_OPTIONS, type DatePeriod } from '@/pages/StockReceipts/dateFilter';
import FilterToolbar from '@/components/shared/FilterToolbar';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import DatePicker from '@/components/ui/DatePicker';
import Field from '@/components/ui/Field';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';
import BaseSlidePanel from '@/components/BaseSlidePanel';
import AutocompleteInput, { type AutocompleteOption } from '@/components/AutocompleteInput';
import { useImportedSuppliers } from '@/hooks/queries/useStockReceiptQuery';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table';
import { formatVNDOrDash } from '@/utils/format/currencyUtil';
import { formatDateISO, parseDateValue } from '@/utils/format/dateUtil';
import EmptyState from '@/components/ui/EmptyState';

type MaterialForm = { name: string; unit: string; lastUnitPrice: string; quantity: string; supplierId: string; supplierName: string; receiptDate: string };
const EMPTY_MATERIAL: MaterialForm = { name: '', unit: '', lastUnitPrice: '', quantity: '', supplierId: '', supplierName: '', receiptDate: '' };

/** Mức độ "tươi mới" theo lần nhập cuối → màu xanh/vàng/đỏ. */
const materialRecencyTier = (
  lastReceiptDate?: string,
): {
  backgroundClassName: string;
  borderClassName: string;
  badgeBackgroundClassName: string;
  badgeTextClassName: string;
  dotClassName: string;
  label: string;
} => {
  const parsed = parseDateValue(lastReceiptDate);
  const days = parsed ? Math.floor((Date.now() - parsed.getTime()) / 86_400_000) : Infinity;
  if (days < 30)
    return {
      backgroundClassName: 'bg-emerald-50/60 dark:bg-emerald-950/20',
      borderClassName: 'border-l-emerald-500 border-slate-200 dark:border-slate-700 dark:border-l-emerald-500',
      badgeBackgroundClassName: 'bg-emerald-100 dark:bg-emerald-950/50',
      badgeTextClassName: 'text-[10px] font-medium text-emerald-700 dark:text-emerald-300',
      dotClassName: 'bg-emerald-500',
      label: 'Mới nhập',
    };
  if (days <= 60)
    return {
      backgroundClassName: 'bg-amber-50/60 dark:bg-amber-950/20',
      borderClassName: 'border-l-amber-500 border-slate-200 dark:border-slate-700 dark:border-l-amber-500',
      badgeBackgroundClassName: 'bg-amber-100 dark:bg-amber-950/50',
      badgeTextClassName: 'text-[10px] font-medium text-amber-700 dark:text-amber-300',
      dotClassName: 'bg-amber-500',
      label: 'Khá lâu',
    };
  return {
    backgroundClassName: 'bg-rose-50/50 dark:bg-rose-950/20',
    borderClassName: 'border-l-rose-500 border-slate-200 dark:border-slate-700 dark:border-l-rose-500',
    badgeBackgroundClassName: 'bg-rose-100 dark:bg-rose-950/50',
    badgeTextClassName: 'text-[10px] font-medium text-rose-700 dark:text-rose-300',
    dotClassName: 'bg-rose-500',
    label: 'Lâu chưa nhập',
  };
};
export interface BillImportMaterialsTabProps {
  materialSearch: string;
  onMaterialSearchChange: (value: string) => void;
  masterLoading: boolean;
  onRefresh: () => void;
  filteredMaterials: ImportedMaterialSummary[];
}

const BillImportMaterialsTab: React.FC<BillImportMaterialsTabProps> = ({
  materialSearch,
  onMaterialSearchChange,
  masterLoading,
  onRefresh,
  filteredMaterials,
}) => {
  const { t } = useLanguage();
  const [sortBy, setSortBy] = useState<'recent' | 'amount' | 'name' | 'count'>('recent');
  const [period, setPeriod] = useState<DatePeriod>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<MaterialForm>(EMPTY_MATERIAL);
  const [saving, setSaving] = useState(false);
  const { suppliers } = useImportedSuppliers();
  const supplierOptions = useMemo<AutocompleteOption[]>(
    () => suppliers.map((s) => ({ id: s.id, label: s.name })),
    [suppliers],
  );

  // Apply period filter first, then sort
  const periodFiltered = useMemo(
    () => filterByPeriod(filteredMaterials, period),
    [filteredMaterials, period],
  );

  const sortedMaterials = useMemo(() => {
    const arr = [...periodFiltered];
    if (sortBy === 'amount') arr.sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0));
    else if (sortBy === 'name') arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sortBy === 'count') arr.sort((a, b) => (b.importCount || 0) - (a.importCount || 0));
    return arr;
  }, [periodFiltered, sortBy]);

  // Stats tính từ periodFiltered (phản ánh đúng filter người dùng đang xem)
  const stats = useMemo(() => {
    const totalAmount = periodFiltered.reduce((s, m) => s + (m.totalAmount || 0), 0);
    const totalQty = periodFiltered.reduce((s, m) => s + (m.totalQty || 0), 0);
    const totalCount = periodFiltered.reduce((s, m) => s + (m.importCount || 0), 0);
    return { totalAmount, totalQty, totalCount };
  }, [periodFiltered]);

  const openAdd = () => { setForm(EMPTY_MATERIAL); setAddOpen(true); };

  const saveMaterial = async () => {
    if (!form.name.trim()) {
      toast.error('Nhập tên nguyên vật liệu');
      return;
    }
    const price = form.lastUnitPrice.trim() ? Number(form.lastUnitPrice) : null;
    const qty = form.quantity.trim() ? Number(form.quantity) : null;
    setSaving(true);
    try {
      await createMaterial({
        name: form.name.trim(),
        unit: form.unit.trim() || null,
        lastUnitPrice: price != null && !Number.isNaN(price) ? price : null,
        quantity: qty != null && !Number.isNaN(qty) ? qty : null,
        // Có id (chọn NCC có sẵn) → gửi id; nếu chỉ gõ tên mới → BE tự tạo NCC.
        lastSupplierId: form.supplierId || null,
        lastSupplierName: form.supplierName.trim() || null,
        lastReceiptDate: form.receiptDate || null,
      });
      toast.success('Đã thêm nguyên vật liệu');
      setForm(EMPTY_MATERIAL);
      setAddOpen(false);
      await onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Thêm NVL thất bại');
    } finally {
      setSaving(false);
    }
  };

  // Nút hành động đặt trong toolbar (giống slot actions của trang Products).
  const toolbarActions = (
    <>
      <Button
        type="button"
        onClick={openAdd}
        variant="primary"
        leftIcon={<Plus />}
        iconClassName="inline-flex shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5"
        sizeClassName="px-3 py-2 text-xs"
        roundedClassName="rounded-xl"
        layoutClassName="inline-flex items-center gap-1.5"
        disableVariantHover
      >
        Thêm NVL
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
            icon: Package,
            label: 'Loại NVL',
            value: String(periodFiltered.length),
            accent: '#4abab9',
          },
          {
            icon: ShoppingBag,
            label: 'Lần nhập',
            value: String(stats.totalCount),
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
        search={materialSearch}
        onSearchChange={onMaterialSearchChange}
        searchPlaceholder={t('billImport.materialsSearch')}
        period={period}
        periodOptions={PERIOD_OPTIONS as any}
        onPeriodChange={(v) => setPeriod(v as DatePeriod)}
        sortBy={sortBy}
        sortOptions={[
          { value: 'recent', label: t('billImport.sort.recent') },
          { value: 'amount', label: t('billImport.sort.amount') },
          { value: 'count', label: t('billImport.sort.materialCount') },
          { value: 'name', label: t('billImport.sort.name') },
        ]}
        onSortChange={(v) => setSortBy(v as any)}
        actions={toolbarActions}
        stats={
          <Typography size="xs" variant="muted" layoutClassName="text-right">
            {sortedMaterials.length} / {filteredMaterials.length} NVL
          </Typography>
        }
        onClearAll={() => { setPeriod('all'); onMaterialSearchChange(''); }}
      />
      {/* ===== Desktop: bảng dày · Mobile: card ===== */}
      <Box layoutClassName="max-h-[640px] overflow-auto px-1 pb-1">
          {sortedMaterials.length === 0 ? (
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="Không có nguyên vật liệu phù hợp."
            />
          ) : (
            <Box layoutClassName="grid gap-3 p-1 sm:hidden">
              {sortedMaterials.map((row) => {
                const tier = materialRecencyTier(row.lastReceiptDate);
                return (
                  <Card
                    key={row.id}
                    padding="md"
                    layoutClassName="space-y-2 border-l-4"
                    backgroundClassName={tier.backgroundClassName}
                    borderClassName={tier.borderClassName}
                  >
                    {/* Hàng đầu: tên (kèm chấm recency) */}
                    <Box layoutClassName="flex items-start gap-2">
                      <Box layoutClassName="flex min-w-0 flex-1 items-center gap-1.5">
                        <Box
                          layoutClassName="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                          backgroundClassName={tier.dotClassName}
                          title={tier.label}
                        />
                        <Typography size="sm" layoutClassName="break-words font-semibold">
                          {row.name}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Giá nhập gần nhất (to, đậm) / đơn vị */}
                    <Box layoutClassName="flex flex-wrap items-baseline gap-x-1">
                      <Typography size="lg" layoutClassName="font-bold text-primary-700 dark:text-primary-300">
                        {formatVNDOrDash(row.lastUnitPrice)}
                      </Typography>
                      {row.canonicalUnit ? (
                        <Typography size="xs" variant="muted">
                          / {row.canonicalUnit}
                        </Typography>
                      ) : null}
                    </Box>

                    {/* Dòng phụ: đã nhập tổng · số lần · NCC gần nhất */}
                    <Box layoutClassName="flex flex-wrap gap-x-3 gap-y-0.5">
                      <Typography size="xs" variant="muted">
                        Đã nhập {row.totalQty} {row.canonicalUnit || ''}
                      </Typography>
                      <Typography size="xs" variant="muted">
                        {row.importCount} lần
                      </Typography>
                      {row.lastSupplierName ? (
                        <Typography size="xs" variant="muted" layoutClassName="truncate">
                          🏭 {row.lastSupplierName}
                        </Typography>
                      ) : null}
                      {row.lastReceiptDate ? (
                        <Typography size="xs" variant="muted">
                          🕒 {formatDateISO(row.lastReceiptDate)}
                        </Typography>
                      ) : null}
                    </Box>
                  </Card>
                );
              })}
            </Box>
          )}
          {sortedMaterials.length > 0 ? (
            <Box layoutClassName="hidden sm:block">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell layoutClassName="sticky top-0 z-20 p-2 text-left bg-white dark:bg-slate-800">Tên NVL</TableHeaderCell>
                    <TableHeaderCell layoutClassName="sticky top-0 z-20 p-2 text-right bg-white dark:bg-slate-800">Đơn giá gần nhất</TableHeaderCell>
                    <TableHeaderCell layoutClassName="sticky top-0 z-20 p-2 text-right bg-white dark:bg-slate-800">Đã nhập</TableHeaderCell>
                    <TableHeaderCell layoutClassName="sticky top-0 z-20 p-2 text-right bg-white dark:bg-slate-800">Số lần</TableHeaderCell>
                    <TableHeaderCell layoutClassName="sticky top-0 z-20 p-2 text-left bg-white dark:bg-slate-800">NCC gần nhất</TableHeaderCell>
                    <TableHeaderCell layoutClassName="sticky top-0 z-20 p-2 text-left bg-white dark:bg-slate-800">Nhập lần cuối</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedMaterials.map((row) => {
                    const tier = materialRecencyTier(row.lastReceiptDate);
                    return (
                      <TableRow
                        key={row.id}
                        borderClassName="border-b border-slate-100 dark:border-slate-700/60">
                        <TableCell layoutClassName="p-2" textClassName="text-sm font-medium text-slate-800 dark:text-slate-100">{row.name}</TableCell>
                        <TableCell layoutClassName="p-2 text-right" textClassName="text-sm font-semibold tabular-nums text-primary-700 dark:text-primary-300">
                          {formatVNDOrDash(row.lastUnitPrice)}
                          {row.canonicalUnit ? <Typography as="span" size="xs" variant="muted">/{row.canonicalUnit}</Typography> : null}
                        </TableCell>
                        <TableCell layoutClassName="p-2 text-right" textClassName="text-sm tabular-nums text-slate-600 dark:text-slate-300">{row.totalQty} {row.canonicalUnit || ''}</TableCell>
                        <TableCell layoutClassName="p-2 text-right" textClassName="text-sm tabular-nums text-slate-500 dark:text-slate-400">{row.importCount}</TableCell>
                        <TableCell layoutClassName="p-2" textClassName="text-sm text-slate-600 dark:text-slate-300">{row.lastSupplierName || '—'}</TableCell>
                        <TableCell layoutClassName="p-2">
                          <Box layoutClassName="flex items-center gap-1.5">
                            <Box layoutClassName="h-2 w-2 shrink-0" roundedClassName="rounded-full" backgroundClassName={tier.dotClassName} title={tier.label} />
                            <Typography as="span" size="xs" variant="muted">{row.lastReceiptDate ? formatDateISO(row.lastReceiptDate) : '—'}</Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          ) : null}
        </Box>

      <BaseSlidePanel
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Thêm nguyên vật liệu"
        maxWidth="md"
        footer={
          <Box layoutClassName="flex gap-2 p-4">
            <Button type="button" disabled={saving} onClick={() => void saveMaterial()} variant="primary" sizeClassName="px-4 py-2 text-sm" roundedClassName="rounded-lg" layoutClassName="inline-flex items-center gap-1.5" disableVariantHover>
              Thêm
            </Button>
            <Button type="button" onClick={() => setAddOpen(false)} variant="secondary" sizeClassName="px-4 py-2 text-sm" roundedClassName="rounded-lg" disableVariantHover>Huỷ</Button>
          </Box>
        }
      >
        <Box layoutClassName="space-y-5 p-4">
          <Box layoutClassName="space-y-3">
            <Heading level={3} layoutClassName="flex items-center gap-2 uppercase tracking-wider" textClassName="text-sm font-semibold">
              <Package className="h-4 w-4 text-primary-500" /> Thông tin nguyên vật liệu
            </Heading>
            <Field label="Tên nguyên vật liệu" htmlFor="nvl-name" required>
              <Input id="nvl-name" value={form.name} placeholder="vd Bột mì, Đường trắng" onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} fullWidth />
            </Field>
            <Box layoutClassName="grid grid-cols-2 gap-3">
              <Field label="Số lượng" htmlFor="nvl-qty">
                <Input id="nvl-qty" type="number" min={0} value={form.quantity} placeholder="vd 10" onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} fullWidth />
              </Field>
              <Field label="Đơn vị" htmlFor="nvl-unit">
                <Input id="nvl-unit" value={form.unit} placeholder="vd kg, cái, gói" onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} fullWidth />
              </Field>
            </Box>
            <Field label="Đơn giá tham khảo" htmlFor="nvl-price">
              <Input id="nvl-price" type="number" min={0} value={form.lastUnitPrice} placeholder="VND" onChange={(e) => setForm((f) => ({ ...f, lastUnitPrice: e.target.value }))} fullWidth />
            </Field>
          </Box>

          <Box layoutClassName="space-y-3">
            <Heading level={3} layoutClassName="flex items-center gap-2 uppercase tracking-wider" textClassName="text-sm font-semibold">
              <Truck className="h-4 w-4 text-primary-500" /> Nguồn nhập gần nhất
            </Heading>
            <AutocompleteInput
              label="Nhà cung cấp"
              value={form.supplierName}
              onChange={(v) => setForm((f) => ({ ...f, supplierName: v, supplierId: '' }))}
              onSelect={(opt) => setForm((f) => ({ ...f, supplierName: opt.label, supplierId: opt.id }))}
              options={supplierOptions}
              placeholder="Gõ tên NCC — chọn có sẵn hoặc tạo mới"
            />
            <Field label="Ngày nhập gần nhất" htmlFor="nvl-date">
              <DatePicker value={form.receiptDate} onChange={(v) => setForm((f) => ({ ...f, receiptDate: v }))} fullWidth placeholder="Chọn ngày" />
            </Field>
          </Box>

          <Box layoutClassName="p-3" backgroundClassName="bg-slate-50 dark:bg-slate-800/60" borderClassName="border border-slate-200 dark:border-slate-700" roundedClassName="rounded-lg">
            <Typography size="xs" variant="muted">
              Nhập số lượng → tính là 1 lần nhập tay (tổng chi = SL × đơn giá). NCC gõ tên chưa có sẽ được tạo mới. Thống kê tự cộng dồn khi có phiếu nhập cùng tên.
            </Typography>
          </Box>
        </Box>
      </BaseSlidePanel>
    </Box>
  );
};

export default BillImportMaterialsTab;
