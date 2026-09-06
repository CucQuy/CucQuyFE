import { apiClient } from '@/services/api/client';
import {
  ShiftAssignment,
  SetDayInput,
  WorkShift,
  WorkShiftSaveItem,
} from '@/types/shift';

const BASE = '/shifts';

/** Ép ca định nghĩa (untrusted) về WorkShift với default an toàn. */
function toShift(r: any): WorkShift {
  return {
    code: typeof r?.code === 'string' ? r.code : '',
    name: typeof r?.name === 'string' ? r.name : '',
    startTime: typeof r?.startTime === 'string' ? r.startTime : '',
    endTime: typeof r?.endTime === 'string' ? r.endTime : '',
    congFactor: typeof r?.congFactor === 'number' ? r.congFactor : 0,
    sortOrder: typeof r?.sortOrder === 'number' ? r.sortOrder : 0,
    weekdays: Array.isArray(r?.weekdays)
      ? r.weekdays.filter((n: unknown): n is number => typeof n === 'number')
      : [],
    active: r?.active !== false,
  };
}

/** Ép phân ca (untrusted) về ShiftAssignment. */
function toAssignment(r: any): ShiftAssignment {
  return {
    id: typeof r?.id === 'string' ? r.id : '',
    employeeId: typeof r?.employeeId === 'string' ? r.employeeId : '',
    employeeName: typeof r?.employeeName === 'string' ? r.employeeName : '',
    workDate: typeof r?.workDate === 'string' ? r.workDate : '',
    shiftCode: typeof r?.shiftCode === 'string' ? r.shiftCode : '',
    note: typeof r?.note === 'string' ? r.note : null,
  };
}

export async function fetchShifts(): Promise<WorkShift[]> {
  const res = await apiClient.get<any[]>(BASE);
  return Array.isArray(res.data) ? res.data.map(toShift) : [];
}

/** Lưu cài đặt ca (giờ + thứ trong tuần + bật/tắt) → trả danh sách sau lưu. */
export async function saveShifts(
  items: WorkShiftSaveItem[],
): Promise<WorkShift[]> {
  const res = await apiClient.put<any[]>(BASE, items);
  return Array.isArray(res.data) ? res.data.map(toShift) : [];
}

/** Phân ca trong khoảng ngày [from, to] (yyyy-mm-dd). */
export async function fetchShiftAssignments(
  from: string,
  to: string,
): Promise<ShiftAssignment[]> {
  const res = await apiClient.get<any[]>(`${BASE}/assignments`, {
    params: { from, to },
  });
  return Array.isArray(res.data) ? res.data.map(toAssignment) : [];
}

/** Đặt trọn danh sách NV cho 1 (ngày, ca) → trả danh sách sau cập nhật. */
export async function setDayAssignments(
  input: SetDayInput,
): Promise<ShiftAssignment[]> {
  const res = await apiClient.put<any[]>(`${BASE}/assignments/day`, input);
  return Array.isArray(res.data) ? res.data.map(toAssignment) : [];
}

/** 1 dòng lịch sử thay đổi đăng ký ca. */
export interface ShiftAssignmentLog {
  id: number;
  employeeId: string;
  employeeName: string;
  workDate: string; // yyyy-mm-dd
  shiftCode: string;
  shiftName: string;
  /** 'add' = thêm ca, 'remove' = gỡ ca */
  action: 'add' | 'remove';
  /** 'self' = NV tự đăng ký, 'admin' = admin xếp/sửa */
  source: string;
  changedBy: string;
  createdAt: string | null;
}

/** Lịch sử thay đổi đăng ký ca — ai đổi, đổi gì, lúc nào. */
export async function fetchShiftLogs(params: {
  employeeId?: string;
  from?: string;
  to?: string;
  limit?: number;
} = {}): Promise<ShiftAssignmentLog[]> {
  const res = await apiClient.get<any[]>(`${BASE}/assignments/logs`, { params });
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.map((r) => ({
    id: Number(r?.id) || 0,
    employeeId: typeof r?.employeeId === 'string' ? r.employeeId : '',
    employeeName: typeof r?.employeeName === 'string' ? r.employeeName : '',
    workDate: typeof r?.workDate === 'string' ? r.workDate : '',
    shiftCode: typeof r?.shiftCode === 'string' ? r.shiftCode : '',
    shiftName: typeof r?.shiftName === 'string' ? r.shiftName : '',
    action: r?.action === 'remove' ? 'remove' : 'add',
    source: typeof r?.source === 'string' ? r.source : 'admin',
    changedBy: typeof r?.changedBy === 'string' ? r.changedBy : '',
    createdAt: typeof r?.createdAt === 'string' ? r.createdAt : null,
  }));
}
