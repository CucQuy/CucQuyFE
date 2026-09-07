import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, Save, Clock, CalendarClock } from 'lucide-react';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Switch from '@/components/ui/Switch';
import Badge from '@/components/ui/Badge';
import IconButton from '@/components/ui/IconButton';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import Field from '@/components/ui/Field';
import { useNotificationSchedules, useScheduleMutations } from '@/hooks/queries/useNotificationSchedulesQuery';
import {
  SCHEDULE_TYPE_LABEL,
  WEEKDAYS,
  type NotificationSchedule,
  type ScheduleType,
} from '@/services/notificationScheduleService';

interface FormState {
  type: ScheduleType;
  timeHHMM: string;
  days: number[];
  enabled: boolean;
}
const emptyForm = (): FormState => ({ type: 'daily_summary', timeHHMM: '20:00', days: [], enabled: true });

const daysLabel = (days: number[]): string => {
  if (!days || days.length === 0) return 'Hằng ngày';
  return WEEKDAYS.filter((w) => days.includes(w.value)).map((w) => w.label).join(', ');
};

const ScheduleTab: React.FC = () => {
  const { schedules, loading } = useNotificationSchedules();
  const { createSchedule, updateSchedule, deleteSchedule, saving } = useScheduleMutations();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const openAdd = () => { setEditingId(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (s: NotificationSchedule) => {
    setEditingId(s.id);
    setForm({ type: s.type, timeHHMM: s.timeHHMM, days: s.days ?? [], enabled: s.enabled });
    setShowForm(true);
  };
  const close = () => { setShowForm(false); setEditingId(null); };

  const toggleDay = (d: number) =>
    setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d] }));

  const save = async () => {
    if (!/^\d{2}:\d{2}$/.test(form.timeHHMM)) { toast.error('Giờ không hợp lệ (HH:MM)'); return; }
    try {
      if (editingId) { await updateSchedule(editingId, form); toast.success('Đã cập nhật lịch'); }
      else { await createSchedule(form); toast.success('Đã tạo lịch'); }
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không lưu được lịch');
    }
  };

  const toggleEnabled = async (s: NotificationSchedule) => {
    try { await updateSchedule(s.id, { enabled: !s.enabled }); } catch { toast.error('Không đổi được trạng thái'); }
  };

  const remove = async (s: NotificationSchedule) => {
    if (!window.confirm(`Xoá lịch "${SCHEDULE_TYPE_LABEL[s.type]}" lúc ${s.timeHHMM}?`)) return;
    try { await deleteSchedule(s.id); toast.success('Đã xoá'); } catch { toast.error('Không xoá được'); }
  };

  return (
    <Box layoutClassName="space-y-4">
      <Box layoutClassName="flex items-center justify-between gap-3">
        <Typography size="sm" variant="muted">Tin lặp lại tự gửi đúng giờ (giờ VN) — không cần bấm tay.</Typography>
        {!showForm ? (
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={openAdd}>Thêm lịch</Button>
        ) : null}
      </Box>

      {showForm ? (
        <Card padding="md">
          <Box layoutClassName="space-y-3">
            <Box layoutClassName="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Loại thông báo">
                <Select fullWidth value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ScheduleType }))}>
                  {(Object.keys(SCHEDULE_TYPE_LABEL) as ScheduleType[]).map((t) => (
                    <option key={t} value={t}>{SCHEDULE_TYPE_LABEL[t]}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Giờ gửi (VN)">
                <Input type="time" fullWidth value={form.timeHHMM} onChange={(e) => setForm((f) => ({ ...f, timeHHMM: e.target.value }))} />
              </Field>
            </Box>
            <Field label="Ngày trong tuần" hint="Không chọn = hằng ngày">
              <Box layoutClassName="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w) => {
                  const on = form.days.includes(w.value);
                  return (
                    <Button
                      key={w.value}
                      type="button"
                      variant={on ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => toggleDay(w.value)}
                    >
                      {w.label}
                    </Button>
                  );
                })}
              </Box>
            </Field>
            <Box layoutClassName="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
              <Typography as="span" size="sm" textClassName="text-slate-600 dark:text-slate-300">{form.enabled ? 'Đang bật' : 'Tắt'}</Typography>
            </Box>
            <Box layoutClassName="flex items-center gap-2 pt-1">
              <Button variant="primary" size="sm" disabled={saving} onClick={save} leftIcon={saving ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}>
                {editingId ? 'Cập nhật' : 'Lưu lịch'}
              </Button>
              <Button variant="secondary" size="sm" onClick={close} leftIcon={<X className="w-4 h-4" />}>Huỷ</Button>
            </Box>
            <Typography size="xs" variant="muted">Gửi tới nhóm Zalo chính. (Chọn nhóm riêng sẽ bổ sung sau.)</Typography>
          </Box>
        </Card>
      ) : null}

      {loading ? (
        <Box layoutClassName="flex items-center justify-center py-12"><Spinner size="lg" /></Box>
      ) : schedules.length === 0 ? (
        <Card padding="lg">
          <EmptyState icon={<CalendarClock className="h-8 w-8" />} title="Chưa có lịch tự động" description="Tạo lịch để tự gửi tổng kết ngày / sản xuất mai đúng giờ." />
        </Card>
      ) : (
        <Box layoutClassName="space-y-2">
          {schedules.map((s) => (
            <Card key={s.id} padding="sm">
              <Box layoutClassName="flex items-center gap-3">
                <Box layoutClassName="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" backgroundClassName="bg-primary-100 dark:bg-primary-900/30">
                  <Clock className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </Box>
                <Box layoutClassName="min-w-0 flex-1">
                  <Box layoutClassName="flex flex-wrap items-center gap-2">
                    <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-900 dark:text-white">{SCHEDULE_TYPE_LABEL[s.type]}</Typography>
                    <Badge size="sm" borderClassName="border-transparent" backgroundClassName="bg-slate-100 dark:bg-slate-700" textClassName="text-slate-600 dark:text-slate-300">{s.timeHHMM}</Badge>
                    <Badge size="sm" borderClassName="border-transparent" backgroundClassName="bg-sky-100 dark:bg-sky-900/30" textClassName="text-sky-700 dark:text-sky-300">{daysLabel(s.days)}</Badge>
                    {!s.enabled ? (
                      <Badge size="sm" borderClassName="border-transparent" backgroundClassName="bg-slate-100 dark:bg-slate-700" textClassName="text-slate-500">tắt</Badge>
                    ) : null}
                  </Box>
                  {s.lastRunOn ? (
                    <Typography as="p" size="xs" variant="muted" layoutClassName="mt-0.5">Chạy gần nhất: {s.lastRunOn}</Typography>
                  ) : null}
                </Box>
                <Switch checked={s.enabled} onCheckedChange={() => void toggleEnabled(s)} />
                <IconButton label="Sửa" variant="ghost" size="sm" onClick={() => openEdit(s)} textClassName="text-slate-400" hoverClassName="hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20">
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton label="Xoá" variant="ghost" size="sm" onClick={() => void remove(s)} textClassName="text-slate-400" hoverClassName="hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </Box>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ScheduleTab;
