/**
 * VariantTable — bảng biến thể gọn (kiểu Shopee/Lazada) dùng chung cho Vị & Size.
 * Cột: Ảnh | Tên | (Màu — chỉ vị) | Giá | xoá. Dòng cuối là nút Thêm.
 */
import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { DEFAULT_FLAVOR_COLORS } from '@/types/flavor';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Typography from '@/components/ui/Typography';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table';
import ImageCell from '@/pages/Storage/product/components/ImageCell';

export interface VariantRow {
  name: string;
  price?: number;
  image?: string;
  color?: string;
  count?: number;
}

interface VariantTableProps {
  icon: React.ReactNode;
  title: string;
  hint: string;
  namePlaceholder: string;
  withColor?: boolean;
  /** Cột "Số cái" (combo) — chỉ dùng cho size. */
  withCount?: boolean;
  items: VariantRow[];
  onChange: (items: VariantRow[]) => void;
  galleryImages: string[];
  /** Nằm trong khối đã có tiêu đề → bỏ khung card + header để không lồng 2 tầng. */
  flat?: boolean;
}

const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400';

const VariantTable: React.FC<VariantTableProps> = ({
  icon, title, hint, namePlaceholder, withColor, withCount, items, onChange, galleryImages, flat,
}) => {
  const [name, setName] = useState('');

  const add = () => {
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n) return;
    if (items.some((x) => x.name.toLowerCase() === n.toLowerCase())) { setName(''); return; }
    const row: VariantRow = { name: n, price: 0 };
    if (withColor) row.color = DEFAULT_FLAVOR_COLORS[items.length % DEFAULT_FLAVOR_COLORS.length];
    onChange([...items, row]);
    setName('');
  };
  const patch = (idx: number, p: Partial<VariantRow>) => onChange(items.map((x, i) => (i === idx ? { ...x, ...p } : x)));
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    flat ? (
      <Box layoutClassName="space-y-2">{children}</Box>
    ) : (
      <Card padding="md" layoutClassName="space-y-3">{children}</Card>
    );

  return (
    <Shell>
      {flat ? null : (
      <Box layoutClassName="flex items-center gap-2">
        <Box layoutClassName="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/30">{icon}</Box>
        <Typography as="span" size="sm" layoutClassName="font-semibold uppercase tracking-wide" textClassName="text-slate-900 dark:text-white">{title}</Typography>
        <Typography as="span" size="xs" variant="muted" layoutClassName="ml-auto">{items.length} · {hint}</Typography>
      </Box>
      )}

      {items.length > 0 ? (
        <Card padding="none" layoutClassName="overflow-hidden" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-100 dark:border-slate-700">
          <Table>
            <TableHead backgroundClassName="bg-slate-50 dark:bg-slate-900/40">
              <TableRow>
                <TableHeaderCell layoutClassName={th}>Ảnh</TableHeaderCell>
                <TableHeaderCell layoutClassName={th}>Tên</TableHeaderCell>
                {withColor ? <TableHeaderCell layoutClassName={th}>Màu</TableHeaderCell> : null}
                {withCount ? <TableHeaderCell layoutClassName={th}>Số cái</TableHeaderCell> : null}
                <TableHeaderCell layoutClassName={`${th} text-right`}>Giá</TableHeaderCell>
                <TableHeaderCell layoutClassName={th}> </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((x, idx) => (
                <TableRow key={idx} borderClassName="border-t border-slate-50 dark:border-slate-700/50">
                  <TableCell layoutClassName="px-3 py-2">
                    <ImageCell images={galleryImages} value={x.image} onChange={(img) => patch(idx, { image: img })} />
                  </TableCell>
                  <TableCell layoutClassName="px-3 py-2">
                    <Input
                      type="text"
                      value={x.name}
                      onChange={(e) => patch(idx, { name: e.target.value })}
                      placeholder={namePlaceholder}
                      backgroundClassName="bg-slate-50 dark:bg-slate-700"
                      containerClassName="min-w-[8rem]" />
                  </TableCell>
                  {withColor ? (
                    <TableCell layoutClassName="px-3 py-2">
                      <Input
                        type="color"
                        value={x.color || '#64748b'}
                        onChange={(e) => patch(idx, { color: e.target.value })}
                        aria-label="Màu vị"
                        containerClassName="w-9"
                        sizeClassName="h-8 p-0.5"
                        backgroundClassName="bg-white dark:bg-slate-700" />
                    </TableCell>
                  ) : null}
                  {withCount ? (
                    <TableCell layoutClassName="px-3 py-2">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={x.count ?? 1}
                        onChange={(e) => patch(idx, { count: Math.max(1, Number(e.target.value) || 1) })}
                        aria-label="Số cái"
                        backgroundClassName="bg-slate-50 dark:bg-slate-700"
                        containerClassName="w-16" />
                    </TableCell>
                  ) : null}
                  <TableCell layoutClassName="px-3 py-2 text-right">
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={x.price ?? 0}
                      onChange={(e) => patch(idx, { price: Math.max(0, Number(e.target.value) || 0) })}
                      rightIcon={<Typography as="span" size="xs" variant="muted">đ</Typography>}
                      backgroundClassName="bg-slate-50 dark:bg-slate-700"
                      containerClassName="w-28" />
                  </TableCell>
                  <TableCell layoutClassName="px-2 py-2">
                    <Button
                      type="button"
                      onClick={() => remove(idx)}
                      aria-label={`Xoá ${x.name}`}
                      variant="ghost"
                      disableVariantHover
                      disableVariantTextColor
                      sizeClassName="p-1.5"
                      roundedClassName="rounded-lg"
                      borderClassName="border border-transparent"
                      textClassName="text-slate-400"
                      hoverClassName="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Typography size="xs" variant="muted">Chưa có. Thêm ở dưới.</Typography>
      )}

      {/* Thêm dòng */}
      <Box layoutClassName="flex items-center gap-2">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={namePlaceholder}
          backgroundClassName="bg-slate-50 dark:bg-slate-700"
          containerClassName="flex-1" />
        <Button
          type="button"
          onClick={add}
          variant="primary"
          leftIcon={<Plus className="h-4 w-4" />}
          sizeClassName="px-3 py-2 text-sm"
          roundedClassName="rounded-lg">
          Thêm
        </Button>
      </Box>
    </Shell>
  );
};

export default VariantTable;
