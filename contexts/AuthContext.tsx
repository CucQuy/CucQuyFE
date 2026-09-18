import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  saveUserToLocalStorage,
  getUserFromLocalStorage,
  addAccountToHistory,
} from '@/utils/user/userUtil';
import { clearSsoToken } from '@/services/auth/ssoToken';
import {
  endSession,
  restoreSession,
  setSessionExpiredHandler,
  watchSessionFreshness,
} from '@/services/auth/session';
import { UserData } from '@/types/user';

/** User rút gọn gắn vào context (thay cho user đăng nhập). */
export interface CurrentUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  currentUser: CurrentUser | null;
  userData: UserData | null; // hồ sơ đầy đủ (role/status) từ BE
  loading: boolean;
  applyLogin: (data: UserData) => void; // gọi sau khi SSO Google thành công
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const toCurrentUser = (data: UserData): CurrentUser => ({
  uid: data.uid,
  email: data.email,
  displayName: data.customName || data.displayName,
  photoURL: data.photoURL,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  /** Dọn sạch phiên phía FE (không gọi BE) — dùng khi refresh token đã chết. */
  const resetLocalSession = useCallback(() => {
    clearSsoToken();
    saveUserToLocalStorage(null);
    setUserData(null);
    setCurrentUser(null);
  }, []);

  // Khôi phục phiên khi mở app: hỏi BE làm mới access token (refresh token nằm trong
  // cookie httpOnly). Còn refresh được nghĩa là còn đăng nhập — kể cả sau nhiều tuần
  // không mở app — nên không cần bắt user đăng nhập lại như cơ chế token 7 ngày cũ.
  useEffect(() => {
    mounted.current = true;
    void (async () => {
      const cached = getUserFromLocalStorage();
      const alive = await restoreSession();
      if (!mounted.current) return;
      if (alive && cached) {
        setUserData(cached as UserData);
        setCurrentUser(toCurrentUser(cached as UserData));
      } else if (!alive) {
        resetLocalSession();
      }
      setLoading(false);
    })();
    return () => { mounted.current = false; };
  }, [resetLocalSession]);

  // Phiên chết hẳn (refresh thất bại) → dọn state để ProtectedRoute đưa về /login.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      if (mounted.current) resetLocalSession();
    });
    const unwatch = watchSessionFreshness();
    return () => {
      setSessionExpiredHandler(null);
      unwatch();
    };
  }, [resetLocalSession]);

  /** Áp dụng phiên sau khi đăng nhập Google (token đã lưu trước đó). */
  const applyLogin = useCallback((data: UserData) => {
    saveUserToLocalStorage(data);
    addAccountToHistory(data);
    setUserData(data);
    setCurrentUser(toCurrentUser(data));
  }, []);

  const logout = useCallback(() => {
    // Thu hồi phiên ở BE trước, rồi mới dọn state (không chờ mạng cũng vẫn thoát được).
    void endSession().finally(() => resetLocalSession());
  }, [resetLocalSession]);

  // Memo value → consumer không re-render khi provider render lại vì lý do không liên quan.
  const value: AuthContextType = useMemo(
    () => ({ currentUser, userData, loading, applyLogin, logout }),
    [currentUser, userData, loading, applyLogin, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
