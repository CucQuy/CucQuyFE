import React, { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { qk } from '@/hooks/queryKeys';
import {
  isSocketEnabled,
  SOCKET_EVENTS,
  type OrderPaidEvent,
} from '@/services/socket';
import {
  isPaymentSpeakerEnabled,
  playNotificationSound,
  primeNotificationSound,
  speakPaymentAmount,
} from '@/utils/sound';
import { getSsoToken } from '@/services/auth/ssoToken';
import { UserRole } from '@/types/user';
import { PaymentStatus } from '@/types/enums';
import type { Order } from '@/types';

/** Chỉ Owner (super_admin) + Admin nhận noti thanh toán (khớp gate ở BE gateway). */
const NOTIFY_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

/**
 * Lắng nghe realtime: khi webhook SePay đánh dấu 1 đơn đã thanh toán, BE bắn
 * `order:paid` → âm "ting ting" + toast + tự đổi trạng thái trong cache (khỏi
 * refresh) cho Owner/Admin đang online. Component không render gì. Tầng kết nối
 * socket nằm ở `services/socket`.
 */
const RealtimePaymentListener: React.FC = () => {
  const { currentUser, userData } = useAuth();
  const queryClient = useQueryClient();
  const role = userData?.role;

  // Mở khoá âm thông báo sau cử chỉ đầu tiên của người dùng (autoplay policy).
  useEffect(() => primeNotificationSound(), []);

  useEffect(() => {
    if (!currentUser || !role || !NOTIFY_ROLES.includes(role) || !isSocketEnabled()) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let socket: any = null;
    let cancelled = false;

    // Dynamic import → socket.io-client KHÔNG nằm trong bundle shell, chỉ tải khi
    // Owner/Admin đã đăng nhập (đúng đối tượng cần realtime thanh toán).
    import('@/services/socket/connect').then(({ createAuthedSocket }) => {
      if (cancelled) return;
      socket = createAuthedSocket(() => Promise.resolve(getSsoToken()));

      socket.on(SOCKET_EVENTS.ORDER_PAID, (e: OrderPaidEvent) => {
        const rawAmount = e?.amount || 0;
        const amount = rawAmount.toLocaleString('vi-VN');
        playNotificationSound();
        // Loa thanh toán: đọc "Đã nhận ... đồng" (nếu user bật) sau tiếng ting.
        if (isPaymentSpeakerEnabled()) speakPaymentAmount(rawAmount);
        toast.success(`💰 Đơn ${e?.orderNumber} đã thanh toán ${amount}đ`, {
          duration: 6000,
        });

        // Cập nhật trạng thái ngay trong cache (khỏi refresh): set đơn khớp = PAID...
        if (e?.orderNumber) {
          queryClient.setQueryData<Order[]>(qk.orders.all, (old) =>
            Array.isArray(old)
              ? old.map((o) =>
                  o.orderNumber === e.orderNumber
                    ? { ...o, paymentStatus: PaymentStatus.PAID }
                    : o,
                )
              : old,
          );
        }
        // ...rồi refetch để đồng bộ các field server tính (sepayId, updatedAt...).
        queryClient.invalidateQueries({ queryKey: qk.orders.all });
      });
    });

    return () => {
      cancelled = true;
      if (socket) {
        socket.off(SOCKET_EVENTS.ORDER_PAID);
        socket.disconnect();
      }
    };
  }, [currentUser, role, queryClient]);

  return null;
};

export default RealtimePaymentListener;
