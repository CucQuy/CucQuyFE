import { apiClient } from "@/services/api/client";
import { Order, OrderFieldChange, ZaloNotifyFeature } from "@/types";
import {
  DailySummaryStats,
  formatDailySummaryMessage,
  formatDeliveryDueMessage,
  formatHealthCheckMessage,
  formatOrderDeleteMessage,
  formatOrderMessage,
  formatOrderUpdateMessage,
  formatPendingOrdersMessage,
  formatProductionTomorrowMessage,
  formatStuckPendingMessage,
  formatUnpaidOrdersMessage,
  OrderUpdateEditorInfo,
} from "@/utils/zalo/zaloUtil";

// Lop GUI HTTP da chuyen sang BE (proxy /zalo/send) de giau ZALO_TOKEN khoi bundle FE.
// Moi logic build message van giu nguyen o FE; chi cac primitive duoi day goi BE.

const postTextToGroups = async (groupIds: string[], message: string) => {
  await apiClient.post('/zalo/send', { groupIds, message });
};

/** Gửi ẢNH đơn (đã upload → URL) kèm message vào nhóm — dùng cho hàng đợi ảnh đơn mới. */
export const sendZaloOrderImage = async (
  groupIds: string[],
  message: string,
  caption: string,
  imageUrl: string,
) => {
  await apiClient.post('/zalo/send', {
    groupIds,
    message,
    image: { caption, image_url: [imageUrl] },
  });
};

/**
 * Gửi tin theo TÍNH NĂNG: không tự chọn nhóm, BE tra nhóm nào được gán feature này
 * ở Cài đặt Zalo → Nhóm (thay cho "nhóm chính" cũ). Chưa gán nhóm → BE trả lỗi rõ.
 */
export const sendZaloMessage = async (message: string, feature: ZaloNotifyFeature) => {
  try {
    await apiClient.post('/zalo/send', { message, feature });
  } catch (error: any) {
    console.error("Loi gui Zalo:", error.response?.data || error.message);
    throw error;
  }
};

export const sendNewOrderZaloNotifications = async (order: any, groupIds: string[]) => {
  if (groupIds.length === 0) return;
  // Chỉ gửi TEXT thông báo đơn mới — KHÔNG kèm QR thanh toán vào nhóm.
  const message = formatOrderMessage(order);
  try {
    await postTextToGroups(groupIds, message);
  } catch (error: any) {
    console.error("Loi gui Zalo:", error.response?.data || error.message);
    throw error;
  }
};

export const sendOrderUpdateNotification = async (
  order: any,
  changes: OrderFieldChange[],
  editor: OrderUpdateEditorInfo | undefined,
  groupIds: string[],
  itemsDiff?: import('@/utils/order/itemsDiff').ItemChangeEntry[],
  prevOrder?: any,
) => {
  if (groupIds.length === 0 || changes.length === 0) return;
  const message = formatOrderUpdateMessage(order, changes, editor, itemsDiff, prevOrder);
  try {
    await postTextToGroups(groupIds, message);
  } catch (error: any) {
    console.error("Loi gui Zalo update:", error.response?.data || error.message);
  }
};

export const sendOrderDeleteNotification = async (
  order: any,
  editor: OrderUpdateEditorInfo | undefined,
  groupIds: string[],
) => {
  if (groupIds.length === 0) return;
  const message = formatOrderDeleteMessage(order, editor);
  try {
    await postTextToGroups(groupIds, message);
  } catch (error: any) {
    console.error("Loi gui Zalo delete:", error.response?.data || error.message);
  }
};

export const sendUnpaidOrdersNotification = async (orders: Order[]) => {
  const message = formatUnpaidOrdersMessage(orders);
  await sendZaloMessage(message, 'unpaid');
};

export const sendPendingOrdersNotification = async (orders: Order[]) => {
  const message = formatPendingOrdersMessage(orders);
  await sendZaloMessage(message, 'pending');
};

export const sendDeliveryDueNotification = async (orders: Order[], fromDate?: Date, toDate?: Date) => {
  const message = formatDeliveryDueMessage(orders, fromDate, toDate);
  await sendZaloMessage(message, 'delivery_due');
};

export const sendCustomNotification = async (message: string) => {
  await sendZaloMessage(message, 'custom');
};

/**
 * Gui 1 message test toi 1 group ID. Tra ve { ok, error? } thay vi throw.
 */
/** 1 nhóm Zalo của nick đang gửi (BE proxy API listAllGroupForPartner của Abit). */
export interface ZaloBridgeGroup {
  groupId: string;
  name: string;
  members: number;
  /** URL ảnh đại diện nhóm (group_avt); rỗng nếu nhóm không có ảnh. */
  avatar: string;
}

/**
 * Lấy danh sách nhóm Zalo THẬT của nick đang dùng để gửi → chọn đúng ID nhóm,
 * khỏi copy tay (ID copy sai là tin không tới mà bridge vẫn báo nhận).
 */
export const fetchZaloBridgeGroups = async (phone?: string): Promise<ZaloBridgeGroup[]> => {
  const { data } = await apiClient.get<ZaloBridgeGroup[]>('/zalo/groups', {
    params: phone ? { phone } : undefined,
  });
  return Array.isArray(data)
    ? data
        .map((g) => ({
          groupId: typeof g?.groupId === 'string' ? g.groupId : '',
          name: typeof g?.name === 'string' ? g.name : '',
          members: typeof g?.members === 'number' ? g.members : 0,
          avatar: typeof g?.avatar === 'string' ? g.avatar : '',
        }))
        .filter((g) => g.groupId)
    : [];
};

export const sendZaloTestMessage = async (
  groupId: string,
  customMessage?: string,
): Promise<{ ok: boolean; error?: string }> => {
  const cleanId = (groupId || '').trim();
  if (!cleanId) return { ok: false, error: 'Group ID trong' };
  const now = new Date();
  const message =
    customMessage ||
    `🔔 TEST THONG BAO\n━━━━━━━━━━━━━━━\nDay la tin nhan test tu he thong.\nNeu nhan duoc tin nay, group da cau hinh dung.\n\nThoi gian: ${now.toLocaleString('vi-VN')}`;
  try {
    await postTextToGroups([cleanId], message);
    return { ok: true };
  } catch (error: any) {
    const msg = error?.response?.data?.message || error?.message || 'Loi khong xac dinh';
    return { ok: false, error: msg };
  }
};

// ============== SCHEDULED / OPS NOTIFICATIONS ==============

export const sendProductionTomorrowNotification = async (orders: Order[], targetDate: Date) => {
  const message = formatProductionTomorrowMessage(orders, targetDate);
  await sendZaloMessage(message, 'production_tomorrow');
};

export const sendStuckPendingNotification = async (orders: Order[], thresholdHours: number) => {
  const message = formatStuckPendingMessage(orders, thresholdHours);
  await sendZaloMessage(message, 'stuck_pending');
};

export const sendDailySummaryNotification = async (stats: DailySummaryStats, date: Date) => {
  const message = formatDailySummaryMessage(stats, date);
  await sendZaloMessage(message, 'daily_summary');
};

export const sendHealthCheckNotification = async () => {
  const message = formatHealthCheckMessage(new Date());
  await sendZaloMessage(message, 'health_check');
};
