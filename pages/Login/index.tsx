import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { ChefHat, UserPlus, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Heading from '@/components/ui/Heading';
import Image from '@/components/ui/Image';
import IconButton from '@/components/ui/IconButton';
import Spinner from '@/components/ui/Spinner';
import AvatarImage from '@/components/ui/AvatarImage';
import Typography from '@/components/ui/Typography';
import ThemeToggle from '@/components/ThemeToggle';
import { getAccountsHistory, removeAccountFromHistory } from '@/utils/user/userUtil';
import toast from 'react-hot-toast';

// BE broker khởi tạo luồng đăng nhập Google (server-side qua RiceService).
// FE KHÔNG cần Google client_id — chỉ điều hướng sang endpoint start của BE.
const API_BASE: string = ((import.meta as any).env?.VITE_API_URL || 'https://api.cucquy.site/api').replace(/\/+$/, '');

const LoginPage: React.FC = () => {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accountsHistory, setAccountsHistory] = useState(getAccountsHistory());
  const [params, setParams] = useSearchParams();

  // Đã đăng nhập → về trang chủ
  useEffect(() => {
    if (currentUser) navigate('/', { replace: true });
  }, [currentUser, navigate]);

  useEffect(() => {
    setAccountsHistory(getAccountsHistory());
  }, []);

  // BE 302 về đây kèm ?error=sso khi đổi mã đăng nhập thất bại. Báo rồi xoá param
  // để F5 không hiện lại toast cũ.
  useEffect(() => {
    if (params.get('error') !== 'sso') return;
    toast.error('Đăng nhập Google thất bại. Vui lòng thử lại.');
    params.delete('error');
    setParams(params, { replace: true });
  }, [params, setParams]);

  // Điều hướng cả trang sang BE → BE 302 sang Google → callback về /auth/callback?token=.
  const startLogin = () => {
    setLoading(true);
    window.location.href = `${API_BASE}/auth/google/start`;
  };

  const handleRemoveAccount = (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeAccountFromHistory(uid);
    setAccountsHistory(getAccountsHistory());
    toast.success(t('login.accountRemoved'));
  };

  return (
    <Box
      layoutClassName="min-h-screen flex flex-col items-center justify-center relative p-4"
      backgroundClassName="bg-gradient-to-br from-primary-100 via-primary-50 to-primary-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"
    >
      <Box layoutClassName="absolute top-4 right-4">
        <ThemeToggle variant="floating" />
      </Box>

      <Card
        padding="none"
        layoutClassName="max-w-md w-full space-y-8 animate-fade-in p-8"
        roundedClassName="rounded-2xl"
        shadowClassName="shadow-xl"
      >
        <Box layoutClassName="text-center">
          <Box
            layoutClassName="mx-auto w-16 h-16 flex items-center justify-center mb-4 transform rotate-3"
            backgroundClassName="bg-primary-100 dark:bg-primary-900/20"
            roundedClassName="rounded-2xl"
          >
            <ChefHat className="w-10 h-10 text-primary-600 dark:text-primary-500" />
          </Box>
          <Heading level={2} layoutClassName="mb-2">
            Tiệm Bánh{' '}
            <Typography as="span" textClassName="font-inherit text-primary-600 dark:text-primary-500">
              Cúc Quy
            </Typography>
          </Heading>
          <Typography variant="muted">{t('login.welcome')}</Typography>
        </Box>

        <Box layoutClassName="space-y-4">
          {/* Danh sách tài khoản đã từng đăng nhập */}
          {accountsHistory.length > 0 && (
            <Box layoutClassName="space-y-2">
              <Typography size="sm" layoutClassName="mb-2" textClassName="font-medium">
                {t('login.recentAccounts')}
              </Typography>
              <Box layoutClassName="space-y-2 max-h-64 overflow-y-auto">
                {accountsHistory
                  .filter((acc) => acc.uid !== currentUser?.uid)
                  .map((account) => (
                    <Card
                      key={account.uid}
                      onClick={() => startLogin()}
                      padding="none"
                      layoutClassName="group flex cursor-pointer items-center gap-3 p-3"
                      roundedClassName="rounded-lg"
                      borderClassName="border-slate-200 dark:border-slate-600"
                      backgroundClassName="bg-slate-50 dark:bg-slate-700/50"
                      hoverClassName="hover:bg-slate-100 dark:hover:bg-slate-700"
                      stateClassName="transition-colors"
                    >
                      <AvatarImage
                        src={account.photoURL || undefined}
                        alt={account.displayName || 'User'}
                        fallback={
                          <Typography as="span" textClassName="text-sm font-bold text-primary-600 dark:text-primary-400">
                            {account.displayName?.charAt(0).toUpperCase() || account.email?.charAt(0).toUpperCase() || 'A'}
                          </Typography>
                        }
                      />
                      <Box layoutClassName="flex-1 min-w-0">
                        <Typography size="sm" variant="primary" layoutClassName="truncate" textClassName="font-medium">
                          {account.displayName || 'User'}
                        </Typography>
                        <Typography size="xs" variant="muted" layoutClassName="truncate">
                          {account.email}
                        </Typography>
                      </Box>
                      <IconButton
                        onClick={(e) => handleRemoveAccount(account.uid, e)}
                        label={t('login.removeAccount')}
                        size="sm"
                        sizeClassName="h-7 w-7"
                        roundedClassName="rounded-lg"
                        textClassName="text-slate-400"
                        stateClassName="opacity-0 transition-all group-hover:opacity-100"
                        hoverClassName="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        title={t('login.removeAccount')}
                      >
                        <X className="w-4 h-4" />
                      </IconButton>
                    </Card>
                  ))}
              </Box>
            </Box>
          )}

          {/* Nút đăng nhập Google */}
          <Button
            onClick={() => startLogin()}
            disabled={loading}
            variant="secondary"
            fullWidth
            roundedClassName="rounded-xl"
            sizeClassName="py-3"
            shadowClassName="shadow-sm"
            hoverClassName="hover:shadow-md"
            leftIcon={loading ? undefined : <UserPlus className="w-5 h-5" />}
          >
            {loading ? (
              <Spinner size="md" textClassName="text-slate-400" />
            ) : (
              <>
                <Image
                  src="https://developers.google.com/identity/images/g-logo.png"
                  alt="Google"
                  layoutClassName="w-5 h-5"
                />
                {t('login.googleButton')}
              </>
            )}
          </Button>
        </Box>

        <Box layoutClassName="text-center text-xs" textClassName="text-slate-400 dark:text-slate-500">
          <Typography size="xs" variant="muted">
            &copy; {new Date().getFullYear()} Tiệm Bánh Cúc Quy. All rights reserved.
          </Typography>
        </Box>
      </Card>
    </Box>
  );
};

export default LoginPage;
