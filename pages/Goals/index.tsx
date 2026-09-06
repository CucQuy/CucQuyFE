import React, { useEffect, useMemo, useState } from 'react';
import { Target, Pencil, Check, X, TrendingUp, CalendarCheck, Gauge, ChevronLeft, ChevronRight } from 'lucide-react';
import { Order, OrderStatus, PaymentStatus } from '@/types';
import { useOrders } from '@/hooks/useOrders';
import { getOrderRevenueDate, getOrderTotal } from '@/utils/order/orderUtils';
import toast from 'react-hot-toast';
import { formatVND } from '@/utils/format/currencyUtil';
import { fetchRevenueGoals, saveRevenueGoals } from '@/services/configurationService';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Heading from '@/components/ui/Heading';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Typography from '@/components/ui/Typography';
import { MetricCard, TrendChart } from '@/components/ui/stats';

/** Chìa localStorage CŨ — chỉ còn dùng để nạp 1 lần rồi đẩy lên BE (xem migrateLocal). */
const LS_MIN = 'goals.dailyMin';
const LS_EXP = 'goals.dailyExpected';

/** Doanh thu ghi nhận theo NGÀY của 1 tháng bất kỳ (đơn DELIVERED + PAID). */
const dailyRevenueOfMonth = (orders: Order[], y: number, m: number): Map<number, number> => {
  const map = new Map<number, number>();
  for (const o of orders) {
    if (o.paymentStatus !== PaymentStatus.PAID || o.status !== OrderStatus.DELIVERED) continue;
    const d = getOrderRevenueDate(o);
    if (!d || d.getFullYear() !== y || d.getMonth() !== m) continue;
    const day = d.getDate();
    map.set(day, (map.get(day) ?? 0) + getOrderTotal(o));
  }
  return map;
};

/** Tổng doanh thu từng tháng, khoá 'yyyy-mm' — cho biểu đồ 12 tháng. */
const monthlyRevenue = (orders: Order[]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const o of orders) {
    if (o.paymentStatus !== PaymentStatus.PAID || o.status !== OrderStatus.DELIVERED) continue;
    const d = getOrderRevenueDate(o);
    if (!d) continue;
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(k, (map.get(k) ?? 0) + getOrderTotal(o));
  }
  return map;
};

const GoalsPage: React.FC = () => {
  const { orders } = useOrders();
  const [minDaily, setMinDaily] = useState(0);
  const [expectedDaily, setExpectedDaily] = useState(0);
  const [monthlyTarget, setMonthlyTarget] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  /** 0 = tháng này, -1 = tháng trước… (xem lại kết quả các tháng cũ). */
  const [monthOffset, setMonthOffset] = useState(0);
  const [draftMin, setDraftMin] = useState('');
  const [draftExp, setDraftExp] = useState('');
  const [draftMonth, setDraftMonth] = useState('');

  // Mục tiêu lưu ở BE để mọi máy (POS, laptop, điện thoại) thấy CÙNG một số.
  // Máy nào còn số cũ trong localStorage thì đẩy lên BE 1 lần rồi xoá chìa.
  useEffect(() => {
    void (async () => {
      try {
        const g = await fetchRevenueGoals();
        let { dailyMin, dailyExpected } = g;
        if (!dailyMin && !dailyExpected) {
          const oldMin = Number(localStorage.getItem(LS_MIN)) || 0;
          const oldExp = Number(localStorage.getItem(LS_EXP)) || 0;
          if (oldMin || oldExp) {
            await saveRevenueGoals({ dailyMin: oldMin, dailyExpected: oldExp });
            dailyMin = oldMin;
            dailyExpected = oldExp;
            localStorage.removeItem(LS_MIN);
            localStorage.removeItem(LS_EXP);
          }
        }
        setMinDaily(dailyMin);
        setExpectedDaily(dailyExpected);
        setMonthlyTarget(g.monthlyTarget);
      } catch {
        toast.error('Không tải được mục tiêu doanh thu.');
      }
    })();
  }, []);

  const startEdit = () => {
    setDraftMin(minDaily ? String(minDaily) : '');
    setDraftExp(expectedDaily ? String(expectedDaily) : '');
    setDraftMonth(monthlyTarget ? String(monthlyTarget) : '');
    setEditing(true);
  };
  const save = async () => {
    const mn = Number(draftMin.replace(/[^\d]/g, '')) || 0;
    const ex = Number(draftExp.replace(/[^\d]/g, '')) || 0;
    const mt = Number(draftMonth.replace(/[^\d]/g, '')) || 0;
    setSaving(true);
    try {
      await saveRevenueGoals({ dailyMin: mn, dailyExpected: ex, monthlyTarget: mt });
      setMinDaily(mn);
      setExpectedDaily(ex);
      setMonthlyTarget(mt);
      setEditing(false);
      toast.success('Đã lưu mục tiêu.');
    } catch {
      toast.error('Lưu mục tiêu thất bại.');
    } finally {
      setSaving(false);
    }
  };

  /** Gợi ý: mục tiêu tháng ÷ số ngày trong tháng → mức mỗi ngày. */
  const suggestDailyFromMonth = () => {
    const mt = Number(draftMonth.replace(/[^\d]/g, '')) || 0;
    if (!mt) return;
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    setDraftExp(String(Math.round(mt / daysInMonth)));
  };

  const stats = useMemo(() => {
    const now = new Date();
    // Tháng đang xem (mặc định tháng này; lùi lại để xem tháng cũ).
    const cur = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const isThisMonth = monthOffset === 0;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    // Tháng đã qua thì vẽ trọn tháng; tháng này chỉ vẽ tới hôm nay để đường không rơi về 0.
    const todayDay = isThisMonth ? now.getDate() : daysInMonth;
    const map = dailyRevenueOfMonth(orders, y, m);
    const chart = Array.from({ length: todayDay }, (_, i) => {
      const day = i + 1;
      return {
        day: `${day}/${m + 1}`,
        revenue: map.get(day) ?? 0,
        min: minDaily,
        expected: expectedDaily,
      };
    });
    const todayRevenue = isThisMonth ? (map.get(now.getDate()) ?? 0) : 0;
    const total = chart.reduce((s, c) => s + c.revenue, 0);
    const hitExpected = expectedDaily > 0 ? chart.filter((c) => c.revenue >= expectedDaily).length : 0;
    const hitMin = minDaily > 0 ? chart.filter((c) => c.revenue >= minDaily).length : 0;
    const belowMin = minDaily > 0 ? chart.filter((c) => c.revenue < minDaily).length : 0;
    const avg = todayDay > 0 ? total / todayDay : 0;
    // Tiến độ tháng: đã đạt bao nhiêu %, còn thiếu bao nhiêu, và những ngày còn lại
    // cần bán trung bình bao nhiêu mỗi ngày để kịp mục tiêu.
    const daysLeft = isThisMonth ? Math.max(0, daysInMonth - todayDay) : 0;
    const remain = Math.max(0, monthlyTarget - total);
    const pace = daysLeft > 0 ? remain / daysLeft : remain;
    const progress = monthlyTarget > 0 ? Math.min(100, Math.round((total / monthlyTarget) * 100)) : 0;
    // Theo nhịp hiện tại thì hết tháng sẽ được bao nhiêu (dự phóng).
    const projected = todayDay > 0 ? (total / todayDay) * daysInMonth : 0;
    return {
      chart, todayRevenue, total, hitExpected, hitMin, belowMin, avg, todayDay,
      daysInMonth, daysLeft, remain, pace, progress, projected,
      isThisMonth, label: `Tháng ${m + 1}/${y}`,
    };
  }, [orders, minDaily, expectedDaily, monthlyTarget, monthOffset]);

  /** 12 tháng gần nhất: doanh thu thực vs mục tiêu tháng. */
  const monthsChart = useMemo(() => {
    const map = monthlyRevenue(orders);
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return {
        month: `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`,
        revenue: map.get(k) ?? 0,
        target: monthlyTarget,
      };
    });
  }, [orders, monthlyTarget]);

  const configured = minDaily > 0 || expectedDaily > 0 || monthlyTarget > 0;
  const todayVsMin = stats.todayRevenue - minDaily;
  const todayVsExp = stats.todayRevenue - expectedDaily;

  return (
    <Box layoutClassName="flex h-full flex-col space-y-4">
      {/* Header */}
      <Box layoutClassName="flex flex-wrap items-center justify-between gap-3">
        <Box layoutClassName="flex items-center gap-2.5">
          <Box layoutClassName="flex h-9 w-9 items-center justify-center rounded-xl" backgroundClassName="bg-primary-100 dark:bg-primary-900/30">
            <Target className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </Box>
          <Box>
            <Heading level={1} textClassName="text-lg font-bold text-slate-900 dark:text-white">Mục tiêu doanh thu</Heading>
            <Typography as="p" size="xs" variant="muted">Đặt mục tiêu cả tháng + mức mỗi ngày, theo dõi tiến độ thực tế.</Typography>
          </Box>
        </Box>

        {/* Chọn tháng xem lại — mặc định tháng này, lùi tối đa 11 tháng */}
        <Box layoutClassName="flex items-center gap-1">
          <Button
            type="button"
            onClick={() => setMonthOffset((v) => Math.max(-11, v - 1))}
            variant="ghost"
            sizeClassName="px-2 py-1.5"
            roundedClassName="rounded-lg"
            backgroundClassName="bg-white dark:bg-slate-800"
            borderClassName="border border-slate-200 dark:border-slate-600"
            textClassName="text-slate-600 dark:text-slate-300"
            layoutClassName="inline-flex items-center"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Typography size="sm" layoutClassName="min-w-[7.5rem] text-center font-semibold tabular-nums" textClassName="text-slate-800 dark:text-slate-100">
            {stats.label}
          </Typography>
          <Button
            type="button"
            onClick={() => setMonthOffset((v) => Math.min(0, v + 1))}
            disabled={monthOffset >= 0}
            variant="ghost"
            sizeClassName="px-2 py-1.5"
            roundedClassName="rounded-lg"
            backgroundClassName="bg-white dark:bg-slate-800"
            borderClassName="border border-slate-200 dark:border-slate-600"
            textClassName="text-slate-600 dark:text-slate-300"
            layoutClassName="inline-flex items-center"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Box>
      </Box>

      {/* Cài đặt mục tiêu ngày */}
      <Card padding="md" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-100 dark:border-slate-700">
        <Box layoutClassName="mb-3 flex items-center justify-between">
          <Typography size="xs" variant="muted" layoutClassName="font-semibold uppercase tracking-wide">Mục tiêu mỗi ngày</Typography>
          {!editing ? (
            <Button type="button" onClick={startEdit} variant="ghost" leftIcon={<Pencil />} iconClassName="inline-flex shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5" sizeClassName="px-2.5 py-1 text-xs" roundedClassName="rounded-md" backgroundClassName="bg-slate-100 dark:bg-slate-700/50" textClassName="font-medium text-slate-600 dark:text-slate-300" layoutClassName="inline-flex items-center gap-1">Sửa</Button>
          ) : null}
        </Box>
        {editing ? (
          <Box layoutClassName="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Box layoutClassName="space-y-1.5 sm:col-span-2">
              <Label className="mb-0">Mục tiêu cả tháng (VND)</Label>
              <Box layoutClassName="flex gap-2">
                <Input type="number" value={draftMonth} onChange={(e) => setDraftMonth(e.target.value)} placeholder="vd 40.000.000" fullWidth />
                <Button type="button" onClick={suggestDailyFromMonth} variant="secondary" sizeClassName="shrink-0 px-3 py-2 text-xs" roundedClassName="rounded-lg" borderClassName="border border-slate-200 dark:border-slate-600" backgroundClassName="bg-white dark:bg-slate-800" textClassName="text-slate-600 dark:text-slate-300" title="Chia mục tiêu tháng cho số ngày → điền vào ô kỳ vọng/ngày">
                  Chia theo ngày
                </Button>
              </Box>
            </Box>
            <Box layoutClassName="space-y-1.5">
              <Label className="mb-0">Tối thiểu / ngày (VND)</Label>
              <Input type="number" value={draftMin} onChange={(e) => setDraftMin(e.target.value)} placeholder="vd 1.000.000" fullWidth />
            </Box>
            <Box layoutClassName="space-y-1.5">
              <Label className="mb-0">Kỳ vọng / ngày (VND)</Label>
              <Input type="number" value={draftExp} onChange={(e) => setDraftExp(e.target.value)} placeholder="vd 2.500.000" fullWidth />
            </Box>
            <Box layoutClassName="flex gap-2 sm:col-span-2">
              <Button type="button" onClick={() => void save()} disabled={saving} variant="primary" leftIcon={<Check />} iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4" sizeClassName="px-3.5 py-2 text-sm" roundedClassName="rounded-lg" backgroundClassName="bg-primary-600" hoverClassName="hover:bg-primary-700" textClassName="font-medium text-white" layoutClassName="inline-flex items-center gap-1.5" disableVariantHover>Lưu</Button>
              <Button type="button" onClick={() => setEditing(false)} variant="secondary" leftIcon={<X />} iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4" sizeClassName="px-3.5 py-2 text-sm" roundedClassName="rounded-lg" borderClassName="border border-slate-200 dark:border-slate-600" backgroundClassName="bg-white dark:bg-slate-800" textClassName="text-slate-600 dark:text-slate-300" layoutClassName="inline-flex items-center gap-1.5">Huỷ</Button>
            </Box>
          </Box>
        ) : (
          <Box layoutClassName="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Box layoutClassName="flex items-center justify-between rounded-lg px-3 py-2.5 sm:col-span-2" backgroundClassName="bg-primary-50 dark:bg-primary-900/15">
              <Typography size="sm" textClassName="text-primary-700 dark:text-primary-300">Mục tiêu cả tháng</Typography>
              <Typography size="sm" layoutClassName="font-bold" textClassName="text-primary-700 dark:text-primary-300">{monthlyTarget > 0 ? formatVND(monthlyTarget) : '—'}</Typography>
            </Box>
            <Box layoutClassName="flex items-center justify-between rounded-lg px-3 py-2.5" backgroundClassName="bg-rose-50 dark:bg-rose-900/15">
              <Typography size="sm" textClassName="text-rose-700 dark:text-rose-300">Tối thiểu / ngày</Typography>
              <Typography size="sm" layoutClassName="font-bold" textClassName="text-rose-700 dark:text-rose-300">{minDaily > 0 ? formatVND(minDaily) : '—'}</Typography>
            </Box>
            <Box layoutClassName="flex items-center justify-between rounded-lg px-3 py-2.5" backgroundClassName="bg-emerald-50 dark:bg-emerald-900/15">
              <Typography size="sm" textClassName="text-emerald-700 dark:text-emerald-300">Kỳ vọng / ngày</Typography>
              <Typography size="sm" layoutClassName="font-bold" textClassName="text-emerald-700 dark:text-emerald-300">{expectedDaily > 0 ? formatVND(expectedDaily) : '—'}</Typography>
            </Box>
          </Box>
        )}
      </Card>

      {!configured ? (
        <Card padding="md" backgroundClassName="bg-amber-50 dark:bg-amber-900/15" borderClassName="border-amber-200 dark:border-amber-800">
          <Typography size="sm" textClassName="text-amber-700 dark:text-amber-300">Chưa đặt mục tiêu — bấm "Sửa" để nhập mục tiêu cả tháng và mức tối thiểu &amp; kỳ vọng mỗi ngày.</Typography>
        </Card>
      ) : null}

      {/* Tiến độ THÁNG (chỉ hiện khi đã đặt mục tiêu tháng) */}
      {monthlyTarget > 0 ? (
        <Card padding="md" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-100 dark:border-slate-700">
          <Box layoutClassName="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <Typography size="xs" variant="muted" layoutClassName="font-semibold uppercase tracking-wide">Tiến độ {stats.label}</Typography>
            <Typography size="sm" textClassName="text-slate-600 dark:text-slate-300">
              {formatVND(stats.total)} / <b>{formatVND(monthlyTarget)}</b> · {stats.progress}%
            </Typography>
          </Box>

          {/* Thanh tiến độ: xanh khi đã đạt, hổ phách khi còn thiếu */}
          <Box layoutClassName="h-2.5 w-full overflow-hidden" backgroundClassName="bg-slate-100 dark:bg-slate-700" roundedClassName="rounded-full">
            <Box
              layoutClassName="h-full"
              style={{ width: `${stats.progress}%` }}
              backgroundClassName={stats.progress >= 100 ? 'bg-emerald-500' : 'bg-primary-500'}
              roundedClassName="rounded-full"
            />
          </Box>

          <Box layoutClassName="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Box layoutClassName="rounded-lg px-3 py-2" backgroundClassName="bg-slate-50 dark:bg-slate-700/30">
              <Typography size="xs" variant="muted">Còn thiếu</Typography>
              <Typography size="sm" layoutClassName="font-bold tabular-nums" textClassName={stats.remain > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                {stats.remain > 0 ? formatVND(stats.remain) : 'Đã đạt'}
              </Typography>
            </Box>
            <Box layoutClassName="rounded-lg px-3 py-2" backgroundClassName="bg-slate-50 dark:bg-slate-700/30">
              <Typography size="xs" variant="muted">Còn lại {stats.daysLeft} ngày · cần/ngày</Typography>
              <Typography size="sm" layoutClassName="font-bold tabular-nums" textClassName="text-slate-800 dark:text-slate-100">
                {stats.remain > 0 ? formatVND(stats.pace) : '—'}
              </Typography>
            </Box>
            <Box layoutClassName="rounded-lg px-3 py-2" backgroundClassName="bg-slate-50 dark:bg-slate-700/30">
              <Typography size="xs" variant="muted">Theo nhịp này hết tháng</Typography>
              <Typography size="sm" layoutClassName="font-bold tabular-nums" textClassName={stats.projected >= monthlyTarget ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {formatVND(stats.projected)}
              </Typography>
            </Box>
            <Box layoutClassName="rounded-lg px-3 py-2" backgroundClassName="bg-slate-50 dark:bg-slate-700/30">
              <Typography size="xs" variant="muted">TB / ngày cần cả tháng</Typography>
              <Typography size="sm" layoutClassName="font-bold tabular-nums" textClassName="text-slate-800 dark:text-slate-100">
                {formatVND(monthlyTarget / stats.daysInMonth)}
              </Typography>
            </Box>
          </Box>
        </Card>
      ) : null}

      {/* KPI hôm nay — chỉ hiện khi đang xem tháng này */}
      {stats.isThisMonth ? (
      <Box layoutClassName="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Doanh thu hôm nay"
          value={formatVND(stats.todayRevenue)}
          valueSize="xl"
          icon={TrendingUp}
          iconWrapClassName="bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400"
        />
        <MetricCard
          label="So với tối thiểu"
          value={`${todayVsMin >= 0 ? '+' : '−'}${formatVND(Math.abs(todayVsMin))}`}
          valueClassName={todayVsMin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
          valueSize="xl"
          icon={Gauge}
          iconWrapClassName="bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
        />
        <MetricCard
          label="So với kỳ vọng"
          value={`${todayVsExp >= 0 ? '+' : '−'}${formatVND(Math.abs(todayVsExp))}`}
          valueClassName={todayVsExp >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
          valueSize="xl"
          icon={Target}
          iconWrapClassName="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
        />
        <MetricCard
          label="TB / ngày (tháng này)"
          value={formatVND(stats.avg)}
          valueSize="xl"
          icon={CalendarCheck}
          iconWrapClassName="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
        />
      </Box>
      ) : null}

      {/* Biểu đồ doanh thu theo ngày + 2 đường min/kỳ vọng */}
      <Card padding="md" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-100 dark:border-slate-700">
        <Box layoutClassName="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary-500" />
          <Typography size="xs" variant="muted" layoutClassName="font-semibold uppercase tracking-wide">Doanh thu theo ngày — {stats.label}</Typography>
        </Box>
        {stats.chart.length === 0 ? (
          <Box layoutClassName="flex h-64 items-center justify-center">
            <Typography size="xs" variant="muted">Chưa có dữ liệu</Typography>
          </Box>
        ) : (
          <TrendChart
            data={stats.chart}
            xKey="day"
            series={[
              { key: 'revenue', label: 'Doanh thu', color: '#3b82f6' },
              { key: 'min', label: 'Tối thiểu', color: '#ef4444' },
              { key: 'expected', label: 'Kỳ vọng', color: '#16a34a' },
            ]}
            type="line"
            formatValue={formatVND}
            heightClassName="h-64 sm:h-72"
          />
        )}
      </Card>

      {/* 12 tháng gần nhất — nhìn cả năm, so với mục tiêu tháng */}
      <Card padding="md" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-100 dark:border-slate-700">
        <Box layoutClassName="mb-3 flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-primary-500" />
          <Typography size="xs" variant="muted" layoutClassName="font-semibold uppercase tracking-wide">Doanh thu 12 tháng gần nhất</Typography>
        </Box>
        <TrendChart
          data={monthsChart}
          xKey="month"
          series={
            monthlyTarget > 0
              ? [
                  { key: 'revenue', label: 'Doanh thu', color: '#3b82f6' },
                  { key: 'target', label: 'Mục tiêu tháng', color: '#16a34a' },
                ]
              : [{ key: 'revenue', label: 'Doanh thu', color: '#3b82f6' }]
          }
          type="area"
          formatValue={formatVND}
          heightClassName="h-56 sm:h-64"
        />
      </Card>

      {/* Thống kê kỳ */}
      <Box layoutClassName="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Ngày đạt kỳ vọng" value={`${stats.hitExpected}/${stats.todayDay}`} valueSize="xl" icon={Target} iconWrapClassName="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" />
        <MetricCard label="Ngày đạt tối thiểu" value={`${stats.hitMin}/${stats.todayDay}`} valueSize="xl" icon={Gauge} iconWrapClassName="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" />
        <MetricCard label="Ngày dưới tối thiểu" value={`${stats.belowMin}/${stats.todayDay}`} valueClassName={stats.belowMin > 0 ? 'text-rose-600 dark:text-rose-400' : undefined} valueSize="xl" icon={X} iconWrapClassName="bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400" />
        <MetricCard label={`Tổng ${stats.label}`} value={formatVND(stats.total)} valueSize="xl" icon={TrendingUp} iconWrapClassName="bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400" />
      </Box>
    </Box>
  );
};

export default GoalsPage;
