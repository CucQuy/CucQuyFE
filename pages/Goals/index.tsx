import React, { useMemo } from 'react';
import { Target, TrendingUp, CalendarCheck, Gauge, X } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { formatVND } from '@/utils/format/currencyUtil';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';
import { MetricCard, TrendChart } from '@/components/ui/stats';
import { dailyRevenueOfMonth, useRevenueGoals } from './goalsShared';

/**
 * Mục tiêu ĐANG DIỄN RA — chỉ tháng hiện tại: hôm nay bán được bao nhiêu, tháng này
 * đã đi được bao xa, còn phải bán bao nhiêu mỗi ngày cho kịp.
 * Xem tháng cũ ở màn "Tổng quan"; đặt mục tiêu ở màn "Cài đặt".
 */
const GoalsPage: React.FC = () => {
  const { orders } = useOrders();
  const { goals } = useRevenueGoals();
  const minDaily = goals.dailyMin;
  const expectedDaily = goals.dailyExpected;
  const monthlyTarget = goals.monthlyTarget;

  const stats = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const todayDay = now.getDate();
    const map = dailyRevenueOfMonth(orders, y, m);
    // Chỉ vẽ tới hôm nay để đường không rơi về 0 ở những ngày chưa tới.
    const chart = Array.from({ length: todayDay }, (_, i) => {
      const day = i + 1;
      return {
        day: `${day}/${m + 1}`,
        revenue: map.get(day) ?? 0,
        min: minDaily,
        expected: expectedDaily,
      };
    });
    const todayRevenue = map.get(todayDay) ?? 0;
    const total = chart.reduce((s, c) => s + c.revenue, 0);
    const hitExpected = expectedDaily > 0 ? chart.filter((c) => c.revenue >= expectedDaily).length : 0;
    const hitMin = minDaily > 0 ? chart.filter((c) => c.revenue >= minDaily).length : 0;
    const belowMin = minDaily > 0 ? chart.filter((c) => c.revenue < minDaily).length : 0;
    const avg = todayDay > 0 ? total / todayDay : 0;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysLeft = Math.max(0, daysInMonth - todayDay);
    const remain = Math.max(0, monthlyTarget - total);
    const pace = daysLeft > 0 ? remain / daysLeft : remain;
    const progress = monthlyTarget > 0 ? Math.min(100, Math.round((total / monthlyTarget) * 100)) : 0;
    const projected = todayDay > 0 ? (total / todayDay) * daysInMonth : 0;
    return {
      chart, todayRevenue, total, hitExpected, hitMin, belowMin, avg, todayDay,
      daysInMonth, daysLeft, remain, pace, progress, projected,
      label: `Tháng ${m + 1}/${y}`,
    };
  }, [orders, minDaily, expectedDaily, monthlyTarget]);

  const configured = minDaily > 0 || expectedDaily > 0 || monthlyTarget > 0;
  const todayVsMin = stats.todayRevenue - minDaily;
  const todayVsExp = stats.todayRevenue - expectedDaily;

  return (
    <Box layoutClassName="flex h-full flex-col space-y-4">
      <Box layoutClassName="flex flex-wrap items-center justify-between gap-3">
        <Box layoutClassName="flex items-center gap-2.5">
          <Box layoutClassName="flex h-9 w-9 items-center justify-center rounded-xl" backgroundClassName="bg-primary-100 dark:bg-primary-900/30">
            <Target className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </Box>
          <Box>
            <Heading level={1} textClassName="text-lg font-bold text-slate-900 dark:text-white">Đang diễn ra — {stats.label}</Heading>
            <Typography as="p" size="xs" variant="muted">Hôm nay bán được bao nhiêu, tháng này còn cách mục tiêu bao xa.</Typography>
          </Box>
        </Box>
      </Box>

      {!configured ? (
        <Card padding="md" backgroundClassName="bg-amber-50 dark:bg-amber-900/15" borderClassName="border-amber-200 dark:border-amber-800">
          <Typography size="sm" textClassName="text-amber-700 dark:text-amber-300">Chưa đặt mục tiêu — vào màn "Cài đặt" trong nhóm Mục tiêu để nhập.</Typography>
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


      {/* KPI hôm nay */}
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
