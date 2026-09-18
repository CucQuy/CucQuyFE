import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link2Off, PackageOpen, Split } from 'lucide-react';
import {
  fetchTxReceiptAllocations,
  addTxReceiptAllocations,
  removeTxReceiptAllocation,
  type TxReceiptAllocSummary,
} from '@/services/transactionService';
import { formatVND } from '@/utils/format/currencyUtil';
import Box from '@/components/ui/Box';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Checkbox from '@/components/ui/Checkbox';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';

interface Props {
  /** GD tiền-ra đang đối soát. */
  txId: string;
  /** Gọi sau khi rải/gỡ để refetch bảng sổ phía sau (không đóng modal). */
  onChanged?: () => void;
}

const fmtDate = (v?: string | null): string => {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Trạng thái tick + số tiền của từng phiếu ứng viên. */
type Pick = { checked: boolean; amount: string };

/**
 * Panel RẢI 1 GIAO DỊCH tiền-ra ra NHIỀU phiếu nhập (transaction-first).
 * Đối xứng AllocationPanel (bill-first) nhưng khởi từ phía GD: hiện tiền GD / đã rải / còn lại,
 * tick nhiều phiếu (mặc định = còn nợ phiếu, sửa được) rồi rải 1 lượt.
 */
const TxReceiptAllocPanel: React.FC<Props> = ({ txId, onChanged }) => {
  const [summary, setSummary] = useState<TxReceiptAllocSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [picks, setPicks] = useState<Record<string, Pick>>({});

  const load = async () => {
    setLoading(true);
    try {
      const s = await fetchTxReceiptAllocations(txId);
      setSummary(s);
      // Reset lựa chọn: mặc định chưa tick, số tiền = còn nợ phiếu.
      const next: Record<string, Pick> = {};
      for (const c of s.candidates) next[c.receiptId] = { checked: false, amount: String(c.remaining) };
      setPicks(next);
    } catch {
      toast.error('Không tải được danh sách phiếu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txId]);

  const remaining = summary?.remaining ?? 0;

  // Tổng tiền các phiếu đang tick (để hiện + cảnh báo vượt còn-lại GD).
  const pickedTotal = useMemo(() => {
    if (!summary) return 0;
    return summary.candidates.reduce((sum, c) => {
      const p = picks[c.receiptId];
      if (!p?.checked) return sum;
      const v = Number(p.amount);
      return sum + (Number.isFinite(v) && v > 0 ? v : 0);
    }, 0);
  }, [summary, picks]);

  const pickedCount = useMemo(
    () => Object.values(picks).filter((p) => p.checked).length,
    [picks],
  );

  const toggle = (receiptId: string) =>
    setPicks((prev) => ({
      ...prev,
      [receiptId]: { ...prev[receiptId], checked: !prev[receiptId]?.checked },
    }));

  const setAmount = (receiptId: string, amount: string) =>
    setPicks((prev) => ({
      ...prev,
      [receiptId]: { checked: prev[receiptId]?.checked ?? true, amount: amount.replace(/[^\d]/g, '') },
    }));

  const apply = async () => {
    if (!summary) return;
    const items = summary.candidates
      .filter((c) => picks[c.receiptId]?.checked)
      .map((c) => {
        const raw = Number(picks[c.receiptId]?.amount);
        return { receiptId: c.receiptId, amount: Number.isFinite(raw) && raw > 0 ? raw : null };
      });
    if (items.length === 0) {
      toast.error('Chưa chọn phiếu nào để rải.');
      return;
    }
    setBusy(true);
    try {
      const s = await addTxReceiptAllocations(txId, items);
      setSummary(s);
      const next: Record<string, Pick> = {};
      for (const c of s.candidates) next[c.receiptId] = { checked: false, amount: String(c.remaining) };
      setPicks(next);
      onChanged?.();
      toast.success('Đã rải giao dịch vào phiếu nhập.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rải thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (allocId: string) => {
    setBusy(true);
    try {
      const s = await removeTxReceiptAllocation(allocId);
      setSummary(s);
      const next: Record<string, Pick> = {};
      for (const c of s.candidates) next[c.receiptId] = { checked: false, amount: String(c.remaining) };
      setPicks(next);
      onChanged?.();
      toast.success('Đã gỡ phiếu khỏi giao dịch.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gỡ thất bại.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Box layoutClassName="flex items-center justify-center py-8">
        <Spinner size="md" textClassName="text-primary-500" />
      </Box>
    );
  }
  if (!summary) return null;

  const over = pickedTotal > remaining + 0.5;

  return (
    <Box layoutClassName="space-y-3">
      {/* Tổng quan tiền GD: đã rải / còn lại */}
      <Box
        layoutClassName="flex items-center justify-between gap-2 rounded-lg p-2.5"
        borderClassName="border border-slate-200 dark:border-slate-700"
        backgroundClassName="bg-slate-50 dark:bg-slate-800/60"
      >
        <Box>
          <Typography as="p" size="xs" textClassName="text-slate-500 dark:text-slate-400">Đã rải</Typography>
          <Typography as="p" size="sm" layoutClassName="font-semibold" textClassName="text-slate-700 dark:text-slate-200">
            {formatVND(summary.allocated)} / {formatVND(summary.txAmount)}
          </Typography>
        </Box>
        <Badge
          size="sm"
          backgroundClassName={remaining > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}
          textClassName={remaining > 0 ? 'font-semibold text-amber-700 dark:text-amber-300' : 'font-semibold text-emerald-700 dark:text-emerald-300'}
        >
          {remaining > 0 ? `Còn lại ${formatVND(remaining)}` : 'Đã rải hết'}
        </Badge>
      </Box>

      {/* Phiếu đã gắn cho GD này */}
      {summary.allocations.length > 0 ? (
        <Box layoutClassName="space-y-1.5">
          <Typography size="xs" layoutClassName="font-semibold uppercase" textClassName="text-slate-500 dark:text-slate-400">
            Đã gắn ({summary.allocations.length})
          </Typography>
          {summary.allocations.map((a) => (
            <Box
              key={a.id}
              layoutClassName="flex items-center justify-between gap-2 rounded-lg p-2.5"
              borderClassName="border border-emerald-200 dark:border-emerald-800"
              backgroundClassName="bg-emerald-50/60 dark:bg-emerald-900/10"
            >
              <Box layoutClassName="min-w-0 flex-1">
                <Typography as="p" size="sm" layoutClassName="truncate font-semibold" textClassName="text-slate-800 dark:text-slate-100">
                  {a.supplier || 'Phiếu nhập'} · {formatVND(a.amount)}
                </Typography>
                <Typography as="p" size="xs" layoutClassName="truncate" textClassName="text-slate-400 dark:text-slate-500">
                  {fmtDate(a.receiptDate)}{a.receiptTotal != null ? ` · bill ${formatVND(a.receiptTotal)}` : ''}{a.receiptReconciled ? ' · ✓ đủ' : ''}
                </Typography>
              </Box>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                leftIcon={<Link2Off className="h-3.5 w-3.5" />}
                onClick={() => void remove(a.id)}
              >
                Gỡ
              </Button>
            </Box>
          ))}
        </Box>
      ) : null}

      {/* Phiếu ứng viên — tick nhiều + sửa số tiền */}
      <Box layoutClassName="space-y-1.5">
        <Typography size="xs" layoutClassName="flex items-center gap-1.5 font-semibold uppercase" textClassName="text-slate-500 dark:text-slate-400">
          <PackageOpen className="h-3.5 w-3.5" /> Phiếu chưa đối soát ({summary.candidates.length})
        </Typography>
        {summary.candidates.length === 0 ? (
          <Typography size="xs" variant="muted">Không còn phiếu nào để rải.</Typography>
        ) : (
          <Box layoutClassName="max-h-[38vh] space-y-1.5 overflow-y-auto pr-1">
            {summary.candidates.map((c) => {
              const p = picks[c.receiptId] ?? { checked: false, amount: String(c.remaining) };
              const exact = c.remaining === remaining && remaining > 0;
              return (
                <Box
                  key={c.receiptId}
                  layoutClassName="flex items-center gap-2 rounded-lg p-2.5"
                  borderClassName={p.checked ? 'border border-primary-300 dark:border-primary-700' : 'border border-slate-100 dark:border-slate-700'}
                  backgroundClassName={p.checked ? 'bg-primary-50/60 dark:bg-primary-900/10' : 'bg-white dark:bg-slate-800'}
                >
                  <Checkbox checked={p.checked} onChange={() => toggle(c.receiptId)} />
                  <Box layoutClassName="min-w-0 flex-1" onClick={() => toggle(c.receiptId)}>
                    <Box layoutClassName="flex items-center gap-1.5">
                      <Typography as="span" size="sm" layoutClassName="truncate font-semibold" textClassName="text-slate-800 dark:text-slate-100">
                        {c.supplier || 'Phiếu nhập'} · {formatVND(c.total ?? 0)}
                      </Typography>
                      {exact ? (
                        <Badge size="sm" backgroundClassName="bg-emerald-100 dark:bg-emerald-900/30" textClassName="text-emerald-700 dark:text-emerald-300">
                          đúng tiền
                        </Badge>
                      ) : null}
                    </Box>
                    <Typography as="p" size="xs" layoutClassName="truncate" textClassName="text-slate-400 dark:text-slate-500">
                      {fmtDate(c.receiptDate)} · còn nợ {formatVND(c.remaining)}{c.invoice ? ` · ${c.invoice}` : ''}
                    </Typography>
                  </Box>
                  {p.checked ? (
                    <Input
                      value={p.amount}
                      onChange={(e) => setAmount(c.receiptId, e.target.value)}
                      inputMode="numeric"
                      sizeClassName="w-28 px-2 py-1 text-right text-sm"
                    />
                  ) : null}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Nút rải — dính đáy vùng cuộn: danh sách phiếu dài cả trăm dòng, để nút trôi
          xuống cuối thì phải cuộn hết mới bấm được (và dễ bị thân modal cắt mất). */}
      {summary.candidates.length > 0 ? (
        <Box
          layoutClassName="sticky bottom-0 z-10 space-y-1.5 pb-1 pt-2"
          backgroundClassName="bg-white dark:bg-slate-800"
        >
          {over ? (
            <Typography size="xs" textClassName="text-amber-600 dark:text-amber-400">
              Tổng chọn {formatVND(pickedTotal)} vượt còn lại {formatVND(remaining)} — hệ thống sẽ tự cắt theo phần còn lại của giao dịch.
            </Typography>
          ) : null}
          <Button
            type="button"
            variant="primary"
            fullWidth
            disabled={busy || pickedCount === 0 || remaining <= 0}
            leftIcon={<Split className="h-4 w-4" />}
            onClick={() => void apply()}
          >
            {remaining <= 0
              ? 'Giao dịch đã rải hết'
              : `Rải vào ${pickedCount} phiếu${pickedCount > 0 ? ` (${formatVND(Math.min(pickedTotal, remaining))})` : ''}`}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
};

export default TxReceiptAllocPanel;
