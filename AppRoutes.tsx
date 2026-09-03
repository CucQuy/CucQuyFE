import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleBasedRoute from "./components/RoleBasedRoute";
import Spinner from "./components/ui/Spinner";
// Lazy-load từng trang → mỗi trang là 1 chunk JS riêng, chỉ tải khi vào (giảm bundle đầu).
const DashboardPage = lazy(() => import("./pages/Dashboard/index"));
const GoalsPage = lazy(() => import("./pages/Goals/index"));
const OrdersPage = lazy(() => import("./pages/Orders/index"));
const ShippingPage = lazy(() => import("./pages/Shipping/index"));
const TxOverviewPage = lazy(() => import("./pages/Transactions/OverviewPage"));
const TxLedgerPage = lazy(() => import("./pages/Transactions/LedgerPage"));
const PromotionsPage = lazy(() => import("./pages/Promotions/index"));
const InventoryPage = lazy(() => import("./pages/Storage/index"));
const ProductDetailPage = lazy(() => import("./pages/Storage/product/ProductDetailPage"));
const CostOverviewPage = lazy(() => import("./pages/CostHub/OverviewTab"));
const CostReceiptsPage = lazy(() => import("./pages/StockReceipts/index"));
const CostMaterialsPage = lazy(() => import("./pages/Materials/index"));
const CostAssetsPage = lazy(() => import("./pages/CostHub/AssetsTab"));
const CostOpexPage = lazy(() => import("./pages/CostHub/OpexTab"));
const RecipesPage = lazy(() => import("./pages/Recipes/index"));
const CustomersPage = lazy(() => import("./pages/Customers/index"));
const SuppliersPage = lazy(() => import("./pages/Suppliers/index"));
const CarriersPage = lazy(() => import("./pages/Partners/CarriersPage"));
const UsersPage = lazy(() => import("./pages/Users/index"));
const EmployeesPage = lazy(() => import("./pages/Employees/index"));
const CalendarPage = lazy(() => import("./pages/Calendar/CalendarPage"));
const ShiftsPage = lazy(() => import("./pages/Shifts/index"));
const ShiftAssignPage = lazy(() => import("./pages/Shifts/AssignPage"));
const AttendancePage = lazy(() => import("./pages/Attendance/index"));
const ShiftRegisterPage = lazy(() => import("./pages/Attendance/RegisterPage"));
const AttendanceManagePage = lazy(() => import("./pages/Attendance/ManagePage"));
const SystemTrafficPage = lazy(() => import("./pages/System/Traffic/index"));
const SystemLogsPage = lazy(() => import("./pages/System/Requests/index"));
const NotificationsPage = lazy(() => import("./pages/Notifications/index"));
const SepaySettingsTab = lazy(() => import("./pages/Settings/SepaySettingsTab"));
const SpeakerSettingsTab = lazy(() => import("./pages/Settings/SpeakerSettingsTab"));
const ZaloSettingsTab = lazy(() => import("./pages/Settings/ZaloSettingsTab"));
const ScreenVisibilityTab = lazy(() => import("./pages/Settings/ScreenVisibilityTab"));
const RolesPage = lazy(() => import("./pages/Settings/RolesPage"));
const ProductSettings = lazy(() => import("./pages/Settings/ProductSettings"));
const LoginPage = lazy(() => import("./pages/Login/index"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallback/index"));
// Trang tra cứu đơn CÔNG KHAI cho khách (link trong tin Zalo) — ngoài ProtectedRoute/Layout.
const PublicOrderPage = lazy(() => import("./pages/PublicOrder/index"));
const OrderNotifyPage = lazy(() => import("./pages/OrderNotify/index"));
const SerpApiMapsTestPage = lazy(() => import("./pages/Test/SerpApiMaps/index"));
import { routes } from "./config/routes";

const PageLoader: React.FC = () => (
  <div className="flex h-full min-h-[40vh] items-center justify-center">
    <Spinner size="lg" textClassName="text-primary-500" />
  </div>
);

/**
 * Bảng route của app — tách khỏi App.tsx (App.tsx chỉ còn provider tree + HashRouter + Toaster).
 * Giữ nguyên 100% route + phân quyền RoleBasedRoute + redirect như trước (no-visual-change).
 */
const AppRoutes: React.FC = () => (
  <Suspense fallback={<PageLoader />}>
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/auth/callback" element={<AuthCallbackPage />} />
    <Route path="/don/:token" element={<PublicOrderPage />} />
    <Route
      path="/"
      element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }
    >
      <Route
        index
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/")?.roles}>
            <DashboardPage />
          </RoleBasedRoute>
        }
      />
      <Route
        path="goals"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/goals")?.roles}>
            <GoalsPage />
          </RoleBasedRoute>
        }
      />
      <Route
        path="orders"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/orders")?.roles}>
            <OrdersPage />
          </RoleBasedRoute>
        }
      />
      <Route
        path="order-notify"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/order-notify")?.roles}>
            <OrderNotifyPage />
          </RoleBasedRoute>
        }
      />
      <Route
        path="shipping"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/shipping")?.roles}>
            <ShippingPage />
          </RoleBasedRoute>
        }
      />
      {/* Tài chính — 2 sub-screen: Tổng quan (P&L) + Sổ giao dịch (gộp Lịch sử + Đối soát) */}
      <Route
        path="finance/overview"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/finance/overview")?.roles}>
            <TxOverviewPage />
          </RoleBasedRoute>
        }
      />
      <Route
        path="finance/ledger"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/finance/ledger")?.roles}>
            <TxLedgerPage />
          </RoleBasedRoute>
        }
      />
      {/* Back-compat redirect các path cũ → Sổ giao dịch mới ("Cần đối soát" đã gỡ) */}
      <Route path="finance" element={<Navigate to="/finance/overview" replace />} />
      <Route path="finance/history" element={<Navigate to="/finance/ledger" replace />} />
      <Route path="finance/reconcile" element={<Navigate to="/finance/ledger" replace />} />
      <Route path="finance/reconciliation" element={<Navigate to="/finance/ledger" replace />} />
      <Route path="finance/transactions" element={<Navigate to="/finance/ledger" replace />} />
      <Route path="revenue" element={<Navigate to="/finance/overview" replace />} />
      <Route path="finance/cashflow" element={<Navigate to="/finance/ledger" replace />} />
      <Route path="transactions" element={<Navigate to="/finance/ledger" replace />} />
      <Route
        path="promotions"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/promotions")?.roles}>
            <PromotionsPage />
          </RoleBasedRoute>
        }
      />
      {/* Đã gỡ screen Hoa hồng — redirect các path cũ về Tổng quan */}
      <Route path="commission" element={<Navigate to="/" replace />} />
      <Route path="commission-settings" element={<Navigate to="/" replace />} />
      <Route path="my-commission" element={<Navigate to="/" replace />} />
      <Route path="commission-guide" element={<Navigate to="/" replace />} />
      <Route
        path="storage"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/storage")?.roles}>
            <InventoryPage />
          </RoleBasedRoute>
        }
      />
      <Route
        path="storage/product/:id"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/storage")?.roles}>
            <ProductDetailPage />
          </RoleBasedRoute>
        }
      />
      {/* Chi phí vận hành: 5 screen con (Tổng quan · Phiếu nhập · NVL · Tài sản · Vận hành). */}
      <Route path="expenses" element={<Navigate to="/expenses/overview" replace />} />
      <Route path="expenses/overview" element={<RoleBasedRoute requiredRole={routes.find((r) => r.path === "/expenses/overview")?.roles}><CostOverviewPage /></RoleBasedRoute>} />
      <Route path="expenses/receipts" element={<RoleBasedRoute requiredRole={routes.find((r) => r.path === "/expenses/receipts")?.roles}><CostReceiptsPage /></RoleBasedRoute>} />
      <Route path="expenses/materials" element={<RoleBasedRoute requiredRole={routes.find((r) => r.path === "/expenses/materials")?.roles}><CostMaterialsPage /></RoleBasedRoute>} />
      <Route path="expenses/assets" element={<RoleBasedRoute requiredRole={routes.find((r) => r.path === "/expenses/assets")?.roles}><CostAssetsPage /></RoleBasedRoute>} />
      <Route path="recipes" element={<RoleBasedRoute requiredRole={routes.find((r) => r.path === "/recipes")?.roles}><RecipesPage /></RoleBasedRoute>} />
      <Route path="expenses/opex" element={<RoleBasedRoute requiredRole={routes.find((r) => r.path === "/expenses/opex")?.roles}><CostOpexPage /></RoleBasedRoute>} />
      {/* Đối tác = nhóm 3 màn con: Khách hàng / Nhà cung cấp / Đơn vị vận chuyển. */}
      <Route path="partners" element={<Navigate to="/partners/customers" replace />} />
      <Route
        path="partners/customers"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/partners/customers")?.roles}>
            <CustomersPage />
          </RoleBasedRoute>
        }
      />
      <Route
        path="partners/suppliers"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/partners/suppliers")?.roles}>
            <SuppliersPage />
          </RoleBasedRoute>
        }
      />
      <Route
        path="partners/carriers"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/partners/carriers")?.roles}>
            <CarriersPage />
          </RoleBasedRoute>
        }
      />
      {/* Link cũ → màn con tương ứng. */}
      <Route path="suppliers" element={<Navigate to="/partners/suppliers" replace />} />
      <Route path="customers" element={<Navigate to="/partners/customers" replace />} />
      <Route path="stock-receipts" element={<Navigate to="/expenses/receipts" replace />} />
      <Route path="materials" element={<Navigate to="/expenses/materials" replace />} />
      <Route path="bill-import" element={<Navigate to="/expenses/receipts" replace />} />
      <Route
        path="users"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/users")?.roles}>
            <UsersPage />
          </RoleBasedRoute>
        }
      />
      <Route
        path="employees"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/employees")?.roles}>
            <EmployeesPage />
          </RoleBasedRoute>
        }
      />
      {/* Lịch là trang riêng. */}
      <Route
        path="calendar"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/calendar")?.roles}>
            <CalendarPage />
          </RoleBasedRoute>
        }
      />
      {/* Nhóm Ca làm: Cài đặt ca + Xếp ca (Lịch, Đăng ký ca ở route riêng). */}
      <Route
        path="shifts"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/shifts")?.roles}>
            <ShiftsPage />
          </RoleBasedRoute>
        }
      />
      <Route
        path="shifts/assign"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/shifts/assign")?.roles}>
            <ShiftAssignPage />
          </RoleBasedRoute>
        }
      />
      <Route
        path="attendance"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/attendance")?.roles}>
            <AttendancePage />
          </RoleBasedRoute>
        }
      />
      <Route
        path="attendance/register"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/attendance/register")?.roles}>
            <ShiftRegisterPage />
          </RoleBasedRoute>
        }
      />
      <Route
        path="attendance/manage"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/attendance/manage")?.roles}>
            <AttendanceManagePage />
          </RoleBasedRoute>
        }
      />
      {/* Khuôn mặt đã gộp vào trang Nhân viên → redirect link cũ */}
      <Route path="attendance/faces" element={<Navigate to="/employees" replace />} />
      <Route path="attendance/payroll" element={<Navigate to="/attendance/manage" replace />} />
      <Route
        path="system/traffic"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/system/traffic")?.roles}>
            <SystemTrafficPage />
          </RoleBasedRoute>
        }
      />
      <Route
        path="system/logs"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/system/logs")?.roles}>
            <SystemLogsPage />
          </RoleBasedRoute>
        }
      />
      <Route
        path="notifications"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/notifications")?.roles}>
            <NotificationsPage />
          </RoleBasedRoute>
        }
      />
      <Route path="settings" element={<Navigate to="/settings/sepay" replace />} />
      {/* Cài đặt đơn hàng đã gỡ: nhãn phụ thu bỏ, phí ship chuyển sang /shipping (Bán hàng). */}
      <Route path="settings/order" element={<Navigate to="/shipping" replace />} />
      <Route
        path="settings/sepay"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/settings/sepay")?.roles}>
            <SepaySettingsTab />
          </RoleBasedRoute>
        }
      />
      <Route
        path="settings/speaker"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/settings/speaker")?.roles}>
            <SpeakerSettingsTab />
          </RoleBasedRoute>
        }
      />
      <Route
        path="settings/zalo"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/settings/zalo")?.roles}>
            <ZaloSettingsTab />
          </RoleBasedRoute>
        }
      />
      <Route
        path="settings/screens"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/settings/screens")?.roles}>
            <ScreenVisibilityTab />
          </RoleBasedRoute>
        }
      />
      <Route
        path="settings/roles"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/settings/roles")?.roles}>
            <RolesPage />
          </RoleBasedRoute>
        }
      />
      {/* Mạng đã gộp vào Cài đặt → Màn hình (tab Dải mạng) — giữ redirect cho bookmark. */}
      <Route path="settings/network" element={<Navigate to="/settings/screens" replace />} />
      <Route
        path="settings/product"
        element={
          <RoleBasedRoute requiredRole={routes.find((r) => r.path === "/settings/product")?.roles}>
            <ProductSettings />
          </RoleBasedRoute>
        }
      />
      {/* Back-compat: các path cũ đã gộp vào "Cài đặt sản phẩm" */}
      <Route path="settings/badges" element={<Navigate to="/settings/product" replace />} />
      <Route path="settings/categories" element={<Navigate to="/settings/product" replace />} />
      <Route path="settings/flavors" element={<Navigate to="/settings/product" replace />} />
      <Route path="test/serpapi-maps" element={<SerpApiMapsTestPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
  </Suspense>
);

export default AppRoutes;
