import { Order, OrderFieldChange, MIX_FLAVOR, MIX_LABEL } from "@/types";
import { parseDateValue } from "../format/dateUtil";
import { formatVND } from "../format/currencyUtil";
import { formatItemsDiff } from "@/utils/order/itemsDiff";
import { getOrderTotal } from "../order/orderUtils";

const DIVIDER = '─────────────────────────';

/** Gom vị (có lặp) → "4 socola, 3 matcha, 1 red" (số lượng đứng trước). '' nếu không có. */
const flavorsDetail = (flavors?: string[]): string => {
  if (!Array.isArray(flavors) || !flavors.length) return '';
  const m = new Map<string, number>();
  flavors.forEach((f) => m.set(f, (m.get(f) || 0) + 1));
  return Array.from(m.entries())
    .map(([n, q]) => (n === MIX_FLAVOR ? MIX_LABEL : `${q} ${n}`))
    .join(', ');
};

/**
 * Các dòng hiển thị 1 món trong noti đơn (cấu trúc phân cấp).
 * - Có `sizeCounts[].units` (vị riêng từng combo) → mỗi đơn vị 1 dòng kèm vị + dòng "Tổng vị":
 *     • Cookies truyền thống
 *     - Combo Tình Bạn (3 cái) #1: 2 socola, 1 matcha
 *     - Combo Tình Bạn (3 cái) #2: 1 matcha, 2 cafe
 *     Tổng vị: 3 matcha, 2 socola, 2 cafe
 * - Đơn cũ (không units) → sizes + SL + "Chi tiết (gộp)" như trước.
 */
const itemLines = (it: any): string[] => {
  const out: string[] = [];
  const scs = (it?.sizeCounts ?? []).filter((x: any) => (x?.qty || 0) > 0);
  const qty = it?.quantity || 0;
  const hasUnits = scs.some((sc: any) => Array.isArray(sc?.units) && sc.units.length > 0);

  if (scs.length > 0 && hasUnits) {
    out.push(`• ${it?.name ?? ''}`);
    scs.forEach((sc: any) => {
      (sc.units ?? []).forEach((unit: string[], u: number) => {
        const fl = flavorsDetail(unit);
        const label = `${sc.name}${sc.qty > 1 ? ` #${u + 1}` : ''}`;
        out.push(fl ? `- ${label}: ${fl}` : `- ${label}: (chưa chọn vị)`);
      });
    });
    const total = flavorsDetail(it?.flavors);
    if (total) out.push(`Tổng vị: ${total}`);
    if (it?.packagingOption) out.push(`Đóng gói: ${it.packagingOption}`);
    return out;
  }

  if (scs.length > 0) {
    out.push(`• ${it?.name ?? ''}`);
    scs.forEach((sc: any) => out.push(`- ${sc.name}: SL ${sc.qty}`));
  } else if (it?.size) {
    out.push(`• ${it?.name ?? ''} · ${it.size}${qty > 1 ? ` · SL ${qty}` : ''}`);
  } else {
    out.push(`• ${it?.name ?? ''}${qty > 1 ? ` · SL ${qty}` : ''}`);
  }
  const fl = flavorsDetail(it?.flavors);
  if (fl) out.push(`Chi tiết (${fl})`);
  if (it?.packagingOption) out.push(`Đóng gói: ${it.packagingOption}`);
  return out;
};

export const formatDate = (date: Date | null): string => {
  if (!date) return '(không có)';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Format ngày tất định (tránh locale vi-VN đảo giờ/ngày khi bỏ year).
const p2 = (n: number): string => String(n).padStart(2, '0');
/** dd/MM/yy */
const dmy = (d: Date): string => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
/** dd/MM */
const dm = (d: Date): string => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`;
/** HH:mm */
const hm = (d: Date): string => `${p2(d.getHours())}:${p2(d.getMinutes())}`;

/** "dd/MM/yy HH:mm" — giữ shape cũ (nơi khác .split(' ')[0] lấy phần ngày). */
const formatDateShort = (date: Date | null): string => (date ? `${dmy(date)} ${hm(date)}` : '—');

/** Ngày + giờ gọn cho danh sách (không năm): "07/07 14:00". */
const formatDayHM = (date: Date | null): string => (date ? `${dm(date)} ${hm(date)}` : '—');

/** Dòng khách gọn: "Nguyễn A · 0901234567" (bỏ phần thiếu). */
const customerLine = (name?: string, phone?: string): string =>
  [name || '(không có)', phone || ''].filter(Boolean).join(' · ');

const deliveryTypeLabel = (dt: string | undefined): string => {
  if (dt === 'PICKUP') return 'Khách qua lấy';
  if (dt === 'SHIP_PROVINCE') return 'Ship tỉnh';
  return 'Ship';
};

// ============== NEW ORDER ==============
export const formatOrderMessage = (order: any): string => {
  const deliveryDate = order.deliveryDate ? parseDateValue(order.deliveryDate) : null;
  const totalItems = order.items?.reduce((s: number, it: any) => s + (it.quantity || 0), 0) || 0;
  const subtotal = (order.items || []).reduce((s: number, it: any) => s + ((it.price || 0) * (it.quantity || 0)), 0);
  const shipping = order.shippingCost || 0;
  const surcharge = Number(order.surchargeAmount || 0);
  const total = getOrderTotal(order);

  const lines: string[] = [];
  if (order.isTest) lines.push('⚠️ ĐƠN HÀNG TEST');
  lines.push(`🟢 ĐƠN MỚI · ${order.orderNumber || order.id}`);
  lines.push(DIVIDER);
  lines.push(`👤 ${customerLine(order.customer?.name, order.customer?.phone)}`);

  const giao = deliveryDate
    ? `${dmy(deliveryDate)}${order.deliveryTime ? ' ' + order.deliveryTime : ' ' + hm(deliveryDate)}`
    : '—';
  lines.push(`🚚 Giao: ${giao} · ${deliveryTypeLabel(order.deliveryType)}`);
  if (order.deliveryType !== 'PICKUP' && order.customer?.address) {
    lines.push(`🏠 ${order.customer.address}`);
  }

  lines.push(`📋 Sản phẩm (${totalItems}):`);
  if (order.items && order.items.length > 0) {
    order.items.forEach((it: any) => itemLines(it).forEach((l) => lines.push(l)));
  } else {
    lines.push(' (không có)');
  }

  const manualDiscount = Number(order.manualDiscountAmount || 0);
  const money = [`Hàng ${formatVND(subtotal)}`];
  if (shipping > 0) money.push(`Ship ${formatVND(shipping)}`);
  if (surcharge > 0) money.push(`Phụ thu ${formatVND(surcharge)}`);
  if (manualDiscount > 0) money.push(`Giảm ${formatVND(manualDiscount)}`);
  lines.push(`💰 ${money.join(' · ')}`);
  lines.push(`💵 TỔNG: ${formatVND(total)}`);
  if (order.note) lines.push(`💬 ${order.note}`);
  return lines.join('\n');
};

/**
 * Text đi KÈM ẢNH đơn mới (thẻ chia sẻ đã chứa chi tiết): tiêu đề + khách + địa chỉ.
 * Giữ ngắn nhưng đủ để đọc ngay trên thông báo Zalo mà không cần mở ảnh.
 */
export const formatOrderImageCaption = (order: any): string => {
  const lines: string[] = [];
  if (order?.isTest) lines.push('⚠️ ĐƠN HÀNG TEST');
  lines.push(`🟢 ĐƠN MỚI · ${order?.orderNumber || order?.id || ''}`);
  lines.push(`👤 ${customerLine(order?.customer?.name, order?.customer?.phone)}`);
  const addr = (order?.customer?.address ?? '').trim();
  if (order?.deliveryType === 'PICKUP') {
    lines.push('🏠 Khách qua lấy');
  } else if (addr) {
    lines.push(`🏠 ${addr}`);
  }
  return lines.join('\n');
};

// ============== UPDATE ORDER ==============
export interface OrderUpdateEditorInfo {
  name?: string;
  uid?: string;
}

export const formatOrderUpdateMessage = (
  order: any,
  changes: OrderFieldChange[],
  editor?: OrderUpdateEditorInfo,
  itemsDiff?: import('@/utils/order/itemsDiff').ItemChangeEntry[],
  _prevOrder?: any,
): string => {
  const lines: string[] = [];
  if (order.isTest) lines.push('⚠️ ĐƠN HÀNG TEST');
  lines.push(`🟡 CẬP NHẬT · ${order.orderNumber || order.id}`);
  lines.push(DIVIDER);
  const cust = order.customer?.name || order.customerName || '(không có)';
  lines.push(`👤 ${cust} · ✏️ ${editor?.name || 'Unknown'} · 🕒 ${formatDayHM(new Date())}`);

  lines.push(`📝 Thay đổi (${changes.length}):`);
  changes.forEach((c) => {
    const label = c.label || c.field;
    if (c.field === 'items' && itemsDiff && itemsDiff.length > 0) {
      lines.push(` • ${label} (${itemsDiff.length}):`);
      formatItemsDiff(itemsDiff).forEach((d) => lines.push(`   ${d}`));
      return;
    }
    const oldV = c.oldValue == null || c.oldValue === '' ? '—' : String(c.oldValue);
    const newV = c.newValue == null || c.newValue === '' ? '—' : String(c.newValue);
    lines.push(` • ${label}: ${oldV} → ${newV}`);
  });

  lines.push(`💵 Tổng mới: ${formatVND(getOrderTotal(order))}`);
  return lines.join('\n');
};

// ============== DELETE ORDER ==============
export const formatOrderDeleteMessage = (
  order: any,
  editor?: OrderUpdateEditorInfo,
): string => {
  const lines: string[] = [];
  if (order.isTest) lines.push('⚠️ ĐƠN HÀNG TEST');
  lines.push(`🔴 XOÁ ĐƠN · ${order.orderNumber || order.id}`);
  lines.push(DIVIDER);
  const custName = order.customer?.name || order.customerName || '(không có)';
  const phone = order.customer?.phone || order.phone || '';
  lines.push(`👤 ${customerLine(custName, phone)}`);
  lines.push(`🗑️ ${editor?.name || 'Unknown'} · 🕒 ${formatDayHM(new Date())}`);
  lines.push(`💵 Giá trị: ${formatVND(getOrderTotal(order))}`);
  return lines.join('\n');
};

// ============== BATCH REMINDERS ==============
export const formatUnpaidOrdersMessage = (orders: Order[]): string => {
  // Defensive: loại đơn đã huỷ / trả lại — không tính là chưa TT
  const filtered = orders.filter((o) => {
    const st = String(o.status ?? '').toUpperCase();
    return st !== 'CANCELLED' && st !== 'RETURNED';
  });
  if (filtered.length === 0) return `✅ Không có đơn hàng chưa thanh toán.`;
  const totalUnpaid = filtered.reduce((s, o) => s + getOrderTotal(o), 0);
  const lines: string[] = [];
  lines.push(`⚠️ ĐƠN CHƯA THANH TOÁN · ${filtered.length} đơn · ${formatVND(totalUnpaid)}`);
  lines.push(DIVIDER);
  filtered.forEach((o, i) => {
    const od = parseDateValue(o.orderDate || o.date);
    lines.push(`${i + 1}. ${o.orderNumber || o.id} · ${formatVND(getOrderTotal(o))} · ${customerLine(o.customer?.name, o.customer?.phone)}`);
    lines.push(`   🕒 Đặt ${formatDayHM(od)}`);
  });
  return lines.join('\n');
};

export const formatPendingOrdersMessage = (orders: Order[]): string => {
  if (orders.length === 0) return `✅ Không có đơn hàng cần xử lý.`;
  const totalPending = orders.reduce((s, o) => s + getOrderTotal(o), 0);
  const lines: string[] = [];
  lines.push(`⚠️ ĐƠN CẦN XỬ LÝ · ${orders.length} đơn · ${formatVND(totalPending)}`);
  lines.push(DIVIDER);
  orders.forEach((o, i) => {
    const dd = o.deliveryDate ? parseDateValue(o.deliveryDate) : null;
    lines.push(`${i + 1}. ${o.orderNumber || o.id} · ${formatVND(getOrderTotal(o))} · ${customerLine(o.customer?.name, o.customer?.phone)}`);
    if (dd) lines.push(`   📅 Giao ${dm(dd)}${o.deliveryTime ? ' ' + o.deliveryTime : ' ' + hm(dd)}`);
    (o.items || []).forEach((it) => itemLines(it).forEach((l) => lines.push(`   ${l}`)));
  });
  return lines.join('\n');
};

/** 1 dòng gọn cho 1 đơn: "Tên KH - N gói - <vị> - <note>". Gộp vị từ items.flavors. */
const deliveryOrderLine = (o: Order): string => {
  const qty = (o.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const flavorCounts = new Map<string, number>();
  (o.items || []).forEach((it) =>
    (it.flavors || []).forEach((f) => {
      const fl = (f || '').trim();
      if (fl) flavorCounts.set(fl, (flavorCounts.get(fl) || 0) + 1);
    }),
  );
  const flavors = Array.from(flavorCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([f, c]) => (f === MIX_FLAVOR ? MIX_LABEL : `${c} ${f}`))
    .join(', ');
  const note = (o.note || '').trim();
  const name = o.customer?.name?.trim() || '(?)';
  return `• ${name} - ${qty} gói${flavors ? ` - ${flavors}` : ''}${note ? ` - ${note}` : ''}`;
};

/** Thông báo đơn cần giao — hỗ trợ 1 ngày hoặc KHOẢNG ngày (from → to). */
export const formatDeliveryDueMessage = (orders: Order[], fromDate?: Date, toDate?: Date): string => {
  const fromStr = fromDate ? dm(fromDate) : '';
  const toStr = toDate ? dm(toDate) : '';
  const rangeStr =
    fromStr && toStr && fromStr !== toStr ? `${fromStr}–${toStr}` : fromStr || toStr || 'hôm nay';
  if (orders.length === 0) return `✅ Không có đơn hàng cần giao (${rangeStr}).`;
  const totalGoi = orders.reduce(
    (s, o) => s + (o.items || []).reduce((a, it) => a + (Number(it.quantity) || 0), 0),
    0,
  );
  const lines: string[] = [];
  lines.push(`🚚 CẦN GIAO · ${rangeStr} · ${orders.length} đơn · ${totalGoi} gói`);
  lines.push(DIVIDER);
  // sắp theo ngày giao rồi tên
  const sorted = [...orders].sort((a, b) => {
    const da = a.deliveryDate ? parseDateValue(a.deliveryDate)?.getTime() ?? 0 : 0;
    const db = b.deliveryDate ? parseDateValue(b.deliveryDate)?.getTime() ?? 0 : 0;
    return da - db || (a.customer?.name || '').localeCompare(b.customer?.name || '');
  });
  let curDate = '';
  sorted.forEach((o) => {
    const dd = o.deliveryDate ? parseDateValue(o.deliveryDate) : null;
    const dLbl = dd ? dm(dd) : '—';
    if (dLbl !== curDate) { curDate = dLbl; lines.push(`📅 ${dLbl}`); }
    lines.push(deliveryOrderLine(o));
  });
  return lines.join('\n');
};

export const formatPaymentReceivedMessage = (orderNumber: string | null, transactionAmount: number): string => {
  const lines: string[] = [];
  lines.push(`💰 ĐÃ NHẬN THANH TOÁN${orderNumber ? ' · ' + orderNumber : ''}`);
  lines.push(DIVIDER);
  lines.push(`💵 ${formatVND(transactionAmount)}`);
  lines.push('✅ ĐÃ THANH TOÁN');
  return lines.join('\n');
};

// ============== PRODUCTION TOMORROW ==============
export const formatProductionTomorrowMessage = (orders: Order[], targetDate: Date): string => {
  const dateStr = formatDateShort(targetDate).split(' ')[0];
  if (orders.length === 0) return `✅ Mai (${dateStr}) chưa có đơn nào cần làm.`;

  // Gộp items theo name + quantity
  const itemMap = new Map<string, number>();
  let totalItems = 0;
  orders.forEach((o) => {
    (o.items || []).forEach((it: any) => {
      const key = it.name || '(?)';
      const qty = it.quantity || 0;
      itemMap.set(key, (itemMap.get(key) || 0) + qty);
      totalItems += qty;
    });
  });

  const sortedItems = Array.from(itemMap.entries()).sort((a, b) => b[1] - a[1]);

  const lines: string[] = [];
  lines.push(`🍰 SẢN XUẤT NGÀY MAI · ${dateStr}`);
  lines.push(DIVIDER);
  lines.push(`📊 ${orders.length} đơn · ${totalItems} sản phẩm`);
  lines.push('');
  sortedItems.forEach(([name, qty]) => {
    lines.push(`• ${name} × ${qty}`);
  });
  return lines.join('\n');
};

// ============== STUCK PENDING (đơn PENDING quá lâu) ==============
export const formatStuckPendingMessage = (orders: Order[], thresholdHours: number): string => {
  if (orders.length === 0) return `✅ Không có đơn PENDING nào quá ${thresholdHours} giờ.`;
  const lines: string[] = [];
  lines.push(`⚠️ ĐƠN PENDING QUÁ ${thresholdHours}H · ${orders.length} đơn`);
  lines.push(DIVIDER);
  const now = Date.now();
  orders.forEach((o, i) => {
    const created = parseDateValue(o.orderDate || o.createdAt || (o as any).date);
    const ageH = created ? Math.floor((now - created.getTime()) / 3600000) : null;
    lines.push(`${i + 1}. ${o.orderNumber || o.id} · ${formatVND(getOrderTotal(o))} · ${customerLine(o.customer?.name, o.customer?.phone)}`);
    if (created) lines.push(`   ⏰ Tạo ${formatDayHM(created)}${ageH != null ? ` (${ageH}h trước)` : ''}`);
  });
  return lines.join('\n');
};

// ============== DAILY SUMMARY ==============
export interface DailySummaryStats {
  orders: Order[];
  newCustomersCount?: number;
}
export const formatDailySummaryMessage = (stats: DailySummaryStats, date: Date): string => {
  const dateStr = formatDateShort(date).split(' ')[0];
  const orders = stats.orders;
  const revenue = orders.reduce((s, o) => s + getOrderTotal(o), 0);

  // Đếm trạng thái thanh toán
  const paid = orders.filter((o) => o.paymentStatus === 'PAID').length;
  const unpaid = orders.length - paid;

  // Top sản phẩm
  const itemMap = new Map<string, number>();
  orders.forEach((o) => {
    (o.items || []).forEach((it: any) => {
      const k = it.name || '(?)';
      itemMap.set(k, (itemMap.get(k) || 0) + (it.quantity || 0));
    });
  });
  const topItems = Array.from(itemMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const lines: string[] = [];
  lines.push(`📊 TỔNG KẾT HÔM NAY · ${dateStr}`);
  lines.push(DIVIDER);
  lines.push(`📦 Đơn: ${orders.length}`);
  lines.push(`💵 Doanh thu: ${formatVND(revenue)}`);
  if (stats.newCustomersCount !== undefined) {
    lines.push(`👥 KH mới: ${stats.newCustomersCount}`);
  }
  lines.push(`💳 Đã TT: ${paid} · Chưa TT: ${unpaid}`);
  if (topItems.length > 0) {
    lines.push('');
    lines.push(`🏆 Top sản phẩm:`);
    topItems.forEach(([name, qty], i) => {
      lines.push(`   ${i + 1}. ${name} × ${qty}`);
    });
  }
  return lines.join('\n');
};

// ============== HEALTH CHECK ==============
export const formatHealthCheckMessage = (now: Date): string => {
  const timeStr = now.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  const lines: string[] = [];
  lines.push(`✅ HEALTH CHECK · ${timeStr}`);
  lines.push(DIVIDER);
  lines.push('Hệ thống đang hoạt động bình thường.');
  lines.push('Zalo token: live ✓');
  return lines.join('\n');
}
