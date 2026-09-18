import React from 'react';
import { TrendingUp, TrendingDown, Scale, ArrowRightLeft, CheckCircle2, Repeat } from 'lucide-react';
import { LedgerSummary } from '@/types';
import { formatVND } from '@/utils/format/currencyUtil';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';

interface LedgerSummaryBarProps {
  summary: LedgerSummary;
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconWrapClassName: string;
  valueClassName: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon, iconWrapClassName, valueClassName }) => (
  <Card
    padding="none"
    layoutClassName="p-4"
    backgroundClassName="bg-white dark:bg-slate-800"
    borderClassName="border-slate-100 dark:border-slate-700"
  >
    <Box layoutClassName="flex items-start justify-between gap-2">
      <Box layoutClassName="min-w-0">
        <Typography as="p" size="xs" variant="muted" layoutClassName="mb-1 font-medium uppercase tracking-wide">
          {label}
        </Typography>
        <Typography as="p" layoutClassName="truncate text-lg font-bold sm:text-xl" textClassName={valueClassName}>
          {value}
        </Typography>
        {sub && (
          <Typography as="p" size="xs" variant="muted" layoutClassName="mt-0.5 truncate">
            {sub}
          </Typography>
        )}
      </Box>
      <Box layoutClassName={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconWrapClassName}`}>
        {icon}
      </Box>
    </Box>
  </Card>
);

/**
 * Thanh tổng kết kỳ (server tính): thu · chi · luân chuyển nội bộ · số dư · số GD · % đối soát.
 * 100: tiền dồn cuối ngày TK HKD → TK cá nhân nằm TRONG tổng thu/chi (đó là dòng tiền thật
 * trên bank) nên tách riêng 1 thẻ + ghi "thực" ở dòng phụ, khỏi đọc lẫn thành doanh thu.
 */
const LedgerSummaryBar: React.FC<LedgerSummaryBarProps> = ({ summary }) => {
  const netPositive = summary.net >= 0;
  const sweep = summary.sweepIn + summary.sweepOut;
  return (
    <Box layoutClassName="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard
        label="Tổng thu"
        value={`+${formatVND(summary.totalIn)}`}
        sub={
          summary.sweepIn > 0
            ? `${summary.inCount} GD vào · thực +${formatVND(summary.externalIn)}`
            : `${summary.inCount} GD vào`
        }
        icon={<TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
        iconWrapClassName="bg-emerald-50 dark:bg-emerald-900/20"
        valueClassName="text-emerald-600 dark:text-emerald-400"
      />
      <StatCard
        label="Tổng chi"
        value={`−${formatVND(summary.totalOut)}`}
        sub={
          summary.sweepOut > 0
            ? `${summary.outCount} GD ra · thực −${formatVND(summary.externalOut)}`
            : `${summary.outCount} GD ra`
        }
        icon={<TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
        iconWrapClassName="bg-rose-50 dark:bg-rose-900/20"
        valueClassName="text-rose-600 dark:text-rose-400"
      />
      <StatCard
        label="Nội bộ (dồn TK)"
        value={formatVND(sweep)}
        sub="TK HKD → TK cá nhân"
        icon={<Repeat className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
        iconWrapClassName="bg-blue-50 dark:bg-blue-900/20"
        valueClassName="text-blue-600 dark:text-blue-400"
      />
      <StatCard
        label="Số dư ròng"
        value={`${netPositive ? '+' : '−'}${formatVND(Math.abs(summary.net))}`}
        sub={
          sweep > 0
            ? `thu − chi · thực ${summary.netExternal >= 0 ? '+' : '−'}${formatVND(Math.abs(summary.netExternal))}`
            : 'thu − chi'
        }
        icon={<Scale className="h-4 w-4 text-primary-600 dark:text-primary-400" />}
        iconWrapClassName="bg-primary-50 dark:bg-primary-900/20"
        valueClassName={netPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
      />
      <StatCard
        label="Số giao dịch"
        value={String(summary.count)}
        sub="trong kỳ"
        icon={<ArrowRightLeft className="h-4 w-4 text-slate-500 dark:text-slate-400" />}
        iconWrapClassName="bg-slate-100 dark:bg-slate-700/50"
        valueClassName="text-slate-900 dark:text-white"
      />
      <StatCard
        label="Đã đối soát"
        value={`${summary.reconciledPct}%`}
        sub={`${summary.reconciledCount}/${summary.count} · còn ${summary.unreconciledCount}`}
        icon={<CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
        iconWrapClassName="bg-blue-50 dark:bg-blue-900/20"
        valueClassName={summary.unreconciledCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}
      />
    </Box>
  );
};

export default LedgerSummaryBar;
