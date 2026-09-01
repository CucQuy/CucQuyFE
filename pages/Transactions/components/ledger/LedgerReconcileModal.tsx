import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowDownCircle, ArrowUpCircle, Inbox, RotateCcw, PackageOpen, Truck, Coins, Check, Search,
} from 'lucide-react';
import { LedgerTransaction, EXPENSE_CATEGORIES, expenseCategoryIsCost } from '@/types';
import {
  fetchLedger, fetchInCandidateOrders, setTxShipping, setTransactionExpense,
  type InCandidateOrder,
} from '@/services/transactionService';
import { reconcileOrderTransaction, createOrderRefund, REFUND_CATEGORIES, type RefundCategory } from '@/services/orderService';
import { fetchCarriers, type Carrier } from '@/services/carrierService';
import { useOrders } from '@/hooks/useOrders';
import { formatVND } from '@/utils/format/currencyUtil';
import BaseModal from '@/components/BaseModal';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Typography from '@/components/ui/Typography';
import Spinner from '@/components/ui/Spinner';
import TxReceiptAllocPanel from '../TxReceiptAllocPanel';
import type { Order } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fromDate: string;
  toDate: string;
  /** Gọi sau mỗi lần đối soát để refetch bảng sổ phía sau. */
  onChanged: () => void;
}

const fmtDate = (v?: string | null): string => {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Loại đối soát cho 1 giao dịch tiền RA. */
type OutKind = 'refund' | 'stock' | 'shipping' | 'expense';

/**
 * Modal ĐỐI SOÁT gộp trên Sổ giao dịch: cột trái = các GD chưa khớp (vào + ra),
 * cột phải = options theo KIỂU (đơn / phiếu nhập / hoàn tiền / ship / chi phí) — điều kiện chặt.
 */
const LedgerReconcileModal: React.FC<Props> = ({ isOpen, onClose, fromDate, toDate, onChanged }) => {
  const [items, setItems] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchLedger({
        from: fromDate,
        to: toDate ? `${toDate.slice(0, 10)} 23:59:59` : '',
        status: 'unmatched',
        limit: 300,
      });
      setItems(res.items);
      setSelectedId((prev) => (prev && res.items.some((it) => it.id === prev) ? prev : (res.items[0]?.id ?? null)));
    } catch {
      toast.error('Không tải được danh sách giao dịch chưa khớp.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fromDate, toDate]);

  const selected = useMemo(() => items.find((it) => it.id === selectedId) ?? null, [items, selectedId]);

  // Sau khi 1 GD được khớp: bỏ khỏi danh sách + chọn GD kế + refetch bảng sổ.
  const onMatched = (txId: string) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== txId);
      setSelectedId((cur) => (cur === txId ? (next[0]?.id ?? null) : cur));
      return next;
    });
    onChanged();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Đối soát giao dịch chưa khớp" size="2xl">
      <Box layoutClassName="flex h-[70vh] flex-col gap-3 sm:flex-row">
        {/* Cột trái: danh sách GD chưa khớp */}
        <Box
          layoutClassName="flex min-h-0 flex-col sm:w-[42%]"
          borderClassName="border-b border-slate-200 pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3 dark:border-slate-700"
        >
          <Box layoutClassName="mb-2 flex items-center justify-between gap-2">
            <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-700 dark:text-slate-200">
              Chưa khớp ({items.length})
            </Typography>
            <Button
              type="button" variant="ghost" size="sm" disabled={loading}
              leftIcon={<RotateCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />}
              onClick={() => void load()}
            >
              Tải lại
            </Button>
          </Box>

          {loading ? (
            <Box layoutClassName="flex flex-1 items-center justify-center py-10">
              <Spinner size="md" textClassName="text-primary-500" />
            </Box>
          ) : items.length === 0 ? (
            <Box layoutClassName="flex flex-1 flex-col items-center justify-center gap-2 py-10" textClassName="text-slate-400 dark:text-slate-500">
              <Inbox className="h-8 w-8 opacity-40" />
              <Typography size="sm" variant="muted">Tất cả giao dịch trong kỳ đã khớp 🎉</Typography>
            </Box>
          ) : (
            <Box layoutClassName="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
              {items.map((it) => {
                const out = it.transferType === 'out';
                const active = it.id === selectedId;
                return (
                  <Box
                    key={it.id}
                    onClick={() => setSelectedId(it.id)}
                    layoutClassName="flex cursor-pointer items-center gap-2 rounded-lg p-2.5"
                    borderClassName={active ? 'border border-primary-300 dark:border-primary-700' : 'border border-slate-100 dark:border-slate-700'}
                    backgroundClassName={active ? 'bg-primary-50/60 dark:bg-primary-900/10' : 'bg-white dark:bg-slate-800'}
                  >
                    {out ? <ArrowUpCircle className="h-4 w-4 shrink-0 text-rose-500" /> : <ArrowDownCircle className="h-4 w-4 shrink-0 text-emerald-500" />}
                    <Box layoutClassName="min-w-0 flex-1">
                      <Typography as="p" size="sm" layoutClassName="truncate font-medium" textClassName="text-slate-800 dark:text-slate-100">
                        {it.content || it.description || '(không nội dung)'}
                      </Typography>
                      <Typography as="p" size="xs" layoutClassName="truncate" textClassName="text-slate-400 dark:text-slate-500">
                        {fmtDate(it.transactionDate)}{it.gateway ? ` · ${it.gateway}` : ''}
                      </Typography>
                    </Box>
                    <Typography as="span" size="sm" layoutClassName="shrink-0 font-semibold" textClassName={out ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                      {out ? '−' : '+'}{formatVND(it.transferAmount)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        {/* Cột phải: options theo kiểu */}
        <Box layoutClassName="flex min-h-0 flex-1 flex-col">
          {!selected ? (
            <Box layoutClassName="flex flex-1 items-center justify-center py-10">
              <Typography size="sm" variant="muted">Chọn một giao dịch bên trái để đối soát.</Typography>
            </Box>
          ) : selected.transferType === 'out' ? (
            <OutReconcile key={selected.id} tx={selected} onMatched={() => onMatched(selected.id)} />
          ) : (
            <InReconcile key={selected.id} tx={selected} onMatched={() => onMatched(selected.id)} />
          )}
        </Box>
      </Box>
    </BaseModal>
  );
};

/* ─────────────────────────── TIỀN VÀO → khớp ĐƠN ─────────────────────────── */

const matchLabel: Record<NonNullable<InCandidateOrder['match']>, string> = {
  total: 'đúng tổng',
  remaining: 'đúng còn thiếu',
  deposit: 'đúng cọc',
};

const InReconcile: React.FC<{ tx: LedgerTransaction; onMatched: () => void }> = ({ tx, onMatched }) => {
  const [cands, setCands] = useState<InCandidateOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchInCandidateOrders(tx.id)
      .then((c) => { if (live) setCands(c); })
      .catch(() => { if (live) toast.error('Không tải được đơn ứng viên.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [tx.id]);

  const pick = async (o: InCandidateOrder) => {
    setBusy(true);
    try {
      await reconcileOrderTransaction(o.orderId, tx.id);
      toast.success(`Đã khớp ${formatVND(tx.transferAmount)} vào ${o.orderNumber ?? 'đơn'}.`);
      onMatched();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Khớp đơn thất bại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box layoutClassName="flex min-h-0 flex-1 flex-col">
      <TxHeader tx={tx} kindLabel="Tiền vào · thanh toán đơn" />
      {loading ? (
        <Box layoutClassName="flex flex-1 items-center justify-center py-10"><Spinner size="md" textClassName="text-primary-500" /></Box>
      ) : cands.length === 0 ? (
        <Box layoutClassName="flex flex-1 flex-col items-center justify-center gap-2 py-8" textClassName="text-slate-400">
          <Inbox className="h-7 w-7 opacity-40" />
          <Typography size="xs" variant="muted">Không có đơn nào khớp số tiền {formatVND(tx.transferAmount)} trong ~10 ngày.</Typography>
        </Box>
      ) : (
        <Box layoutClassName="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {cands.map((o) => (
            <Box
              key={o.orderId}
              layoutClassName="flex items-center gap-2 rounded-lg p-2.5"
              borderClassName="border border-slate-100 dark:border-slate-700"
              backgroundClassName="bg-white dark:bg-slate-800"
            >
              <Box layoutClassName="min-w-0 flex-1">
                <Box layoutClassName="flex items-center gap-1.5">
                  <Typography as="span" size="sm" layoutClassName="truncate font-semibold" textClassName="text-slate-800 dark:text-slate-100">
                    {o.orderNumber ?? '(chưa mã)'} · {o.customer ?? '—'}
                  </Typography>
                  {o.match ? (
                    <Badge size="sm" backgroundClassName="bg-emerald-100 dark:bg-emerald-900/30" textClassName="text-emerald-700 dark:text-emerald-300">
                      {matchLabel[o.match]}
                    </Badge>
                  ) : null}
                </Box>
                <Typography as="p" size="xs" layoutClassName="truncate" textClassName="text-slate-400 dark:text-slate-500">
                  Tổng {formatVND(o.total ?? 0)} · còn thiếu {formatVND(o.remaining)} · {fmtDate(o.createdAt)}
                </Typography>
              </Box>
              <Button type="button" variant="primary" size="sm" disabled={busy} leftIcon={<Check className="h-3.5 w-3.5" />} onClick={() => void pick(o)}>
                Khớp
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

/* ─────────────────────────── TIỀN RA → chọn kiểu ─────────────────────────── */

const OUT_KINDS: { id: OutKind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'refund', label: 'Hoàn tiền', icon: RotateCcw },
  { id: 'stock', label: 'Nhập hàng', icon: PackageOpen },
  { id: 'shipping', label: 'Phí ship', icon: Truck },
  { id: 'expense', label: 'Chi phí', icon: Coins },
];

const OutReconcile: React.FC<{ tx: LedgerTransaction; onMatched: () => void }> = ({ tx, onMatched }) => {
  const [kind, setKind] = useState<OutKind>('stock');

  return (
    <Box layoutClassName="flex min-h-0 flex-1 flex-col">
      <TxHeader tx={tx} kindLabel="Tiền ra" />
      {/* Bộ chọn kiểu */}
      <Box layoutClassName="mb-3 grid grid-cols-4 gap-1.5">
        {OUT_KINDS.map((k) => {
          const active = kind === k.id;
          const Icon = k.icon;
          return (
            <Button
              key={k.id}
              type="button"
              variant={active ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setKind(k.id)}
              disableVariantHover
              disableVariantTextColor
              layoutClassName="flex flex-col items-center gap-1 py-2"
              roundedClassName="rounded-lg"
              borderClassName="border border-slate-200 dark:border-slate-600"
              backgroundClassName={active ? 'bg-primary-600' : 'bg-white dark:bg-slate-800'}
              textClassName={active ? 'text-white' : 'text-slate-600 dark:text-slate-300'}
            >
              <Icon className="h-4 w-4" />
              {k.label}
            </Button>
          );
        })}
      </Box>

      <Box layoutClassName="min-h-0 flex-1 overflow-y-auto pr-1">
        {kind === 'stock' ? (
          <TxReceiptAllocPanel txId={tx.id} onChanged={onMatched} />
        ) : kind === 'refund' ? (
          <RefundPicker tx={tx} onMatched={onMatched} />
        ) : kind === 'shipping' ? (
          <ShippingPicker tx={tx} onMatched={onMatched} />
        ) : (
          <ExpensePicker tx={tx} onMatched={onMatched} />
        )}
      </Box>
    </Box>
  );
};

/* ---- Hoàn tiền: chọn đơn + hạng mục ---- */
const RefundPicker: React.FC<{ tx: LedgerTransaction; onMatched: () => void }> = ({ tx, onMatched }) => {
  const [category, setCategory] = useState<RefundCategory>('overcollected_cod');
  const [busy, setBusy] = useState(false);
  const apply = async (o: Order) => {
    setBusy(true);
    try {
      await createOrderRefund(o.id, { amount: tx.transferAmount, category, transactionId: tx.id });
      toast.success(`Đã tạo hoàn ${formatVND(tx.transferAmount)} cho ${o.orderNumber ?? 'đơn'}.`);
      onMatched();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Tạo hoàn tiền thất bại.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box layoutClassName="space-y-2.5">
      <Box layoutClassName="flex items-center gap-2">
        <Typography as="span" size="xs" layoutClassName="shrink-0 font-medium" textClassName="text-slate-500 dark:text-slate-400">Hạng mục</Typography>
        <Select value={category} onChange={(e) => setCategory((e.target.value || 'other') as RefundCategory)} sizeClassName="min-w-40 px-2.5 py-1.5 text-sm">
          {REFUND_CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
        </Select>
      </Box>
      <OrderSearchList busy={busy} actionLabel="Tạo hoàn" onPick={apply} />
    </Box>
  );
};

/* ---- Phí ship: đơn HOẶC nhà xe ---- */
const ShippingPicker: React.FC<{ tx: LedgerTransaction; onMatched: () => void }> = ({ tx, onMatched }) => {
  const [target, setTarget] = useState<'order' | 'carrier'>('carrier');
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [carrierId, setCarrierId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchCarriers().then((cs) => setCarriers(cs.filter((c) => c.active))).catch(() => undefined);
  }, []);

  const applyCarrier = async () => {
    if (!carrierId) { toast.error('Chọn nhà xe.'); return; }
    setBusy(true);
    try {
      await setTxShipping(tx.id, { carrierId, note: note || undefined });
      toast.success('Đã gắn phí ship cho nhà xe.');
      onMatched();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gắn ship thất bại.');
    } finally { setBusy(false); }
  };
  const applyOrder = async (o: Order) => {
    setBusy(true);
    try {
      await setTxShipping(tx.id, { orderId: o.id, note: note || undefined });
      toast.success(`Đã gắn phí ship cho ${o.orderNumber ?? 'đơn'}.`);
      onMatched();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gắn ship thất bại.');
    } finally { setBusy(false); }
  };

  return (
    <Box layoutClassName="space-y-2.5">
      <Box layoutClassName="inline-flex gap-1.5">
        <Button type="button" size="sm" variant={target === 'carrier' ? 'primary' : 'secondary'} onClick={() => setTarget('carrier')}
          disableVariantHover disableVariantTextColor roundedClassName="rounded-lg" borderClassName="border border-slate-200 dark:border-slate-600"
          backgroundClassName={target === 'carrier' ? 'bg-primary-600' : 'bg-white dark:bg-slate-800'} textClassName={target === 'carrier' ? 'text-white' : 'text-slate-600 dark:text-slate-300'}>
          Nhà xe / ĐVVC
        </Button>
        <Button type="button" size="sm" variant={target === 'order' ? 'primary' : 'secondary'} onClick={() => setTarget('order')}
          disableVariantHover disableVariantTextColor roundedClassName="rounded-lg" borderClassName="border border-slate-200 dark:border-slate-600"
          backgroundClassName={target === 'order' ? 'bg-primary-600' : 'bg-white dark:bg-slate-800'} textClassName={target === 'order' ? 'text-white' : 'text-slate-600 dark:text-slate-300'}>
          Cho đơn
        </Button>
      </Box>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (tuỳ chọn)" sizeClassName="w-full px-2.5 py-1.5 text-sm" />

      {target === 'carrier' ? (
        <Box layoutClassName="flex items-center gap-2">
          <Select value={carrierId} onChange={(e) => setCarrierId(e.target.value)} sizeClassName="min-w-48 flex-1 px-2.5 py-1.5 text-sm">
            <option value="">— Chọn nhà xe —</option>
            {carriers.map((c) => (<option key={c.id} value={c.id}>{c.name}{c.type === 'coach' ? ' (xe khách)' : ''}</option>))}
          </Select>
          <Button type="button" variant="primary" size="sm" disabled={busy || !carrierId} leftIcon={<Truck className="h-3.5 w-3.5" />} onClick={() => void applyCarrier()}>
            Gắn {formatVND(tx.transferAmount)}
          </Button>
        </Box>
      ) : (
        <OrderSearchList busy={busy} actionLabel="Gắn ship" onPick={applyOrder} />
      )}
    </Box>
  );
};

/* ---- Chi phí: phân loại nhanh ---- */
const ExpensePicker: React.FC<{ tx: LedgerTransaction; onMatched: () => void }> = ({ tx, onMatched }) => {
  const [busy, setBusy] = useState(false);
  const apply = async (cat: string) => {
    setBusy(true);
    try {
      await setTransactionExpense(tx.id, cat, !expenseCategoryIsCost(cat));
      toast.success('Đã phân loại chi phí.');
      onMatched();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Phân loại thất bại.');
    } finally { setBusy(false); }
  };
  return (
    <Box layoutClassName="space-y-2">
      <Typography size="xs" variant="muted">Chọn hạng mục chi phí cho khoản {formatVND(tx.transferAmount)}:</Typography>
      <Box layoutClassName="flex flex-wrap gap-1.5">
        {EXPENSE_CATEGORIES.map((c) => (
          <Button
            key={c.value}
            type="button" variant="secondary" size="sm" disabled={busy}
            onClick={() => void apply(c.value)}
            roundedClassName="rounded-full" borderClassName="border border-slate-200 dark:border-slate-600"
            backgroundClassName="bg-white dark:bg-slate-800" textClassName="text-slate-700 dark:text-slate-200"
          >
            {c.label}
          </Button>
        ))}
      </Box>
    </Box>
  );
};

/* ---- Ô tìm + chọn ĐƠN dùng chung (hoàn tiền / ship cho đơn) ---- */
const OrderSearchList: React.FC<{ busy: boolean; actionLabel: string; onPick: (o: Order) => void }> = ({ busy, actionLabel, onPick }) => {
  const { orders } = useOrders();
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const base = [...orders].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
    const filtered = kw
      ? base.filter((o) => (o.orderNumber ?? '').toLowerCase().includes(kw) || (o.customer?.name ?? '').toLowerCase().includes(kw) || (o.customer?.phone ?? '').includes(kw))
      : base;
    return filtered.slice(0, 25);
  }, [orders, q]);

  return (
    <Box layoutClassName="space-y-2">
      <Box layoutClassName="flex items-center gap-2 rounded-lg px-2.5 py-1.5" borderClassName="border border-slate-200 dark:border-slate-600" backgroundClassName="bg-white dark:bg-slate-800">
        <Search className="h-3.5 w-3.5 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã đơn / tên / SĐT khách" sizeClassName="w-full px-0 py-0 text-sm" borderClassName="border-0" backgroundClassName="bg-transparent" />
      </Box>
      <Box layoutClassName="max-h-[34vh] space-y-1.5 overflow-y-auto pr-1">
        {results.length === 0 ? (
          <Typography size="xs" variant="muted">Không tìm thấy đơn.</Typography>
        ) : results.map((o) => (
          <Box
            key={o.id}
            layoutClassName="flex items-center gap-2 rounded-lg p-2.5"
            borderClassName="border border-slate-100 dark:border-slate-700"
            backgroundClassName="bg-white dark:bg-slate-800"
          >
            <Box layoutClassName="min-w-0 flex-1">
              <Typography as="p" size="sm" layoutClassName="truncate font-semibold" textClassName="text-slate-800 dark:text-slate-100">
                {o.orderNumber ?? '(chưa mã)'} · {o.customer?.name ?? '—'}
              </Typography>
              <Typography as="p" size="xs" layoutClassName="truncate" textClassName="text-slate-400 dark:text-slate-500">
                Tổng {formatVND(o.total)} · {fmtDate(typeof o.createdAt === 'string' ? o.createdAt : null)}
              </Typography>
            </Box>
            <Button type="button" variant="primary" size="sm" disabled={busy} leftIcon={<Check className="h-3.5 w-3.5" />} onClick={() => onPick(o)}>
              {actionLabel}
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/* ---- Header GD đang đối soát ---- */
const TxHeader: React.FC<{ tx: LedgerTransaction; kindLabel: string }> = ({ tx, kindLabel }) => {
  const out = tx.transferType === 'out';
  return (
    <Box
      layoutClassName="mb-3 rounded-lg p-2.5"
      borderClassName="border border-slate-200 dark:border-slate-700"
      backgroundClassName="bg-slate-50 dark:bg-slate-800/60"
    >
      <Box layoutClassName="flex items-center justify-between gap-2">
        <Typography as="span" size="xs" layoutClassName="font-semibold uppercase" textClassName="text-slate-500 dark:text-slate-400">{kindLabel}</Typography>
        <Typography as="span" size="sm" layoutClassName="font-bold" textClassName={out ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
          {out ? '−' : '+'}{formatVND(tx.transferAmount)}
        </Typography>
      </Box>
      <Typography as="p" size="xs" layoutClassName="mt-0.5 truncate" textClassName="text-slate-500 dark:text-slate-400">
        {tx.content || tx.description || '(không nội dung)'} · {fmtDate(tx.transactionDate)}
      </Typography>
    </Box>
  );
};

export default LedgerReconcileModal;
