import { UserRole } from "@/types/user";
import {
  LayoutDashboard,
  Target,
  ShoppingCart,
  Boxes,
  FileText,
  Truck,
  Package,
  Users,
  Settings,
  TrendingUp,
  Coins,
  Wallet,
  BookOpen,
  UserCog,
  IdCard,
  Bell,
  MessageCircle,
  Activity,
  ShieldCheck,
  Tag,
  Monitor,
  MessageSquare,
  QrCode,
  Building2,
  Clock,
  UserCheck,
  CalendarCheck,
  ChefHat,
  PieChart,
  BarChart3,
  BookText,
  Receipt,
  Armchair,
  Factory,
  CalendarClock,
  CalendarRange,
  SlidersHorizontal,
  Cake,
  ClipboardList,
  Handshake,
  BriefcaseBusiness,
  Store,
  ShoppingBag,
  Volume2,
} from "lucide-react";
import { LucideIcon } from "lucide-react";
import ZaloIcon from "@/components/ui/ZaloIcon";
import { ScreenVisibilityMap, ScreenRolesMap } from "@/types";

export type RouteType = "page" | "tab";

export interface RouteConfig {
  type: RouteType;
  path: string;
  labelKey: string;
  icon: LucideIcon;
  roles: UserRole[]; // Roles có quyền truy cập route này
  tabId?: string; // Dùng cho route type=tab
  parentPath?: string; // Dùng cho route type=tab
  disabled?: boolean;
}

export const getRouteConfigKey = (route: RouteConfig): string => {
  if (route.type === "tab" && route.parentPath && route.tabId) {
    return `${route.parentPath}#${route.tabId}`;
  }
  return route.path;
};

/**
 * Role được phép truy cập 1 route: ưu tiên OVERRIDE từ config (Cài đặt → Màn hình),
 * nếu không có thì dùng mặc định `route.roles` (hard-code). Chỉnh được ở /settings/screens.
 */
export const effectiveRoles = (
  route: RouteConfig,
  screenRoles: ScreenRolesMap = {},
): UserRole[] => {
  const ov = screenRoles[getRouteConfigKey(route)];
  return ov && ov.length ? (ov as UserRole[]) : route.roles;
};

/** Role được phép cho 1 path (dùng ở route guard). undefined nếu path không thuộc routes. */
export const rolesForPath = (
  path: string,
  screenRoles: ScreenRolesMap = {},
): UserRole[] | undefined => {
  const ov = screenRoles[path];
  if (ov && ov.length) return ov as UserRole[];
  return routes.find((r) => r.path === path)?.roles;
};

/**
 * Cấu hình routes và quyền truy cập theo role
 */
export const routes: RouteConfig[] = [
  {
    type: "page",
    path: "/",
    labelKey: "nav.dashboard",
    icon: LayoutDashboard,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/goals",
    labelKey: "nav.goals",
    icon: Target,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/orders",
    labelKey: "nav.orders",
    icon: ShoppingCart,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLABORATOR],
  },
  {
    type: "page",
    path: "/order-notify",
    labelKey: "nav.orderNotify",
    icon: Bell,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/facebook",
    labelKey: "nav.facebookCustomers",
    icon: MessageCircle,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/shipping",
    labelKey: "nav.shipping",
    icon: Truck,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/finance/overview",
    labelKey: "nav.txOverview",
    icon: PieChart,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/finance/ledger",
    labelKey: "nav.txLedger",
    icon: BookText,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/promotions",
    labelKey: "nav.promotions",
    icon: Tag,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/storage",
    labelKey: "nav.inventory",
    icon: Boxes,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/expenses/overview",
    labelKey: "nav.costOverview",
    icon: BarChart3,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/expenses/receipts",
    labelKey: "nav.stockReceipts",
    icon: Receipt,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/expenses/materials",
    labelKey: "nav.materials",
    icon: Package,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/expenses/assets",
    labelKey: "nav.costAssets",
    icon: Armchair,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/expenses/opex",
    labelKey: "nav.costOpex",
    icon: Coins,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/recipes",
    labelKey: "nav.recipes",
    icon: ChefHat,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/partners/customers",
    labelKey: "nav.customers",
    icon: Users,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLABORATOR],
  },
  {
    type: "page",
    path: "/partners/suppliers",
    labelKey: "nav.suppliers",
    icon: Factory,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/partners/carriers",
    labelKey: "nav.partnersCarriers",
    icon: Truck,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/employees",
    labelKey: "nav.employees",
    icon: IdCard,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/shifts",
    labelKey: "nav.shifts",
    icon: SlidersHorizontal,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/shifts/assign",
    labelKey: "nav.shiftAssign",
    icon: CalendarRange,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/calendar",
    labelKey: "nav.calendar",
    icon: CalendarClock,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/attendance",
    labelKey: "nav.attendance",
    icon: Clock,
    // Màn chấm công dành cho người vào/tan ca — super_admin KHÔNG cần chấm công.
    roles: [UserRole.ADMIN, UserRole.STAFF],
  },
  {
    type: "page",
    path: "/attendance/register",
    labelKey: "nav.shiftRegister",
    icon: CalendarCheck,
    // Đăng ký ca tuần sau — cùng đối tượng với chấm công (NV/quản lý), không cần super_admin.
    roles: [UserRole.ADMIN, UserRole.STAFF],
  },
  {
    type: "page",
    path: "/attendance/manage",
    labelKey: "nav.attendanceManage",
    icon: Coins,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/users",
    labelKey: "nav.users",
    icon: UserCog,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN], // Chỉ admin mới quản lý users
  },
  {
    type: "page",
    path: "/notifications",
    labelKey: "nav.notifications",
    icon: Bell,
    roles: [UserRole.SUPER_ADMIN],
  },
  {
    type: "page",
    path: "/system/traffic",
    labelKey: "nav.systemTraffic",
    icon: Activity,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/system/logs",
    labelKey: "nav.systemLogs",
    icon: FileText,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    type: "page",
    path: "/settings/product",
    labelKey: "nav.settingsProduct",
    icon: Cake,
    roles: [UserRole.SUPER_ADMIN],
  },
  {
    type: "page",
    path: "/settings/sepay",
    labelKey: "nav.settingsSepay",
    icon: QrCode,
    roles: [UserRole.SUPER_ADMIN],
  },
  {
    type: "page",
    path: "/settings/speaker",
    labelKey: "nav.settingsSpeaker",
    icon: Volume2,
    roles: [UserRole.SUPER_ADMIN],
  },
  {
    type: "page",
    path: "/settings/zalo",
    labelKey: "nav.settingsZalo",
    icon: ZaloIcon as unknown as LucideIcon,
    roles: [UserRole.SUPER_ADMIN],
  },
  {
    type: "page",
    path: "/settings/screens",
    labelKey: "nav.settingsScreens",
    icon: Monitor,
    roles: [UserRole.SUPER_ADMIN],
  },
  {
    type: "page",
    path: "/settings/roles",
    labelKey: "nav.settingsRoles",
    icon: ShieldCheck,
    roles: [UserRole.SUPER_ADMIN],
  },
];

export const storageTabRoutes: RouteConfig[] = [
  {
    type: "tab",
    path: "/storage",
    parentPath: "/storage",
    tabId: "products",
    labelKey: "inventory.productsTab",
    icon: Boxes,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
];

/**
 * Kiểm tra xem role có quyền truy cập route không
 */
export const hasRoutePermission = (
  routePath: string,
  userRole: UserRole | undefined,
  screenRoles: ScreenRolesMap = {},
): boolean => {
  if (!userRole) return false;

  const route = routes.find((r) => r.path === routePath);
  if (!route) return false;

  return effectiveRoles(route, screenRoles).includes(userRole);
};

/**
 * Normalize role từ string hoặc enum về UserRole enum
 */
const normalizeRole = (
  role: UserRole | string | undefined,
): UserRole | undefined => {
  if (!role) return undefined;

  // Nếu đã là enum, return luôn
  if (Object.values(UserRole).includes(role as UserRole)) {
    return role as UserRole;
  }

  // Nếu là string, thử match với enum values
  const roleString = String(role).toLowerCase();
  if (roleString === "super_admin" || roleString === UserRole.SUPER_ADMIN) {
    return UserRole.SUPER_ADMIN;
  }
  if (roleString === "admin" || roleString === UserRole.ADMIN) {
    return UserRole.ADMIN;
  }
  if (roleString === "colaborator" || roleString === UserRole.COLABORATOR) {
    return UserRole.COLABORATOR;
  }

  return undefined;
};

/**
 * Lấy danh sách routes mà user có quyền truy cập
 */
export const getAccessibleRoutes = (
  userRole: UserRole | string | undefined,
  screenVisibility: ScreenVisibilityMap = {},
  screenRoles: ScreenRolesMap = {},
): RouteConfig[] => {
  const normalizedRole = normalizeRole(userRole);

  if (!normalizedRole) {
    return [];
  }

  return routes
    .filter((route) => effectiveRoles(route, screenRoles).includes(normalizedRole))
    .map((route) => {
      const configKey = getRouteConfigKey(route);
      const disabledByConfig = screenVisibility[configKey] === false;
      return {
        ...route,
        disabled: Boolean(route.disabled) || disabledByConfig,
      };
    });
};

/**
 * Nhóm menu sidebar dạng xổ xuống: 1 mục cha chứa nhiều route con.
 * childPaths quyết định thứ tự hiển thị các mục con trong nhóm.
 */
export interface NavGroupConfig {
  key: string;
  labelKey: string;
  icon: LucideIcon;
  childPaths: string[];
}

export const navGroups: NavGroupConfig[] = [
  {
    // Bán hàng: vận chuyển + khuyến mãi (Đơn hàng để phẳng cho nhanh).
    key: "sales",
    labelKey: "nav.salesGroup",
    icon: ShoppingBag,
    childPaths: [
      "/order-notify",
      "/facebook",
      "/shipping",
      "/promotions",
    ],
  },
  {
    key: "transactions",
    labelKey: "nav.transactionsHub",
    icon: Wallet,
    childPaths: [
      "/finance/overview",
      "/finance/ledger",
    ],
  },
  {
    // Đối tác: Khách hàng + Nhà cung cấp + Đơn vị vận chuyển.
    key: "partners",
    labelKey: "nav.partnersGroup",
    icon: Handshake,
    childPaths: [
      "/partners/customers",
      "/partners/suppliers",
      "/partners/carriers",
    ],
  },
  {
    // Nhân sự: Nhân viên (lương) + Chấm công + Quản lý chấm công.
    key: "hr",
    labelKey: "nav.hrGroup",
    icon: BriefcaseBusiness,
    childPaths: [
      "/employees",
      "/attendance",
      "/attendance/manage",
    ],
  },
  {
    // Ca làm = KẾ HOẠCH ca: Cài đặt ca + Xếp ca (admin) + Đăng ký ca (NV) + Lịch.
    key: "shift",
    labelKey: "nav.shiftGroup",
    icon: CalendarClock,
    childPaths: [
      "/shifts",
      "/shifts/assign",
      "/attendance/register",
      "/calendar",
    ],
  },
  {
    key: "cost",
    labelKey: "nav.costGroup",
    icon: Building2,
    childPaths: [
      "/expenses/overview",
      "/expenses/receipts",
      "/expenses/materials",
      "/expenses/assets",
      "/expenses/opex",
    ],
  },
  {
    key: "product",
    labelKey: "nav.productGroup",
    icon: Store,
    childPaths: [
      "/storage",
      "/recipes",
      "/settings/product",
    ],
  },
  {
    // Hệ thống & quản trị: người dùng + thông báo + giám sát hệ thống.
    key: "system",
    labelKey: "nav.systemGroup",
    icon: ShieldCheck,
    childPaths: [
      "/users",
      "/notifications",
      "/system/traffic",
      "/system/logs",
    ],
  },
  {
    // Cài đặt: mỗi mục 1 screen con (Đơn hàng/Thanh toán/Zalo/Màn hình).
    key: "settings",
    labelKey: "nav.settingsGroup",
    icon: Settings,
    childPaths: [
      "/settings/sepay",
      "/settings/speaker",
      "/settings/zalo",
      "/settings/screens",
      "/settings/roles",
    ],
  },
];

export type NavNode =
  | { type: "route"; route: RouteConfig }
  | { type: "group"; group: NavGroupConfig; children: RouteConfig[] };

/**
 * Dựng cây điều hướng: route thường giữ nguyên, các route thuộc 1 nhóm
 * được gom lại dưới mục cha (đặt tại vị trí của mục con đầu tiên).
 */
export const buildNavTree = (
  userRole: UserRole | string | undefined,
  screenVisibility: ScreenVisibilityMap = {},
  screenRoles: ScreenRolesMap = {},
): NavNode[] => {
  const accessible = getAccessibleRoutes(userRole, screenVisibility, screenRoles);
  const pathToGroup = new Map<string, NavGroupConfig>();
  navGroups.forEach((g) => g.childPaths.forEach((p) => pathToGroup.set(p, g)));

  const nodes: NavNode[] = [];
  const emitted = new Set<string>();

  for (const route of accessible) {
    const group = pathToGroup.get(route.path);
    if (!group) {
      nodes.push({ type: "route", route });
      continue;
    }
    if (emitted.has(group.key)) continue;
    emitted.add(group.key);
    const children = group.childPaths
      .map((p) => accessible.find((r) => r.path === p))
      .filter((r): r is RouteConfig => Boolean(r));
    if (children.length > 0) {
      nodes.push({ type: "group", group, children });
    }
  }

  return nodes;
};

export const getAccessibleStorageTabs = (
  userRole: UserRole | string | undefined,
  screenVisibility: ScreenVisibilityMap = {},
  screenRoles: ScreenRolesMap = {},
): RouteConfig[] => {
  const normalizedRole = normalizeRole(userRole);
  if (!normalizedRole) return [];
  return storageTabRoutes
    .filter((tab) => effectiveRoles(tab, screenRoles).includes(normalizedRole))
    .map((tab) => {
      const configKey = getRouteConfigKey(tab);
      const disabledByConfig = screenVisibility[configKey] === false;
      return {
        ...tab,
        disabled: Boolean(tab.disabled) || disabledByConfig,
      };
    });
};
