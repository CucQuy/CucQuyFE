export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  customName?: string; // Tên gợi nhớ do admin đặt
  status: UserStatus; // pending, active, inactive
  createdAt: string;
  lastLoginAt: string;
  role: UserRole;
}

/** Quyền hành động 1 module (view/create/edit/delete → bool). */
export type ModuleActions = Record<string, boolean>;
/** Phân quyền module×hành động của 1 role: { orders: {view,create,...}, ... }. */
export type RolePermissions = Record<string, ModuleActions>;

/** Vai trò động (quản lý ở Cài đặt → Quyền và Tính năng). key lưu ở users.role + screen_visibility.roles. */
export interface Role {
  key: string;
  name: string;
  sortOrder: number;
  builtIn: boolean;
  /** Ma trận phân quyền module×hành động (Quyền và Tính năng). */
  permissions?: RolePermissions;
}

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  COLABORATOR = 'colaborator',
  STAFF = 'staff',
}

