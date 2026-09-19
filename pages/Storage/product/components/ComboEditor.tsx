/**
 * ComboEditor — khai báo combo bằng SẢN PHẨM CÓ SẴN (không gõ tay mô tả).
 * Mỗi dòng: chọn sản phẩm + số phần + "1 phần = mấy đơn vị bán lẻ" (hộp 10 cái → 0.1).
 * Giá lẻ cộng lại + mức tiết kiệm tính ngay tại chỗ theo giá sản phẩm hiện tại.
 */
import React, { useMemo } from 'react';
import { Boxes, Plus, Trash2 } from 'lucide-react';
import type { ComboItem, Product } from '@/types';
import { formatVND } from '@/utils/format/currencyUtil';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Heading from '@/components/ui/Heading';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Typography from '@/components/ui/Typography';

interface Props {
  /** Sản phẩm đang sửa (bị loại khỏi danh sách chọn để combo không tự chứa mình). */
  selfId?: string;
  comboPrice: number;
  items: ComboItem[];
  setItems: (items: ComboItem[]) => void;
  products: Product[];
  loading?: boolean;
}

const ComboEditor: React.FC<Props> = ({ selfId, comboPrice, items, setItems, products, loading }) => {
  const priceById = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach((p) => m.set(p.id, Number(p.price) || 0));
    return m;
  }, [products]);

  const options = useMemo(
    () => products.filter((p) => p.id !== selfId).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [products, selfId],
  );

  const lineRetail = (it: ComboItem) =>
    (priceById.get(it.productId) ?? 0) * (Number(it.portion) || 0) * (Number(it.qty) || 0);
  const retailSum = items.reduce((s, it) => s + lineRetail(it), 0);
  const saving = retailSum - (Number(comboPrice) || 0);

  const add = () => setItems([...items, { productId: '', qty: 1, portion: 1, unitLabel: 'cái' }]);
  const update = (idx: number, patch: Partial<ComboItem>) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const remove = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  return (
    <Box layoutClassName="space-y-2">
      <Box layoutClassName="flex items-center justify-between gap-2">
        <Heading level={4} layoutClassName="flex items-center gap-2" textClassName="text-sm font-semibold">
          <Boxes className="h-4 w-4 text-primary-500" /> Thành phần combo
        </Heading>
        <Button
          type="button"
          variant="ghost"
          onClick={add}
          sizeClassName="px-2 py-1 text-xs"
          roundedClassName="rounded-lg"
          shadowClassName=""
          borderClassName="border border-slate-200 dark:border-slate-600"
          backgroundClassName="bg-white dark:bg-slate-800"
          textClassName="text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          <Plus className="h-3.5 w-3.5" /> Thêm món
        </Button>
      </Box>

      <Typography as="p" size="xs" variant="muted">
        Chọn từ sản phẩm đang bán. <b>Số phần</b> là số món trong hộp; <b>tỉ lệ</b> là 1 phần bằng mấy đơn vị
        bán lẻ (phô mai dẻo bán hộp 10 cái → 0.1; bánh mì chuối bán ổ 5 lát → 0.2; bánh bán từng cái → 1).
      </Typography>

      {loading ? (
        <Typography as="p" size="xs" variant="muted">Đang tải thành phần…</Typography>
      ) : items.length > 0 ? (
        <Box layoutClassName="space-y-2">
          {items.map((it, idx) => (
            <Box key={idx} layoutClassName="flex items-end gap-2">
              <Box layoutClassName="min-w-0 flex-1">
                {idx === 0 ? <Typography as="span" size="xs" variant="muted">Sản phẩm</Typography> : null}
                <Select
                  value={it.productId}
                  onChange={(e) => update(idx, { productId: e.target.value })}
                  fullWidth
                >
                  <option value="">— chọn sản phẩm —</option>
                  {options.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatVND(Number(p.price) || 0)})
                    </option>
                  ))}
                </Select>
              </Box>
              <Box layoutClassName="w-20">
                {idx === 0 ? <Typography as="span" size="xs" variant="muted">Số phần</Typography> : null}
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={it.qty || ''}
                  onChange={(e) => update(idx, { qty: Math.max(0, Number(e.target.value) || 0) })}
                  placeholder="1"
                  fullWidth
                />
              </Box>
              <Box layoutClassName="w-20">
                {idx === 0 ? <Typography as="span" size="xs" variant="muted">Tỉ lệ</Typography> : null}
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={it.portion || ''}
                  onChange={(e) => update(idx, { portion: Math.min(1, Math.max(0, Number(e.target.value) || 0)) })}
                  placeholder="1"
                  fullWidth
                />
              </Box>
              <Box layoutClassName="w-24">
                {idx === 0 ? <Typography as="span" size="xs" variant="muted">Đơn vị</Typography> : null}
                <Input
                  value={it.unitLabel ?? ''}
                  onChange={(e) => update(idx, { unitLabel: e.target.value })}
                  placeholder="cái"
                  fullWidth
                />
              </Box>
              <Box layoutClassName="w-24 pb-2 text-right">
                <Typography as="span" size="xs" variant="muted">{formatVND(lineRetail(it))}</Typography>
              </Box>
              <Button
                type="button"
                variant="ghost"
                onClick={() => remove(idx)}
                sizeClassName="p-2"
                roundedClassName="rounded-lg"
                shadowClassName=""
                borderClassName="border border-transparent"
                backgroundClassName="bg-transparent hover:bg-red-50 dark:hover:bg-red-900/20"
                textClassName="text-red-500"
                aria-label="Xoá món"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Box>
          ))}

          <Box
            layoutClassName="flex flex-wrap items-center justify-end gap-4 pt-2"
            borderClassName="border-t border-slate-100 dark:border-slate-700"
          >
            <Typography as="span" size="xs" variant="muted">
              Lẻ cộng lại: <b>{formatVND(retailSum)}</b>
            </Typography>
            <Typography as="span" size="xs" variant="muted">
              Giá combo: <b>{formatVND(Number(comboPrice) || 0)}</b>
            </Typography>
            <Typography
              as="span"
              size="xs"
              textClassName={saving >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}
            >
              Khách tiết kiệm: <b>{formatVND(saving)}</b>
              {retailSum > 0 ? ` (${Math.round((saving / retailSum) * 100)}%)` : ''}
            </Typography>
          </Box>
        </Box>
      ) : (
        <Typography as="p" size="xs" variant="muted">
          Chưa có món nào — sản phẩm này không phải combo.
        </Typography>
      )}
    </Box>
  );
};

export default ComboEditor;
