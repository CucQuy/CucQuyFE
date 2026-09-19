import React from 'react';
import { ArrowRight, Landmark, Wallet } from 'lucide-react';
import { LedgerAccountFlow } from '@/types';
import { paymentAccountKindLabel } from '@/types/paymentConfig';
import { formatVND } from '@/utils/format/currencyUtil';
import Badge from '@/components/ui/Badge';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';

interface LedgerAccountFlowCardProps {
  accounts: LedgerAccountFlow[];
  /** accountId đang lọc ('' = không lọc) — bấm 1 thẻ để lọc sổ theo TK đó. */
  selected: string;
  onSelect: (accountId: string) => void;
}

/**
 * "Dòng tiền nào của tài khoản nào" — tách thu/chi trong kỳ theo TỪNG tài khoản,
 * kèm nhãn loại TK (hộ kinh doanh / cá nhân) và phần dồn tiền nội bộ cuối ngày
 * (TK HKD → TK cá nhân) để không đọc lẫn thành thu/chi thật.
 * Bấm 1 thẻ = lọc sổ theo tài khoản đó (bấm lại để bỏ lọc).
 */
const LedgerAccountFlowCard: React.FC<LedgerAccountFlowCardProps> = ({ accounts, selected, onSelect }) => {
  if (accounts.length === 0) return null;

  return (
    <Card padding="md" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-100 dark:border-slate-700">
      <Box layoutClassName="mb-3 flex flex-wrap items-center gap-2">
        <Landmark className="h-4 w-4 text-primary-500" />
        <Typography as="span" size="xs" variant="muted" layoutClassName="font-semibold uppercase tracking-wide">
          Dòng tiền theo tài khoản
        </Typography>
        <Typography as="span" size="xs" variant="muted">
          · số dư tính toàn thời gian · thu/chi theo kỳ đang xem
        </Typography>
      </Box>

      <Box layoutClassName="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => {
          const isPersonal = a.kind === 'personal';
          const active = !!a.accountId && a.accountId === selected;
          const key = a.accountId ?? `unknown-${a.label}`;
          return (
            <Button
              key={key}
              type="button"
              variant="secondary"
              disableVariantHover
              disableVariantTextColor
              disabled={!a.accountId}
              onClick={() => a.accountId && onSelect(a.accountId === selected ? '' : a.accountId)}
              layoutClassName="flex w-full flex-col items-stretch gap-1.5 text-left"
              sizeClassName="p-3"
              roundedClassName="rounded-xl"
              borderClassName={
                active
                  ? 'border border-primary-300 dark:border-primary-600'
                  : 'border border-slate-100 dark:border-slate-700'
              }
              backgroundClassName={
                active
                  ? 'bg-primary-50/70 dark:bg-primary-900/20'
                  : 'bg-slate-50/60 dark:bg-slate-900/30'
              }
              hoverClassName="hover:bg-primary-50/60 dark:hover:bg-primary-900/10"
              stateClassName="transition-colors disabled:cursor-default"
            >
              <Box layoutClassName="flex items-center justify-between gap-2">
                <Box layoutClassName="flex min-w-0 items-center gap-1.5">
                  {isPersonal ? (
                    <Wallet className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  )}
                  <Typography as="span" size="sm" layoutClassName="truncate font-semibold" textClassName="text-slate-800 dark:text-slate-100">
                    {a.label}
                  </Typography>
                </Box>
                <Badge
                  size="sm"
                  layoutClassName="shrink-0 px-2 py-0.5 text-[11px] font-medium"
                  borderClassName={
                    a.kind === null
                      ? 'border border-slate-200 dark:border-slate-600'
                      : isPersonal
                        ? 'border border-blue-200 dark:border-blue-700'
                        : 'border border-emerald-200 dark:border-emerald-700'
                  }
                  backgroundClassName={
                    a.kind === null
                      ? 'bg-slate-100 dark:bg-slate-700/40'
                      : isPersonal
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'bg-emerald-50 dark:bg-emerald-900/20'
                  }
                  textClassName={
                    a.kind === null
                      ? 'text-slate-500 dark:text-slate-400'
                      : isPersonal
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-emerald-700 dark:text-emerald-300'
                  }
                >
                  {a.kind === null ? 'Chưa khai' : paymentAccountKindLabel(a.kind)}
                </Badge>
              </Box>

              {/* Số dư hiện tại — toàn thời gian, không đổi theo kỳ đang lọc. */}
              {a.balance !== null && (
                <Box layoutClassName="flex items-baseline justify-between gap-2">
                  <Typography as="span" size="xs" variant="muted">Số dư</Typography>
                  <Typography
                    as="span"
                    layoutClassName="text-base font-bold"
                    textClassName={a.balance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}
                  >
                    {formatVND(a.balance)}
                  </Typography>
                </Box>
              )}

              <Box
                layoutClassName="flex items-center justify-between gap-2 pt-1.5"
                borderClassName="border-t border-slate-200/70 dark:border-slate-700/70"
              >
                <Typography as="span" size="xs" layoutClassName="font-medium" textClassName="text-emerald-600 dark:text-emerald-400">
                  +{formatVND(a.in)}
                </Typography>
                <Typography as="span" size="xs" layoutClassName="font-medium" textClassName="text-rose-600 dark:text-rose-400">
                  −{formatVND(a.out)}
                </Typography>
                <Typography as="span" size="xs" variant="muted">{a.count} GD</Typography>
              </Box>

              {/* Phần chỉ là dồn tiền nội bộ giữa 2 TK — không phải thu/chi với bên ngoài. */}
              {(a.sweepIn > 0 || a.sweepOut > 0) && (
                <Typography as="span" size="xs" variant="muted">
                  {a.sweepIn > 0 ? `nhận dồn ${formatVND(a.sweepIn)}` : `dồn đi ${formatVND(a.sweepOut)}`} (nội bộ)
                </Typography>
              )}
            </Button>
          );
        })}
      </Box>
    </Card>
  );
};

export default LedgerAccountFlowCard;
