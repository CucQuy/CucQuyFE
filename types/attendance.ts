// Chấm công nhân viên (Face ID + giới hạn IP mạng quán).
export type AttendanceKind = 'in' | 'out';
export type AttendanceShift = 'ca1' | 'ca2' | 'ca3';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string | null;
  kind: AttendanceKind;
  shift: AttendanceShift | null; // ca suy ra theo giờ chấm
  checkedAt: string; // ISO
  ip: string | null;
  faceDistance: number | null;
  imageUrl: string | null;
  note: string | null;
}

/** Vào/ra của 1 ca trong ngày. */
export interface AttendanceShiftStatus {
  shift: AttendanceShift;
  in: string | null;
  out: string | null;
}

/** Dải mạng quán được phép chấm công. */
export interface AllowedNetwork {
  id: string;
  label: string | null;
  ipCidr: string; // '113.161.10.20' hoặc '1.2.3.0/24'
  active: boolean;
  createdAt?: string;
}

/** Hồ sơ NV suy ra từ email tài khoản đang đăng nhập. */
export interface EmployeeRef {
  id: string;
  name: string;
  email: string | null;
  status: string;
  faceCount: number;
}

/** Trạng thái IP hiện tại so với whitelist. */
export interface IpStatus {
  configured: boolean;
  allowed: boolean;
  ip: string;
}

/** Lần chấm vào chưa có chấm ra (phiên đang mở / đã bị bỏ vì quên tan ca). */
export interface AttendanceOpenSession {
  at: string; // ISO giờ chấm vào
  date: string; // yyyy-mm-dd
  shift: AttendanceShift | null;
  deadline: string | null; // hạn phải chấm ra (ISO)
}

/** Trạng thái chấm công hôm nay của NV. */
export interface AttendanceStatus {
  employeeId: string;
  faceCount: number;
  lastKind: AttendanceKind | null;
  lastAt: string | null;
  nextKind: AttendanceKind; // hành động kế tiếp (in/out)
  currentShift: AttendanceShift | null; // ca mà lần chấm kế tiếp rơi vào (theo giờ hiện tại)
  todayIn: string | null;
  todayOut: string | null;
  todayCount: number;
  todayShifts: AttendanceShiftStatus[]; // vào/ra từng ca hôm nay
  openSince: string | null; // giờ vào của phiên đang mở (chưa quá hạn tan ca)
  checkoutDeadline: string | null; // hạn phải chấm ra của phiên đang mở
  /** Lần chấm vào đã bị BỎ QUA vì quá hạn tan ca → ca đó tính thiếu công. */
  skippedCheckout: AttendanceOpenSession | null;
  today?: AttendanceDayCompute | null; // đối chiếu đăng ký ↔ đã làm hôm nay (ca hợp lệ + công)
}

/** 1 ca theo compute đăng-ký↔đã-làm của 1 ngày. */
export type SpxDayShiftStatus =
  | 'valid'
  | 'partial'
  | 'no_checkout'
  | 'missed'
  | 'unregistered'
  | 'off';
export interface AttendanceDayShift {
  code: AttendanceShift;
  name: string;
  congFactor: number;
  registered: boolean;
  worked: boolean;
  valid: boolean;
  hours: number; // giờ CHẤM hợp lệ của ca (chấm thực tế cắt trong khung ca)
  adjHours: number; // giờ quản lý bổ sung gắn đúng ca này
  totalHours: number; // hours + adjHours (giờ dùng để tính tiền ca)
  pay: number | null; // tiền của ca = totalHours × mức lương/giờ (null khi chưa đặt mức)
  status: SpxDayShiftStatus;
}

/** Kết quả đối chiếu đăng ký ↔ đã làm cho 1 NV/ngày (đăng ký công). */
export interface AttendanceDayCompute {
  employeeId: string;
  date: string; // yyyy-mm-dd
  in: string | null;
  out: string | null;
  cong: number;
  hours: number; // tổng giờ hợp lệ trong ngày
  rate: number | null; // mức lương/giờ áp dụng ngày đó
  adjHours: number; // tổng giờ quản lý bổ sung trong ngày
  pay: number | null; // tiền ngày = (giờ chấm + giờ bổ sung) × mức/giờ
  /** Có lần chấm vào bị bỏ vì quên tan ca (ca dở dang → thiếu công). */
  missingCheckout: boolean;
  missingCheckoutAt: string | null; // giờ vào bị bỏ (ISO)
  shifts: AttendanceDayShift[];
}

// ---- Bảng công & lương (payroll) ----

/** 1 ngày trong bảng lương của 1 NV. */
export interface PayrollDay {
  date: string; // yyyy-mm-dd
  cong: number;
  workHours: number; // giờ từ chấm công
  adjHours: number; // giờ admin bổ sung (âm = trừ)
  hours: number; // workHours + adjHours
  rate: number | null; // mức lương/giờ áp dụng (null nếu chưa cấu hình)
  pay: number; // tiền ngày = hours × rate
  registered: number; // số ca đăng ký
  valid: number; // số ca hợp lệ
  in: string | null; // giờ chấm vào (ISO) — null nếu không chấm
  out: string | null; // giờ chấm ra (ISO)
  shifts: AttendanceDayShift[]; // chi tiết từng ca (đăng ký/làm/hợp lệ)
  /** Có lần chấm vào bị bỏ vì quên tan ca (ca dở dang → thiếu công). */
  missingCheckout: boolean;
  /** Đã CHỐT công: số giờ hiện tại là số cuối (NV chỉ xin làm ít giờ) → không coi là thiếu ca. */
  locked: boolean;
  lockNote: string;
}

/** Tổng hợp công/giờ/lương của 1 NV trong kỳ. */
export interface PayrollRow {
  employeeId: string;
  name: string;
  position: string | null;
  totalHours: number;
  workHours: number;
  adjHours: number;
  totalCong: number;
  registeredShifts: number;
  validShifts: number;
  salary: number;
  days: PayrollDay[];
}

/** Kết quả GET /attendance/payroll. */
export interface PayrollResult {
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
  totalSalary: number;
  totalHours: number;
  employees: PayrollRow[];
}

/** 1 bản ghi bổ sung công (admin thêm tay). */
export interface AttendanceAdjustment {
  id: string;
  employeeId: string;
  employeeName: string | null;
  workDate: string; // yyyy-mm-dd
  hours: number; // giờ bổ sung (âm = trừ)
  shiftCode: AttendanceShift | null; // ca được bổ sung (null = giờ chung)
  reason: string | null;
  createdBy: string | null;
  createdAt: string | null;
}

/** Định nghĩa 1 ca (từ work_shift_list). */
export interface WorkShiftDef {
  code: AttendanceShift;
  name: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  congFactor: number;
  sortOrder: number;
  weekdays: number[]; // ISO dow 1=T2..7=CN
  active: boolean;
}

/** Trạng thái "đã chốt" đăng ký của 1 tuần. */
export interface ShiftWeekSubmission {
  submitted: boolean;
  submittedAt: string | null; // 'DD/MM/YYYY HH:MM' (giờ VN), null nếu chưa chốt
  submittedBy: string | null;
}

/** Kết quả GET /attendance/my-shifts (lưới đăng ký ca). */
export interface MyShiftWeek {
  employee: EmployeeRef;
  shifts: WorkShiftDef[];
  week: Record<string, string[]>; // { 'yyyy-mm-dd': ['ca1','ca2'] }
  submission: ShiftWeekSubmission;
}

/** Nhãn trạng thái ca (compute). */
export const DAY_SHIFT_STATUS_LABELS: { value: SpxDayShiftStatus; label: string }[] = [
  { value: 'valid', label: 'Hợp lệ' },
  { value: 'partial', label: 'Làm một phần' },
  { value: 'no_checkout', label: 'Quên tan ca (thiếu công)' },
  { value: 'missed', label: 'Vắng (đã đăng ký)' },
  { value: 'unregistered', label: 'Chưa đăng ký' },
  { value: 'off', label: 'Không đăng ký' },
];
export const dayShiftStatusLabel = (s?: SpxDayShiftStatus | null): string =>
  DAY_SHIFT_STATUS_LABELS.find((x) => x.value === s)?.label ?? '—';

/** Kết quả GET /attendance/me. */
export interface AttendanceMe {
  employee: EmployeeRef | null;
  status: AttendanceStatus | null;
  ip: IpStatus;
}

/** 1 dòng tổng quan quản lý (mỗi NV). */
export interface AttendanceOverviewRow {
  employeeId: string;
  name: string;
  email: string | null;
  position: string | null;
  status: string;
  faceCount: number;
  todayIn: string | null;
  todayOut: string | null;
}

export interface AttendanceHistory {
  items: AttendanceRecord[];
  total: number;
  limit: number;
  offset: number;
}

export const KIND_LABELS: { value: AttendanceKind; label: string }[] = [
  { value: 'in', label: 'Vào ca' },
  { value: 'out', label: 'Tan ca' },
];

export const kindLabel = (k?: AttendanceKind | string | null): string =>
  KIND_LABELS.find((x) => x.value === k)?.label ?? '—';

/** 3 ca làm việc cố định (giờ hiển thị). Đồng bộ với attendance_shift_at ở BE. */
export const SHIFTS: { value: AttendanceShift; label: string; time: string }[] = [
  { value: 'ca1', label: 'Ca 1', time: '08:00–12:00' },
  { value: 'ca2', label: 'Ca 2', time: '13:30–17:30' },
  { value: 'ca3', label: 'Ca 3', time: '17:30–21:30' },
];

export const shiftLabel = (s?: AttendanceShift | string | null): string =>
  SHIFTS.find((x) => x.value === s)?.label ?? '—';

export const shiftTime = (s?: AttendanceShift | string | null): string =>
  SHIFTS.find((x) => x.value === s)?.time ?? '';
