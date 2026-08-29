import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, CalendarRange, Lock, Unlock } from 'lucide-react';
import { useEmployees } from '@/hooks/queries/useEmployeesQuery';
import { fetchShifts, fetchShiftAssignments, setDayAssignments } from '@/services/shiftService';
import { fetchWeekSubmissions, reopenWeek } from '@/services/attendanceService';
import { WorkShift } from '@/types/shift';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Typography from '@/components/ui/Typography';
import Spinner from '@/components/ui/Spinner';

const fmt = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const isoDow = (d: Date): number => (d.getDay() === 0 ? 7 : d.getDay());
const DOW_LABEL = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
/** Thứ 2 của TUẦN HIỆN TẠI (admin trực bảng tuần đang chạy). */
const thisMonday = (): Date => {
  const now = new Date();
  const m = addDays(now, -(isoDow(now) - 1));
  m.setHours(0, 0, 0, 0);
  return m;
};

const cellKey = (date: string, shift: string) => `${date}|${shift}`;

/**
 * Bảng QUẢN LÝ đăng ký công (admin): NV × 7 ngày × ca. Admin tick/bỏ tick mọi ngày
 * (kể cả quá khứ). Toggle = gửi trọn danh sách NV của (ngày, ca) qua setDayAssignments.
 */
const AdminShiftBoard: React.FC = () => {
  const { employees, loading: empLoading } = useEmployees();
  const [weekStart, setWeekStart] = useState<Date>(() => thisMonday());
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  // map `${date}|${shift}` -> Set(employeeId đã đăng ký)
  const [reg, setReg] = useState<Map<string, Set<string>>>(new Map());
  // employeeId -> thời điểm chốt (đã chốt tuần này)
  const [submitted, setSubmitted] = useState<Map<string, string>>(new Map());
  const [reopening, setReopening] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const from = fmt(days[0]);
  const to = fmt(days[6]);
  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === 'active'),
    [employees],
  );
  const activeShifts = useMemo(
    () => shifts.filter((s) => s.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [shifts],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sh, assigns, subs] = await Promise.all([
        fetchShifts(),
        fetchShiftAssignments(from, to),
        fetchWeekSubmissions(from),
      ]);
      setShifts(sh);
      const m = new Map<string, Set<string>>();
      for (const a of assigns) {
        const k = cellKey(a.workDate, a.shiftCode);
        if (!m.has(k)) m.set(k, new Set());
        m.get(k)!.add(a.employeeId);
      }
      setReg(m);
      setSubmitted(new Map(subs.map((s) => [s.employeeId, s.submittedAt ?? ''])));
    } catch {
      toast.error('Không tải được bảng đăng ký.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const doReopen = async (empId: string) => {
    if (!window.confirm('Mở lại tuần cho NV này? Họ sẽ đăng ký/sửa lại được.')) return;
    setReopening(empId);
    try {
      await reopenWeek(empId, from);
      setSubmitted((prev) => {
        const nx = new Map(prev);
        nx.delete(empId);
        return nx;
      });
      toast.success('Đã mở lại tuần.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Mở lại thất bại.');
    } finally {
      setReopening(null);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (empId: string, date: string, shiftCode: string) => {
    const k = cellKey(date, shiftCode);
    const cur = new Set(reg.get(k) ?? []);
    if (cur.has(empId)) cur.delete(empId);
    else cur.add(empId);
    // optimistic
    setReg((prev) => {
      const nx = new Map(prev);
      nx.set(k, cur);
      return nx;
    });
    setSaving(`${empId}:${k}`);
    try {
      await setDayAssignments({ workDate: date, shiftCode, employeeIds: Array.from(cur) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lưu thất bại.');
      void load();
    } finally {
      setSaving(null);
    }
  };

  const busy = loading || empLoading;

  return (
    <Card
      padding="none"
      layoutClassName="overflow-hidden"
      borderClassName="border border-slate-200 dark:border-slate-700"
      backgroundClassName="bg-white dark:bg-slate-800"
    >
      {/* Toolbar: điều hướng tuần */}
      <Box
        layoutClassName="flex items-center justify-between gap-2 px-4 py-3"
        borderClassName="border-b border-slate-100 dark:border-slate-700"
      >
        <Button
          type="button"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          variant="secondary"
          leftIcon={<ChevronLeft />}
          iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
          sizeClassName="px-3 py-1.5 text-sm"
          roundedClassName="rounded-lg"
          borderClassName="border border-slate-200 dark:border-slate-600"
          backgroundClassName="bg-white dark:bg-slate-800"
          textClassName="text-slate-700 dark:text-slate-200"
          layoutClassName="inline-flex items-center gap-1"
        >
          Tuần trước
        </Button>
        <Box layoutClassName="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-primary-500" />
          <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-800 dark:text-slate-100">
            {days[0].getDate()}/{days[0].getMonth() + 1} – {days[6].getDate()}/{days[6].getMonth() + 1}
          </Typography>
        </Box>
        <Button
          type="button"
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          variant="secondary"
          sizeClassName="px-3 py-1.5 text-sm"
          roundedClassName="rounded-lg"
          borderClassName="border border-slate-200 dark:border-slate-600"
          backgroundClassName="bg-white dark:bg-slate-800"
          textClassName="text-slate-700 dark:text-slate-200"
          layoutClassName="inline-flex items-center gap-1"
        >
          Tuần sau
          <ChevronRight className="h-4 w-4" />
        </Button>
      </Box>

      <Box layoutClassName="flex flex-col gap-3 p-4">
      <Typography as="p" size="xs" variant="muted">
        Admin tick/bỏ ca đăng ký cho từng NV (sửa được cả ngày quá khứ). NV tự đăng ký ngày tương lai ở trang chấm công.
      </Typography>

      {busy ? (
        <Box layoutClassName="flex items-center justify-center gap-2 py-10">
          <Spinner /> <Typography as="span" size="sm" variant="muted">Đang tải…</Typography>
        </Box>
      ) : (
        <Box layoutClassName="overflow-x-auto">
          <Box layoutClassName="min-w-[860px] space-y-1">
            {/* Header ngày */}
            <Box layoutClassName="flex gap-1">
              <Box layoutClassName="w-36 shrink-0 px-2 py-1.5">
                <Typography as="span" size="xs" layoutClassName="font-semibold uppercase" variant="muted">Nhân viên</Typography>
              </Box>
              {days.map((d) => (
                <Box key={fmt(d)} layoutClassName="flex-1 px-1 py-1.5 text-center">
                  <Typography as="span" size="xs" layoutClassName="font-semibold" textClassName="text-slate-700 dark:text-slate-200">
                    {DOW_LABEL[isoDow(d)]} {d.getDate()}/{d.getMonth() + 1}
                  </Typography>
                </Box>
              ))}
            </Box>

            {activeEmployees.length === 0 ? (
              <Typography as="p" size="sm" variant="muted" layoutClassName="px-2 py-3">
                Chưa có nhân viên active.
              </Typography>
            ) : (
              activeEmployees.map((emp) => (
                <Box
                  key={emp.id}
                  layoutClassName="flex items-stretch gap-1 rounded-lg"
                  borderClassName="border border-slate-200 dark:border-slate-700"
                >
                  <Box layoutClassName="flex w-36 shrink-0 flex-col justify-center gap-0.5 px-2 py-2">
                    <Typography as="span" size="sm" layoutClassName="truncate font-medium" textClassName="text-slate-800 dark:text-slate-100">
                      {emp.name}
                    </Typography>
                    {submitted.has(emp.id) ? (
                      <Box layoutClassName="flex items-center gap-1">
                        <Lock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <Typography as="span" size="xs" textClassName="text-emerald-600 dark:text-emerald-400">
                          Đã chốt
                        </Typography>
                        <Button
                          type="button"
                          onClick={() => void doReopen(emp.id)}
                          disabled={reopening === emp.id}
                          variant="secondary"
                          leftIcon={<Unlock />}
                          iconClassName="inline-flex shrink-0 [&_svg]:h-3 [&_svg]:w-3"
                          sizeClassName="px-1.5 py-0.5 text-[10px]"
                          roundedClassName="rounded"
                          borderClassName="border border-slate-200 dark:border-slate-600"
                          backgroundClassName="bg-white dark:bg-slate-800"
                          textClassName="text-slate-600 dark:text-slate-300"
                          layoutClassName="inline-flex items-center gap-0.5"
                        >
                          Mở lại
                        </Button>
                      </Box>
                    ) : (
                      <Typography as="span" size="xs" variant="muted">Chưa chốt</Typography>
                    )}
                  </Box>
                  {days.map((d) => {
                    const date = fmt(d);
                    return (
                      <Box key={date} layoutClassName="flex flex-1 flex-wrap items-center justify-center gap-1 px-1 py-1.5">
                        {activeShifts.map((s) => {
                          const applicable = s.weekdays.includes(isoDow(d));
                          const on = reg.get(cellKey(date, s.code))?.has(emp.id) ?? false;
                          const isBusy = saving === `${emp.id}:${cellKey(date, s.code)}`;
                          if (!applicable) {
                            return (
                              <Typography key={s.code} as="span" size="xs" variant="muted" layoutClassName="px-1">·</Typography>
                            );
                          }
                          return (
                            <Button
                              key={s.code}
                              type="button"
                              onClick={() => void toggle(emp.id, date, s.code)}
                              disabled={isBusy}
                              variant={on ? 'primary' : 'secondary'}
                              sizeClassName="px-1.5 py-0.5 text-[11px]"
                              roundedClassName="rounded"
                              borderClassName={on ? 'border border-primary-600' : 'border border-slate-200 dark:border-slate-600'}
                              backgroundClassName={on ? 'bg-primary-600' : 'bg-white dark:bg-slate-800'}
                              textClassName={on ? 'font-semibold text-white' : 'text-slate-500 dark:text-slate-400'}
                              layoutClassName="inline-flex items-center"
                              disableVariantHover
                              disableVariantTextColor
                            >
                              {s.code.replace('ca', 'C')}
                            </Button>
                          );
                        })}
                      </Box>
                    );
                  })}
                </Box>
              ))
            )}
          </Box>
        </Box>
      )}
      </Box>
    </Card>
  );
};

export default AdminShiftBoard;
