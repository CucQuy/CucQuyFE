import React from 'react';
import { TrendingUp, ArrowDownLeft } from 'lucide-react';
import { LedgerTransaction } from '@/types';
import { expenseCategoryTag } from '@/types/transaction';
import { paymentAccountPurposeLabel } from '@/types/paymentConfig';
import { formatVND } from '@/utils/format/currencyUtil';
import Badge from '@/components/ui/Badge';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import ExpenseTag from '../ExpenseTag';
import LedgerStatusBadge from './LedgerStatusBadge';

interface LedgerMobileListProps {
  transactions: LedgerTransaction[];
  formatDate: (dateStr: string) => string;
  onRowClick?: (tr: LedgerTransaction) => void;
}

/** Danh sách sổ (mobile) — card gọn: số tiền + trạng thái + nội dung. */
const LedgerMobileList: React.FC<LedgerMobileListProps> = ({ transactions, formatDate, onRowClick }) => {
  if (!transactions.length) return null;
  return (
    <Box layoutClassName="space-y-2 lg:hidden">
      {transactions.map((tr) => {
        const out = tr.transferType === 'out';
        return (
          <Card
            key={tr.id}
            padding="none"
            layoutClassName="p-3.5"
            backgroundClassName="bg-white dark:bg-slate-800"
            borderClassName="border-slate-100 dark:border-slate-700"
            onClick={() => onRowClick?.(tr)}
            stateClassName="cursor-pointer transition-colors"
            hoverClassName="hover:bg-primary-50/40 dark:hover:bg-primary-900/10"
          >
            <Box layoutClassName="flex items-start justify-between gap-3">
              <Box layoutClassName="flex min-w-0 items-center gap-2.5">
                <Box layoutClassName={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${out ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                  {out
                    ? <ArrowDownLeft className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    : <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                </Box>
                <Box layoutClassName="min-w-0">
                  <Typography as="p" size="sm" layoutClassName="font-bold" textClassName={out ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                    {out ? '−' : '+'}{formatVND(tr.transferAmount)}
                  </Typography>
                  <Typography as="p" size="xs" variant="muted" layoutClassName="truncate">
                    {formatDate(tr.transactionDate)}
                  </Typography>
                </Box>
              </Box>
              <LedgerStatusBadge status={tr.status} needsReview={tr.needsReview} />
            </Box>
            {tr.content && (
              <Typography as="p" size="xs" layoutClassName="mt-2 line-clamp-2" textClassName="text-slate-600 dark:text-slate-300" title={tr.content}>
                {tr.content}
              </Typography>
            )}
            <Box layoutClassName="mt-2 flex flex-wrap items-center gap-2">
              {tr.orderNumber && (
                <Badge
                  size="sm"
                  layoutClassName="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold font-mono"
                  borderClassName="border border-primary-200 dark:border-primary-700"
                  backgroundClassName="bg-primary-50 dark:bg-primary-900/20"
                  textClassName="text-primary-700 dark:text-primary-300"
                >
                  {tr.orderNumber}
                </Badge>
              )}
              {out && expenseCategoryTag(tr.expenseCategory) && <ExpenseTag transaction={tr} />}
              {/* 099: TK của dòng tiền (fallback gateway khi TK chưa khai). */}
              {(tr.accountLabel || tr.gateway) && (
                <Typography as="span" size="xs" variant="muted">
                  {tr.accountLabel || tr.gateway}
                  {tr.accountPurpose ? ` · ${paymentAccountPurposeLabel(tr.accountPurpose)}` : ''}
                </Typography>
              )}
            </Box>
          </Card>
        );
      })}
    </Box>
  );
};

export default LedgerMobileList;
