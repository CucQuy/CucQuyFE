import React from 'react';
import { Calendar, Building2, TrendingUp, ArrowDownLeft } from 'lucide-react';
import { LedgerTransaction } from '@/types';
import { expenseCategoryTag } from '@/types/transaction';
import { paymentAccountKindLabel } from '@/types/paymentConfig';
import { formatVND } from '@/utils/format/currencyUtil';
import Badge from '@/components/ui/Badge';
import Box from '@/components/ui/Box';
import Typography from '@/components/ui/Typography';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table';
import ExpenseTag from '../ExpenseTag';
import LedgerStatusBadge from './LedgerStatusBadge';

interface LedgerDesktopTableProps {
  transactions: LedgerTransaction[];
  formatDate: (dateStr: string) => string;
  onRowClick?: (tr: LedgerTransaction) => void;
}

/** Bảng sổ (desktop) — cột Trạng thái thống nhất + tag danh mục / mã đơn + TÀI KHOẢN. */
const LedgerDesktopTable: React.FC<LedgerDesktopTableProps> = ({ transactions, formatDate, onRowClick }) => {
  if (!transactions.length) return null;
  return (
    <Box layoutClassName="hidden flex-1 flex-col overflow-hidden lg:flex">
      <Box layoutClassName="flex-1 overflow-x-auto">
        <Table>
          <TableHead
            layoutClassName="sticky top-0 z-10"
            backgroundClassName="bg-slate-50 dark:bg-slate-700/60"
            borderClassName="border-b border-slate-200 dark:border-slate-600"
          >
            <TableRow textClassName="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              <TableHeaderCell layoutClassName="px-5 py-3.5">Ngày GD</TableHeaderCell>
              <TableHeaderCell layoutClassName="px-5 py-3.5">Số tiền</TableHeaderCell>
              <TableHeaderCell layoutClassName="px-5 py-3.5">Trạng thái</TableHeaderCell>
              <TableHeaderCell layoutClassName="px-5 py-3.5">Nội dung</TableHeaderCell>
              <TableHeaderCell layoutClassName="px-5 py-3.5">Mã đơn / Danh mục</TableHeaderCell>
              <TableHeaderCell layoutClassName="px-5 py-3.5">Tài khoản</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map((tr, idx) => (
              <TableRow
                key={tr.id}
                onClick={() => onRowClick?.(tr)}
                backgroundClassName={idx % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-700/20'}
                hoverClassName="hover:bg-primary-50/60 dark:hover:bg-primary-900/10"
                stateClassName="group cursor-pointer transition-colors"
                borderClassName="border-b border-slate-100 dark:border-slate-700/60 last:border-0"
              >
                <TableCell layoutClassName="whitespace-nowrap px-5 py-3.5">
                  <Box layoutClassName="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <Typography as="span" size="xs" textClassName="text-slate-600 dark:text-slate-300">
                      {formatDate(tr.transactionDate)}
                    </Typography>
                  </Box>
                </TableCell>

                <TableCell layoutClassName="whitespace-nowrap px-5 py-3.5">
                  {tr.transferType === 'out' ? (
                    <Box layoutClassName="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 dark:bg-rose-900/20">
                      <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                      <Typography as="span" layoutClassName="text-sm font-bold" textClassName="text-rose-700 dark:text-rose-300">
                        −{formatVND(tr.transferAmount)}
                      </Typography>
                    </Box>
                  ) : (
                    <Box layoutClassName="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 dark:bg-emerald-900/20">
                      <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <Typography as="span" layoutClassName="text-sm font-bold" textClassName="text-emerald-700 dark:text-emerald-300">
                        +{formatVND(tr.transferAmount)}
                      </Typography>
                    </Box>
                  )}
                </TableCell>

                <TableCell layoutClassName="px-5 py-3.5">
                  <LedgerStatusBadge status={tr.status} needsReview={tr.needsReview} />
                </TableCell>

                <TableCell layoutClassName="px-5 py-3.5">
                  <Typography
                    as="div"
                    size="xs"
                    layoutClassName="max-w-[260px] truncate"
                    textClassName="text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white transition-colors"
                    title={tr.content}
                  >
                    {tr.content || '—'}
                  </Typography>
                </TableCell>

                <TableCell layoutClassName="px-5 py-3.5">
                  {tr.orderNumber ? (
                    <Badge
                      size="sm"
                      layoutClassName="inline-flex items-center px-2.5 py-1 text-xs font-semibold font-mono"
                      borderClassName="border border-primary-200 dark:border-primary-700"
                      backgroundClassName="bg-primary-50 dark:bg-primary-900/20"
                      textClassName="text-primary-700 dark:text-primary-300"
                    >
                      {tr.orderNumber}
                    </Badge>
                  ) : (tr.transferType === 'out' || tr.status === 'expense_credit')
                    && expenseCategoryTag(tr.expenseCategory) ? (
                    <ExpenseTag transaction={tr} />
                  ) : (
                    <Typography as="span" size="xs" variant="muted">—</Typography>
                  )}
                </TableCell>

                {/* 100: TK của dòng tiền + loại (hộ kinh doanh / cá nhân). */}
                <TableCell layoutClassName="px-5 py-3.5">
                  <Box layoutClassName="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <Box layoutClassName="min-w-0">
                      <Typography as="div" size="xs" layoutClassName="truncate" textClassName="text-slate-600 dark:text-slate-400">
                        {tr.accountLabel || tr.gateway || '—'}
                      </Typography>
                      {tr.accountKind && (
                        <Typography
                          as="div"
                          size="xs"
                          layoutClassName="truncate"
                          textClassName={
                            tr.accountKind === 'personal'
                              ? 'text-blue-600 dark:text-blue-300'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }
                        >
                          {paymentAccountKindLabel(tr.accountKind)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
};

export default React.memo(LedgerDesktopTable);
