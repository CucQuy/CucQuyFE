import React, { useMemo, useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, Target, TrendingUp } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { formatVND } from '@/utils/format/currencyUtil';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';
import Badge from '@/components/ui/Badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/Table';
import { MetricCard, TrendChart } from '@/components/ui/stats';
import { dailyRevenueOfMonth, monthKey, monthlyRevenue, useRevenueGoals } from './goalsShared';

/** Số tháng nhìn lại trên biểu đồ + bảng. */
const MONTHS_BACK = 12;

/**
 * Tổng quan mục tiêu: nhìn cả năm và xem lại từng tháng đã qua.
 * Tháng đang chạy để ở màn "Đang diễn ra" — ở đây tập trung so sánh giữa các tháng.
 */
const GoalsOverviewPage: React.FC = () => {
  const { orders } = useOrders();
  const { goals } = useRevenueGoals();
  /** 0 = tháng này, -1 = tháng trước… */
  const [monthOffset, setMonthOffset] = useState(-1);

  const byMonth = useMemo(() => monthlyRevenue(orders), [orders]);

  /** 12 tháng gần nhất: doanh thu thực vs mục tiêu tháng. */
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: MONTHS_BACK }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK - 1) + i, 1);
      const revenue = byMonth.get(monthKey(d)) ?? 0;
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return {
        date: d,
        month: `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`,
        label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`,
        revenue,
        target: goals.monthlyTarget,
        avgPerDay: Math.round(revenue / daysInMonth),
        hit: goals.monthlyTarget > 0 && revenue >= goals.monthlyTarget,
      };
    });
  }, [byMonth, goals.monthlyTarget]);

  /** Chi tiết tháng đang chọn (mặc định tháng trước — tháng đã trọn vẹn số liệu). */
  const detail = useMemo(() => {
    const now = new Date();
    const cur = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const isThisMonth = monthOffset === 0;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const upto = isThisMonth ? now.getDate() : daysInMonth;
    const map = dailyRevenueOfMonth(orders, y, m);

    const chart = Array.from({ length: upto }, (_, i) => ({
      day: `${i + 1}/${m + 1}`,
      revenue: map.get(i + 1) ?? 0,
      min: goals.dailyMin,
      expected: goals.dailyExpected,
    }));
    const total = chart.reduce((s, c) => s + c.revenue, 0);
    const daysSold = chart.filter((c) => c.revenue > 0).length;
    return {
      chart,
      total,
      daysSold,
      daysInMonth,
      label: `Tháng ${m + 1}/${y}`,
      avgAll: Math.round(total / daysInMonth),
      avgSold: daysSold > 0 ? Math.round(total / daysSold) : 0,
      hitExpected: goals.dailyExpected > 0 ? chart.filter((c) => c.revenue >= goals.dailyExpected).length : 0,
      belowMin: goals.dailyMin > 0 ? chart.filter((c) => c.revenue < goals.dailyMin).length : 0,
    };
  }, [orders, monthOffset, goals.dailyMin, goals.dailyExpected]);

  const bestMonth = useMemo(
    () => months.reduce((a, b) => (b.revenue > a.revenue ? b : a), months[0]),
    [months],
  );

  return (
    <Box layoutClassName="flex h-full flex-col space-y-4">
      <Box layoutClassName="flex flex-wrap items-center justify-between gap-3">
        <Box layoutClassName="flex items-center gap-2.5">
          <Box
            layoutClassName="flex h-9 w-9 items-center justify-center rounded-xl"
            backgroundClassName="bg-primary-100 dark:bg-primary-900/30"
          >
            <TrendingUp className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </Box>
          <Box>
            <Heading level={1} textClassName="text-lg font-bold text-slate-900 dark:text-white">
              Tổng quan mục tiêu
            </Heading>
            <Typography as="p" size="xs" variant="muted">
              Doanh thu 12 tháng gần nhất và chi tiết từng tháng đã qua.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Biểu đồ 12 tháng */}
      <Card padding="md" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-100 dark:border-slate-700">
        <Box layoutClassName="mb-3 flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-primary-500" />
          <Typography size="xs" variant="muted" layoutClassName="font-semibold uppercase tracking-wide">
            Doanh thu {MONTHS_BACK} tháng gần nhất
          </Typography>
        </Box>
        <TrendChart
          data={months}
          xKey="month"
          series={
            goals.monthlyTarget > 0
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

      {/* Bảng so sánh các tháng */}
      <Card
        padding="none"
        layoutClassName="overflow-hidden"
        backgroundClassName="bg-white dark:bg-slate-800"
        borderClassName="border-slate-100 dark:border-slate-700"
      >
        <Box layoutClassName="overflow-x-auto">
          <Table>
            <TableHead backgroundClassName="bg-slate-50 dark:bg-slate-700/40">
              <TableRow>
                <TableHeaderCell layoutClassName="px-4 py-3">Tháng</TableHeaderCell>
                <TableHeaderCell layoutClassName="px-4 py-3 text-right">Doanh thu</TableHeaderCell>
                <TableHeaderCell layoutClassName="px-4 py-3 text-right">TB / ngày</TableHeaderCell>
                <TableHeaderCell layoutClassName="px-4 py-3 text-center">So mục tiêu</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...months].reverse().map((r) => (
                <TableRow
                  key={r.month}
                  borderClassName="border-b border-slate-100 last:border-0 dark:border-slate-700/60"
                >
                  <TableCell layoutClassName="whitespace-nowrap px-4 py-2.5" textClassName="text-sm text-slate-800 dark:text-slate-100">
                    {r.label}
                  </TableCell>
                  <TableCell layoutClassName="whitespace-nowrap px-4 py-2.5 text-right tabular-nums" textClassName="text-sm text-slate-800 dark:text-slate-100">
                    {r.revenue > 0 ? formatVND(r.revenue) : '—'}
                  </TableCell>
                  <TableCell layoutClassName="whitespace-nowrap px-4 py-2.5 text-right tabular-nums" textClassName="text-sm text-slate-600 dark:text-slate-300">
                    {r.revenue > 0 ? formatVND(r.avgPerDay) : '—'}
                  </TableCell>
                  <TableCell layoutClassName="whitespace-nowrap px-4 py-2.5 text-center">
                    {goals.monthlyTarget <= 0 || r.revenue === 0 ? (
                      <Typography as="span" size="xs" variant="muted">—</Typography>
                    ) : r.hit ? (
                      <Badge
                        size="sm"
                        backgroundClassName="bg-emerald-50 dark:bg-emerald-900/20"
                        textClassName="text-emerald-700 dark:text-emerald-300"
                      >
                        đạt {Math.round((r.revenue / goals.monthlyTarget) * 100)}%
                      </Badge>
                    ) : (
                      <Badge
                        size="sm"
                        backgroundClassName="bg-amber-50 dark:bg-amber-900/20"
                        textClassName="text-amber-700 dark:text-amber-300"
                      >
                        {Math.round((r.revenue / goals.monthlyTarget) * 100)}%
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Card>

      {/* Xem lại chi tiết 1 tháng */}
      <Card padding="md" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-100 dark:border-slate-700">
        <Box layoutClassName="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Typography size="xs" variant="muted" layoutClassName="font-semibold uppercase tracking-wide">
            Chi tiết theo ngày
          </Typography>
          <Box layoutClassName="flex items-center gap-1">
            <Button
              type="button"
              onClick={() => setMonthOffset((v) => Math.max(-(MONTHS_BACK - 1), v - 1))}
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
            <Typography
              size="sm"
              layoutClassName="min-w-[7.5rem] text-center font-semibold tabular-nums"
              textClassName="text-slate-800 dark:text-slate-100"
            >
              {detail.label}
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

        <Box layoutClassName="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Tổng tháng" value={formatVND(detail.total)} valueSize="lg" icon={TrendingUp} iconWrapClassName="bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400" />
          <MetricCard label={`TB / ngày (${detail.daysInMonth} ngày)`} value={formatVND(detail.avgAll)} valueSize="lg" icon={CalendarCheck} iconWrapClassName="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" />
          <MetricCard label={`TB / ngày có bán (${detail.daysSold})`} value={formatVND(detail.avgSold)} valueSize="lg" icon={CalendarCheck} iconWrapClassName="bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400" />
          <MetricCard label="Ngày đạt kỳ vọng" value={`${detail.hitExpected}/${detail.chart.length}`} valueSize="lg" icon={Target} iconWrapClassName="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" />
        </Box>

        {detail.chart.length === 0 ? (
          <Box layoutClassName="flex h-48 items-center justify-center">
            <Typography size="xs" variant="muted">Chưa có dữ liệu</Typography>
          </Box>
        ) : (
          <TrendChart
            data={detail.chart}
            xKey="day"
            series={[
              { key: 'revenue', label: 'Doanh thu', color: '#3b82f6' },
              { key: 'min', label: 'Tối thiểu', color: '#ef4444' },
              { key: 'expected', label: 'Kỳ vọng', color: '#16a34a' },
            ]}
            type="line"
            formatValue={formatVND}
            heightClassName="h-56 sm:h-64"
          />
        )}
      </Card>

      {bestMonth && bestMonth.revenue > 0 ? (
        <Typography size="xs" variant="muted">
          Tháng cao nhất trong {MONTHS_BACK} tháng: <b>{bestMonth.label}</b> — {formatVND(bestMonth.revenue)}
        </Typography>
      ) : null}
    </Box>
  );
};

export default GoalsOverviewPage;
