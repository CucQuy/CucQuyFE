/**
 * Danh mục MODULE (tính năng) + HÀNH ĐỘNG cho màn "Quyền và Tính năng".
 * Mỗi role có 1 ma trận permissions: { moduleKey: { action: bool } }.
 * Thêm module mới = thêm 1 dòng ở đây (UI + hook useCan tự nhận).
 */

export type PermAction = 'view' | 'create' | 'edit' | 'delete';

export const PERM_ACTIONS: { key: PermAction; label: string }[] = [
  { key: 'view', label: 'Xem' },
  { key: 'create', label: 'Tạo' },
  { key: 'edit', label: 'Sửa' },
  { key: 'delete', label: 'Xóa' },
];

export interface PermModule {
  key: string;
  label: string;
  /** Hành động áp dụng cho module (ẩn action không liên quan). */
  actions: PermAction[];
  group: string;
}

const ALL: PermAction[] = ['view', 'create', 'edit', 'delete'];

/** Nhóm hiển thị theo thứ tự. */
export const PERM_GROUPS = [
  'Bán hàng',
  'Tài chính',
  'Đối tác',
  'Sản phẩm & Kho',
  'Nhân sự',
  'Hệ thống',
] as const;

export const PERMISSION_MODULES: PermModule[] = [
  // ── Bán hàng ──
  { key: 'orders', label: 'Đơn hàng', actions: ALL, group: 'Bán hàng' },
  { key: 'shipping', label: 'Vận chuyển', actions: ['view', 'edit'], group: 'Bán hàng' },
  { key: 'promotions', label: 'Khuyến mãi', actions: ALL, group: 'Bán hàng' },
  { key: 'calendar', label: 'Lịch', actions: ALL, group: 'Bán hàng' },

  // ── Tài chính ──
  { key: 'finance', label: 'Sổ quỹ / Giao dịch', actions: ['view', 'edit'], group: 'Tài chính' },
  { key: 'expenses', label: 'Chi phí', actions: ALL, group: 'Tài chính' },

  // ── Đối tác ──
  { key: 'customers', label: 'Khách hàng', actions: ALL, group: 'Đối tác' },
  { key: 'suppliers', label: 'Nhà cung cấp', actions: ALL, group: 'Đối tác' },

  // ── Sản phẩm & Kho ──
  { key: 'products', label: 'Sản phẩm', actions: ALL, group: 'Sản phẩm & Kho' },
  { key: 'inventory', label: 'Kho / Nguyên liệu', actions: ALL, group: 'Sản phẩm & Kho' },
  { key: 'recipes', label: 'Công thức', actions: ALL, group: 'Sản phẩm & Kho' },

  // ── Nhân sự ──
  { key: 'employees', label: 'Nhân viên', actions: ALL, group: 'Nhân sự' },
  { key: 'attendance', label: 'Chấm công', actions: ['view', 'create', 'edit'], group: 'Nhân sự' },
  { key: 'shifts', label: 'Ca làm / Đăng ký công', actions: ['view', 'edit'], group: 'Nhân sự' },

  // ── Hệ thống ──
  { key: 'dashboard', label: 'Tổng quan', actions: ['view'], group: 'Hệ thống' },
  { key: 'reports', label: 'Báo cáo / Thống kê', actions: ['view'], group: 'Hệ thống' },
  { key: 'users', label: 'Người dùng', actions: ['view', 'edit'], group: 'Hệ thống' },
  { key: 'notifications', label: 'Thông báo', actions: ['view'], group: 'Hệ thống' },
  { key: 'settings', label: 'Cài đặt', actions: ['view', 'edit'], group: 'Hệ thống' },
];
