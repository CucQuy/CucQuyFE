import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCheck, Inbox, PackageOpen, Receipt, ShoppingCart, Wand2 } from 'lucide-react';
import {
  autoReconcileApply,
  autoReconcilePreview,
  type AutoReconcileInOrder,
  type AutoReconcileOutExpense,
  type AutoReconcileOutReceipt,
  type AutoReconcilePreviewResult,
} from '@/services/transactionService';
import { expenseCategoryLabel } from '@/types';
import { formatVND } from '@/utils/format/currencyUtil';
import BaseModal from '@/components/BaseModal';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Checkbox from '@/components/ui/Checkbox';
import Typography from '@/components/ui/Typography';
import Spinner from '@/components/ui/Spinner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Kỳ đang xem trên màn Sổ — quét đúng khoảng này. */
  fromDate: string;
  toDate: string;
  /** Gọi sau khi ghi xong để refetch bảng sổ phía sau. */
  onChanged: () => void;
}

const fmtDate = (v?: string | null): string => {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Key duy nhất 1 cặp — dùng làm id cho tick/bỏ tick. */
const keyOf = (group: string, txId: string, target: string) => `${group}:${txId}:${target}`;

/**
 * Đối soát TỰ ĐỘNG cho Sổ giao dịch: quét kỳ đang xem, gợi ý các cặp CHẮC CHẮN
 * (giao dịch có đúng 1 ứng viên và ứng viên đó cũng chỉ được 1 giao dịch nhắm tới),
 * cho bỏ tick từng cặp rồi mới ghi.
 *
 * Cặp nhập nhằng KHÔNG hiện ở đây — chúng chỉ được đếm để nhắc người dùng sang
 * modal "Đối soát" tay, vì đoán bừa thì sổ sách sai mà rất khó lần ra sau này.
 */
const LedgerAutoReconcileModal: React.FC<Props> = ({ isOpen, onClose, fromDate, toDate, onChanged }) => {
  const [data, setData] = useState<AutoReconcilePreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  /** Cặp bị BỎ tick (mặc định mọi cặp đều được tick). */
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res = await autoReconcilePreview(
        fromDate,
        toDate ? `${toDate.slice(0, 10)} 23:59:59` : '',
      );
      setData(res);
      setUnchecked(new Set());
    } catch {
      toast.error('Không quét được giao dịch để đối soát.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fromDate, toDate]);

  const toggle = (key: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Cặp còn tick, tách theo nhóm — chính là payload sẽ gửi đi.
  const picked = useMemo(() => {
    const inOrders = (data?.inOrders ?? []).filter(
      (m) => !unchecked.has(keyOf('in', m.transactionId, m.orderId)),
    );
    const outReceipts = (data?.outReceipts ?? []).filter(
      (m) => !unchecked.has(keyOf('rec', m.transactionId, m.receiptId)),
    );
    const outExpenses = (data?.outExpenses ?? []).filter(
      (m) => !unchecked.has(keyOf('exp', m.transactionId, m.expenseId)),
    );
    return { inOrders, outReceipts, outExpenses };
  }, [data, unchecked]);

  const pickedCount =
    picked.inOrders.length + picked.outReceipts.length + picked.outExpenses.length;
  const totalCount =
    (data?.inOrders.length ?? 0) + (data?.outReceipts.length ?? 0) + (data?.outExpenses.length ?? 0);

  const apply = async () => {
    if (pickedCount === 0) return;
    setApplying(true);
    try {
      const res = await autoReconcileApply(picked);
      if (res.applied > 0) toast.success(`Đã đối soát ${res.applied} giao dịch.`);
      // skipped = cặp không còn hợp lệ lúc ghi (ai đó vừa khớp tay, đơn vừa PAID…).
      if (res.skipped > 0) toast(`${res.skipped} cặp bị bỏ qua vì dữ liệu đã đổi.`, { icon: '⚠️' });
      if (res.applied === 0 && res.skipped === 0) toast('Không có gì để ghi.', { icon: 'ℹ️' });
      onChanged();
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Ghi đối soát thất bại.');
    } finally {
      setApplying(false);
    }
  };

  /** 1 dòng cặp: checkbox + mô tả GD bên trái, đối tượng khớp bên phải. */
  const Row: React.FC<{ id: string; amount: number; txDate: string | null; left: string; right: React.ReactNode }> = ({
    id, amount, txDate, left, right,
  }) => (
    <Box
      layoutClassName="flex items-start gap-3 px-3 py-2"
      borderClassName="border-b border-slate-100 last:border-b-0 dark:border-slate-700"
    >
      <Checkbox checked={!unchecked.has(id)} onChange={() => toggle(id)} />
      <Box layoutClassName="min-w-0 flex-1">
        <Box layoutClassName="flex flex-wrap items-center gap-2">
          <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-800 dark:text-slate-100">
            {formatVND(amount)}
          </Typography>
          <Typography as="span" size="xs" variant="muted">
            {fmtDate(txDate)}
          </Typography>
        </Box>
        <Typography as="p" size="xs" variant="muted" layoutClassName="truncate">
          {left || '—'}
        </Typography>
      </Box>
      <Box layoutClassName="min-w-0 max-w-[45%] text-right">{right}</Box>
    </Box>
  );

  /** Khối 1 nhóm cặp (đơn / phiếu nhập / chi phí). Rỗng thì không render. */
  const Group: React.FC<{ title: string; icon: React.ReactNode; count: number; children: React.ReactNode }> = ({
    title, icon, count, children,
  }) => {
    if (count === 0) return null;
    return (
      <Box layoutClassName="space-y-1">
        <Box layoutClassName="flex items-center gap-2 px-1">
          {icon}
          <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-700 dark:text-slate-200">
            {title}
          </Typography>
          <Badge size="sm" backgroundClassName="bg-slate-100 dark:bg-slate-700" textClassName="text-slate-600 dark:text-slate-300">
            {count}
          </Badge>
        </Box>
        <Box
          borderClassName="border border-slate-200 dark:border-slate-700"
          roundedClassName="rounded-lg"
          layoutClassName="overflow-hidden"
        >
          {children}
        </Box>
      </Box>
    );
  };

  const counts = data?.counts;
  const skipped = (counts?.ambiguousIn ?? 0) + (counts?.ambiguousOut ?? 0) + (counts?.conflictOut ?? 0);

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Đối soát tự động" size="2xl">
      <Box layoutClassName="flex h-[70vh] flex-col gap-3">
        <Typography size="xs" variant="muted">
          Quét giao dịch chưa khớp trong kỳ đang xem ({fmtDate(fromDate)} – {fmtDate(toDate)}) và ghép
          với đơn hàng, phiếu nhập kho, khoản chi nhập tay cùng số tiền. Chỉ gợi ý khi khớp duy nhất.
        </Typography>

        {loading ? (
          <Box layoutClassName="flex flex-1 items-center justify-center">
            <Spinner size="lg" textClassName="text-primary-500" />
          </Box>
        ) : totalCount === 0 ? (
          <Box layoutClassName="flex flex-1 flex-col items-center justify-center gap-2" textClassName="text-slate-400 dark:text-slate-500">
            <Inbox className="h-8 w-8 opacity-40" />
            <Typography size="sm" variant="muted">
              Không tìm được cặp nào chắc chắn trong kỳ này.
            </Typography>
            {skipped > 0 ? (
              <Typography size="xs" variant="muted">
                {skipped} giao dịch có ứng viên nhưng không khớp duy nhất — xử lý ở nút “Đối soát”.
              </Typography>
            ) : null}
          </Box>
        ) : (
          <Box layoutClassName="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <Group
              title="Tiền vào → đơn hàng"
              icon={<ShoppingCart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
              count={data?.inOrders.length ?? 0}
            >
              {(data?.inOrders ?? []).map((m: AutoReconcileInOrder) => (
                <Row
                  key={keyOf('in', m.transactionId, m.orderId)}
                  id={keyOf('in', m.transactionId, m.orderId)}
                  amount={m.amount}
                  txDate={m.transactionDate}
                  left={m.description}
                  right={
                    <>
                      <Typography as="p" size="sm" layoutClassName="font-semibold" textClassName="text-slate-800 dark:text-slate-100">
                        {m.orderNumber}
                      </Typography>
                      <Typography as="p" size="xs" variant="muted" layoutClassName="truncate">
                        {m.customer || '—'} · {formatVND(m.orderTotal)}
                      </Typography>
                    </>
                  }
                />
              ))}
            </Group>

            <Group
              title="Tiền ra → phiếu nhập kho"
              icon={<PackageOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
              count={data?.outReceipts.length ?? 0}
            >
              {(data?.outReceipts ?? []).map((m: AutoReconcileOutReceipt) => (
                <Row
                  key={keyOf('rec', m.transactionId, m.receiptId)}
                  id={keyOf('rec', m.transactionId, m.receiptId)}
                  amount={m.amount}
                  txDate={m.transactionDate}
                  left={m.description}
                  right={
                    <>
                      <Typography as="p" size="sm" layoutClassName="truncate font-semibold" textClassName="text-slate-800 dark:text-slate-100">
                        {m.supplier || 'Phiếu nhập'}
                      </Typography>
                      <Typography as="p" size="xs" variant="muted" layoutClassName="truncate">
                        {m.invoice ? `${m.invoice} · ` : ''}
                        {fmtDate(m.receiptDate)} · {formatVND(m.receiptTotal)}
                      </Typography>
                    </>
                  }
                />
              ))}
            </Group>

            <Group
              title="Tiền ra → chi phí nhập tay"
              icon={<Receipt className="h-4 w-4 text-sky-600 dark:text-sky-400" />}
              count={data?.outExpenses.length ?? 0}
            >
              {(data?.outExpenses ?? []).map((m: AutoReconcileOutExpense) => (
                <Row
                  key={keyOf('exp', m.transactionId, m.expenseId)}
                  id={keyOf('exp', m.transactionId, m.expenseId)}
                  amount={m.amount}
                  txDate={m.transactionDate}
                  left={m.description}
                  right={
                    <>
                      <Typography as="p" size="sm" layoutClassName="font-semibold" textClassName="text-slate-800 dark:text-slate-100">
                        {expenseCategoryLabel(m.category ?? '')}
                      </Typography>
                      <Typography as="p" size="xs" variant="muted" layoutClassName="truncate">
                        {m.note || fmtDate(m.expenseDate)}
                      </Typography>
                    </>
                  }
                />
              ))}
            </Group>
          </Box>
        )}

        {/* Nhắc số GD phải tự xử — nếu giấu đi người dùng tưởng sổ đã sạch. */}
        {skipped > 0 && totalCount > 0 ? (
          <Box
            layoutClassName="flex items-start gap-2 p-2.5"
            backgroundClassName="bg-amber-50 dark:bg-amber-900/20"
            roundedClassName="rounded-lg"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <Typography size="xs" textClassName="text-amber-800 dark:text-amber-200">
              {skipped} giao dịch có ứng viên nhưng không khớp duy nhất (trùng số tiền, hoặc vừa khớp
              phiếu nhập vừa khớp chi phí) — cần đối soát tay ở nút “Đối soát”.
            </Typography>
          </Box>
        ) : null}

        <Box layoutClassName="flex items-center justify-between gap-2 pt-1">
          <Typography size="xs" variant="muted">
            {totalCount > 0 ? `Đã chọn ${pickedCount}/${totalCount} cặp` : ''}
          </Typography>
          <Box layoutClassName="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={applying}>
              Đóng
            </Button>
            <Button
              type="button"
              onClick={() => void apply()}
              disabled={applying || pickedCount === 0}
              leftIcon={applying ? <Spinner size="sm" /> : <CheckCheck className="h-4 w-4" />}
              layoutClassName="inline-flex items-center gap-1.5"
            >
              {applying ? 'Đang ghi…' : `Đối soát ${pickedCount} cặp`}
            </Button>
          </Box>
        </Box>
      </Box>
    </BaseModal>
  );
};

export default LedgerAutoReconcileModal;
