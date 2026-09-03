import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { MapPinned, Sparkles, Pencil, Check, X } from 'lucide-react';
import { Order } from '@/types';
import { SpxAddressStatus, spxAddressStatusLabel } from '@/types/order';
import { resolveOrderSpx, setOrderSpx2Address } from '@/services/orderService';
import { SPX_PROVINCES, SPX_WARDS_BY_PROVINCE } from '@/assets/spxAdminList';
import Box from '@/components/ui/Box';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import Label from '@/components/ui/Label';

interface Props {
  order: Order;
  /** Gọi khi lưu/làm mịn thành công, truyền order mới để màn ngoài cập nhật cache. */
  onUpdated: (order: Order) => void;
}

/** Màu badge theo trạng thái làm mịn (giống bản 3 cấp). */
const statusStyle: Record<SpxAddressStatus | 'none', { bg: string; text: string; border: string }> = {
  matched: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  partial: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  unmatched: {
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
  },
  none: {
    bg: 'bg-slate-50 dark:bg-slate-800/40',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

/**
 * Khối "Địa chỉ SPX 2 cấp (hệ mới)" ở chi tiết đơn ship tỉnh: hiện Tỉnh/Xã đã resolve theo
 * danh mục sau sáp nhập 2025 + trạng thái, nút "Làm mịn lại" (rule + AI grounded ở BE), và
 * sửa tay bằng dropdown danh mục 2 cấp (offline trong FE — khớp State_list(2)/City_list(2)).
 * Song song `SpxAddressPanel` (3 cấp) — dùng cho sheet "Tạo đơn (địa chỉ mới)".
 */
const Spx2AddressPanel: React.FC<Props> = ({ order, onUpdated }) => {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [province, setProvince] = useState(order.spx2Province ?? '');
  const [ward, setWard] = useState(order.spx2Ward ?? '');

  // Đồng bộ lại khi order (bản resolve) đổi từ ngoài.
  useEffect(() => {
    setProvince(order.spx2Province ?? '');
    setWard(order.spx2Ward ?? '');
  }, [order.spx2Province, order.spx2Ward]);

  const st = statusStyle[order.spx2Status ?? 'none'];
  const wards = useMemo(
    () => (province ? SPX_WARDS_BY_PROVINCE[province] ?? [] : []),
    [province],
  );

  const handleResolve = async () => {
    setBusy(true);
    try {
      const o = await resolveOrderSpx(order.id, true, 2);
      onUpdated(o);
      toast.success('Đã làm mịn địa chỉ 2 cấp.');
    } catch {
      toast.error('Làm mịn địa chỉ 2 cấp thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const o = await setOrderSpx2Address(order.id, { province, ward });
      onUpdated(o);
      setEditing(false);
      toast.success('Đã lưu địa chỉ SPX 2 cấp.');
    } catch {
      toast.error('Lưu địa chỉ thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const resolvedLine =
    [order.spx2Ward, order.spx2Province].filter(Boolean).join(', ') || 'Chưa làm mịn';

  return (
    <Box
      layoutClassName="space-y-3 rounded-lg p-3"
      borderClassName={`border ${st.border}`}
      backgroundClassName={st.bg}
    >
      <Box layoutClassName="flex items-center justify-between gap-2">
        <Box layoutClassName="flex items-center gap-2">
          <MapPinned className="h-4 w-4 text-slate-500 dark:text-slate-300" />
          <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-700 dark:text-slate-100">
            Địa chỉ SPX 2 cấp
          </Typography>
          <Badge backgroundClassName={st.bg} textClassName={st.text} borderClassName={`border ${st.border}`}>
            {spxAddressStatusLabel(order.spx2Status)}
            {order.spx2Manual ? ' · sửa tay' : ''}
          </Badge>
        </Box>
      </Box>

      {!editing ? (
        <>
          <Typography as="p" size="sm" textClassName="text-slate-700 dark:text-slate-200">
            {resolvedLine}
          </Typography>
          <Box layoutClassName="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => void handleResolve()}
              disabled={busy}
              variant="secondary"
              leftIcon={<Sparkles />}
              iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
              sizeClassName="px-3 py-1.5 text-sm"
              roundedClassName="rounded-lg"
              borderClassName="border border-slate-200 dark:border-slate-600"
              backgroundClassName="bg-white dark:bg-slate-800"
              textClassName="text-slate-700 dark:text-slate-200"
              layoutClassName="inline-flex items-center gap-1.5"
            >
              Làm mịn lại
            </Button>
            <Button
              type="button"
              onClick={() => setEditing(true)}
              disabled={busy}
              variant="secondary"
              leftIcon={<Pencil />}
              iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
              sizeClassName="px-3 py-1.5 text-sm"
              roundedClassName="rounded-lg"
              borderClassName="border border-slate-200 dark:border-slate-600"
              backgroundClassName="bg-white dark:bg-slate-800"
              textClassName="text-slate-700 dark:text-slate-200"
              layoutClassName="inline-flex items-center gap-1.5"
            >
              Sửa tay
            </Button>
          </Box>
        </>
      ) : (
        <Box layoutClassName="space-y-3">
          <Box layoutClassName="space-y-1">
            <Label className="mb-0">Tỉnh/Thành (hệ mới)</Label>
            <Select
              value={province}
              searchable
              onChange={(e) => {
                setProvince(e.target.value);
                setWard('');
              }}
            >
              <option value="">— Chọn Tỉnh —</option>
              {SPX_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Box>
          <Box layoutClassName="space-y-1">
            <Label className="mb-0">Xã/Phường (hệ mới)</Label>
            <Select
              value={ward}
              searchable
              disabled={!province}
              onChange={(e) => setWard(e.target.value)}
            >
              <option value="">— Chọn Xã/Phường —</option>
              {wards.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </Select>
          </Box>
          <Box layoutClassName="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy || !province}
              variant="primary"
              leftIcon={<Check />}
              iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
              sizeClassName="px-3 py-1.5 text-sm"
              roundedClassName="rounded-lg"
              backgroundClassName="bg-primary-600"
              hoverClassName="hover:bg-primary-700"
              textClassName="font-medium text-white"
              layoutClassName="inline-flex items-center gap-1.5"
              disableVariantHover
            >
              Lưu
            </Button>
            <Button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
              variant="secondary"
              leftIcon={<X />}
              iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
              sizeClassName="px-3 py-1.5 text-sm"
              roundedClassName="rounded-lg"
              borderClassName="border border-slate-200 dark:border-slate-600"
              backgroundClassName="bg-white dark:bg-slate-800"
              textClassName="text-slate-700 dark:text-slate-200"
              layoutClassName="inline-flex items-center gap-1.5"
            >
              Huỷ
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Spx2AddressPanel;
