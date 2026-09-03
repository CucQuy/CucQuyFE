import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CakeSlice, Check, Clock, Package, Phone, Truck } from 'lucide-react';
import { fetchPublicOrder, type PublicOrder } from '@/services/publicOrderService';
import { formatVND } from '@/utils/format/currencyUtil';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/Table';

/** Các bước khách thấy được (bỏ CANCELLED/RETURNED — xử lý riêng bằng badge). */
const STEPS: { key: string; label: string }[] = [
  { key: 'PENDING', label: 'Đã nhận đơn' },
  { key: 'PROCESSING', label: 'Đang làm bánh' },
  { key: 'DELIVERED', label: 'Đã giao' },
];

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Đã nhận đơn',
  PROCESSING: 'Đang làm bánh',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã huỷ',
  RETURNED: 'Trả hàng',
};

const DELIVERY_LABEL: Record<string, string> = {
  SHIP: 'Giao nội thành',
  SHIP_PROVINCE: 'Gửi tỉnh',
  PICKUP: 'Khách qua lấy',
  DINE_IN: 'Dùng tại tiệm',
};

const SHOP_PHONE = '0349049567';

/** 'yyyy-mm-dd' → 'dd/mm/yyyy' (sai định dạng thì trả nguyên chuỗi). */
const dmy = (iso?: string | null): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso ?? '');
};

/**
 * Trang tra cứu đơn CÔNG KHAI cho khách — mở từ link trong tin Zalo (/don/:token).
 * KHÔNG cần đăng nhập, nằm ngoài Layout/ProtectedRoute. Dữ liệu do BE lọc sẵn
 * (không địa chỉ đầy đủ, không ghi chú nội bộ) — xem `order_public_status`.
 */
const PublicOrderPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const data = await fetchPublicOrder(String(token ?? ''));
      if (!cancelled) {
        setOrder(data);
        setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const stepIndex = useMemo(() => {
    const i = STEPS.findIndex((s) => s.key === order?.status);
    return i >= 0 ? i : 0;
  }, [order?.status]);

  const isClosed = order?.status === 'CANCELLED' || order?.status === 'RETURNED';
  const remain = Math.max(0, (order?.total ?? 0) - (order?.paidAmount ?? 0));

  return (
    <Box
      layoutClassName="min-h-screen px-4 py-8"
      backgroundClassName="bg-gradient-to-b from-rose-50 to-white dark:from-slate-900 dark:to-slate-900"
    >
      <Box layoutClassName="mx-auto w-full max-w-lg space-y-4">
        {/* Đầu trang: tên tiệm */}
        <Box layoutClassName="flex flex-col items-center gap-1 text-center">
          <CakeSlice className="h-9 w-9 text-rose-500" />
          <Heading level={1} textClassName="text-xl font-bold text-slate-900 dark:text-white">
            Tiệm Bánh Cúc Quy
          </Heading>
          <Typography size="sm" variant="muted">
            Theo dõi đơn hàng của bạn
          </Typography>
        </Box>

        {loading ? (
          <Card layoutClassName="flex items-center justify-center gap-2 p-8">
            <Spinner size="md" />
            <Typography size="sm" variant="muted">
              Đang tải đơn…
            </Typography>
          </Card>
        ) : !order ? (
          <Card layoutClassName="space-y-2 p-6 text-center">
            <Typography as="p" size="sm" textClassName="font-semibold text-slate-800 dark:text-slate-100">
              Không tìm thấy đơn hàng
            </Typography>
            <Typography as="p" size="sm" variant="muted">
              Link có thể đã hết hiệu lực. Bạn nhắn Zalo hoặc gọi tiệm để được kiểm tra giúp nhé.
            </Typography>
            <Button
              type="button"
              onClick={() => window.open(`tel:${SHOP_PHONE}`, '_self')}
              leftIcon={<Phone className="h-4 w-4" />}
              backgroundClassName="bg-rose-500"
              hoverClassName="hover:bg-rose-600"
              textClassName="text-sm font-semibold text-white"
              roundedClassName="rounded-xl"
              sizeClassName="px-4 py-2"
              layoutClassName="mx-auto inline-flex items-center gap-1.5"
              variant="primary"
              disableVariantHover
              disableVariantTextColor
            >
              Gọi tiệm {SHOP_PHONE}
            </Button>
          </Card>
        ) : (
          <>
            {/* Mã đơn + trạng thái */}
            <Card layoutClassName="space-y-3 p-4">
              <Box layoutClassName="flex flex-wrap items-center justify-between gap-2">
                <Heading level={2} textClassName="text-base font-semibold text-slate-900 dark:text-white">
                  Đơn {order.orderNumber}
                </Heading>
                <Badge
                  backgroundClassName={isClosed ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}
                  textClassName={isClosed ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}
                  borderClassName={isClosed ? 'border border-rose-200 dark:border-rose-800' : 'border border-emerald-200 dark:border-emerald-800'}
                >
                  {STATUS_LABEL[order.status] ?? order.status}
                </Badge>
              </Box>
              <Typography size="sm" variant="muted">
                {order.customerName}
                {order.phoneMasked ? ` · ${order.phoneMasked}` : ''}
              </Typography>

              {/* Các bước xử lý */}
              {!isClosed ? (
                <Box layoutClassName="space-y-2 pt-1">
                  {STEPS.map((s, i) => {
                    const done = i <= stepIndex;
                    return (
                      <Box key={s.key} layoutClassName="flex items-center gap-2.5">
                        <Box
                          layoutClassName="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                          backgroundClassName={done ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}
                        >
                          {done ? (
                            <Check className="h-3.5 w-3.5 text-white" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                          )}
                        </Box>
                        <Typography
                          size="sm"
                          textClassName={done
                            ? 'font-medium text-slate-900 dark:text-white'
                            : 'text-slate-500 dark:text-slate-400'}
                        >
                          {s.label}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              ) : null}
            </Card>

            {/* Sản phẩm + tiền */}
            <Card layoutClassName="space-y-3 p-4">
              <Typography size="xs" layoutClassName="font-bold uppercase tracking-wider" textClassName="text-slate-500 dark:text-slate-400">
                Sản phẩm
              </Typography>
              <Table>
                <TableBody>
                  {order.items.map((it, i) => (
                    <TableRow key={`${it.name}-${i}`} borderClassName="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
                      <TableCell layoutClassName="py-2" textClassName="text-sm text-slate-800 dark:text-slate-100">
                        {it.name}
                      </TableCell>
                      <TableCell layoutClassName="py-2 text-right" textClassName="text-sm text-slate-500 dark:text-slate-400">
                        × {it.quantity}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Box layoutClassName="space-y-1 border-t border-slate-100 pt-3 dark:border-slate-700">
                <Box layoutClassName="flex items-center justify-between">
                  <Typography size="sm" variant="muted">Tổng đơn</Typography>
                  <Typography size="sm" textClassName="font-semibold text-slate-900 dark:text-white">
                    {formatVND(order.total)}
                  </Typography>
                </Box>
                {order.paidAmount > 0 ? (
                  <Box layoutClassName="flex items-center justify-between">
                    <Typography size="sm" variant="muted">Đã thanh toán</Typography>
                    <Typography size="sm" textClassName="text-emerald-600 dark:text-emerald-400">
                      {formatVND(order.paidAmount)}
                    </Typography>
                  </Box>
                ) : null}
                {remain > 0 ? (
                  <Box layoutClassName="flex items-center justify-between">
                    <Typography size="sm" variant="muted">Còn lại</Typography>
                    <Typography size="sm" textClassName="font-semibold text-rose-600 dark:text-rose-400">
                      {formatVND(remain)}
                    </Typography>
                  </Box>
                ) : null}
              </Box>
            </Card>

            {/* Giao hàng */}
            <Card layoutClassName="space-y-2 p-4">
              <Typography size="xs" layoutClassName="font-bold uppercase tracking-wider" textClassName="text-slate-500 dark:text-slate-400">
                Giao hàng
              </Typography>
              <Box layoutClassName="flex items-center gap-2">
                <Truck className="h-4 w-4 text-slate-400" />
                <Typography size="sm" textClassName="text-slate-800 dark:text-slate-100">
                  {DELIVERY_LABEL[order.deliveryType] ?? order.deliveryType}
                  {order.deliveryDate ? ` · ${dmy(order.deliveryDate)}` : ''}
                  {order.deliveryTime ? ` ${order.deliveryTime}` : ''}
                </Typography>
              </Box>
              {order.trackingNumber ? (
                <>
                  <Box layoutClassName="flex items-center gap-2">
                    <Package className="h-4 w-4 text-slate-400" />
                    <Typography size="sm" textClassName="text-slate-800 dark:text-slate-100">
                      Mã vận đơn: {order.trackingNumber}
                    </Typography>
                  </Box>
                  {order.trackingStatus ? (
                    <Typography size="sm" layoutClassName="pl-6" textClassName="text-slate-500 dark:text-slate-400">
                      {order.trackingStatus}
                    </Typography>
                  ) : null}
                  <Button
                    type="button"
                    onClick={() => window.open(`https://spx.vn/track?${order.trackingNumber}`, '_blank')}
                    leftIcon={<Package className="h-3.5 w-3.5" />}
                    variant="secondary"
                    borderClassName="border border-slate-200 dark:border-slate-600"
                    backgroundClassName="bg-white dark:bg-slate-800"
                    textClassName="text-xs font-medium text-slate-700 dark:text-slate-200"
                    roundedClassName="rounded-lg"
                    sizeClassName="px-2.5 py-1.5"
                    layoutClassName="inline-flex items-center gap-1.5"
                  >
                    Tra cứu trên SPX
                  </Button>
                </>
              ) : null}
            </Card>

            {/* Liên hệ */}
            <Button
              type="button"
              onClick={() => window.open(`tel:${SHOP_PHONE}`, '_self')}
              leftIcon={<Phone className="h-4 w-4" />}
              backgroundClassName="bg-rose-500"
              hoverClassName="hover:bg-rose-600"
              textClassName="text-sm font-semibold text-white"
              roundedClassName="rounded-xl"
              sizeClassName="w-full px-4 py-2.5"
              layoutClassName="inline-flex items-center justify-center gap-1.5"
              variant="primary"
              disableVariantHover
              disableVariantTextColor
            >
              Gọi tiệm {SHOP_PHONE}
            </Button>
            <Typography size="xs" variant="muted" layoutClassName="text-center">
              Cảm ơn bạn đã đặt bánh tại Tiệm Bánh Cúc Quy 🍰
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
};

export default PublicOrderPage;
