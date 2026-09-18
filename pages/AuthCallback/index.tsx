import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { endSession, ensureAccessToken } from '@/services/auth/session';
import { syncCurrentUser } from '@/services/userService';
import { UserStatus } from '@/types/user';
import Box from '@/components/ui/Box';
import Spinner from '@/components/ui/Spinner';
import Typography from '@/components/ui/Typography';
import toast from 'react-hot-toast';

/**
 * Đích redirect sau đăng nhập Google (luồng server-side qua RiceService).
 *
 * BE đã đổi mã đăng nhập lấy phiên và cất refresh token vào cookie httpOnly rồi mới
 * 302 về đây — URL sạch, KHÔNG mang token. Trang này chỉ việc đổi cookie lấy access
 * token đầu tiên → lấy hồ sơ (role/status) từ BE → áp phiên → về trang chủ.
 */

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { applyLogin } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard StrictMode double-run
    ran.current = true;

    void (async () => {
      try {
        await ensureAccessToken(); // cookie phiên → access token đầu tiên (AuthProvider có thể đã lấy)
        // Sync: upsert user theo token. User MỚI → BE tạo record status 'pending'
        // (để admin thấy trong QL người dùng + duyệt). User cũ → trả hồ sơ hiện tại.
        const data = await syncCurrentUser();
        if (!data) {
          await endSession();
          toast.error('Đăng nhập thất bại: không tạo được hồ sơ. Thử lại hoặc liên hệ quản trị viên.');
          navigate('/login', { replace: true });
          return;
        }
        if (data.status !== UserStatus.ACTIVE) {
          await endSession();
          toast.error('Tài khoản chưa được phê duyệt. Vui lòng chờ quản trị viên.');
          navigate('/login', { replace: true });
          return;
        }
        applyLogin(data);
        toast.success('Đăng nhập thành công');
        navigate('/', { replace: true });
      } catch {
        await endSession();
        toast.error('Đăng nhập thất bại. Vui lòng thử lại.');
        navigate('/login', { replace: true });
      }
    })();
  }, [navigate, applyLogin]);

  return (
    <Box
      layoutClassName="min-h-screen flex flex-col items-center justify-center gap-4"
      backgroundClassName="bg-gradient-to-br from-primary-100 via-primary-50 to-primary-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"
    >
      <Spinner size="lg" textClassName="text-primary-500" />
      <Typography variant="muted">Đang hoàn tất đăng nhập…</Typography>
    </Box>
  );
};

export default AuthCallbackPage;
