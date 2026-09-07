import { apiClient } from '@/services/api/client';

/**
 * Loại lịch = composer của code (4 loại dưới) HOẶC key 1 chức năng tự soạn thêm từ
 * màn Chức năng (097) → để string, danh mục lấy từ API zalo-features.
 */
export type ScheduleType = string;

export interface NotificationSchedule {
  id: string;
  type: ScheduleType;
  timeHHMM: string; // 'HH:MM'
  days: number[]; // 0..6 (0=CN), rỗng = hằng ngày
  targetGroupIds: string[];
  enabled: boolean;
  lastRunOn?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScheduleInput {
  type?: ScheduleType;
  timeHHMM?: string;
  days?: number[];
  targetGroupIds?: string[];
  enabled?: boolean;
}

const PATH = '/notification-schedules';

export const fetchSchedules = async (): Promise<NotificationSchedule[]> => {
  const res = await apiClient.get<NotificationSchedule[]>(PATH);
  return res.data ?? [];
};

export const createSchedule = async (data: ScheduleInput): Promise<{ id: string }> => {
  const res = await apiClient.post<{ id: string }>(PATH, data);
  return res.data;
};

export const updateSchedule = async (id: string, data: ScheduleInput): Promise<void> => {
  await apiClient.patch(`${PATH}/${id}`, data);
};

export const deleteSchedule = async (id: string): Promise<void> => {
  await apiClient.delete(`${PATH}/${id}`);
};

/** Tuỳ chọn khi gửi ngay (chỉ dùng cho delivery_by_day): ngày bắt đầu + số ngày gom. */
export interface SendNowOptions {
  fromDate?: string; // YYYY-MM-DD
  days?: number; // 1..14
}

/** Gửi ngay 1 loại thông báo qua Zalo (nhóm mặc định). */
export const sendNotificationNow = async (
  type: ScheduleType,
  opts?: SendNowOptions,
): Promise<{ sent: boolean }> => {
  const res = await apiClient.post<{ sent: boolean }>(`${PATH}/send-now`, { type, ...opts });
  return res.data ?? { sent: false };
};

/** Nhãn 4 loại nội dung do CODE soạn — chức năng tự soạn lấy nhãn từ API. */
export const SCHEDULE_TYPE_LABEL: Record<string, string> = {
  daily_summary: 'Tổng kết hôm nay',
  production_tomorrow: 'Sản xuất ngày mai',
  delivery_today_tomorrow: 'Đơn giao hôm nay + ngày mai',
  delivery_by_day: 'Đơn cần giao (gom theo ngày, 3 ngày tới)',
};

/** Thứ trong tuần (0=CN). */
export const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: 'T2' },
  { value: 2, label: 'T3' },
  { value: 3, label: 'T4' },
  { value: 4, label: 'T5' },
  { value: 5, label: 'T6' },
  { value: 6, label: 'T7' },
  { value: 0, label: 'CN' },
];
