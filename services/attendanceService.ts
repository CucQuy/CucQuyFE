import { apiClient } from '@/services/api/client';
import {
  AllowedNetwork,
  AttendanceAdjustment,
  AttendanceDayShift,
  AttendanceHistory,
  AttendanceKind,
  AttendanceMe,
  AttendanceOverviewRow,
  AttendanceRecord,
  AttendanceDayCompute,
  AttendanceOpenSession,
  MyShiftWeek,
  PayrollDay,
  PayrollResult,
  PayrollRow,
  ShiftWeekSubmission,
} from '@/types/attendance';

const BASE = '/attendance';

// ---- Đăng ký công (NV tự đăng ký ca) ----

/** Ca đang bật + đăng ký ca của NV trong khoảng ngày (lưới đăng ký). */
export async function fetchMyShiftWeek(from: string, to: string): Promise<MyShiftWeek> {
  const res = await apiClient.get<MyShiftWeek>(`${BASE}/my-shifts`, { params: { from, to } });
  const d = (res.data ?? {}) as any;
  return {
    employee: d?.employee ?? null,
    shifts: Array.isArray(d?.shifts)
      ? d.shifts.filter((s: any) => s?.active !== false)
      : [],
    week: d?.week && typeof d.week === 'object' ? d.week : {},
    submission: toSubmission(d?.submission),
  };
}

/** Type-guard trạng thái chốt (API untrusted). */
function toSubmission(v: any): ShiftWeekSubmission {
  return {
    submitted: v?.submitted === true,
    submittedAt: typeof v?.submittedAt === 'string' ? v.submittedAt : null,
    submittedBy: typeof v?.submittedBy === 'string' ? v.submittedBy : null,
  };
}

/** NV CHỐT đăng ký cả tuần (weekStart = thứ 2, 'yyyy-mm-dd') → khoá. */
export async function submitMyWeek(weekStart: string): Promise<ShiftWeekSubmission> {
  const res = await apiClient.post<any>(`${BASE}/my-shifts/submit`, { weekStart });
  return toSubmission(res.data);
}

/** Danh sách NV đã chốt trong 1 tuần — admin. */
export async function fetchWeekSubmissions(
  weekStart: string,
): Promise<Array<{ employeeId: string; submittedAt: string | null; submittedBy: string | null }>> {
  const res = await apiClient.get<any[]>(`${BASE}/shift-submissions`, { params: { weekStart } });
  return Array.isArray(res.data)
    ? res.data.map((r) => ({
        employeeId: str(r?.employeeId) ?? '',
        submittedAt: str(r?.submittedAt),
        submittedBy: str(r?.submittedBy),
      }))
    : [];
}

/** Admin mở lại tuần (bỏ chốt) cho 1 NV → NV đăng ký lại được. */
export async function reopenWeek(
  employeeId: string,
  weekStart: string,
): Promise<{ submitted: boolean }> {
  const res = await apiClient.post<any>(`${BASE}/shift-submissions/reopen`, {
    employeeId,
    weekStart,
  });
  return { submitted: res.data?.submitted === true };
}

/** NV tự đăng ký ca CỦA MÌNH cho 1 ngày tương lai (thay trọn ngày). */
export async function registerMyShift(
  workDate: string,
  shiftCodes: string[],
): Promise<{ workDate: string; shiftCodes: string[] }> {
  const res = await apiClient.put<{ workDate: string; shiftCodes: string[] }>(
    `${BASE}/my-shifts`,
    { workDate, shiftCodes },
  );
  const d = (res.data ?? {}) as any;
  return {
    workDate: String(d?.workDate ?? workDate),
    shiftCodes: Array.isArray(d?.shiftCodes) ? d.shiftCodes : [],
  };
}

/** Đối chiếu đăng ký ↔ đã làm (ca hợp lệ + công) cho 1 NV/ngày — admin. */
export async function fetchDayCompute(
  employeeId: string,
  date?: string,
): Promise<AttendanceDayCompute | null> {
  const res = await apiClient.get<AttendanceDayCompute>(`${BASE}/day-compute`, {
    params: { employeeId, ...(date ? { date } : {}) },
  });
  return toDayCompute(res.data);
}

// ---- type-guard (dữ liệu API là untrusted) ----
function num(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}
/**
 * Chuẩn hoá field thời gian về ISO string. apiClient revive chuỗi timestamptz Postgres
 * thành object Timestamp-like (có .toDate()) TRƯỚC khi tới đây, nên phải nhận cả 2 dạng.
 */
function toIso(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const anyv = v as { toDate?: () => Date; toMillis?: () => number };
    try {
      if (typeof anyv.toDate === 'function') return anyv.toDate().toISOString();
      if (typeof anyv.toMillis === 'function') return new Date(anyv.toMillis()).toISOString();
    } catch {
      /* ignore */
    }
  }
  return null;
}

function toShift(v: unknown): AttendanceRecord['shift'] {
  return v === 'ca1' || v === 'ca2' || v === 'ca3' ? v : null;
}

function toRecord(r: any): AttendanceRecord {
  return {
    id: str(r?.id) ?? '',
    employeeId: str(r?.employeeId) ?? '',
    employeeName: str(r?.employeeName),
    kind: r?.kind === 'out' ? 'out' : 'in',
    shift: toShift(r?.shift),
    checkedAt: toIso(r?.checkedAt) ?? '',
    ip: str(r?.ip),
    faceDistance: num(r?.faceDistance),
    imageUrl: str(r?.imageUrl),
    note: str(r?.note),
  };
}

function toNetwork(r: any): AllowedNetwork {
  return {
    id: str(r?.id) ?? '',
    label: str(r?.label),
    ipCidr: str(r?.ipCidr) ?? '',
    active: r?.active !== false,
    createdAt: toIso(r?.createdAt) ?? undefined,
  };
}

// ---- Nhân viên (self) ----

/** Lần chấm vào chưa có chấm ra (phiên đang mở / bị bỏ vì quên tan ca). */
function toOpenSession(o: any): AttendanceOpenSession | null {
  const at = toIso(o?.at);
  if (!at) return null;
  return { at, date: str(o?.date) ?? '', shift: toShift(o?.shift), deadline: toIso(o?.deadline) };
}

/** Đối chiếu đăng ký ↔ đã làm của 1 ngày (dùng lại cho status.today và /day-compute). */
function toDayCompute(d: any): AttendanceDayCompute | null {
  if (!d) return null;
  return {
    employeeId: str(d?.employeeId) ?? '',
    date: str(d?.date) ?? '',
    in: toIso(d?.in),
    out: toIso(d?.out),
    cong: num(d?.cong) ?? 0,
    hours: num(d?.hours) ?? 0,
    rate: num(d?.rate),
    adjHours: num(d?.adjHours) ?? 0,
    pay: num(d?.pay),
    missingCheckout: d?.missingCheckout === true,
    missingCheckoutAt: toIso(d?.missingCheckoutAt),
    shifts: Array.isArray(d?.shifts) ? d.shifts.map(toDayShift) : [],
  };
}

/** Trạng thái của NV đang đăng nhập + IP hiện tại. */
export async function fetchMe(): Promise<AttendanceMe> {
  const res = await apiClient.get<AttendanceMe>(`${BASE}/me`);
  const d = res.data as any;
  return {
    employee: d?.employee
      ? {
          id: str(d.employee.id) ?? '',
          name: str(d.employee.name) ?? '',
          email: str(d.employee.email),
          status: str(d.employee.status) ?? 'active',
          faceCount: num(d.employee.faceCount) ?? 0,
        }
      : null,
    status: d?.status
      ? {
          employeeId: str(d.status.employeeId) ?? '',
          faceCount: num(d.status.faceCount) ?? 0,
          lastKind: d.status.lastKind === 'out' ? 'out' : d.status.lastKind === 'in' ? 'in' : null,
          lastAt: toIso(d.status.lastAt),
          nextKind: d.status.nextKind === 'out' ? 'out' : 'in',
          currentShift: toShift(d.status.currentShift),
          todayIn: toIso(d.status.todayIn),
          todayOut: toIso(d.status.todayOut),
          todayCount: num(d.status.todayCount) ?? 0,
          todayShifts: Array.isArray(d.status.todayShifts)
            ? d.status.todayShifts
                .map((s: any) => ({ shift: toShift(s?.shift), in: toIso(s?.in), out: toIso(s?.out) }))
                .filter((s: any) => s.shift)
            : [],
          openSince: toIso(d.status.openSince),
          checkoutDeadline: toIso(d.status.checkoutDeadline),
          skippedCheckout: toOpenSession(d.status.skippedCheckout),
          today: toDayCompute(d.status.today),
        }
      : null,
    ip: {
      configured: Boolean(d?.ip?.configured),
      allowed: Boolean(d?.ip?.allowed),
      ip: str(d?.ip?.ip) ?? '',
    },
  };
}

/** Đăng ký 1 mẫu khuôn mặt. employeeId chỉ dùng khi admin đăng ký hộ. */
export async function registerFace(
  imageBlob: Blob,
  opts?: { employeeId?: string; reset?: boolean },
): Promise<{ employeeId: string; faceCount: number }> {
  const form = new FormData();
  form.append('file', imageBlob, 'face.jpg');
  if (opts?.employeeId) form.append('employeeId', opts.employeeId);
  if (opts?.reset) form.append('reset', 'true');
  const res = await apiClient.post<any>(`${BASE}/register-face`, form);
  return {
    employeeId: str(res.data?.employeeId) ?? '',
    faceCount: num(res.data?.faceCount) ?? 0,
  };
}

/** Chấm công vào/ra (BE kiểm IP + so khớp mặt). */
export async function checkAttendance(
  imageBlob: Blob,
  kind: AttendanceKind,
  note?: string,
): Promise<{ record: AttendanceRecord; distance: number }> {
  const form = new FormData();
  form.append('file', imageBlob, 'check.jpg');
  form.append('kind', kind);
  if (note) form.append('note', note);
  const res = await apiClient.post<any>(`${BASE}/check`, form);
  return {
    record: toRecord(res.data?.record),
    distance: num(res.data?.distance) ?? 0,
  };
}

// ---- Quản lý (admin) ----

/** IP server nhìn thấy + dải gợi ý whitelist (IPv6 → /56, IPv4 → /32). */
export async function fetchCurrentIp(): Promise<{ ip: string; suggestedCidr: string }> {
  const res = await apiClient.get<{ ip: string; suggestedCidr?: string }>(`${BASE}/current-ip`);
  const ip = str(res.data?.ip) ?? '';
  return { ip, suggestedCidr: str(res.data?.suggestedCidr) || ip };
}

export async function fetchOverview(): Promise<AttendanceOverviewRow[]> {
  const res = await apiClient.get<any[]>(`${BASE}/overview`);
  return Array.isArray(res.data)
    ? res.data.map((r) => ({
        employeeId: str(r?.employeeId) ?? '',
        name: str(r?.name) ?? '',
        email: str(r?.email),
        position: str(r?.position),
        status: str(r?.status) ?? 'active',
        faceCount: num(r?.faceCount) ?? 0,
        todayIn: toIso(r?.todayIn),
        todayOut: toIso(r?.todayOut),
      }))
    : [];
}

export async function fetchHistory(params?: {
  employeeId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<AttendanceHistory> {
  const res = await apiClient.get<any>(`${BASE}/history`, { params });
  const d = res.data ?? {};
  return {
    items: Array.isArray(d.items) ? d.items.map(toRecord) : [],
    total: num(d.total) ?? 0,
    limit: num(d.limit) ?? 100,
    offset: num(d.offset) ?? 0,
  };
}

export async function fetchNetworks(): Promise<AllowedNetwork[]> {
  const res = await apiClient.get<any[]>(`${BASE}/networks`);
  return Array.isArray(res.data) ? res.data.map(toNetwork) : [];
}

export async function upsertNetwork(input: {
  id?: string;
  label?: string | null;
  ipCidr: string;
  active?: boolean;
}): Promise<AllowedNetwork> {
  const res = await apiClient.post<any>(`${BASE}/networks`, input);
  return toNetwork(res.data);
}

export async function deleteNetwork(id: string): Promise<{ ok: boolean }> {
  const res = await apiClient.delete<{ ok: boolean }>(`${BASE}/networks/${id}`);
  return res.data;
}

/** Xoá toàn bộ mẫu mặt của 1 NV (admin, để đăng ký lại). */
export async function clearEmployeeFace(
  employeeId: string,
): Promise<{ ok: boolean; deleted: number }> {
  const res = await apiClient.post<{ ok: boolean; deleted: number }>(
    `${BASE}/faces/${employeeId}/clear`,
    {},
  );
  return res.data;
}

// ---- Bảng công & lương (admin) ----

const n0 = (v: unknown): number => (typeof v === 'number' ? v : 0);

function toDayShift(s: any): AttendanceDayShift {
  return {
    code: (s?.code === 'ca1' || s?.code === 'ca2' || s?.code === 'ca3' ? s.code : 'ca1'),
    name: str(s?.name) ?? '',
    congFactor: n0(s?.congFactor),
    registered: s?.registered === true,
    worked: s?.worked === true,
    valid: s?.valid === true,
    hours: n0(s?.hours),
    adjHours: n0(s?.adjHours),
    totalHours: n0(s?.totalHours),
    pay: num(s?.pay),
    status:
      s?.status === 'valid' ||
      s?.status === 'partial' ||
      s?.status === 'no_checkout' ||
      s?.status === 'missed' ||
      s?.status === 'unregistered'
        ? s.status
        : 'off',
  };
}

function toPayrollDay(d: any): PayrollDay {
  return {
    date: str(d?.date) ?? '',
    cong: n0(d?.cong),
    workHours: n0(d?.workHours),
    adjHours: n0(d?.adjHours),
    hours: n0(d?.hours),
    rate: num(d?.rate),
    pay: n0(d?.pay),
    registered: n0(d?.registered),
    valid: n0(d?.valid),
    in: toIso(d?.in),
    out: toIso(d?.out),
    shifts: Array.isArray(d?.shifts) ? d.shifts.map(toDayShift) : [],
    missingCheckout: d?.missingCheckout === true,
    locked: d?.locked === true,
    lockNote: str(d?.lockNote) ?? '',
  };
}

function toPayrollRow(r: any): PayrollRow {
  return {
    employeeId: str(r?.employeeId) ?? '',
    name: str(r?.name) ?? '',
    position: str(r?.position),
    totalHours: n0(r?.totalHours),
    workHours: n0(r?.workHours),
    adjHours: n0(r?.adjHours),
    totalCong: n0(r?.totalCong),
    registeredShifts: n0(r?.registeredShifts),
    validShifts: n0(r?.validShifts),
    salary: n0(r?.salary),
    days: Array.isArray(r?.days) ? r.days.map(toPayrollDay) : [],
  };
}

/** Tổng hợp công/giờ/lương theo kỳ (mặc định tháng hiện tại nếu không truyền). */
export async function fetchPayroll(params?: {
  from?: string;
  to?: string;
  employeeId?: string;
}): Promise<PayrollResult> {
  const res = await apiClient.get<any>(`${BASE}/payroll`, { params });
  const d = res.data ?? {};
  return {
    from: str(d?.from) ?? '',
    to: str(d?.to) ?? '',
    totalSalary: n0(d?.totalSalary),
    totalHours: n0(d?.totalHours),
    employees: Array.isArray(d?.employees) ? d.employees.map(toPayrollRow) : [],
  };
}

/** Kết quả chốt công + gửi bảng lương Zalo (POST /attendance/payroll/close). */
export interface ClosePayrollResult {
  month: string;
  from: string;
  to: string;
  totalSalary: number;
  employeeCount: number;
  sent: number;
  skipped: number;
  fullFileUrl: string | null;
  dryRun: boolean;
}

/**
 * Chốt công kỳ + gửi bảng lương Excel qua Zalo NGAY — chỉ gửi cho từng NV tương
 * ứng (file riêng). `dryRun` → chỉ sinh file tổng, trả link, KHÔNG gửi Zalo.
 */
export async function closePayroll(params?: {
  from?: string;
  to?: string;
  dryRun?: boolean;
}): Promise<ClosePayrollResult> {
  const res = await apiClient.post<any>(`${BASE}/payroll/close`, null, {
    params: {
      from: params?.from,
      to: params?.to,
      dryRun: params?.dryRun ? 'true' : undefined,
    },
  });
  const d = res.data ?? {};
  return {
    month: str(d?.month) ?? '',
    from: str(d?.from) ?? '',
    to: str(d?.to) ?? '',
    totalSalary: n0(d?.totalSalary),
    employeeCount: n0(d?.employeeCount),
    sent: n0(d?.sent),
    skipped: n0(d?.skipped),
    fullFileUrl: str(d?.fullFileUrl) ?? null,
    dryRun: d?.dryRun === true,
  };
}

function toAdjustment(a: any): AttendanceAdjustment {
  return {
    id: str(a?.id) ?? '',
    employeeId: str(a?.employeeId) ?? '',
    employeeName: str(a?.employeeName),
    workDate: str(a?.workDate) ?? '',
    hours: n0(a?.hours),
    shiftCode: a?.shiftCode === 'ca1' || a?.shiftCode === 'ca2' || a?.shiftCode === 'ca3' ? a.shiftCode : null,
    reason: str(a?.reason),
    createdBy: str(a?.createdBy),
    createdAt: toIso(a?.createdAt),
  };
}

export async function fetchAdjustments(params?: {
  employeeId?: string;
  from?: string;
  to?: string;
}): Promise<AttendanceAdjustment[]> {
  const res = await apiClient.get<any[]>(`${BASE}/adjustments`, { params });
  return Array.isArray(res.data) ? res.data.map(toAdjustment) : [];
}

export async function addAdjustment(input: {
  employeeId: string;
  workDate: string;
  /** Bỏ trống khi dùng `fill` — BE tự tính phần còn thiếu của ca. */
  hours?: number;
  shiftCode?: string;
  reason?: string;
  /** true = bù ĐỦ ca (thời lượng ca − giờ đã chấm − giờ đã bổ sung). */
  fill?: boolean;
}): Promise<AttendanceAdjustment | null> {
  const res = await apiClient.post<any>(`${BASE}/adjustments`, input);
  // Ca đã đủ giờ → BE trả null, không tạo bản ghi.
  return res.data ? toAdjustment(res.data) : null;
}

/** Chốt công 1 ngày — số giờ hiện tại là số cuối, khỏi bù đủ ca. */
export async function lockDay(input: {
  employeeId: string;
  workDate: string;
  note?: string;
}): Promise<{ ok: boolean }> {
  await apiClient.post(`${BASE}/day-lock`, input);
  return { ok: true };
}

/** Mở chốt để sửa lại ngày. */
export async function unlockDay(employeeId: string, workDate: string): Promise<{ ok: boolean }> {
  const res = await apiClient.delete<{ ok: boolean }>(
    `${BASE}/day-lock/${encodeURIComponent(employeeId)}/${workDate}`,
  );
  return res.data ?? { ok: false };
}

export async function deleteAdjustment(id: string): Promise<{ ok: boolean }> {
  const res = await apiClient.delete<{ ok: boolean }>(`${BASE}/adjustments/${id}`);
  return res.data;
}
