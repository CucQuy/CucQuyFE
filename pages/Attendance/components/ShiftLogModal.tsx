import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { History, Minus, Plus } from 'lucide-react';
import { fetchShiftLogs, type ShiftAssignmentLog } from '@/services/shiftService';
import BaseModal from '@/components/BaseModal';
import Box from '@/components/ui/Box';
import Typography from '@/components/ui/Typography';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';

const at = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const day = (ymd: string): string => {
  const [y, m, d] = ymd.split('-');
  return d && m ? `${d}/${m}` : ymd;
};

interface Props {
  onClose: () => void;
  /** Lọc theo 1 nhân viên (bỏ trống = cả tiệm). */
  employeeId?: string;
}

/**
 * Lịch sử thay đổi đăng ký ca — nhân viên tick nhầm rồi admin sửa thì vẫn còn dấu vết:
 * ai bị thêm/gỡ ca nào, ngày nào, do NV tự đăng ký hay admin sửa, lúc mấy giờ.
 */
const ShiftLogModal: React.FC<Props> = ({ onClose, employeeId }) => {
  const [logs, setLogs] = useState<ShiftAssignmentLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setLogs(await fetchShiftLogs({ employeeId, limit: 200 }));
      } catch {
        toast.error('Không tải được lịch sử ca.');
      } finally {
        setLoading(false);
      }
    })();
  }, [employeeId]);

  return (
    <BaseModal isOpen onClose={onClose} title="Lịch sử thay đổi ca" size="lg">
      {loading ? (
        <Box layoutClassName="flex items-center justify-center gap-2 py-8">
          <Spinner size="md" />
          <Typography size="sm" variant="muted">Đang tải…</Typography>
        </Box>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<History className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
          title="Chưa có thay đổi nào"
          description="Mọi lần thêm/gỡ ca từ giờ sẽ được ghi lại ở đây."
        />
      ) : (
        <Box layoutClassName="max-h-[26rem] space-y-1.5 overflow-y-auto">
          {logs.map((l) => (
            <Box
              key={l.id}
              layoutClassName="flex items-center gap-2.5 px-3 py-2"
              backgroundClassName="bg-slate-50 dark:bg-slate-700/30"
              roundedClassName="rounded-lg"
            >
              <Box
                layoutClassName="flex h-6 w-6 shrink-0 items-center justify-center"
                backgroundClassName={
                  l.action === 'add'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                    : 'bg-rose-100 dark:bg-rose-900/30'
                }
                roundedClassName="rounded-full"
              >
                {l.action === 'add' ? (
                  <Plus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                ) : (
                  <Minus className="h-3.5 w-3.5 text-rose-600 dark:text-rose-300" />
                )}
              </Box>

              <Box layoutClassName="min-w-0 flex-1">
                <Typography as="p" size="sm" textClassName="text-slate-800 dark:text-slate-100">
                  <b>{l.employeeName || l.employeeId}</b>{' '}
                  {l.action === 'add' ? 'được thêm' : 'bị gỡ khỏi'} <b>{l.shiftName}</b> ngày{' '}
                  {day(l.workDate)}
                </Typography>
                <Typography as="p" size="xs" variant="muted">
                  {at(l.createdAt)}
                  {l.changedBy ? ` · ${l.changedBy}` : ''}
                </Typography>
              </Box>

              <Badge
                size="sm"
                backgroundClassName={
                  l.source === 'self' ? 'bg-sky-50 dark:bg-sky-900/30' : 'bg-slate-100 dark:bg-slate-700'
                }
                textClassName={
                  l.source === 'self'
                    ? 'text-sky-700 dark:text-sky-300'
                    : 'text-slate-600 dark:text-slate-300'
                }
              >
                {l.source === 'self' ? 'NV tự đăng ký' : 'Admin sửa'}
              </Badge>
            </Box>
          ))}
        </Box>
      )}
    </BaseModal>
  );
};

export default ShiftLogModal;
