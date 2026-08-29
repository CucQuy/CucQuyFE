import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, CalendarCheck, Lock, CheckCircle2 } from 'lucide-react';
import { MyShiftWeek } from '@/types/attendance';
import { fetchMyShiftWeek, registerMyShift, submitMyWeek } from '@/services/attendanceService';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Typography from '@/components/ui/Typography';
import Spinner from '@/components/ui/Spinner';

/** yyyy-mm-dd theo giờ địa phương (tránh lệch UTC). */
const fmt = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
/** ISO dow: 1=T2 .. 7=CN. */
const isoDow = (d: Date): number => (d.getDay() === 0 ? 7 : d.getDay());
const DOW_LABEL = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
/** Thứ 2 của TUẦN SAU (mặc định — NV đăng ký cho tuần tới). */
const nextMonday = (): Date => {
  const now = new Date();
  const thisMon = addDays(now, -((isoDow(now) - 1)));
  const m = addDays(thisMon, 7);
  m.setHours(0, 0, 0, 0);
  return m;
};

/**
 * Tab "Đăng ký ca": NV tự tick ca sẽ làm cho từng ngày trong TUẦN (mặc định tuần sau).
 * Chỉ sửa được ngày TƯƠNG LAI (ngày đã tới/qua bị khoá — admin sửa qua trang quản lý).
 */
const RegisterTab: React.FC = () => {
  const [weekStart, setWeekStart] = useState<Date>(() => nextMonday());
  const [data, setData] = useState<MyShiftWeek | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null); // `${date}:${code}` đang lưu
  const [submitting, setSubmitting] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const from = fmt(days[0]);
  const to = fmt(days[6]);
  const today = fmt(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchMyShiftWeek(from, to));
    } catch {
      toast.error('Không tải được lịch đăng ký.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const shifts = data?.shifts ?? [];
  const week = data?.week ?? {};
  const submitted = data?.submission?.submitted ?? false;
  const submittedAt = data?.submission?.submittedAt ?? null;

  const doSubmit = async () => {
    if (submitted || submitting) return;
    const anyRegistered = Object.values(week).some((c) => Array.isArray(c) && c.length > 0);
    const msg = anyRegistered
      ? 'Chốt đăng ký tuần này? Sau khi chốt sẽ KHÔNG sửa được nữa (nhờ quản lý mở lại nếu cần).'
      : 'Bạn chưa tick ca nào. Vẫn chốt (báo là tuần này không đăng ký ca)?';
    if (!window.confirm(msg)) return;
    setSubmitting(true);
    try {
      const s = await submitMyWeek(from);
      setData((prev) => (prev ? { ...prev, submission: s } : prev));
      toast.success('Đã chốt đăng ký tuần.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chốt đăng ký thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = async (date: string, code: string, applicable: boolean, future: boolean) => {
    if (!applicable || !future || submitted) return;
    const cur = week[date] ?? [];
    const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
    setSaving(`${date}:${code}`);
    setData((prev) => (prev ? { ...prev, week: { ...prev.week, [date]: next } } : prev));
    try {
      const r = await registerMyShift(date, next);
      setData((prev) => (prev ? { ...prev, week: { ...prev.week, [date]: r.shiftCodes } } : prev));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lưu đăng ký thất bại.');
      void load();
    } finally {
      setSaving(null);
    }
  };

  return (
    <Box layoutClassName="space-y-4">
      {/* Điều hướng tuần */}
      <Box layoutClassName="flex items-center justify-between gap-2">
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
          <CalendarCheck className="h-4 w-4 text-primary-500" />
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

      <Typography as="p" size="xs" variant="muted">
        Tick ca bạn sẽ làm. Chỉ sửa được ngày <b>tương lai</b>; ngày đã tới/qua bị khoá.
      </Typography>

      {/* Thanh chốt đăng ký tuần */}
      {!loading && (
        submitted ? (
          <Box
            layoutClassName="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2"
            borderClassName="border border-emerald-200 dark:border-emerald-800"
            backgroundClassName="bg-emerald-50 dark:bg-emerald-900/20"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <Typography as="span" size="sm" layoutClassName="font-medium" textClassName="text-emerald-700 dark:text-emerald-300">
              Đã chốt đăng ký tuần này{submittedAt ? ` (lúc ${submittedAt})` : ''}. Không sửa được — nhờ quản lý mở lại nếu cần.
            </Typography>
          </Box>
        ) : (
          <Box layoutClassName="flex flex-wrap items-center justify-between gap-2">
            <Typography as="span" size="xs" variant="muted">
              Xong thì bấm <b>Chốt đăng ký</b> để gửi. Sau khi chốt sẽ không sửa được nữa.
            </Typography>
            <Button
              type="button"
              onClick={() => void doSubmit()}
              disabled={submitting}
              variant="primary"
              leftIcon={<CheckCircle2 />}
              iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
              sizeClassName="px-3.5 py-1.5 text-sm"
              roundedClassName="rounded-lg"
              backgroundClassName="bg-emerald-600"
              textClassName="font-semibold text-white"
              layoutClassName="inline-flex items-center gap-1.5"
              disableVariantHover
              disableVariantTextColor
            >
              {submitting ? 'Đang chốt…' : 'Chốt đăng ký tuần'}
            </Button>
          </Box>
        )
      )}

      {loading ? (
        <Box layoutClassName="flex items-center justify-center gap-2 py-10">
          <Spinner /> <Typography as="span" size="sm" variant="muted">Đang tải…</Typography>
        </Box>
      ) : (
        <Box layoutClassName="space-y-2">
          {days.map((d) => {
            const date = fmt(d);
            const future = date > today;
            const isToday = date === today;
            const codes = week[date] ?? [];
            return (
              <Box
                key={date}
                layoutClassName="flex flex-wrap items-center gap-2 rounded-lg p-2.5"
                borderClassName="border border-slate-200 dark:border-slate-700"
                backgroundClassName={future ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/40'}
              >
                <Box layoutClassName="flex w-24 shrink-0 items-center gap-1.5">
                  <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-800 dark:text-slate-100">
                    {DOW_LABEL[isoDow(d)]} {d.getDate()}/{d.getMonth() + 1}
                  </Typography>
                  {!future && <Lock className="h-3.5 w-3.5 text-slate-400" />}
                  {isToday && (
                    <Typography as="span" size="xs" textClassName="text-primary-500">hôm nay</Typography>
                  )}
                </Box>
                <Box layoutClassName="flex flex-wrap gap-1.5">
                  {shifts.map((s) => {
                    const applicable = s.weekdays.includes(isoDow(d));
                    const on = codes.includes(s.code);
                    const busy = saving === `${date}:${s.code}`;
                    if (!applicable) {
                      return (
                        <Typography key={s.code} as="span" size="xs" layoutClassName="px-2 py-1" variant="muted">
                          {s.name}: nghỉ
                        </Typography>
                      );
                    }
                    return (
                      <Button
                        key={s.code}
                        type="button"
                        onClick={() => void toggle(date, s.code, applicable, future)}
                        disabled={!future || busy || submitted}
                        variant={on ? 'primary' : 'secondary'}
                        sizeClassName="px-2.5 py-1 text-xs"
                        roundedClassName="rounded-lg"
                        borderClassName={on ? 'border border-primary-600' : 'border border-slate-200 dark:border-slate-600'}
                        backgroundClassName={on ? 'bg-primary-600' : 'bg-white dark:bg-slate-800'}
                        textClassName={on ? 'font-medium text-white' : 'text-slate-700 dark:text-slate-200'}
                        layoutClassName="inline-flex items-center gap-1"
                        disableVariantHover
                        disableVariantTextColor
                      >
                        {s.name} · {s.startTime}
                      </Button>
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default RegisterTab;
