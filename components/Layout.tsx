import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown, Menu, LayoutGrid } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useScreenConfig } from '@/contexts/ScreenConfigContext';
import { buildNavTree, RouteConfig, routes, navGroups, type NavGroupNode } from '@/config/routes';
import { getUserFromLocalStorage } from '@/utils/user/userUtil';
import ThemeToggle from './ThemeToggle';
import Spinner from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import MobileFooterNav from './MobileFooterNav';
import ZaloShareQueueHost from './ZaloShareQueueHost';
import { useSystemPing } from '@/hooks/useSystemPing';
import NotificationBell from './NotificationBell';
import Popover from '@/components/ui/Popover';

const Layout: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { screenVisibility, screenRoles, isScreenEnabled } = useScreenConfig();
  const ping = useSystemPing();

  const pingDot =
    ping.level === 'good' ? 'bg-emerald-500' : ping.level === 'ok' ? 'bg-amber-500' : 'bg-red-500';
  const pingText =
    ping.level === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : ping.level === 'ok'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  // Thu gọn sidebar (desktop) — nhớ lựa chọn qua localStorage.
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState<boolean>(
    () => localStorage.getItem('sidebarCollapsed') === '1',
  );
  React.useEffect(() => {
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  // Quick menu → mega menu (truy cập nhanh mọi trang)
  const [megaOpen, setMegaOpen] = React.useState(false);
  const megaRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!megaOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) setMegaOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMegaOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [megaOpen]);
  // đóng mega menu khi chuyển trang
  React.useEffect(() => { setMegaOpen(false); }, [location.pathname]);

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'vi' : 'en');
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success(t('nav.signOut') + ' success');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out');
    }
  };

  // Lấy danh sách routes mà user có quyền truy cập dựa trên role
  // Fallback: Nếu chưa có userData, load từ localStorage
  const storedUser = React.useMemo(() => getUserFromLocalStorage(), []);
  const userRole = userData?.role || storedUser?.role;
  
  
  const navTree = buildNavTree(userRole, screenVisibility, screenRoles);
  // Tách cho mega menu: route lẻ (cột "Chính") + các nhóm (mỗi nhóm 1 cột)
  const megaStandalone = navTree.flatMap((n) => (n.type === 'route' ? [n.route] : []));
  const megaGroups = navTree.flatMap((n) => (n.type === 'group' ? [n] : []));

  React.useEffect(() => {
    if (location.pathname === '/') return;
    if (!isScreenEnabled(location.pathname)) {
      navigate('/', { replace: true });
    }
  }, [location.pathname, isScreenEnabled, navigate]);

  // Trạng thái xổ của các nhóm menu; tự mở nhóm chứa trang đang xem
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    navTree.forEach(node => {
      if (node.type === 'group' && node.children.some(c => c.path === location.pathname)) {
        setOpenGroups(prev => (prev[node.group.key] ? prev : { ...prev, [node.group.key]: true }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Render 1 mục lá (route) trong sidebar
  const renderLeaf = (item: RouteConfig, indented = false) => {
    const active = location.pathname === item.path;
    const Icon = item.icon;
    return (
      <Link
        key={item.path}
        to={item.disabled ? '#' : item.path}
        className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${indented ? 'pl-10' : ''} ${
          active
            ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 shadow-sm'
            : item.disabled
              ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Icon className={`${indented ? 'w-4 h-4' : 'w-5 h-5'} mr-3 ${active ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'}`} />
        {t(item.labelKey)}
        {item.disabled && <span className="ml-auto text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">Bảo trì</span>}
      </Link>
    );
  };

  /**
   * Nhóm trong sidebar, render ĐỆ QUY để hỗ trợ 3 cấp
   * (vd: Kết nối đa kênh › Zalo › Nhóm & cài đặt). `depth` chỉ dùng để thụt lề.
   */
  const renderGroup = (node: NavGroupNode, depth = 0): React.ReactNode => {
    const GroupIcon = node.group.icon;
    const pathsInside = (n: NavGroupNode): string[] => [
      ...n.children.map((c) => c.path),
      ...n.subGroups.flatMap(pathsInside),
    ];
    const groupActive = pathsInside(node).includes(location.pathname);
    const isOpen = openGroups[node.group.key] ?? groupActive;
    return (
      <div key={node.group.key} className={depth > 0 ? 'ml-3' : undefined}>
        <button
          type="button"
          onClick={() => setOpenGroups(prev => ({ ...prev, [node.group.key]: !isOpen }))}
          className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            groupActive
              ? 'text-primary-700 dark:text-primary-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <GroupIcon className={`w-5 h-5 mr-3 ${groupActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'}`} />
          {t(node.group.labelKey)}
          <ChevronDown className={`ml-auto w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <div className="mt-1 space-y-1">
            {node.subGroups.map((sub) => renderGroup(sub, depth + 1))}
            {node.children.map(child => renderLeaf(child, true))}
          </div>
        )}
      </div>
    );
  };


  // 1 mục trong mega menu
  const renderMegaItem = (item: RouteConfig) => {
    const Icon = item.icon;
    const active = location.pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.disabled ? '#' : item.path}
        onClick={(e) => { if (item.disabled) { e.preventDefault(); return; } setMegaOpen(false); }}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
          active
            ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 font-medium'
            : item.disabled
              ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'}`} />
        <span className="truncate">{t(item.labelKey)}</span>
      </Link>
    );
  };

  // Tiêu đề trang lấy từ routes.ts (nguồn sự thật) — tránh map hardcode lỗi thời.
  // Route thuộc 1 nhóm sidebar → hiện breadcrumb "Nhóm › Trang" cho rõ ngữ cảnh.
  const getPageTitle = () => {
    const path = location.pathname;
    const route =
      routes.find((r) => r.path === path) ??
      routes
        .filter((r) => r.path !== '/' && path.startsWith(`${r.path}/`))
        .sort((a, b) => b.path.length - a.path.length)[0];
    if (!route) return 'Tiệm Bánh Cúc Quy';
    const group = navGroups.find((g) => g.childPaths.includes(route.path));
    const leaf = t(route.labelKey);
    return group ? `${t(group.labelKey)} › ${leaf}` : leaf;
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 z-20 overflow-hidden transition-[width,opacity] duration-300 ease-in-out will-change-[width] ${sidebarCollapsed ? 'w-0 border-r-0 opacity-0' : 'w-64 opacity-100'}`}>
        <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-700">
          <img src="/icon-v4.svg" alt="Tiệm Bánh Cúc Quy" className="w-8 h-8 rounded-lg mr-3 shadow-sm shadow-primary-300 dark:shadow-none" />
          <span className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Cúc <span className="text-primary-600 dark:text-primary-500"> Quy</span></span>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navTree.map((node) =>
            node.type === 'route' ? renderLeaf(node.route) : renderGroup(node),
          )}

          {/* Phiên bản web */}
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700">
            <p className="text-center text-[11px] font-mono text-slate-400 dark:text-slate-500">v{__BUILD_ID__}</p>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 md:px-8 z-30 sticky top-0 transition-colors duration-200">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-label={sidebarCollapsed ? 'Mở sidebar' : 'Thu gọn sidebar'}
              title={sidebarCollapsed ? 'Mở sidebar' : 'Thu gọn sidebar'}
              className="hidden md:inline-flex shrink-0 items-center justify-center w-9 h-9 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors active:scale-90"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="md:hidden flex min-w-0 items-center gap-2">
              <img src="/icon-v4.svg" alt="Tiệm Bánh Cúc Quy" className="w-8 h-8 shrink-0 rounded-lg shadow-sm shadow-primary-300 dark:shadow-none" />
              <div className="flex min-w-0 flex-col leading-none">
                <span className="truncate text-base font-bold text-slate-800 dark:text-white">Tiệm Bánh <span className="text-primary-600 dark:text-primary-500">Cúc Quy</span></span>
                <span className="mt-0.5 text-[9px] font-mono text-slate-400 dark:text-slate-500">v{__BUILD_ID__}</span>
              </div>
            </div>
            <div className="hidden md:block min-w-0">
              <h1 className="truncate text-xl font-bold text-slate-800 dark:text-white">
                {getPageTitle()}
              </h1>
            </div>

            {/* Quick menu → mega menu (truy cập nhanh) */}
            <div className="hidden md:block relative shrink-0" ref={megaRef}>
              <button
                type="button"
                onClick={() => setMegaOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={megaOpen}
                className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden lg:inline">Truy cập nhanh</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ease-in-out ${megaOpen ? 'rotate-180' : ''}`} />
              </button>
              <div
                className={`absolute left-0 top-full mt-2 origin-top-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl z-40 p-4 w-[min(88vw,720px)] transition-[opacity,transform] duration-200 ease-out ${
                  megaOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
                }`}
              >
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
                  {megaStandalone.length > 0 && (
                    <div>
                      <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Chính</p>
                      <div className="space-y-0.5">
                        {megaStandalone.map((r) => renderMegaItem(r))}
                      </div>
                    </div>
                  )}
                  {megaGroups.flatMap((node) =>
                    // Nhóm 3 cấp: nhóm con hiện thành mục riêng, nhãn "Cha › Con".
                    node.subGroups.length > 0
                      ? node.subGroups.map((sub) => (
                          <div key={sub.group.key}>
                            <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                              {t(node.group.labelKey)} › {t(sub.group.labelKey)}
                            </p>
                            <div className="space-y-0.5">
                              {sub.children.map((c) => renderMegaItem(c))}
                            </div>
                          </div>
                        ))
                      : [(
                          <div key={node.group.key}>
                            <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t(node.group.labelKey)}</p>
                            <div className="space-y-0.5">
                              {node.children.map((c) => renderMegaItem(c))}
                            </div>
                          </div>
                        )],
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 md:gap-4">

            <NotificationBell />

             <div className="hidden lg:flex items-center gap-2" title={`${ping.label}${ping.ms !== null ? ` · ${ping.ms} ms` : ''}`}>
               <span className={`w-2 h-2 rounded-full ${pingDot} animate-pulse`}></span>
               <span className={`text-xs font-semibold ${pingText}`}>
                 {ping.ms !== null ? `${ping.ms} ms` : '— ms'}
               </span>
               <span className="text-xs font-medium text-slate-400 dark:text-slate-500 hidden xl:inline-block">{ping.label}</span>
             </div>

             {/* Avatar user → dropdown: ngôn ngữ / giao diện / đăng xuất (gom cho mọi kích cỡ) */}
             <div className="flex shrink-0 items-center pl-2 border-l border-slate-200 dark:border-slate-700">
               <Popover
                 align="right"
                 width={232}
                 paddingClassName="p-1.5"
                 trigger={
                   <button
                     type="button"
                     aria-label={currentUser?.displayName || 'Tài khoản'}
                     className="flex shrink-0 items-center rounded-full p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                   >
                     <span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-slate-700 overflow-hidden border border-slate-300 dark:border-slate-600 flex items-center justify-center">
                       {currentUser?.photoURL ? (
                         <img src={currentUser.photoURL} alt="User" className="w-full h-full object-cover" />
                       ) : (
                         <span className="text-primary-600 font-bold">
                           {currentUser?.displayName?.charAt(0).toUpperCase() || 'A'}
                         </span>
                       )}
                     </span>
                   </button>
                 }
               >
                 {(close) => (
                   <div className="w-full">
                     {/* Thông tin user */}
                     <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-700">
                       <p className="truncate text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                         {currentUser?.displayName || 'Admin'}
                       </p>
                       <p className="truncate text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                         {currentUser?.email || 'admin@cucquy.com'}
                       </p>
                     </div>
                     <div className="pt-1.5">
                       {/* Ngôn ngữ */}
                       <button
                         type="button"
                         onClick={() => { toggleLanguage(); close(); }}
                         className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                       >
                         <img
                           src={language === 'en' ? 'https://flagcdn.com/w40/us.png' : 'https://flagcdn.com/w40/vn.png'}
                           alt=""
                           className="w-5 h-auto rounded-sm shadow-sm object-cover"
                         />
                         {language === 'en' ? 'English' : 'Tiếng Việt'}
                       </button>
                       {/* Giao diện (sáng/tối) */}
                       <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                         <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Giao diện</span>
                         <ThemeToggle />
                       </div>
                       {/* Đăng xuất */}
                       <button
                         type="button"
                         onClick={() => { close(); handleLogout(); }}
                         className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                       >
                         <LogOut className="w-4 h-4" />
                         {t('nav.signOut')}
                       </button>
                     </div>
                   </div>
                 )}
               </Popover>
             </div>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-8 md:pb-8 scroll-smooth">
          <div className=" mx-auto w-full">
            <React.Suspense fallback={
              <div className="flex h-full min-h-[40vh] items-center justify-center">
                <Spinner size="lg" textClassName="text-primary-500" />
              </div>
            }>
              <Outlet />
            </React.Suspense>
          </div>
        </main>

        {/* Mobile Footer Navigation */}
        <MobileFooterNav />
      </div>

      {/* Hàng đợi gửi ảnh đơn mới vào Zalo (render off-screen, xử lý nền) */}
      <ZaloShareQueueHost />
    </div>
  );
};

export default Layout;