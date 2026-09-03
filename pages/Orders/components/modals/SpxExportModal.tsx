import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { PackageCheck } from 'lucide-react';
import { Order, DeliveryType, OrderStatus } from '@/types';
import { exportOrdersToSpx, isSpxShippable, isTrackingCancelled, codRemaining, ResolvedAddress, SpxAddressMode } from '@/utils/order/spxOrderExport';
import { resolveSpxOldAddresses } from '@/services/orderService';
import { resolveSpxAddresses } from '@/utils/order/spxAddressMatch';
import { getOrderTotal } from '@/utils/order/orderUtils';
import { formatVND } from '@/utils/format/currencyUtil';
import BaseModal from '@/components/BaseModal';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Typography from '@/components/ui/Typography';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Toàn bộ danh sách đơn (tự lọc đơn cần tạo VĐ bên trong). */
  orders: Order[];
}

const SpxExportModal: React.FC<Props> = ({ isOpen, onClose, orders }) => {
  const [weight, setWeight] = useState('1');
  // Mặc định 'old' — SPX chỉ đọc sheet ĐẦU "Tạo đơn (địa chỉ cũ)"; để data ở sheet "mới" (sheet2) → SPX đọc sheet đầu trống → fail.
  const [addressMode, setAddressMode] = useState<SpxAddressMode>('old');
  const useAi = true; // luôn dùng AI tách địa chỉ (không cho tắt).
  const [busy, setBusy] = useState(false);

  const eligible = useMemo(() => orders.filter(isSpxShippable), [orders]);
  const totalCod = useMemo(() => eligible.reduce((s, o) => s + codRemaining(o), 0), [eligible]);
  const totalValue = useMemo(() => eligible.reduce((s, o) => s + getOrderTotal(o), 0), [eligible]);

  // Đơn ship tỉnh còn "treo" (chưa xong) nhưng CHƯA đủ điều kiện xuất — kèm lý do.
  const ineligible = useMemo(() => {
    const done = (o: Order) =>
      o.status === OrderStatus.CANCELLED ||
      o.status === OrderStatus.DELIVERED ||
      o.status === OrderStatus.RETURNED;
    return orders
      .filter((o) => o.deliveryType === DeliveryType.SHIP_PROVINCE && !done(o) && !isSpxShippable(o))
      .map((o) => ({
        o,
        reason: o.trackingNumber
          ? 'đã có mã vận đơn'
          : (Number(o.paidAmount) || 0) <= 0
            ? 'chưa cọc'
            : 'chưa đủ điều kiện',
      }));
  }, [orders]);

  const handleExport = async () => {
    if (eligible.length === 0) return;
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) {
      toast.error('Cân nặng mặc định phải là số dương (KG).');
      return;
    }
    setBusy(true);
    const loadingId = toast.loading(useAi ? 'Đang tách địa chỉ (rule + AI)…' : 'Đang tách địa chỉ…');
    try {
      let resolved: ResolvedAddress[];
      let filled: number;
      let label: string;
      if (addressMode === 'old') {
        // Hệ CŨ 3 cấp (BE, danh mục spx_*_old + AI): Tỉnh + Quận/Huyện + Xã/Phường.
        const addrs = eligible.map((o) =>
          [o.customer.address, o.customer.city].filter(Boolean).join(', '),
        );
        // TÁI DÙNG bản đã "làm mịn" lưu sẵn (spxStatus='matched' + địa chỉ chưa đổi) → khỏi gọi AI lại.
        const arr = eligible.map((o, i) =>
          o.spxStatus === 'matched' && (o.spxSource ?? '') === addrs[i]
            ? { state: o.spxState ?? '', city: o.spxCity ?? '', ward: o.spxWard ?? '' }
            : { state: '', city: '', ward: '' },
        );
        const missIdx = arr
          .map((r, i) => (!r.state || !r.city || !r.ward ? i : -1))
          .filter((i) => i >= 0);
        if (missIdx.length > 0) {
          const got = await resolveSpxOldAddresses(missIdx.map((i) => addrs[i]), useAi);
          missIdx.forEach((oi, k) => {
            const g = got[k];
            if (g) arr[oi] = { state: g.state, city: g.city, ward: g.ward };
          });
        }
        resolved = arr.map((r) => ({ state: r.state, city: r.city, ward: r.ward }));
        filled = arr.filter((r) => r.state && r.city && r.ward).length;
        const reused = eligible.length - missIdx.length;
        label = `Tỉnh+Quận+Xã · tái dùng ${reused}/${eligible.length}`;
      } else {
        // Hệ MỚI 2 cấp (danh mục 2025 + AI): Tỉnh + Phường/Xã (KHÔNG Quận).
        const addrs = eligible.map((o) =>
          [o.customer.address, o.customer.city].filter(Boolean).join(', '),
        );
        // TÁI DÙNG bản "làm mịn" 2 cấp lưu sẵn trên đơn (spx2Status='matched' + địa chỉ chưa đổi).
        const arr = eligible.map((o, i) =>
          o.spx2Status === 'matched' && (o.spx2Source ?? '') === addrs[i]
            ? { province: o.spx2Province ?? '', ward: o.spx2Ward ?? '' }
            : { province: '', ward: '' },
        );
        const missIdx = arr
          .map((r, i) => (!r.province || !r.ward ? i : -1))
          .filter((i) => i >= 0);
        if (missIdx.length > 0) {
          const got = await resolveSpxAddresses(
            missIdx.map((i) => eligible[i]),
            useAi,
          );
          missIdx.forEach((oi, k) => {
            const g = got[k];
            if (g) arr[oi] = { province: g.province, ward: g.ward };
          });
        }
        resolved = arr.map((r) => ({ province: r.province, ward: r.ward }));
        filled = arr.filter((r) => r.province && r.ward).length;
        const reused = eligible.length - missIdx.length;
        label = `Tỉnh+Phường/Xã · tái dùng ${reused}/${eligible.length}`;
      }
      if (loadingId) toast.dismiss(loadingId);
      const n = await exportOrdersToSpx(eligible, { weightKg: w, addressMode, resolved });
      toast.success(`Đã xuất ${n} đơn · điền đủ ${label} ${filled}/${n}`);
      onClose();
    } catch (err) {
      if (loadingId) toast.dismiss(loadingId);
      toast.error(err instanceof Error ? err.message : 'Xuất file thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Xuất file tạo đơn hàng loạt SPX" size="lg">
      <Box layoutClassName="space-y-4">
        <Typography as="p" size="sm" variant="muted">
          Chỉ xuất đơn <b>ship tỉnh · ĐÃ CỌC · chưa có mã vận đơn (hoặc mã đã bị huỷ → tạo lại)</b>.
          Số tiền COD = <b>còn lại phải thu</b> (tổng đơn − đã cọc) — SPX chỉ thu phần còn thiếu.
        </Typography>

        <Box
          layoutClassName="flex flex-wrap gap-x-6 gap-y-1 rounded-lg px-3 py-2.5"
          borderClassName="border border-slate-200 dark:border-slate-700"
          backgroundClassName="bg-slate-50 dark:bg-slate-800/60"
        >
          <Typography as="span" size="sm" textClassName="text-slate-700 dark:text-slate-200">
            Đơn đủ điều kiện: <b>{eligible.length}</b>
          </Typography>
          <Typography as="span" size="sm" textClassName="text-slate-700 dark:text-slate-200">
            Tổng giá trị: <b>{formatVND(totalValue)}</b>
          </Typography>
          <Typography as="span" size="sm" textClassName="text-slate-700 dark:text-slate-200">
            Tổng COD cần thu: <b>{formatVND(totalCod)}</b>
          </Typography>
        </Box>

        {/* Chi tiết đơn sẽ xuất: đã cọc bao nhiêu, còn thu COD bao nhiêu */}
        {eligible.length > 0 ? (
          <Box
            layoutClassName="max-h-[32vh] space-y-1 overflow-y-auto rounded-lg p-1"
            borderClassName="border border-slate-200 dark:border-slate-700"
          >
            {eligible.map((o) => {
              const total = getOrderTotal(o);
              const paid = Number(o.paidAmount) || 0;
              const cod = codRemaining(o);
              return (
                <Box
                  key={o.id}
                  layoutClassName="flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5"
                  backgroundClassName="bg-slate-50 dark:bg-slate-800/40"
                >
                  <Box layoutClassName="min-w-0 flex-1">
                    <Box layoutClassName="flex items-center gap-1.5">
                      <Typography as="p" size="sm" layoutClassName="truncate font-medium" textClassName="text-slate-800 dark:text-slate-100">
                        {o.orderNumber} · {o.customer.name}
                      </Typography>
                      {isTrackingCancelled(o) && (
                        <Typography
                          as="span"
                          size="xs"
                          layoutClassName="shrink-0 rounded px-1.5 py-0.5 font-semibold"
                          backgroundClassName="bg-rose-100 dark:bg-rose-900/30"
                          textClassName="text-rose-600 dark:text-rose-300"
                        >
                          tạo lại · mã cũ đã huỷ
                        </Typography>
                      )}
                    </Box>
                    <Typography as="span" size="xs" variant="muted">
                      Tổng {formatVND(total)} · đã cọc {formatVND(paid)}
                    </Typography>
                  </Box>
                  <Typography as="span" size="sm" layoutClassName="shrink-0 font-semibold" textClassName="text-emerald-600 dark:text-emerald-400">
                    thu COD {formatVND(cod)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Box
            layoutClassName="rounded-lg p-3 text-center"
            borderClassName="border border-slate-200 dark:border-slate-700"
            backgroundClassName="bg-slate-50 dark:bg-slate-800/40"
          >
            <Typography as="p" size="xs" textClassName="text-slate-500 dark:text-slate-400">
              Không có đơn nào đủ điều kiện (ship tỉnh · đã cọc · chưa có mã vận đơn).
            </Typography>
          </Box>
        )}

        {/* Đơn ship tỉnh CHƯA đủ điều kiện xuất — kèm lý do */}
        {ineligible.length > 0 ? (
          <Box layoutClassName="space-y-1">
            <Typography as="p" size="xs" layoutClassName="font-semibold" textClassName="text-amber-600 dark:text-amber-400">
              Chưa đủ điều kiện ({ineligible.length}) — không xuất
            </Typography>
            <Box
              layoutClassName="max-h-[22vh] space-y-1 overflow-y-auto rounded-lg p-1"
              borderClassName="border border-amber-200 dark:border-amber-900/40"
            >
              {ineligible.map(({ o, reason }) => (
                <Box
                  key={o.id}
                  layoutClassName="flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5"
                  backgroundClassName="bg-amber-50/60 dark:bg-amber-900/15"
                >
                  <Typography as="p" size="sm" layoutClassName="min-w-0 flex-1 truncate" textClassName="text-slate-700 dark:text-slate-200">
                    {o.orderNumber} · {o.customer.name}
                  </Typography>
                  <Typography as="span" size="xs" layoutClassName="shrink-0 font-medium" textClassName="text-amber-600 dark:text-amber-400">
                    {reason}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}

        {/* Chọn định dạng địa chỉ */}
        <Box layoutClassName="flex flex-wrap items-center gap-3">
          <Label className="mb-0">Định dạng địa chỉ</Label>
          <Box layoutClassName="inline-flex gap-1.5">
            <Button
              type="button"
              onClick={() => setAddressMode('new')}
              variant={addressMode === 'new' ? 'primary' : 'secondary'}
              sizeClassName="px-3 py-1.5 text-sm"
              roundedClassName="rounded-lg"
              borderClassName="border border-slate-200 dark:border-slate-600"
              backgroundClassName={addressMode === 'new' ? 'bg-primary-600' : 'bg-white dark:bg-slate-800'}
              textClassName={addressMode === 'new' ? 'font-medium text-white' : 'text-slate-700 dark:text-slate-200'}
              disableVariantHover
              disableVariantTextColor
            >
              Địa chỉ mới (2 cấp)
            </Button>
            <Button
              type="button"
              onClick={() => setAddressMode('old')}
              variant={addressMode === 'old' ? 'primary' : 'secondary'}
              sizeClassName="px-3 py-1.5 text-sm"
              roundedClassName="rounded-lg"
              borderClassName="border border-slate-200 dark:border-slate-600"
              backgroundClassName={addressMode === 'old' ? 'bg-primary-600' : 'bg-white dark:bg-slate-800'}
              textClassName={addressMode === 'old' ? 'font-medium text-white' : 'text-slate-700 dark:text-slate-200'}
              disableVariantHover
              disableVariantTextColor
            >
              Địa chỉ cũ (3 cấp)
            </Button>
          </Box>
        </Box>

        {/* Cân nặng mặc định */}
        <Box layoutClassName="flex items-center gap-3">
          <Label htmlFor="spx-weight" className="mb-0">
            Cân nặng mặc định (KG)
          </Label>
          <Input
            id="spx-weight"
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            min="0.1"
            step="0.1"
            inputMode="decimal"
            sizeClassName="w-24 px-3 py-1.5 text-sm"
            borderClassName="border border-slate-200 dark:border-slate-600"
            roundedClassName="rounded-lg"
          />
        </Box>

        <Box layoutClassName="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            sizeClassName="px-4 py-2 text-sm"
            roundedClassName="rounded-lg"
            borderClassName="border border-slate-200 dark:border-slate-600"
            backgroundClassName="bg-white dark:bg-slate-800"
          >
            Huỷ
          </Button>
          <Button
            type="button"
            onClick={() => void handleExport()}
            disabled={busy || eligible.length === 0}
            variant="primary"
            leftIcon={<PackageCheck />}
            iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
            backgroundClassName="bg-primary-600"
            hoverClassName="hover:bg-primary-700"
            textClassName="font-medium text-white"
            sizeClassName="px-4 py-2 text-sm"
            roundedClassName="rounded-lg"
            layoutClassName="inline-flex items-center gap-1.5"
            disableVariantHover
          >
            {eligible.length === 0 ? 'Không có đơn' : `Tải file (${eligible.length} đơn)`}
          </Button>
        </Box>
      </Box>
    </BaseModal>
  );
};

export default SpxExportModal;
