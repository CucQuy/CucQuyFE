import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Order, OrderStatus, PaymentStatus } from '@/types';
import { getOrderRevenueDate, getOrderTotal } from '@/utils/order/orderUtils';
import { fetchRevenueGoals, saveRevenueGoals, type RevenueGoals } from '@/services/configurationService';

/** Chìa localStorage CŨ — chỉ còn dùng để nạp 1 lần rồi đẩy lên BE. */
const LS_MIN = 'goals.dailyMin';
const LS_EXP = 'goals.dailyExpected';

/** Doanh thu ghi nhận theo NGÀY của 1 tháng bất kỳ (đơn DELIVERED + PAID). */
export const dailyRevenueOfMonth = (
  orders: Order[],
  y: number,
  m: number,
): Map<number, number> => {
  const map = new Map<number, number>();
  for (const o of orders) {
    if (o.paymentStatus !== PaymentStatus.PAID || o.status !== OrderStatus.DELIVERED) continue;
    const d = getOrderRevenueDate(o);
    if (!d || d.getFullYear() !== y || d.getMonth() !== m) continue;
    const day = d.getDate();
    map.set(day, (map.get(day) ?? 0) + getOrderTotal(o));
  }
  return map;
};

/** Tổng doanh thu từng tháng, khoá 'yyyy-mm' — cho biểu đồ nhiều tháng. */
export const monthlyRevenue = (orders: Order[]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const o of orders) {
    if (o.paymentStatus !== PaymentStatus.PAID || o.status !== OrderStatus.DELIVERED) continue;
    const d = getOrderRevenueDate(o);
    if (!d) continue;
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(k, (map.get(k) ?? 0) + getOrderTotal(o));
  }
  return map;
};

export const monthKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * Mục tiêu doanh thu dùng chung cho cả 3 màn Mục tiêu (đang diễn ra / tổng quan / cài đặt).
 * Lưu ở BE nên mọi máy thấy cùng một số; máy nào còn số cũ trong localStorage thì đẩy
 * lên BE một lần rồi xoá chìa.
 */
export const useRevenueGoals = () => {
  const [goals, setGoals] = useState<RevenueGoals>({
    monthlyTarget: 0,
    dailyMin: 0,
    dailyExpected: 0,
    updatedAt: null,
    updatedBy: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const g = await fetchRevenueGoals();
        if (!g.dailyMin && !g.dailyExpected) {
          const oldMin = Number(localStorage.getItem(LS_MIN)) || 0;
          const oldExp = Number(localStorage.getItem(LS_EXP)) || 0;
          if (oldMin || oldExp) {
            await saveRevenueGoals({ dailyMin: oldMin, dailyExpected: oldExp });
            g.dailyMin = oldMin;
            g.dailyExpected = oldExp;
            localStorage.removeItem(LS_MIN);
            localStorage.removeItem(LS_EXP);
          }
        }
        setGoals(g);
      } catch {
        toast.error('Không tải được mục tiêu doanh thu.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async (
    patch: Partial<Pick<RevenueGoals, 'monthlyTarget' | 'dailyMin' | 'dailyExpected'>>,
  ): Promise<boolean> => {
    try {
      await saveRevenueGoals(patch);
      setGoals((g) => ({ ...g, ...patch }));
      return true;
    } catch {
      toast.error('Lưu mục tiêu thất bại.');
      return false;
    }
  };

  return { goals, loading, save };
};
