import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Calendar,
  Building2,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  FileText,
  Hash,
  Clock,
  Wallet,
  Tag,
  Save,
} from 'lucide-react';
import { Transaction, ManualExpense } from '@/types';
import { expenseCategoryLabel, EXPENSE_CATEGORIES } from '@/types/transaction';
import { setTransactionExpense, linkTransactionOrder } from '@/services/transactionService';
import { formatVND } from '@/utils/format/currencyUtil';
import BaseModal from '@/components/BaseModal';
import Badge from '@/components/ui/Badge';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Heading from '@/components/ui/Heading';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Select from '@/components/ui/Select';
import Typography from '@/components/ui/Typography';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  /** Khoản chi phí tay tương ứng (nếu GD tiền-ra này đã được gán). */
  linkedExpense?: ManualExpense;
  formatDate: (dateStr: string) => string;
  /** Gọi sau khi sửa danh mục / mã đơn thành công (để refetch sổ). */
  onChanged?: () => unknown | Promise<unknown>;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  transaction,
  linkedExpense,
  formatDate,
  onChanged,
}) => {
  // Sửa danh mục + mã đơn ngay tại modal (dùng service PATCH sẵn có).
  const [category, setCategory] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCategory(transaction?.expenseCategory ?? '');
    setOrderNumber(transaction?.orderNumber ?? '');
  }, [transaction?.id]);

  if (!transaction) return null;

  const isIncoming = transaction.transferType === 'in';

  const origCategory = transaction.expenseCategory ?? '';
  const origOrder = transaction.orderNumber ?? '';
  const nextOrder = orderNumber.trim().toUpperCase();
  const dirty = category !== origCategory || nextOrder !== origOrder;
  // Category hiện tại không nằm trong danh sách chuẩn (vd 'shopee'/'capital') → giữ làm option để không mất.
  const extraCategory = origCategory && !EXPENSE_CATEGORIES.some((c) => c.value === origCategory) ? origCategory : '';

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      if (category !== origCategory) {
        await setTransactionExpense(transaction.id, category || null, !!transaction.costExcluded, transaction.reviewNote ?? null);
      }
      if (nextOrder !== origOrder) {
        await linkTransactionOrder(transaction.id, nextOrder);
      }
      toast.success('Đã cập nhật giao dịch');
      await onChanged?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  const formatFullDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <Box layoutClassName="flex items-center gap-3">
          <Box
            layoutClassName={`flex h-10 w-10 items-center justify-center rounded-full border ${
              isIncoming
                ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700'
                : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'
            }`}
          >
            {isIncoming ? (
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
          </Box>
          <Box>
            <Heading level={3} textClassName="text-lg text-slate-900 dark:text-white">
              {isIncoming ? 'Giao dịch nhận tiền' : 'Giao dịch chuyển tiền'}
            </Heading>
            <Typography size="xs" variant="muted">
              {formatDate(transaction.transactionDate)}
            </Typography>
          </Box>
        </Box>
      }
      size="lg"
    >
      <Box layoutClassName="space-y-4">
        <Card
          layoutClassName="p-4"
          backgroundClassName="bg-slate-50 dark:bg-slate-900/50"
          borderClassName="border-slate-200 dark:border-slate-700"
        >
          <Box layoutClassName="mb-2 flex items-center justify-between">
            <Typography as="span" size="sm" variant="secondary">Số tiền</Typography>
            <Typography
              as="span"
              layoutClassName="text-2xl font-bold"
              textClassName={
                isIncoming
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }
            >
              {isIncoming ? '+' : '-'}
              {formatVND(transaction.transferAmount)}
            </Typography>
          </Box>
          {transaction.accumulated > 0 && (
            <Box layoutClassName="flex items-center justify-between text-xs" textClassName="text-slate-500 dark:text-slate-400">
              <Typography as="span" size="xs" variant="muted">Số dư sau giao dịch:</Typography>
              <Typography as="span" size="xs" layoutClassName="font-medium">{formatVND(transaction.accumulated)}</Typography>
            </Box>
          )}
        </Card>

        {/* Sửa nhanh phân loại + mã đơn (PATCH sẵn có) */}
        <Card layoutClassName="p-4" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-primary-200 dark:border-primary-800">
          <Box layoutClassName="mb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary-500" />
            <Typography as="span" size="xs" layoutClassName="font-medium uppercase" textClassName="text-primary-600 dark:text-primary-300">
              Sửa phân loại &amp; mã đơn
            </Typography>
          </Box>
          <Box layoutClassName="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Box layoutClassName="space-y-1.5">
              <Label className="mb-0">Danh mục</Label>
              <Select fullWidth value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">— Chưa phân loại —</option>
                {extraCategory ? <option value={extraCategory}>{extraCategory}</option> : null}
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </Box>
            <Box layoutClassName="space-y-1.5">
              <Label className="mb-0">Mã đơn hàng</Label>
              <Input
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="vd ORD-000123 (để trống = gỡ liên kết)"
                fullWidth
              />
            </Box>
          </Box>
          <Box layoutClassName="mt-3 flex justify-end">
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={!dirty || saving}
              variant="primary"
              leftIcon={<Save />}
              iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
              sizeClassName="px-4 py-2 text-sm"
              roundedClassName="rounded-lg"
              backgroundClassName="bg-primary-600"
              hoverClassName="hover:bg-primary-700"
              textClassName="font-medium text-white"
              layoutClassName="inline-flex items-center gap-1.5"
              disableVariantHover
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </Box>
        </Card>

        <Box layoutClassName="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card layoutClassName="p-3" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-200 dark:border-slate-700">
            <Box layoutClassName="mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              <Typography as="span" size="xs" layoutClassName="font-medium uppercase" textClassName="text-slate-600 dark:text-slate-400">
                Nội dung
              </Typography>
            </Box>
            <Typography size="sm" textClassName="text-slate-900 dark:text-white">
              {transaction.content || '-'}
            </Typography>
            {transaction.description && (
              <Typography size="xs" variant="muted" layoutClassName="mt-1">
                {transaction.description}
              </Typography>
            )}
          </Card>

          <Card layoutClassName="p-3" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-200 dark:border-slate-700">
            <Box layoutClassName="mb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              <Typography as="span" size="xs" layoutClassName="font-medium uppercase" textClassName="text-slate-600 dark:text-slate-400">
                Cổng thanh toán
              </Typography>
            </Box>
            <Typography size="sm" textClassName="text-slate-900 dark:text-white">
              {transaction.gateway || '-'}
            </Typography>
          </Card>
        </Box>

        {linkedExpense && (
          <Card layoutClassName="p-3" backgroundClassName="bg-violet-50 dark:bg-violet-900/20" borderClassName="border-violet-200 dark:border-violet-700">
            <Box layoutClassName="mb-2 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-violet-500" />
              <Typography as="span" size="xs" layoutClassName="font-medium uppercase" textClassName="text-violet-600 dark:text-violet-300">
                Chi phí tương ứng
              </Typography>
            </Box>
            <Typography size="sm" textClassName="text-slate-900 dark:text-white">
              {expenseCategoryLabel(linkedExpense.category)} · {formatVND(linkedExpense.amount)}
              {linkedExpense.spreadMonths > 1 ? ` · phân bổ × ${linkedExpense.spreadMonths} tháng` : ''}
              {linkedExpense.note ? ` · ${linkedExpense.note}` : ''}
            </Typography>
          </Card>
        )}

        <Box layoutClassName="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {transaction.orderNumber && (
            <Card layoutClassName="p-3" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-200 dark:border-slate-700">
              <Box layoutClassName="mb-2 flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-slate-400" />
                <Typography as="span" size="xs" layoutClassName="font-medium uppercase" textClassName="text-slate-600 dark:text-slate-400">
                  Mã đơn hàng
                </Typography>
              </Box>
              <Badge
                size="sm"
                layoutClassName="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium font-mono"
                borderClassName="border-transparent"
                backgroundClassName="bg-primary-50 dark:bg-primary-900/20"
                textClassName="text-primary-700 dark:text-primary-300"
              >
                {transaction.orderNumber}
              </Badge>
            </Card>
          )}

          {transaction.sepayId && (
            <Card layoutClassName="p-3" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-200 dark:border-slate-700">
              <Box layoutClassName="mb-2 flex items-center gap-2">
                <Hash className="h-4 w-4 text-slate-400" />
                <Typography as="span" size="xs" layoutClassName="font-medium uppercase" textClassName="text-slate-600 dark:text-slate-400">
                  Mã GD ngân hàng
                </Typography>
              </Box>
              <Badge
                size="sm"
                layoutClassName="inline-flex items-center gap-1 px-2 py-1 text-sm font-mono"
                borderClassName="border-transparent"
                backgroundClassName="bg-slate-50 dark:bg-slate-800/60"
                textClassName="text-slate-700 dark:text-slate-200"
              >
                #{transaction.sepayId}
              </Badge>
            </Card>
          )}
        </Box>

        <Card layoutClassName="p-3" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-200 dark:border-slate-700">
          <Box layoutClassName="mb-2 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-slate-400" />
            <Typography as="span" size="xs" layoutClassName="font-medium uppercase" textClassName="text-slate-600 dark:text-slate-400">
              Thông tin tài khoản
            </Typography>
          </Box>
          <Box layoutClassName="space-y-2">
            {transaction.subAccount && (
              <Box layoutClassName="flex items-center justify-between">
                <Typography as="span" size="xs" variant="muted">Tài khoản phụ:</Typography>
                <Typography as="span" size="sm" layoutClassName="font-mono" textClassName="text-slate-900 dark:text-white">
                  {transaction.subAccount}
                </Typography>
              </Box>
            )}
            {transaction.accountNumber && (
              <Box layoutClassName="flex items-center justify-between">
                <Typography as="span" size="xs" variant="muted">Số tài khoản:</Typography>
                <Typography as="span" size="sm" layoutClassName="font-mono" textClassName="text-slate-900 dark:text-white">
                  {transaction.accountNumber}
                </Typography>
              </Box>
            )}
          </Box>
        </Card>

        <Box layoutClassName="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card layoutClassName="p-3" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-200 dark:border-slate-700">
            <Box layoutClassName="mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <Typography as="span" size="xs" layoutClassName="font-medium uppercase" textClassName="text-slate-600 dark:text-slate-400">
                Ngày giao dịch
              </Typography>
            </Box>
            <Typography size="sm" textClassName="text-slate-900 dark:text-white">
              {formatFullDate(transaction.transactionDate)}
            </Typography>
          </Card>

          {transaction.receivedAt && (
            <Card layoutClassName="p-3" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-200 dark:border-slate-700">
              <Box layoutClassName="mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <Typography as="span" size="xs" layoutClassName="font-medium uppercase" textClassName="text-slate-600 dark:text-slate-400">
                  Ngày nhận
                </Typography>
              </Box>
              <Typography size="sm" textClassName="text-slate-900 dark:text-white">
                {formatFullDate(transaction.receivedAt)}
              </Typography>
            </Card>
          )}
        </Box>

        {(transaction.code || transaction.referenceCode) && (
          <Card layoutClassName="p-3" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-200 dark:border-slate-700">
            <Box layoutClassName="mb-2 flex items-center gap-2">
              <Hash className="h-4 w-4 text-slate-400" />
              <Typography as="span" size="xs" layoutClassName="font-medium uppercase" textClassName="text-slate-600 dark:text-slate-400">
                Mã tham chiếu
              </Typography>
            </Box>
            <Box layoutClassName="space-y-1">
              {transaction.code && (
                <Box layoutClassName="flex items-center justify-between">
                  <Typography as="span" size="xs" variant="muted">Code:</Typography>
                  <Typography as="span" size="sm" layoutClassName="font-mono" textClassName="text-slate-900 dark:text-white">
                    {transaction.code}
                  </Typography>
                </Box>
              )}
              {transaction.referenceCode && (
                <Box layoutClassName="flex items-center justify-between">
                  <Typography as="span" size="xs" variant="muted">Reference:</Typography>
                  <Typography as="span" size="sm" layoutClassName="font-mono" textClassName="text-slate-900 dark:text-white">
                    {transaction.referenceCode}
                  </Typography>
                </Box>
              )}
            </Box>
          </Card>
        )}

        {transaction.createdAt && (
          <Card
            layoutClassName="p-3"
            backgroundClassName="bg-slate-50 dark:bg-slate-900/50"
            borderClassName="border-slate-200 dark:border-slate-700"
          >
            <Box layoutClassName="flex items-center justify-between">
              <Typography as="span" size="xs" variant="muted">ID giao dịch:</Typography>
              <Typography as="span" size="xs" layoutClassName="font-mono" textClassName="text-slate-600 dark:text-slate-400">
                {transaction.id}
              </Typography>
            </Box>
            <Box layoutClassName="mt-1 flex items-center justify-between">
              <Typography as="span" size="xs" variant="muted">Tạo lúc:</Typography>
              <Typography as="span" size="xs" textClassName="text-slate-600 dark:text-slate-400">
                {formatFullDate(transaction.createdAt)}
              </Typography>
            </Box>
          </Card>
        )}
      </Box>
    </BaseModal>
  );
};

export default TransactionDetailModal;

