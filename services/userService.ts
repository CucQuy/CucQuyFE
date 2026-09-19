import { apiClient } from '@/services/api/client';
import { UserData, UserRole, UserStatus } from '@/types/user';
import type { ZaloGroupConfig } from '@/types';

/**
 * Kiểm tra xem user với email đã tồn tại chưa (qua BE)
 * @param email - Email của user cần kiểm tra
 * @returns UserData nếu tồn tại, null nếu không
 */
export const getUserByEmail = async (email: string | null): Promise<UserData | null> => {
  if (!email) return null;
  try {
    const res = await apiClient.get(`/users/by-email/${encodeURIComponent(email)}`);
    return (res.data as UserData | null) ?? null;
  } catch (error) {
    console.error('Error checking user by email:', error);
    return null;
  }
};

/**
 * Đồng bộ user đang đăng nhập lên BE (POST /users/sync — endpoint PUBLIC, BE lấy
 * uid/email từ SSO token). User MỚI → BE tạo record status 'pending' (để admin
 * thấy + duyệt). User cũ → cập nhật last_login. Trả hồ sơ (kèm status/role).
 * Gọi ngay sau khi có token ở AuthCallback.
 */
export const syncCurrentUser = async (): Promise<UserData | null> => {
  try {
    const res = await apiClient.post('/users/sync', {});
    return (res.data as UserData) ?? null;
  } catch (error) {
    console.error('Error syncing current user:', error);
    return null;
  }
};

/**
 * Kiểm tra xem user với UID đã tồn tại chưa (qua BE)
 * @param uid - UID của user cần kiểm tra
 * @returns UserData nếu tồn tại, null nếu không
 */
export const getUserByUid = async (uid: string): Promise<UserData | null> => {
  if (!uid) return null;
  try {
    const res = await apiClient.get(`/users/by-uid/${encodeURIComponent(uid)}`);
    return (res.data as UserData | null) ?? null;
  } catch (error) {
    console.error('Error checking user by UID:', error);
    return null;
  }
};

/**
 * Lưu hoặc cập nhật thông tin user (qua BE). Gọi ngay sau khi đăng nhập.
 * BE lấy uid/email/displayName từ token và merge với body truyền lên.
 * @param user - User object đăng nhập
 * @returns UserData
 */
export const saveUser = async (user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<UserData> => {
  try {
    const res = await apiClient.post('/users/sync', {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    });
    return res.data as UserData;
  } catch (error) {
    console.error('Error saving user:', error);
    throw error;
  }
};

/**
 * Lấy tất cả users (qua BE)
 * @returns Mảng UserData
 */
export const getAllUsers = async (): Promise<UserData[]> => {
  try {
    const res = await apiClient.get('/users');
    return (res.data as UserData[]) ?? [];
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

/**
 * Cập nhật status của user (qua BE)
 * @param uid - UID của user
 * @param status - Status mới
 */
export const updateUserStatus = async (uid: string, status: UserStatus): Promise<void> => {
  try {
    await apiClient.patch(`/users/${encodeURIComponent(uid)}/status`, { status });
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  }
};

/**
 * Cập nhật customName của user (qua BE)
 * @param uid - UID của user
 * @param customName - Tên gợi nhớ mới
 */
export const updateUserCustomName = async (uid: string, customName: string): Promise<void> => {
  try {
    await apiClient.patch(`/users/${encodeURIComponent(uid)}/custom-name`, { customName });
  } catch (error) {
    console.error('Error updating user custom name:', error);
    throw error;
  }
};

/**
 * Cập nhật role của user (qua BE)
 * @param uid - UID của user
 * @param role - Role mới
 */
export const updateUserRole = async (uid: string, role: UserRole): Promise<void> => {
  try {
    await apiClient.patch(`/users/${encodeURIComponent(uid)}/role`, { role });
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

