import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { qk } from '@/hooks/queryKeys';
import {
  isSocketEnabled,
  SOCKET_EVENTS,
  type OrderPaidEvent,
  type OrderCreatedEvent,
} from '@/services/socket';
import {
  isPaymentSpeakerEnabled,
  isKitchenStationEnabled,
  playNotificationSound,
  primeNotificationSound,
  speakPaymentAmount,
  speakNewOrder,
} from '@/utils/sound';
import { getSsoToken } from '@/services/auth/ssoToken';
import { fetchOrder } from '@/services/orderService';
import BatchKitchenPrintPortal from '@/pages/Orders/components/print/BatchKitchenPrintPortal';
import { UserRole } from '@/types/user';
import { PaymentStatus } from '@/types/enums';
import type { Order } from '@/types';

/** Chỉ Owner (super_admin) + Admin nhận noti realtime (khớp gate ở BE gateway). */
const NOTIFY_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

/**
 * Lắng nghe realtime (Owner/Admin đang online). 2 việc:
 * - `order:paid` (webhook SePay khớp đơn) → "ting ting" + đọc số tiền + toast + cập nhật cache.
 * - `order:created` (đơn mới tạo) → CHỈ trên "máy quán" (bật ở Cài đặt): phát âm
 *   "bạn có đơn hàng mới" + TỰ IN PHIẾU BẾP. Máy khác (điện thoại) bỏ qua để không
 *   kêu/in trùng. Component render portal in ẩn khi có đơn cần in.
 */
const RealtimePaymentListener: React.FC = () => {
  const { currentUser, userData } = useAuth();
  const queryClient = useQueryClient();
  const role = userData?.role;

  // Hàng đợi phiếu bếp cần tự in (máy quán). In lần lượt từng đơn (unmount→remount portal).
  const [kitchenQueue, setKitchenQueue] = useState<Order[]>([]);

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
    // Owner/Admin đã đăng nhập (đúng đối tượng cần realtime).
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

      // Đơn mới → CHỈ máy quán (bật chế độ ở Cài đặt) phát âm + tự in phiếu bếp.
      socket.on(SOCKET_EVENTS.ORDER_CREATED, (e: OrderCreatedEvent) => {
        if (!isKitchenStationEnabled()) return;
        playNotificationSound();
        speakNewOrder();
        toast(`🔔 Đơn hàng mới ${e?.orderNumber ?? ''}`.trim(), { duration: 4000 });
        // Lấy đơn đầy đủ (đúng shape FE) rồi xếp hàng in phiếu bếp.
        if (e?.id) {
          fetchOrder(e.id)
            .then((order) => {
              if (order) setKitchenQueue((q) => [...q, order]);
            })
            .catch(() => {
              /* fetch lỗi — vẫn đã phát âm báo đơn mới */
            });
        }
        queryClient.invalidateQueries({ queryKey: qk.orders.all });
      });
    });

    return () => {
      cancelled = true;
      if (socket) {
        socket.off(SOCKET_EVENTS.ORDER_PAID);
        socket.off(SOCKET_EVENTS.ORDER_CREATED);
        socket.disconnect();
      }
    };
  }, [currentUser, role, queryClient]);

  // In phiếu bếp lần lượt từng đơn trong hàng đợi (portal render ẩn ngoài màn hình).
  if (kitchenQueue.length === 0) return null;
  const next = kitchenQueue[0];
  return (
    <BatchKitchenPrintPortal
      key={next.id}
      orders={[next]}
      onDone={() => setKitchenQueue((q) => q.slice(1))}
      onError={(msg) => {
        toast.error(`In phiếu bếp lỗi: ${msg}`);
        setKitchenQueue((q) => q.slice(1));
      }}
    />
  );
};

export default RealtimePaymentListener;
