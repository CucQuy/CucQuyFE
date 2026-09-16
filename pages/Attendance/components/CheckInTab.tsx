import React, { useState } from 'react';
import { AlertTriangle, LogIn, LogOut, RefreshCw, ScanFace, Wifi, WifiOff } from 'lucide-react';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Typography from '@/components/ui/Typography';
import Heading from '@/components/ui/Heading';
import Spinner from '@/components/ui/Spinner';
import Badge from '@/components/ui/Badge';
import { useAttendanceMe } from '@/hooks/queries/useAttendanceQuery';
import {
  AttendanceDayShift,
  AttendanceKind,
  SHIFTS,
  shiftLabel,
  shiftTime,
} from '@/types/attendance';
import CheckInCameraModal from './CheckInCameraModal';
import { vnd } from './payrollUtil';

const fmt = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—';

/** '18:30 13/09' — dùng cho lần chấm vào bị bỏ (có thể là ngày hôm trước). */
const fmtDateTime = (iso?: string | null): string =>
  iso
    ? new Date(iso).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      })
    : '—';

/** ' · 120.000đ' — tiền của ca; rỗng khi chưa đặt mức lương/giờ hoặc ca chưa có giờ. */
const payText = (s: AttendanceDayShift): string =>
  s.pay != null && s.pay > 0 ? ` · ${vnd(s.pay)}` : '';

/** Nhãn + màu của 1 ca theo đối chiếu đăng ký ↔ đã làm. */
const shiftBadge = (s: AttendanceDayShift): { bg: string; text: string; label: string } => {
  switch (s.status) {
    case 'valid':
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-900/30',
        text: 'text-emerald-700 dark:text-emerald-300',
        label: `✓ ${s.hours}h${payText(s)}`,
      };
    case 'partial':
      return {
        bg: 'bg-sky-100 dark:bg-sky-900/30',
        text: 'text-sky-700 dark:text-sky-300',
        label: `${s.hours}h (một phần)${payText(s)}`,
      };
    // Quên tan ca: hệ thống đã bỏ qua lần chấm ra → ca này không tính công.
    case 'no_checkout':
      return {
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        text: 'text-orange-700 dark:text-orange-300',
        label: `quên tan ca · thiếu công${payText(s)}`,
      };
    case 'unregistered':
      return {
        bg: 'bg-rose-100 dark:bg-rose-900/30',
        text: 'text-rose-700 dark:text-rose-300',
        label: 'chưa đăng ký · không tính',
      };
    default:
      // Ca đã đăng ký chưa làm — vẫn có tiền nếu quản lý đã bổ sung công cho ca đó.
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-300',
        label: `đã đăng ký${payText(s)}`,
      };
  }
};

const CheckInTab: React.FC = () => {
  const { me, loading, refetch } = useAttendanceMe();
  const [camOpen, setCamOpen] = useState(false);

  if (loading) {
    return (
      <Box layoutClassName="flex flex-1 items-center justify-center py-16">
        <Spinner size="lg" textClassName="text-primary-500" />
      </Box>
    );
  }

  // Chưa gắn hồ sơ nhân viên với tài khoản
  if (!me?.employee) {
    return (
      <Card
        padding="lg"
        layoutClassName="mx-auto max-w-md text-center"
        borderClassName="border border-amber-200 dark:border-amber-800/50"
        backgroundClassName="bg-amber-50 dark:bg-amber-900/20"
      >
        <Box layoutClassName="flex flex-col items-center gap-3">
          <ScanFace className="h-8 w-8 text-amber-500" />
          <Heading level={2} textClassName="text-base font-bold text-slate-900 dark:text-white">
            Tài khoản chưa gắn hồ sơ nhân viên
          </Heading>
          <Typography size="sm" textClassName="text-slate-600 dark:text-slate-300">
            Nhờ quản lý mở mục Nhân viên và điền email đăng nhập của bạn vào hồ sơ để bật chấm công.
          </Typography>
        </Box>
      </Card>
    );
  }

  const hasFace = me.employee.faceCount > 0;
  const ipOk = me.ip.allowed;
  const ipConfigured = me.ip.configured;

  // Hành động kế tiếp + ca sắp chấm (BE derive; fallback theo lastKind nếu API cũ).
  const status = me.status;
  const nextKind: AttendanceKind =
    status?.nextKind ?? (status?.lastKind === 'in' ? 'out' : 'in');
  const isCheckedIn = nextKind === 'out';
  const curShift = status?.currentShift ?? null;
  const todayShifts = status?.todayShifts ?? [];
  // Đối chiếu đăng ký ↔ đã làm hôm nay (đăng ký công): ca hợp lệ + công.
  const today = status?.today ?? null;
  const dayShift = (code: string) => today?.shifts.find((x) => x.code === code) ?? null;
  // Lần chấm vào quá hạn tan ca → BE tự bỏ qua lần chấm ra, cho chấm vào ca mới.
  const skipped = status?.skippedCheckout ?? null;

  // Ở MẠNG NGOÀI (hoặc quán chưa cấu hình) → TRANG LỖI toàn màn, KHÔNG header/badge/camera.
  if (!ipOk) {
    return (
      <Box layoutClassName="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <Box
          layoutClassName="flex h-20 w-20 items-center justify-center"
          roundedClassName="rounded-full"
          backgroundClassName="bg-rose-100 dark:bg-rose-900/30"
        >
          <WifiOff className="h-10 w-10 text-rose-500" />
        </Box>
        <Heading level={2} textClassName="text-xl font-bold text-slate-900 dark:text-white">
          {ipConfigured ? 'Bạn đang ở mạng ngoài' : 'Quán chưa cấu hình mạng chấm công'}
        </Heading>
        <Typography size="sm" layoutClassName="max-w-sm" textClassName="text-slate-600 dark:text-slate-300">
          {ipConfigured
            ? 'Chỉ chấm công được khi thiết bị dùng WIFI CỦA QUÁN. Hãy kết nối đúng wifi quán rồi bấm "Thử lại".'
            : 'Nhờ quản lý (super admin) thêm IP mạng quán trong mục Quản lý trước khi chấm công.'}
        </Typography>
        {ipConfigured && (
          <Badge
            size="sm"
            layoutClassName="px-2.5 py-1 font-mono"
            backgroundClassName="bg-slate-100 dark:bg-slate-700"
            textClassName="text-slate-600 dark:text-slate-300"
          >
            IP hiện tại: {me.ip.ip || '—'}
          </Badge>
        )}
        <Button
          type="button"
          variant="primary"
          sizeClassName="px-4 py-2 text-sm"
          layoutClassName="inline-flex items-center gap-2"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          onClick={() => refetch()}
        >
          Thử lại
        </Button>
      </Box>
    );
  }

  const initial = (me.employee.name || '?').trim().charAt(0).toUpperCase();

  return (
    <Box layoutClassName="mx-auto flex w-full max-w-sm flex-col gap-5 py-2">
      {/* Header: avatar + tên + chip mạng quán */}
      <Box layoutClassName="flex flex-col items-center gap-2 text-center">
        <Box
          layoutClassName="flex h-16 w-16 items-center justify-center"
          roundedClassName="rounded-full"
          backgroundClassName="bg-primary-100 dark:bg-primary-900/40"
        >
          <Typography as="span" layoutClassName="text-2xl font-bold" textClassName="text-primary-600 dark:text-primary-300">
            {initial}
          </Typography>
        </Box>
        <Heading level={2} textClassName="text-xl font-bold text-slate-900 dark:text-white">
          {me.employee.name}
        </Heading>
        <Box
          layoutClassName="inline-flex items-center gap-1.5 px-2.5 py-1"
          roundedClassName="rounded-full"
          backgroundClassName="bg-emerald-100 dark:bg-emerald-900/30"
        >
          <Wifi className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <Typography as="span" size="xs" layoutClassName="font-semibold" textClassName="text-emerald-700 dark:text-emerald-300">
            Trong mạng quán
          </Typography>
        </Box>
      </Box>

      {/* Quên tan ca ở lần chấm trước → đã bỏ qua, ca đó thiếu công */}
      {skipped && (
        <Box
          layoutClassName="flex items-start gap-2 rounded-xl px-3 py-2.5"
          borderClassName="border border-orange-200 dark:border-orange-800/60"
          backgroundClassName="bg-orange-50 dark:bg-orange-900/20"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
          <Box layoutClassName="flex flex-col gap-0.5">
            <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-orange-700 dark:text-orange-300">
              Lần vào ca {fmtDateTime(skipped.at)} chưa tan ca
            </Typography>
            <Typography as="span" size="xs" textClassName="text-orange-700/80 dark:text-orange-300/80">
              Đã quá giờ ca nên hệ thống bỏ qua lần tan ca đó — ca này tính THIẾU CÔNG. Nhờ quản lý
              bổ sung công nếu bạn có đi làm. Bây giờ bạn vào ca bình thường.
            </Typography>
          </Box>
        </Box>
      )}

      {/* Tổng công hôm nay theo ca ĐĂNG KÝ (đăng ký công) */}
      {today && (
        <Box
          layoutClassName="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5"
          borderClassName="border border-primary-200 dark:border-primary-800"
          backgroundClassName="bg-primary-50/60 dark:bg-primary-900/20"
        >
          <Typography as="span" size="sm" textClassName="text-slate-700 dark:text-slate-200">
            Công hôm nay (ca đã đăng ký + đã làm):
          </Typography>
          <Box layoutClassName="flex items-baseline gap-1.5">
            <Typography as="span" size="sm" layoutClassName="font-bold tabular-nums" textClassName="text-primary-600 dark:text-primary-400">
              {today.cong} công
            </Typography>
            {/* Tiền từ chấm công hôm nay — chưa gồm giờ quản lý bổ sung. */}
            {today.pay != null && (
              <Typography as="span" size="sm" layoutClassName="font-bold tabular-nums" textClassName="text-emerald-600 dark:text-emerald-400">
                · {vnd(today.pay)}
              </Typography>
            )}
          </Box>
        </Box>
      )}

      {/* Trạng thái hôm nay theo TỪNG CA (highlight ca sắp chấm) */}
      <Box layoutClassName="flex flex-col gap-2">
        {SHIFTS.map((s) => {
          const rec = todayShifts.find((t) => t.shift === s.value);
          const active = curShift === s.value;
          const cs = dayShift(s.value);
          return (
            <Box
              key={s.value}
              layoutClassName="flex items-center justify-between gap-2 px-3 py-2"
              roundedClassName="rounded-xl"
              borderClassName={
                active
                  ? 'border border-primary-300 dark:border-primary-700'
                  : 'border border-slate-200 dark:border-slate-700'
              }
              backgroundClassName={
                active ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-white dark:bg-slate-800'
              }
            >
              <Box layoutClassName="flex flex-col">
                <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-800 dark:text-slate-100">
                  {s.label}
                  {active ? ' · sắp chấm' : ''}
                </Typography>
                <Typography as="span" size="xs" textClassName="text-slate-400 dark:text-slate-500">
                  {s.time}
                </Typography>
                {cs && cs.status !== 'off' && (
                  <Box
                    layoutClassName="mt-0.5 inline-flex w-fit items-center px-1.5 py-0.5"
                    roundedClassName="rounded"
                    backgroundClassName={shiftBadge(cs).bg}
                  >
                    <Typography
                      as="span"
                      size="xs"
                      layoutClassName="font-semibold"
                      textClassName={shiftBadge(cs).text}
                    >
                      {shiftBadge(cs).label}
                    </Typography>
                  </Box>
                )}
              </Box>
              <Box layoutClassName="flex items-center gap-4">
                <Box layoutClassName="flex flex-col items-end">
                  <Box layoutClassName="flex items-center gap-1">
                    <LogIn className="h-3 w-3 text-emerald-500" />
                    <Typography as="span" size="xs" textClassName="text-slate-400 dark:text-slate-500">
                      Vào
                    </Typography>
                  </Box>
                  <Typography as="span" size="sm" layoutClassName="font-bold tabular-nums" textClassName="text-emerald-600 dark:text-emerald-400">
                    {fmt(rec?.in)}
                  </Typography>
                </Box>
                <Box layoutClassName="flex flex-col items-end">
                  <Box layoutClassName="flex items-center gap-1">
                    <LogOut className="h-3 w-3 text-rose-500" />
                    <Typography as="span" size="xs" textClassName="text-slate-400 dark:text-slate-500">
                      Tan
                    </Typography>
                  </Box>
                  <Typography as="span" size="sm" layoutClassName="font-bold tabular-nums" textClassName="text-rose-600 dark:text-rose-400">
                    {fmt(rec?.out)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      {!hasFace ? (
        // Chưa được đăng ký khuôn mặt → KHÔNG tự đăng ký, KHÔNG hiện camera.
        <Box
          layoutClassName="flex flex-col items-center gap-3 p-5 text-center"
          roundedClassName="rounded-2xl"
          borderClassName="border border-amber-200 dark:border-amber-800/50"
          backgroundClassName="bg-amber-50 dark:bg-amber-900/20"
        >
          <ScanFace className="h-8 w-8 text-amber-500" />
          <Typography size="sm" layoutClassName="font-semibold" textClassName="text-amber-700 dark:text-amber-300">
            Bạn chưa được đăng ký khuôn mặt
          </Typography>
          <Typography size="xs" textClassName="text-amber-700/80 dark:text-amber-300/80">
            Nhờ quản lý (super admin) đăng ký khuôn mặt cho bạn tại máy quản lý, sau đó mới chấm công được.
          </Typography>
        </Box>
      ) : (
        <>
          {curShift && (
            <Box layoutClassName="flex items-center justify-center gap-1.5">
              <Typography as="span" size="xs" variant="muted">
                {isCheckedIn ? 'Tan ca:' : 'Vào ca:'}
              </Typography>
              <Typography as="span" size="xs" layoutClassName="font-semibold" textClassName="text-primary-600 dark:text-primary-300">
                {shiftLabel(curShift)} · {shiftTime(curShift)}
              </Typography>
            </Box>
          )}
          {/* Quá hạn này mà chưa tan ca → hệ thống bỏ qua, ca tính thiếu công. */}
          {isCheckedIn && status?.checkoutDeadline && (
            <Typography size="xs" layoutClassName="text-center" textClassName="text-orange-600 dark:text-orange-400">
              Nhớ tan ca trước {fmt(status.checkoutDeadline)} — quá giờ sẽ bị bỏ qua và ca này thiếu công.
            </Typography>
          )}
          {/* Bấm → mở modal camera riêng (camera chỉ bật trong modal). 1 nút theo trạng thái. */}
          <Button
            type="button"
            variant={isCheckedIn ? undefined : 'primary'}
            fullWidth
            sizeClassName="px-4 py-4 text-base"
            layoutClassName="inline-flex items-center justify-center gap-2"
            roundedClassName="rounded-xl"
            backgroundClassName={isCheckedIn ? 'bg-rose-600 hover:bg-rose-700' : undefined}
            textClassName={isCheckedIn ? 'font-semibold text-white' : undefined}
            borderClassName={isCheckedIn ? 'border border-transparent' : undefined}
            disableVariantHover={isCheckedIn}
            disableVariantTextColor={isCheckedIn}
            leftIcon={isCheckedIn ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            onClick={() => setCamOpen(true)}
          >
            {isCheckedIn
              ? `Tan ${curShift ? shiftLabel(curShift) : 'ca'}`
              : `Vào ${curShift ? shiftLabel(curShift) : 'ca'}`}
          </Button>
        </>
      )}

      <CheckInCameraModal
        isOpen={camOpen}
        onClose={() => setCamOpen(false)}
        mode={nextKind}
        shift={curShift}
        employeeName={me.employee.name}
        onSuccess={refetch}
      />
    </Box>
  );
};

export default CheckInTab;
