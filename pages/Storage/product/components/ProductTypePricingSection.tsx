import React from 'react';
import { Layers, Plus, Trash2, PackagePlus } from 'lucide-react';
import type { PriceTier, PackagingOption } from '@/types';
import { formatVND } from '@/utils/format/currencyUtil';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Heading from '@/components/ui/Heading';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Typography from '@/components/ui/Typography';

interface Props {
  basePrice: number;
  priceTiers: PriceTier[];
  setPriceTiers: (tiers: PriceTier[]) => void;
  packagingOptions: PackagingOption[];
  setPackagingOptions: (opts: PackagingOption[]) => void;
  /** Ẩn khối không hợp với loại sản phẩm (vd bao bì thì không có "cách gói"). */
  showPriceTiers?: boolean;
  showPackaging?: boolean;
}

const ProductTypePricingSection: React.FC<Props> = ({
  basePrice,
  priceTiers,
  setPriceTiers,
  packagingOptions,
  setPackagingOptions,
  showPriceTiers = true,
  showPackaging = true,
}) => {
  const addTier = () => setPriceTiers([...priceTiers, { minQty: 0, price: 0 }]);
  const updateTier = (idx: number, patch: Partial<PriceTier>) =>
    setPriceTiers(priceTiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  const removeTier = (idx: number) => setPriceTiers(priceTiers.filter((_, i) => i !== idx));

  const addOpt = () => setPackagingOptions([...packagingOptions, { label: '', perUnit: 0 }]);
  const updateOpt = (idx: number, patch: Partial<PackagingOption>) =>
    setPackagingOptions(packagingOptions.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  const removeOpt = (idx: number) => setPackagingOptions(packagingOptions.filter((_, i) => i !== idx));

  return (
    <Box layoutClassName="space-y-5">
      {showPriceTiers && (
      <Box layoutClassName="space-y-2">
        <Box layoutClassName="flex items-center justify-between gap-2">
          <Heading level={4} layoutClassName="flex items-center gap-2" textClassName="text-sm font-semibold">
            <Layers className="h-4 w-4 text-primary-500" /> Mua nhiều giảm giá
          </Heading>
          <Button
            type="button"
            variant="ghost"
            onClick={addTier}
            sizeClassName="px-2 py-1 text-xs"
            roundedClassName="rounded-lg"
            shadowClassName=""
            borderClassName="border border-slate-200 dark:border-slate-600"
            backgroundClassName="bg-white dark:bg-slate-800"
            textClassName="text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            <Plus className="h-3.5 w-3.5" /> Thêm mốc
          </Button>
        </Box>
        <Typography as="p" size="xs" variant="muted">
          Khách mua từ bao nhiêu cái trở lên thì tính giá nào. Ít hơn mốc nhỏ nhất → giá gốc ({formatVND(Number(basePrice) || 0)}).
        </Typography>
        {priceTiers.length > 0 ? (
          <Box layoutClassName="space-y-2">
            {priceTiers.map((tier, idx) => (
              <Box key={idx} layoutClassName="flex items-end gap-2">
                <Box layoutClassName="flex-1">
                  {idx === 0 ? <Typography as="span" size="xs" variant="muted">Mua từ (cái)</Typography> : null}
                  <Input
                    type="number"
                    min={0}
                    value={tier.minQty || ''}
                    onChange={(e) => updateTier(idx, { minQty: Math.max(0, Number(e.target.value) || 0) })}
                    placeholder="vd 10"
                    fullWidth
                    sizeClassName="py-2 text-sm"
                  />
                </Box>
                <Box layoutClassName="flex-1">
                  {idx === 0 ? <Typography as="span" size="xs" variant="muted">Giá/đơn vị</Typography> : null}
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={tier.price || ''}
                    onChange={(e) => updateTier(idx, { price: Math.max(0, Number(e.target.value) || 0) })}
                    placeholder="vd 9000"
                    fullWidth
                    sizeClassName="py-2 text-right text-sm font-semibold"
                  />
                </Box>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeTier(idx)}
                  sizeClassName="p-2"
                  roundedClassName="rounded-lg"
                  shadowClassName=""
                  borderClassName="border border-transparent"
                  backgroundClassName="bg-transparent"
                  textClassName="text-slate-400 hover:text-rose-500"
                  hoverClassName="hover:bg-rose-50 dark:hover:bg-rose-900/20"
                  aria-label="Xoá bậc giá"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography as="p" size="xs" variant="muted">Chưa có mốc nào — mọi số lượng đều tính giá gốc.</Typography>
        )}
      </Box>
      )}

      {showPackaging && (
      <Box layoutClassName="space-y-2">
        <Box layoutClassName="flex items-center justify-between gap-2">
          <Heading level={4} layoutClassName="flex items-center gap-2" textClassName="text-sm font-semibold">
            <PackagePlus className="h-4 w-4 text-primary-500" /> Cách gói khách chọn thêm
          </Heading>
          <Button
            type="button"
            variant="ghost"
            onClick={addOpt}
            sizeClassName="px-2 py-1 text-xs"
            roundedClassName="rounded-lg"
            shadowClassName=""
            borderClassName="border border-slate-200 dark:border-slate-600"
            backgroundClassName="bg-white dark:bg-slate-800"
            textClassName="text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            <Plus className="h-3.5 w-3.5" /> Thêm kiểu gói
          </Button>
        </Box>
        <Typography as="p" size="xs" variant="muted">
          Khách chọn 1 kiểu khi đặt, tiền cộng thêm cho mỗi cái. Vd "Túi giấy" +2.000đ, "Hộp + thiệp" +6.000đ.
        </Typography>
        {packagingOptions.length > 0 ? (
          <Box layoutClassName="space-y-2">
            {packagingOptions.map((opt, idx) => (
              <Box key={idx} layoutClassName="flex items-end gap-2">
                <Box layoutClassName="flex-[2]">
                  {idx === 0 ? <Typography as="span" size="xs" variant="muted">Tên kiểu gói</Typography> : null}
                  <Input
                    value={opt.label}
                    onChange={(e) => updateOpt(idx, { label: e.target.value })}
                    placeholder="vd Hộp + thiệp"
                    fullWidth
                    sizeClassName="py-2 text-sm"
                  />
                </Box>
                <Box layoutClassName="flex-1">
                  {idx === 0 ? <Typography as="span" size="xs" variant="muted">Cộng thêm / cái</Typography> : null}
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={opt.perUnit || ''}
                    onChange={(e) => updateOpt(idx, { perUnit: Math.max(0, Number(e.target.value) || 0) })}
                    placeholder="vd 6000"
                    fullWidth
                    sizeClassName="py-2 text-right text-sm font-semibold"
                  />
                </Box>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeOpt(idx)}
                  sizeClassName="p-2"
                  roundedClassName="rounded-lg"
                  shadowClassName=""
                  borderClassName="border border-transparent"
                  backgroundClassName="bg-transparent"
                  textClassName="text-slate-400 hover:text-rose-500"
                  hoverClassName="hover:bg-rose-50 dark:hover:bg-rose-900/20"
                  aria-label="Xoá kiểu gói"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography as="p" size="xs" variant="muted">Chưa có kiểu gói nào — khách đặt là tính đúng giá bán.</Typography>
        )}
      </Box>
      )}
    </Box>
  );
};

export default ProductTypePricingSection;
