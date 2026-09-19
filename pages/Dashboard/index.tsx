import React, { useState, useMemo, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Order } from '@/types';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOrders } from '@/hooks/useOrders';
import { useRevenueReport } from '@/hooks/queries/useTransactionsQuery';
import DashboardSection from '@/pages/Dashboard/components/DashboardSection';
import DashboardRangeControl from '@/pages/Dashboard/components/DashboardRangeControl';
import DashboardAlerts from '@/pages/Dashboard/components/DashboardAlerts';
import DashboardToday from '@/pages/Dashboard/components/DashboardToday';
import DashboardKpiCockpit from '@/pages/Dashboard/components/DashboardKpiCockpit';
import DashboardChart from '@/pages/Dashboard/components/DashboardChart';
import DashboardOrderStatus from '@/pages/Dashboard/components/DashboardOrderStatus';
import DashboardPaymentMethods from '@/pages/Dashboard/components/DashboardPaymentMethods';
import DashboardTopProducts from '@/pages/Dashboard/components/DashboardTopProducts';
import DashboardTopCustomers from '@/pages/Dashboard/components/DashboardTopCustomers';
import DashboardRecentOrders from '@/pages/Dashboard/components/DashboardRecentOrders';
import DashboardRecentTransactions from '@/pages/Dashboard/components/DashboardRecentTransactions';
import DashboardRecentUsers from '@/pages/Dashboard/components/DashboardRecentUsers';

type TimeRange = 'week' | 'month' | 'year';

/** Ngày LOCAL dạng yyyy-mm-dd — tránh toISOString() lệch về hôm trước do UTC. */
const toLocalYMD = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const DashboardPage: React.FC = () => {
  const { orders, loading, refreshOrders } = useOrders();
  const { language } = useLanguage();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  const isDarkMode = document.documentElement.classList.contains('dark');

  useEffect(() => {
    setReferenceDate(new Date());
  }, [timeRange]);

  const { startDate, endDate, prevStartDate, prevEndDate } = useMemo(() => {
    const end = new Date(referenceDate);
    end.setHours(23, 59, 59, 999);

    const start = new Date(referenceDate);
    start.setHours(0, 0, 0, 0);

    const prevEnd = new Date(end);
    const prevStart = new Date(start);

    if (timeRange === 'week') {
      start.setDate(end.getDate() - 6);
      prevEnd.setDate(end.getDate() - 7);
      prevStart.setDate(start.getDate() - 7);
    } else if (timeRange === 'month') {
      // Set to first day of month
      start.setDate(1);
      // For end date, go to next month day 0
      const nextMonth = new Date(start);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(0);
      end.setTime(nextMonth.getTime());
      end.setHours(23, 59, 59, 999);

      // Previous month
      prevStart.setTime(start.getTime());
      prevStart.setMonth(prevStart.getMonth() - 1);

      prevEnd.setTime(prevStart.getTime());
      prevEnd.setMonth(prevEnd.getMonth() + 1);
      prevEnd.setDate(0);
      prevEnd.setHours(23, 59, 59, 999);
    } else if (timeRange === 'year') {
      start.setMonth(0, 1);
      end.setMonth(11, 31);

      prevStart.setTime(start.getTime());
      prevStart.setFullYear(prevStart.getFullYear() - 1);

      prevEnd.setTime(end.getTime());
      prevEnd.setFullYear(prevEnd.getFullYear() - 1);
    }

    return { startDate: start, endDate: end, prevStartDate: prevStart, prevEndDate: prevEnd };
  }, [referenceDate, timeRange]);

  const { currentRangeLabel, prevRangeLabel } = useMemo(() => {
    const locale = language === 'vi' ? 'vi-VN' : 'en-US';

    const fmt = (s: Date, e: Date) => {
      if (timeRange === 'year') return s.toLocaleDateString(locale, { year: 'numeric' });
      if (timeRange === 'month') return s.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

      const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      return `${s.toLocaleDateString(locale, opts)} - ${e.toLocaleDateString(locale, opts)}`;
    };

    return {
      currentRangeLabel: fmt(startDate, endDate),
      prevRangeLabel: fmt(prevStartDate, prevEndDate)
    };
  }, [startDate, endDate, prevStartDate, prevEndDate, language, timeRange]);

  const handlePrev = () => {
    setReferenceDate(prev => {
      const d = new Date(prev);
      if (timeRange === 'week') d.setDate(d.getDate() - 7);
      else if (timeRange === 'month') d.setMonth(d.getMonth() - 1);
      else if (timeRange === 'year') d.setFullYear(d.getFullYear() - 1);
      return d;
    });
  };

  const handleNext = () => {
    setReferenceDate(prev => {
      const d = new Date(prev);
      if (timeRange === 'week') d.setDate(d.getDate() + 7);
      else if (timeRange === 'month') d.setMonth(d.getMonth() + 1);
      else if (timeRange === 'year') d.setFullYear(d.getFullYear() + 1);
      return d;
    });
  };

  const isFuture = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return endDate.getTime() >= today.getTime();
  }, [endDate]);

  // Biểu đồ theo hệ P&L (khớp Tổng quan/KPI): Doanh thu / Chi phí (nhập+vận hành+khấu hao) /
  // Lợi nhuận — lấy thẳng từ revenue_report (server) để "Lợi nhuận" là LÃI KẾ TOÁN thật,
  // không còn trộn dòng tiền như trước.
  const { report: chartReport } = useRevenueReport({ from: toLocalYMD(startDate), to: toLocalYMD(endDate) });
  const chartData = useMemo(() => {
    if (!chartReport) return [];
    return chartReport.series.map((p) => ({
      name: p.label,
      revenue: p.revenue,
      cost: (p.stockIn ?? 0) + (p.opex ?? 0) + (p.depreciation ?? 0),
      profit: p.profit,
    }));
  }, [chartReport]);

  const recentOrdersForDashboard: Order[] = useMemo(
    () => [...orders].sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()),
    [orders]
  );

  return (
    <Box layoutClassName="space-y-6 animate-fade-in">
      {/* TOOLBAR — góc phải: Làm mới + bộ lọc kỳ (theo bố cục tham khảo) */}
      <Box layoutClassName="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button
          onClick={() => { void refreshOrders(); }}
          disabled={loading}
          variant="ghost"
          size="sm"
          layoutClassName="inline-flex items-center gap-2"
          sizeClassName="px-3 py-1.5"
          textClassName="text-sm font-medium text-primary-600 dark:text-primary-400"
          borderClassName="border border-primary-200 dark:border-primary-900/40"
          roundedClassName="rounded-lg"
          backgroundClassName="bg-white dark:bg-slate-800"
          hoverClassName="hover:bg-primary-50 dark:hover:bg-primary-900/20"
          stateClassName={`transition-colors ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </Button>
        <DashboardRangeControl
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          dateRangeLabel={currentRangeLabel}
          onPrev={handlePrev}
          onNext={handleNext}
          isFuture={isFuture}
        />
      </Box>

      {/* BUỒNG LÁI KPI ĐIỀU HÀNH — số lấy từ revenue_report (nhất quán với Tài chính) */}
      <DashboardKpiCockpit
        fromISO={toLocalYMD(startDate)}
        toISO={toLocalYMD(endDate)}
        prevFromISO={toLocalYMD(prevStartDate)}
        prevToISO={toLocalYMD(prevEndDate)}
        compareText={`vs ${prevRangeLabel}`}
      />

      {/* Cảnh báo cần xử lý (tự ẩn khi không có) */}
      <DashboardAlerts orders={orders} />

      {/* BÁN HÀNG — biểu đồ doanh thu (2/3) + top sản phẩm bán chạy (1/3) */}
      <Box layoutClassName="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Box layoutClassName="lg:col-span-2">
          <DashboardChart data={chartData} isDarkMode={isDarkMode} />
        </Box>
        <DashboardTopProducts orders={orders} startDate={startDate} endDate={endDate} />
      </Box>

      {/* VẬN HÀNH — trạng thái đơn, phương thức TT, hôm nay (mục tiêu chuyển sang màn /goals) */}
      <DashboardSection title="Vận hành">
        <Box layoutClassName="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DashboardOrderStatus orders={orders} startDate={startDate} endDate={endDate} isDarkMode={isDarkMode} />
          <DashboardPaymentMethods orders={orders} startDate={startDate} endDate={endDate} isDarkMode={isDarkMode} />
        </Box>
        <DashboardToday orders={orders} />
      </DashboardSection>

      {/* KHÁCH HÀNG & HOẠT ĐỘNG GẦN ĐÂY */}
      <DashboardSection title="Khách hàng & hoạt động gần đây">
        <Box layoutClassName="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DashboardTopCustomers orders={orders} startDate={startDate} endDate={endDate} />
          <DashboardRecentUsers />
        </Box>
        <Box layoutClassName="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DashboardRecentOrders orders={recentOrdersForDashboard} />
          <DashboardRecentTransactions />
        </Box>
      </DashboardSection>
    </Box>
  );
};

export default DashboardPage;
