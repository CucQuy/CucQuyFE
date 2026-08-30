import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Plus,
  Trash2,
} from 'lucide-react';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Field from '@/components/ui/Field';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import BaseModal from '@/components/BaseModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/Table';
import {
  useAdjustmentMutations,
  useAdjustments,
  usePayroll,
} from '@/hooks/queries/useAttendanceQuery';
import { SHIFTS, shiftLabel } from '@/types/attendance';
import type { AttendanceAdjustment, AttendanceShift, PayrollDay, PayrollRow } from '@/types/attendance';
import {
  currentMonth,
  dowLabel,
  fmtDay,
  fmtHours,
  fmtTime,
  monthRange,
  shiftMonth,
  vnd,
} from './payrollUtil';

interface Props {
  month: string;
  onMonthChange: (m: string) => void;
}

type AdjTarget = { employeeId: string; name: string; date: string };

/** Lý do bổ sung công tạo sẵn; "Khác" → nhập tay. */
const ADJUST_REASONS = ['Quên chấm công', 'Làm bù', 'Tăng ca', 'Đi trễ/về sớm có phép', 'Nghỉ có phép'];
const OTHER = 'Khác';

/** Số giờ của 1 ca (từ khung giờ trong SHIFTS, vd '08:00–12:00' → 4). */
const caHours = (code: string): number => {
  const t = SHIFTS.find((s) => s.value === code)?.time ?? '';
  const [a, b] = t.split(/[–-]/).map((x) => x.trim());
  if (!a || !b) return 0;
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const mins = toMin(b) - toMin(a);
  return mins > 0 ? Math.round((mins / 60) * 100) / 100 : 0;
};

/** SỔ CÔNG & LƯƠNG: danh sách MỌI nhân viên theo tháng, bấm bung chi tiết từng ngày
 *  (đăng ký ca + chấm công + công/giờ), bổ sung công tại chỗ, xuất Excel. */
const TimesheetTab: React.FC<Props> = ({ month, onMonthChange }) => {
  // (1) state
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [adjTarget, setAdjTarget] = useState<AdjTarget | null>(null);
  const [selectedShifts, setSelectedShifts] = useState<Set<AttendanceShift>>(new Set()); // ca cần bổ sung
  const [reasonChoice, setReasonChoice] = useState(''); // lý do chọn sẵn ('' | preset | 'Khác')
  const [reasonOther, setReasonOther] = useState(''); // nhập tay khi chọn "Khác"
  const [saving, setSaving] = useState(false);

  // (2) data
  const range = useMemo(() => monthRange(month), [month]);
  const { data: payroll, loading } = usePayroll(range, true);
  const { rows: adjustments } = useAdjustments(range, true);
  const { addAdjustment, deleteAdjustment } = useAdjustmentMutations();

  const employees = payroll?.employees ?? [];

  /** Bổ sung công theo (NV|ngày) để hiện + xoá trong chi tiết. */
  const adjByKey = useMemo(() => {
    const map = new Map<string, AttendanceAdjustment[]>();
    for (const a of adjustments) {
      const k = `${a.employeeId}|${a.workDate}`;
      const arr = map.get(k) ?? [];
      arr.push(a);
      map.set(k, arr);
    }
    return map;
  }, [adjustments]);

  const modalAdjs = adjTarget ? adjByKey.get(`${adjTarget.employeeId}|${adjTarget.date}`) ?? [] : [];
  // Ca cho phép bổ sung = ca ĐÃ ĐĂNG KÝ của ngày đang chọn (nếu ngày chưa đăng ký ca nào thì cho chọn cả 3).
  const modalDay = adjTarget
    ? payroll?.employees?.find((e) => e.employeeId === adjTarget.employeeId)?.days.find((d) => d.date === adjTarget.date)
    : undefined;
  const registeredCodes = modalDay?.shifts.filter((s) => s.registered).map((s) => s.code) ?? [];
  const chipShifts = registeredCodes.length ? SHIFTS.filter((s) => registeredCodes.includes(s.value)) : SHIFTS;

  // (3) handlers
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openAdjust = (employeeId: string, name: string, date: string) => {
    setAdjTarget({ employeeId, name, date });
    setSelectedShifts(new Set());
    setReasonChoice('');
    setReasonOther('');
  };

  const toggleShift = (code: AttendanceShift) =>
    setSelectedShifts((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const submitAdjust = async () => {
    if (!adjTarget) return;
    if (!adjTarget.date) {
      toast.error('Chọn ngày bổ sung.');
      return;
    }
    // Bỏ qua ca đã bổ sung sẵn trong ngày (tránh trùng).
    const existing = new Set(modalAdjs.map((a) => a.shiftCode).filter(Boolean));
    const toAdd = [...selectedShifts].filter((c) => !existing.has(c));
    if (toAdd.length === 0) {
      toast.error('Chọn ca cần bổ sung.');
      return;
    }
    const finalReason = (reasonChoice === OTHER ? reasonOther.trim() : reasonChoice) || undefined;
    setSaving(true);
    try {
      for (const code of toAdd) {
        await addAdjustment({ employeeId: adjTarget.employeeId, workDate: adjTarget.date, hours: caHours(code), shiftCode: code, reason: finalReason });
      }
      toast.success(`Đã bổ sung ${toAdd.length} ca cho ${adjTarget.name}.`);
      setAdjTarget(null); // bổ sung xong → tắt modal
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bổ sung thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const removeAdjust = async (a: AttendanceAdjustment) => {
    if (!window.confirm(`Xoá bổ sung ${fmtHours(a.hours)}?`)) return;
    try {
      await deleteAdjustment(a.id);
      toast.success('Đã xoá bổ sung.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xoá thất bại.');
    }
  };

  const exportExcel = async () => {
    if (employees.length === 0) {
      toast.error('Chưa có dữ liệu để xuất.');
      return;
    }
    try {
      const XLSX = await import('xlsx-js-style');
      const header = ['Nhân viên', 'Vị trí', 'Ca đăng ký', 'Ca hợp lệ', 'Tổng công', 'Giờ chấm', 'Giờ bổ sung', 'Tổng giờ', 'Lương (VND)'];
      const body = employees.map((r) => [
        r.name, r.position ?? '', r.registeredShifts, r.validShifts, r.totalCong, r.workHours, r.adjHours, r.totalHours, Math.round(r.salary),
      ]);
      const total = ['TỔNG', '', '', '', '', '', '', payroll?.totalHours ?? 0, Math.round(payroll?.totalSalary ?? 0)];
      const ws = XLSX.utils.aoa_to_sheet([header, ...body, total]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'SoCong');
      XLSX.writeFile(wb, `so-cong-luong-${month}.xlsx`);
    } catch {
      toast.error('Xuất Excel thất bại.');
    }
  };

  const th = 'px-4 py-3';

  // (4) render
  return (
    <Box layoutClassName="flex flex-col gap-4">
      {/* Tổng quan kỳ */}
      <Box layoutClassName="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card padding="lg" borderClassName="border border-slate-200 dark:border-slate-700" backgroundClassName="bg-white dark:bg-slate-800">
          <Typography size="xs" textClassName="text-slate-500 dark:text-slate-400">Tổng lương kỳ</Typography>
          <Typography size="xl" layoutClassName="mt-1 font-bold tabular-nums" textClassName="text-primary-600 dark:text-primary-400">{vnd(payroll?.totalSalary ?? 0)}</Typography>
        </Card>
        <Card padding="lg" borderClassName="border border-slate-200 dark:border-slate-700" backgroundClassName="bg-white dark:bg-slate-800">
          <Typography size="xs" textClassName="text-slate-500 dark:text-slate-400">Tổng giờ làm</Typography>
          <Typography size="xl" layoutClassName="mt-1 font-bold tabular-nums" textClassName="text-slate-900 dark:text-white">{fmtHours(payroll?.totalHours ?? 0)}</Typography>
        </Card>
        <Card padding="lg" borderClassName="border border-slate-200 dark:border-slate-700" backgroundClassName="bg-white dark:bg-slate-800">
          <Typography size="xs" textClassName="text-slate-500 dark:text-slate-400">Số nhân viên</Typography>
          <Typography size="xl" layoutClassName="mt-1 font-bold tabular-nums" textClassName="text-slate-900 dark:text-white">{employees.length}</Typography>
        </Card>
      </Box>

      {/* Toolbar + danh sách trong 1 container */}
      <Card padding="none" layoutClassName="overflow-hidden" borderClassName="border border-slate-200 dark:border-slate-700" backgroundClassName="bg-white dark:bg-slate-800">
        <Box
          layoutClassName="flex flex-wrap items-center gap-3 px-4 py-3"
          borderClassName="border-b border-slate-100 dark:border-slate-700"
        >
          <Box layoutClassName="mr-auto flex items-center gap-1">
            <IconButton label="Tháng trước" size="sm" variant="ghost" onClick={() => onMonthChange(shiftMonth(month, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </IconButton>
            <Input type="month" value={month} onChange={(e) => onMonthChange(e.target.value || currentMonth())} sizeClassName="w-40" />
            <IconButton label="Tháng sau" size="sm" variant="ghost" onClick={() => onMonthChange(shiftMonth(month, 1))}>
              <ChevronRight className="h-4 w-4" />
            </IconButton>
          </Box>
          <Button type="button" variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={exportExcel}>
            Xuất Excel
          </Button>
        </Box>

        <Box layoutClassName="overflow-x-auto">
          {loading ? (
            <Box layoutClassName="p-6"><Spinner size="sm" textClassName="text-primary-500" /></Box>
          ) : employees.length === 0 ? (
            <EmptyState title="Chưa có dữ liệu công trong kỳ này." />
          ) : (
            <Table>
              <TableHead backgroundClassName="bg-slate-50 dark:bg-slate-700/60">
                <TableRow textClassName="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <TableHeaderCell layoutClassName={th}>Nhân viên</TableHeaderCell>
                  <TableHeaderCell layoutClassName={th}>Vị trí</TableHeaderCell>
                  <TableHeaderCell layoutClassName={`${th} text-center`}>Ca ĐK</TableHeaderCell>
                  <TableHeaderCell layoutClassName={`${th} text-center`}>Ca hợp lệ</TableHeaderCell>
                  <TableHeaderCell layoutClassName={`${th} text-center`}>Thiếu ca</TableHeaderCell>
                  <TableHeaderCell layoutClassName={`${th} text-center`}>Công</TableHeaderCell>
                  <TableHeaderCell layoutClassName={`${th} text-center`}>Giờ</TableHeaderCell>
                  <TableHeaderCell layoutClassName={`${th} text-right`}>Lương</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {employees.map((r) => (
                  <EmpRow
                    key={r.employeeId}
                    row={r}
                    open={expanded.has(r.employeeId)}
                    onToggle={() => toggle(r.employeeId)}
                    adjByKey={adjByKey}
                    onAdjust={(date) => openAdjust(r.employeeId, r.name, date)}
                    onRemoveAdjust={removeAdjust}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      </Card>

      {/* Modal bổ sung công cho 1 NV / 1 ngày */}
      <BaseModal isOpen={!!adjTarget} onClose={() => setAdjTarget(null)} title={`Bổ sung công — ${adjTarget?.name ?? ''}`} size="sm">
        {adjTarget && (
          <Box layoutClassName="flex flex-col gap-4">
            <Field label="Ngày" htmlFor="ts-adj-date">
              <Input id="ts-adj-date" type="date" value={adjTarget.date} onChange={(e) => setAdjTarget({ ...adjTarget, date: e.target.value })} min={range.from} max={range.to} />
            </Field>

            {modalAdjs.length > 0 && (
              <Box layoutClassName="flex flex-col gap-1.5">
                <Typography size="xs" layoutClassName="font-semibold uppercase tracking-wide" textClassName="text-slate-400">Đã bổ sung ngày này</Typography>
                {modalAdjs.map((a) => (
                  <Box key={a.id} layoutClassName="flex items-center justify-between gap-2 px-3 py-1.5" roundedClassName="rounded-lg" backgroundClassName="bg-slate-50 dark:bg-slate-700/40">
                    <Box layoutClassName="flex items-center gap-2">
                      {a.shiftCode && (
                        <Badge size="sm" layoutClassName="px-1.5 py-0.5 text-[10px]" backgroundClassName="bg-emerald-50 dark:bg-emerald-900/20" textClassName="text-emerald-700 dark:text-emerald-300">
                          {shiftLabel(a.shiftCode)}
                        </Badge>
                      )}
                      <Badge size="sm" layoutClassName="px-1.5 py-0.5 text-[10px]" backgroundClassName="bg-amber-50 dark:bg-amber-900/20" textClassName="text-amber-600 dark:text-amber-400">
                        {a.hours > 0 ? '+' : ''}{fmtHours(a.hours)}
                      </Badge>
                      {a.reason && <Typography as="span" size="xs" textClassName="text-slate-500 dark:text-slate-400">{a.reason}</Typography>}
                    </Box>
                    <IconButton label="Xoá" size="sm" variant="ghost" onClick={() => removeAdjust(a)}>
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}

            {/* Chọn ca cần bổ sung (hoặc Tất cả) — mỗi ca +số giờ của ca đó */}
            <Field label="Bổ sung ca" htmlFor="ts-adj-shifts">
              <Box layoutClassName="flex flex-wrap items-center gap-2">
                {chipShifts.map((s) => {
                  const on = selectedShifts.has(s.value);
                  return (
                    <Button
                      key={s.value}
                      type="button"
                      size="sm"
                      variant={on ? 'primary' : 'secondary'}
                      onClick={() => toggleShift(s.value)}
                      roundedClassName="rounded-full"
                      sizeClassName="px-3 py-1 text-xs"
                      borderClassName={on ? 'border border-primary-600' : 'border border-slate-200 dark:border-slate-600'}
                      backgroundClassName={on ? 'bg-primary-600' : 'bg-white dark:bg-slate-800'}
                      textClassName={on ? 'font-medium text-white' : 'text-slate-700 dark:text-slate-200'}
                      disableVariantHover
                      disableVariantTextColor
                    >
                      {s.label} ({fmtHours(caHours(s.value))})
                    </Button>
                  );
                })}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  sizeClassName="px-2 py-1 text-xs"
                  onClick={() => setSelectedShifts(new Set(chipShifts.map((s) => s.value)))}
                >
                  Tất cả
                </Button>
              </Box>
            </Field>
            <Field label="Lý do" htmlFor="ts-adj-reason">
              <Select id="ts-adj-reason" value={reasonChoice} onChange={(e) => setReasonChoice(e.target.value)} fullWidth>
                <option value="">— Chọn lý do —</option>
                {ADJUST_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                <option value={OTHER}>{OTHER}…</option>
              </Select>
            </Field>
            {reasonChoice === OTHER && (
              <Field label="Lý do khác" htmlFor="ts-adj-reason-other">
                <Input id="ts-adj-reason-other" value={reasonOther} onChange={(e) => setReasonOther(e.target.value)} placeholder="Nhập lý do…" />
              </Field>
            )}
            <Box layoutClassName="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setAdjTarget(null)}>Đóng</Button>
              <Button type="button" variant="primary" size="sm" disabled={saving} leftIcon={<Plus className="h-4 w-4" />} onClick={submitAdjust}>Thêm</Button>
            </Box>
          </Box>
        )}
      </BaseModal>
    </Box>
  );
};

// ── 1 nhân viên: dòng tổng (bấm bung) + chi tiết theo ngày ──
const EmpRow: React.FC<{
  row: PayrollRow;
  open: boolean;
  onToggle: () => void;
  adjByKey: Map<string, AttendanceAdjustment[]>;
  onAdjust: (date: string) => void;
  onRemoveAdjust: (a: AttendanceAdjustment) => void;
}> = ({ row, open, onToggle, adjByKey, onAdjust, onRemoveAdjust }) => {
  const td = 'px-4 py-3';
  const missingRate = row.days.some((d) => d.hours > 0 && d.rate == null);
  const today = todayStr();
  // Thiếu ca = ca đăng ký nhưng CHƯA làm và CHƯA bổ sung (còn cần xử lý).
  // Ngày CHƯA TỚI không tính (chưa đến hạn làm nên không thể "vắng").
  const missedShifts = row.days.reduce((n, d) => {
    if (d.date > today) return n;
    const adjs = adjByKey.get(`${row.employeeId}|${d.date}`) ?? [];
    const adjCodes = new Set(adjs.map((a) => a.shiftCode).filter(Boolean));
    const generalAdj = adjs.some((a) => !a.shiftCode && a.hours > 0);
    return n + d.shifts.filter((s) => s.registered && !s.valid && !adjCodes.has(s.code) && !generalAdj).length;
  }, 0);
  return (
    <>
      <TableRow
        borderClassName="border-b border-slate-100 dark:border-slate-700/60"
        layoutClassName="cursor-pointer"
        hoverClassName="hover:bg-slate-50 dark:hover:bg-slate-700/40"
        stateClassName="transition-colors"
        onClick={onToggle}
      >
        <TableCell layoutClassName={`${td} whitespace-nowrap`}>
          <Box layoutClassName="flex items-center gap-1.5">
            {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
            <Typography as="span" size="sm" layoutClassName="font-medium" textClassName="text-slate-800 dark:text-slate-100">{row.name}</Typography>
          </Box>
        </TableCell>
        <TableCell layoutClassName={`${td} whitespace-nowrap`}>
          <Typography as="span" size="sm" textClassName="text-slate-600 dark:text-slate-300">{row.position || '—'}</Typography>
        </TableCell>
        <TableCell layoutClassName={`${td} text-center whitespace-nowrap`}>
          <Typography as="span" size="sm" layoutClassName="tabular-nums" textClassName="text-slate-600 dark:text-slate-300">{row.registeredShifts}</Typography>
        </TableCell>
        <TableCell layoutClassName={`${td} text-center whitespace-nowrap`}>
          <Typography as="span" size="sm" layoutClassName="tabular-nums" textClassName="text-emerald-600 dark:text-emerald-400">{row.validShifts}</Typography>
        </TableCell>
        <TableCell layoutClassName={`${td} text-center whitespace-nowrap`}>
          {missedShifts > 0 ? (
            <Badge size="sm" layoutClassName="inline-flex px-2 py-0.5 text-[10px] font-semibold" backgroundClassName="bg-rose-50 dark:bg-rose-900/20" textClassName="text-rose-600 dark:text-rose-400">{missedShifts}</Badge>
          ) : (
            <Typography as="span" size="sm" layoutClassName="tabular-nums" textClassName="text-slate-300 dark:text-slate-600">0</Typography>
          )}
        </TableCell>
        <TableCell layoutClassName={`${td} text-center whitespace-nowrap`}>
          <Typography as="span" size="sm" layoutClassName="tabular-nums" textClassName="text-slate-700 dark:text-slate-200">{row.totalCong}</Typography>
        </TableCell>
        <TableCell layoutClassName={`${td} text-center whitespace-nowrap`}>
          <Box layoutClassName="inline-flex items-center gap-1">
            <Typography as="span" size="sm" layoutClassName="tabular-nums" textClassName="text-slate-700 dark:text-slate-200">{fmtHours(row.totalHours)}</Typography>
            {row.adjHours !== 0 && (
              <Badge size="sm" layoutClassName="px-1.5 py-0.5 text-[10px]" backgroundClassName="bg-amber-50 dark:bg-amber-900/20" textClassName="text-amber-600 dark:text-amber-400">
                {row.adjHours > 0 ? '+' : ''}{fmtHours(row.adjHours)}
              </Badge>
            )}
          </Box>
        </TableCell>
        <TableCell layoutClassName={`${td} text-right whitespace-nowrap`}>
          <Box layoutClassName="inline-flex items-center gap-1">
            {missingRate && (
              <Badge size="sm" layoutClassName="px-1.5 py-0.5 text-[10px]" backgroundClassName="bg-amber-50 dark:bg-amber-900/20" textClassName="text-amber-600 dark:text-amber-400">chưa đặt mức</Badge>
            )}
            <Typography as="span" size="sm" layoutClassName="font-semibold tabular-nums" textClassName="text-primary-600 dark:text-primary-400">{vnd(row.salary)}</Typography>
          </Box>
        </TableCell>
      </TableRow>

      {open && (
        <TableRow backgroundClassName="bg-slate-50/60 dark:bg-slate-900/30">
          <TableCell layoutClassName="px-4 py-3" colSpan={8}>
            <DayDetail row={row} adjByKey={adjByKey} onAdjust={onAdjust} onRemoveAdjust={onRemoveAdjust} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

// ── Chi tiết theo ngày của 1 NV ──
const DayDetail: React.FC<{
  row: PayrollRow;
  adjByKey: Map<string, AttendanceAdjustment[]>;
  onAdjust: (date: string) => void;
  onRemoveAdjust: (a: AttendanceAdjustment) => void;
}> = ({ row, adjByKey, onAdjust, onRemoveAdjust }) => {
  const td = 'px-3 py-2';
  if (row.days.length === 0) {
    return <Typography size="sm" textClassName="text-slate-500 dark:text-slate-400">Không có công/chấm công trong tháng.</Typography>;
  }
  return (
    <Box layoutClassName="overflow-x-auto">
      <Table>
        <TableHead>
          <TableRow textClassName="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <TableHeaderCell layoutClassName={td}>Ngày</TableHeaderCell>
            <TableHeaderCell layoutClassName={td}>Đăng ký ca</TableHeaderCell>
            <TableHeaderCell layoutClassName={td}>Chấm công</TableHeaderCell>
            <TableHeaderCell layoutClassName={`${td} text-center`}>Trạng thái</TableHeaderCell>
            <TableHeaderCell layoutClassName={`${td} text-center`}>Công</TableHeaderCell>
            <TableHeaderCell layoutClassName={`${td} text-center`}>Giờ</TableHeaderCell>
            <TableHeaderCell layoutClassName={`${td} text-right`}> </TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {row.days.map((d) => (
            <DayRow
              key={d.date}
              day={d}
              adjustments={adjByKey.get(`${row.employeeId}|${d.date}`) ?? []}
              onAdjust={() => onAdjust(d.date)}
            />
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};

/** yyyy-mm-dd theo giờ máy (= giờ VN của quán). */
const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ── 1 dòng ngày: đăng ký ca + chấm công + hợp lệ + công + giờ ──
/** Trạng thái chấm công trong ngày so với ca đăng ký. */
const dayStatus = (
  day: PayrollDay,
  today: string,
): 'off' | 'full' | 'short' | 'absent' | 'upcoming' => {
  // Ngày CHƯA TỚI: không tính vắng/thiếu — chỉ là "sắp tới" nếu có đăng ký.
  if (day.date > today) return day.registered > 0 ? 'upcoming' : 'off';
  const reg = day.registered;
  const workedUnreg = day.shifts.filter((s) => s.worked && !s.registered).length;
  if (reg === 0 && workedUnreg === 0 && !day.in) return 'off';
  if (reg > 0 && day.valid === 0) return 'absent'; // đăng ký mà không đủ 1 công nào
  if (day.valid === reg && workedUnreg === 0) return 'full'; // làm đúng & đủ ca đăng ký
  return 'short'; // thiếu ca so với đăng ký, hoặc chấm ngoài đăng ký (không tính)
};

const DayRow: React.FC<{
  day: PayrollDay;
  adjustments: AttendanceAdjustment[];
  onAdjust: () => void;
}> = ({ day, adjustments, onAdjust }) => {
  const td = 'px-3 py-2';
  const adjustedCodes = new Set(adjustments.map((a) => a.shiftCode).filter(Boolean));
  // Bổ sung CHUNG (không gắn ca, vd dữ liệu cũ / bổ sung cả ngày) → coi mọi ca đăng ký là đã bù.
  const hasGeneralAdj = adjustments.some((a) => !a.shiftCode && a.hours > 0);
  // Ca hiển thị = ca đăng ký HOẶC ca được bổ sung; xanh khi hợp lệ hoặc đã bổ sung.
  const shownShifts = day.shifts.filter((s) => s.registered || adjustedCodes.has(s.code));
  const hasAtt = !!day.in;
  const hasAdj = adjustments.length > 0 || day.adjHours !== 0;
  const today = todayStr();
  const isToday = day.date === today;
  const status = dayStatus(day, today);

  return (
    <TableRow
      borderClassName="border-b border-slate-100 dark:border-slate-700/40 last:border-0"
      backgroundClassName={isToday ? 'bg-primary-50 dark:bg-primary-900/20' : undefined}>
      <TableCell layoutClassName={`${td} whitespace-nowrap`}>
        <Box layoutClassName="flex items-baseline gap-1.5">
          <Typography as="span" size="xs" layoutClassName="font-medium tabular-nums" textClassName={isToday ? 'text-primary-600 dark:text-primary-300 font-semibold' : 'text-slate-800 dark:text-slate-100'}>{fmtDay(day.date)}</Typography>
          <Typography as="span" size="xs" textClassName="text-slate-400">{dowLabel(day.date)}</Typography>
          {isToday && (
            <Badge size="sm" layoutClassName="px-1.5 py-0.5 text-[9px] font-semibold" backgroundClassName="bg-primary-100 dark:bg-primary-900/40" textClassName="text-primary-700 dark:text-primary-300">hôm nay</Badge>
          )}
        </Box>
      </TableCell>
      {/* Đăng ký ca — ca đủ giờ (hợp lệ) HOẶC đã bổ sung → xanh, còn lại xám */}
      <TableCell layoutClassName={`${td} whitespace-nowrap`}>
        {shownShifts.length === 0 ? (
          <Typography as="span" size="xs" textClassName="text-slate-300 dark:text-slate-600">—</Typography>
        ) : (
          <Box layoutClassName="flex flex-wrap gap-1">
            {shownShifts.map((s) => {
              const green = s.valid || adjustedCodes.has(s.code) || (hasGeneralAdj && s.registered);
              return (
                <Badge
                  key={s.code}
                  size="sm"
                  layoutClassName="px-1.5 py-0.5 text-[10px]"
                  backgroundClassName={green ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-slate-100 dark:bg-slate-700'}
                  textClassName={green ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-500'}
                >
                  {s.name}
                </Badge>
              );
            })}
          </Box>
        )}
      </TableCell>
      {/* Chấm công (giờ vào → ra) */}
      <TableCell layoutClassName={`${td} whitespace-nowrap`}>
        {hasAtt ? (
          <Typography as="span" size="xs" layoutClassName="tabular-nums" textClassName="text-slate-700 dark:text-slate-200">
            {fmtTime(day.in)} → {day.out ? fmtTime(day.out) : '…'}
          </Typography>
        ) : (
          <Typography as="span" size="xs" textClassName="text-slate-300 dark:text-slate-600">—</Typography>
        )}
      </TableCell>
      {/* Trạng thái: đã bổ sung > đủ / thiếu / vắng */}
      <TableCell layoutClassName={`${td} text-center whitespace-nowrap`}>
        {hasAdj ? (
          <Badge size="sm" layoutClassName="inline-flex px-2 py-0.5 text-[10px] font-semibold" backgroundClassName="bg-sky-50 dark:bg-sky-900/20" textClassName="text-sky-700 dark:text-sky-300">Đã bổ sung</Badge>
        ) : status === 'full' ? (
          <Badge size="sm" layoutClassName="inline-flex px-2 py-0.5 text-[10px] font-semibold" backgroundClassName="bg-emerald-50 dark:bg-emerald-900/20" textClassName="text-emerald-700 dark:text-emerald-300">Đủ công</Badge>
        ) : status === 'short' ? (
          <Badge size="sm" layoutClassName="inline-flex px-2 py-0.5 text-[10px] font-semibold" backgroundClassName="bg-amber-50 dark:bg-amber-900/20" textClassName="text-amber-600 dark:text-amber-400">Thiếu công</Badge>
        ) : status === 'absent' ? (
          <Badge size="sm" layoutClassName="inline-flex px-2 py-0.5 text-[10px] font-semibold" backgroundClassName="bg-rose-50 dark:bg-rose-900/20" textClassName="text-rose-600 dark:text-rose-400">Vắng</Badge>
        ) : status === 'upcoming' ? (
          <Badge size="sm" layoutClassName="inline-flex px-2 py-0.5 text-[10px] font-semibold" backgroundClassName="bg-slate-100 dark:bg-slate-700" textClassName="text-slate-500 dark:text-slate-400">Chưa tới</Badge>
        ) : (
          <Typography as="span" size="xs" textClassName="text-slate-300 dark:text-slate-600">—</Typography>
        )}
      </TableCell>
      {/* Công */}
      <TableCell layoutClassName={`${td} text-center whitespace-nowrap`}>
        <Typography as="span" size="xs" layoutClassName="tabular-nums" textClassName="text-slate-600 dark:text-slate-300">{day.cong}</Typography>
      </TableCell>
      {/* Giờ (+ bổ sung) */}
      <TableCell layoutClassName={`${td} text-center whitespace-nowrap`}>
        <Box layoutClassName="inline-flex items-center gap-1">
          <Typography as="span" size="xs" layoutClassName="tabular-nums" textClassName="text-slate-700 dark:text-slate-200">{fmtHours(day.hours)}</Typography>
          {day.adjHours !== 0 && (
            <Badge size="sm" layoutClassName="px-1.5 py-0.5 text-[10px]" backgroundClassName="bg-amber-50 dark:bg-amber-900/20" textClassName="text-amber-600 dark:text-amber-400">
              {day.adjHours > 0 ? '+' : ''}{fmtHours(day.adjHours)}
            </Badge>
          )}
        </Box>
      </TableCell>
      {/* Bổ sung → nút Chỉnh sửa khi đã có bổ sung */}
      <TableCell layoutClassName={`${td} text-right whitespace-nowrap`}>
        <Button type="button" variant={hasAdj ? 'secondary' : 'ghost'} size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={onAdjust}>
          {hasAdj ? 'Chỉnh sửa' : 'Bổ sung'}
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default TimesheetTab;
