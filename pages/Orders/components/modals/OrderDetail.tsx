import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  Banknote,
  Check,
  Clock,
  Copy,
  CreditCard,
  FileText,
  Globe,
  History,
  Link2,
  Mail,
  MapPin,
  Phone,
  QrCode,
  Receipt,
  Share2,
  StickyNote,
  Store,
  Trash2,
  Truck,
  Unlink,
  User,
  Wallet,
  X
} from 'lucide-react';
import { STATUS_COLORS } from '@/constant/order';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePaymentAccounts } from '@/hooks/usePaymentAccounts';
import { TEST_PAYMENT_ACCOUNT } from '@/types/paymentConfig';
import { qk } from '@/hooks/queryKeys';
import { ORDER_EDIT_DENIED, reconcileRefund, markRefundCash, unreconcileRefund, fetchTrackingTimeline, fetchOrder, markOrderBillPrinted, notifyCustomerZalo } from '@/services/orderService';
import { fetchTransactionsByOrderNumber, fetchOutUnlinkedTransactions } from '@/services/transactionService';
import { DeliveryType, Order, OrderItem, PaymentMethod, OrderStatus, PaymentStatus, Transaction, productUsesFlavorPricing, flavorImage, flavorVariantColor, groupFlavors, isMixFlavors, sizeCountsLabel, sizeImage, sizeCount } from '@/types';
import { useProducts } from '@/hooks/queries/useProductsQuery';
import { UserRole } from '@/types/user';
import { orderAddressFallbackKey, surchargeTagLabel, reconcileMethodLabel, refundCategoryLabel } from '@/types/order';
import { useSurchargeTags } from '@/hooks/queries/useSurchargeTagsQuery';
import SpxAddressPanel from '../SpxAddressPanel';
import Spx2AddressPanel from '../Spx2AddressPanel';
import { formatVND } from '@/utils/format/currencyUtil';
import { allocateSurcharge, generateQRCodeImage, getOrderTotal } from '@/utils/order/orderUtils';
import { buildOrderEmvQr } from '@/utils/order/vietQrEmv';
import { pushPosQr, clearPosQr } from '@/services/posService';
import { Sparkles, MonitorSmartphone, Home, Printer, ChefHat, MoreHorizontal, Send } from 'lucide-react';
import BaseSlidePanel from '@/components/BaseSlidePanel';
import Badge from '@/components/ui/Badge';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Heading from '@/components/ui/Heading';
import IconButton from '@/components/ui/IconButton';
import Image from '@/components/ui/Image';
import BottomSheet from '@/components/ui/BottomSheet';
import Spinner from '@/components/ui/Spinner';
import Typography from '@/components/ui/Typography';
import { useIsMobile } from '@/hooks/useIsMobile';
import CancelRefundModal, { type CancelRefundMode, type CancelRefundResult } from '@/pages/Orders/components/modals/CancelRefundModal';
import ShareableOrderCard from '@/pages/Orders/components/modals/ShareableOrderCard';
import OrderPrintPortal from '@/pages/Orders/components/print/OrderPrintPortal';
interface OrderDetailProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  /** CTV chỉ được sửa đơn do họ tạo; false => ẩn chỉnh nhanh trạng thái / thanh toán */
  canEdit?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  onUpdateOrder?: (id: string, data: Partial<Order>) => Promise<void>;
  /** Đổi trạng thái — đường nhẹ/nhanh (optimistic). Dùng cho patch chỉ có status. */
  onChangeStatus?: (id: string, status: string) => Promise<void>;
  /** Patch field nhanh (paymentStatus/paymentMethod/deliveryType) — đường nhẹ (optimistic). */
  onPatchFields?: (id: string, patch: Record<string, unknown>) => Promise<void>;
}

const OrderDetail: React.FC<OrderDetailProps> = ({
  isOpen,
  order,
  onClose,
  canEdit = true,
  onEdit,
  onDelete,
  canDelete = false,
  onUpdateOrder,
  onChangeStatus,
  onPatchFields,
}) => {
  const { t } = useLanguage();
  const { products } = useProducts();
  const { currentUser, userData } = useAuth();
  const { surchargeTags } = useSurchargeTags();
  const { activeAccount } = usePaymentAccounts();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'details' | 'refund' | 'history' | 'tracking'>('details');
  const [moreOpen, setMoreOpen] = useState(false);
  const isMobile = useIsMobile();
  const [posBusy, setPosBusy] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [printMode, setPrintMode] = useState<'bill' | 'kitchen' | null>(null);
  const printToastRef = useRef<string | null>(null);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [crMode, setCrMode] = useState<CancelRefundMode | null>(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [localOrder, setLocalOrder] = useState(order);

  // ── Đối soát phiếu hoàn ↔ GD SePay tiền ra (#186) ──
  // Chỉ Admin/Super Admin được thao tác (như refund).
  const canReconcile =
    userData?.role === UserRole.ADMIN || userData?.role === UserRole.SUPER_ADMIN;
  /** refundId đang mở panel chọn giao dịch (null = không mở). */
  const [pickerRefundId, setPickerRefundId] = useState<string | null>(null);
  /** Danh sách GD tiền ra chưa gắn (load khi mở picker). */
  const [outTx, setOutTx] = useState<Transaction[]>([]);
  const [outTxLoading, setOutTxLoading] = useState(false);
  /** refundId đang chạy 1 thao tác đối soát (disable nút + spinner). */
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);

  // Transactions của đơn hiện tại qua React Query — chỉ chạy khi có orderNumber.
  // Mỗi transaction render thành 1 entry trong block "Lịch sử nhận tiền".
  const orderNumberForTx = order?.orderNumber ?? '';
  const txQuery = useQuery({
    queryKey: qk.transactions.byOrderNumber(orderNumberForTx),
    queryFn: () => fetchTransactionsByOrderNumber(orderNumberForTx),
    enabled: !!currentUser && !!orderNumberForTx,
  });
  const relatedTransactions: Transaction[] = txQuery.data ?? [];

  // Hành trình vận đơn LIVE (SPX) — tra cứu theo mã khi mở đơn.
  const trackingTn = order?.trackingNumber ?? '';
  const trackingQuery = useQuery({
    queryKey: ['tracking', trackingTn],
    queryFn: () => fetchTrackingTimeline(trackingTn),
    enabled: isOpen && /^SPXVN/i.test(trackingTn),
    staleTime: 5 * 60 * 1000,
  });

  React.useEffect(() => {
    setLocalOrder(order);
  }, [order]);

  // List trả bản NHẸ (thiếu history/refunds/decorations/appliedPromotions/giftItems).
  // Khi mở/đổi đơn → fetch bản ĐẦY ĐỦ để hydrate (render bản nhẹ ngay, fill full sau).
  React.useEffect(() => {
    if (!isOpen || !order?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const full = await fetchOrder(order.id);
        if (!cancelled && full) setLocalOrder(full);
      } catch { /* lỗi → giữ bản nhẹ */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, order?.id, order?.updatedAt]);

  // Khi trạng thái thanh toán / sepayId của đơn đổi (vd sau khi ghi nhận thanh
  // toán) → refetch transactions để cập nhật "Lịch sử nhận tiền" như cũ.
  React.useEffect(() => {
    if (orderNumberForTx) void txQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.paymentStatus, order?.sepayId]);

  const shareRef = useRef<HTMLDivElement>(null);
  const [copyingImg, setCopyingImg] = useState(false);
  // Object URL của ảnh đơn để hiển thị <Image> trong modal preview.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Giữ blob gốc để nút "Copy ảnh" trong modal copy vào clipboard mà không render lại.
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  // Cờ loading khi đang copy ảnh từ modal preview.
  const [copyingPreview, setCopyingPreview] = useState(false);
  // Cờ loading nút "Gửi cho khách". PHẢI khai báo ở đây — dưới `if (!currentOrder) return null`
  // là hook có điều kiện → React error #310 (số hook lệch giữa 2 lần render).
  const [notifyingCustomer, setNotifyingCustomer] = useState(false);

  const currentOrder = localOrder || order;
  if (!currentOrder) return null;

  const calculateLineItemTotal = (item: OrderItem) => {
    return item.price * item.quantity;
  };

  const shippingCost = currentOrder.shippingCost || 0;
  
  const subtotal = currentOrder.items.reduce((sum, item) => sum + calculateLineItemTotal(item), 0);
  
  const finalTotal = getOrderTotal(currentOrder);
  const billPrinted = !!currentOrder.billPrintedAt;

  // Phụ thu nhiều dòng (fallback đơn cũ = 1 dòng từ surchargeAmount/tag).
  const surchargeRows = (
    currentOrder.surcharges && currentOrder.surcharges.length > 0
      ? currentOrder.surcharges
      : currentOrder.surchargeAmount
        ? [{ tag: currentOrder.surchargeTag, amount: currentOrder.surchargeAmount }]
        : []
  ).filter((s) => Number(s.amount) > 0);

  // QR cọc + còn lại hiển thị CÙNG LÚC trong 1 section (bỏ toggle tab).
  const depositAmt = Number(currentOrder.depositAmount) || 0;
  const paidAmt = Number(currentOrder.paidAmount) || 0;
  const hasDeposit = depositAmt > 0;
  const collected = Math.max(depositAmt, paidAmt);
  const remainderAmt = Math.max(0, finalTotal - collected);
  // Đơn TEST → QR trỏ vào TK test (MBBank 0776750418) để test thông luồng; đơn thường → TK active.
  const qrAccount = currentOrder.isTest ? TEST_PAYMENT_ACCOUNT : activeAccount;
  // Nội dung CK: mã đơn; cọc → prefix "C". Thiếu TK → URL rỗng (section ẩn an toàn).
  const buildQrUrl = (amount: number, isDeposit: boolean) =>
    qrAccount ? generateQRCodeImage(currentOrder.orderNumber, amount, qrAccount, isDeposit) : '';
  // Các khối QR hiện đồng thời: có cọc → [cọc, còn lại]; không cọc → [đủ]. Bỏ khối tiền = 0.
  const qrBlocks = (hasDeposit
    ? [
        { key: 'deposit', label: t('pos.qrDeposit'), amount: depositAmt, isDeposit: true },
        { key: 'remainder', label: t('pos.qrRemaining'), amount: remainderAmt, isDeposit: false },
      ]
    : [{ key: 'full', label: '', amount: finalTotal, isDeposit: false }]
  ).filter((b) => b.amount > 0);
  // QR card chia sẻ theo trạng thái cọc:
  //  • ĐÃ CỌC (paidAmt>0) → 1 QR = CÒN LẠI (finalTotal − đã trả).
  //  • CHƯA CỌC → QR tổng (+ QR CỌC nếu đơn có mức cọc) → 2 QR.
  const hasPaidDeposit = paidAmt > 0;
  const shareRemaining = Math.max(0, finalTotal - paidAmt);
  const sharePrimaryAmount = hasPaidDeposit && shareRemaining > 0 ? shareRemaining : finalTotal;
  const sharePrimaryLabel = hasPaidDeposit && shareRemaining > 0
    ? 'Chuyển khoản còn lại'
    : (!hasPaidDeposit && depositAmt > 0 ? 'Chuyển khoản đủ' : 'Chuyển khoản');
  // Nội dung CK: mã đơn (kể cả còn lại — BE đối soát theo ORD<digits>).
  const shareDescription = currentOrder.orderNumber;
  const shareQrUrl = qrAccount ? generateQRCodeImage(currentOrder.orderNumber, sharePrimaryAmount, qrAccount, false) : '';
  // QR CỌC chỉ khi CHƯA cọc & đơn có mức cọc (nội dung "C" + mã đơn).
  const shareDepositQrUrl = (qrAccount && !hasPaidDeposit && depositAmt > 0)
    ? generateQRCodeImage(currentOrder.orderNumber, depositAmt, qrAccount, true) : '';
  const shareDepositDescription = `C${currentOrder.orderNumber}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Copy thông tin khách hàng: tên \n sdt \n địa chỉ (kèm city/country nếu có).
  const handleCopyCustomer = () => {
    const c = currentOrder.customer;
    const addressLine = c.address || t(orderAddressFallbackKey(currentOrder.deliveryType));
    const fullAddress = c.city ? `${addressLine}, ${c.city}, ${c.country}` : addressLine;
    const info = [c.name, c.phone, fullAddress].filter(Boolean).join('\n');
    copyToClipboard(info);
    toast.success(t('detail.customerCopied'));
  };

  // Đẩy QR (EMV) số tiền `amount` xuống máy POS/ESP32.
  const handlePushPos = async (amount: number, isDeposit: boolean) => {
    if (!qrAccount || amount <= 0) return;
    const emv = buildOrderEmvQr(currentOrder.orderNumber, amount, qrAccount, isDeposit);
    if (!emv) { toast.error(t('pos.qrBuildFailed')); return; }
    setPosBusy(true);
    try {
      await pushPosQr({ order_id: currentOrder.orderNumber, amount, qr: emv });
      toast.success(t('pos.qrPushed'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('pos.qrPushFailed'));
    } finally { setPosBusy(false); }
  };
  const handleCancelPos = async () => {
    setPosBusy(true);
    try { await clearPosQr(); toast.success(t('pos.backToHomeDone')); }
    catch (e) { toast.error(e instanceof Error ? e.message : t('pos.qrPushFailed')); }
    finally { setPosBusy(false); }
  };


  // Chụp thẻ thông tin gửi khách (ShareableOrderCard, off-screen) → ảnh PNG rồi
  // LUÔN mở MODAL PREVIEW (cả desktop lẫn mobile). Không tự copy, không tự đóng.
  // Trong modal user chọn: Copy ảnh (clipboard) HOẶC tự chụp màn hình / tải ảnh.
  const handleShareOrder = async () => {
    if (!shareRef.current || copyingImg) return;
    setCopyingImg(true);
    const shareToastId = toast.loading(t('detail.copyImageLoading') || 'Đang tạo ảnh...');
    try {
      if (document.fonts?.ready) await document.fonts.ready; // tránh nhảy font khi render
      const node = shareRef.current;
      if (!node) throw new Error('no node');
      const imgs = Array.from(node.querySelectorAll('img')) as HTMLImageElement[];
      // Inline mọi ảnh thành dataURL TRƯỚC khi chụp — né taint canvas do CORS/cache:
      // ảnh SP (RiceService) & QR (SePay) có CORS → fetch (cors, reload) được; ảnh nào
      // KHÔNG có CORS (link cũ) fetch fail → thay ảnh trong suốt để html-to-image
      // không bị "tainted canvas" (toBlob sẽ throw). Sau inline: mọi src là data:/ảnh trong suốt.
      const TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
      await Promise.all(
        imgs.map(async (img) => {
          const src = img.src;
          if (!src || src.startsWith('data:')) return;
          try {
            const res = await fetch(src, { mode: 'cors', cache: 'reload' });
            if (!res.ok) throw new Error(String(res.status));
            const blob = await res.blob();
            img.src = await new Promise<string>((resolve, reject) => {
              const fr = new FileReader();
              fr.onload = () => resolve(fr.result as string);
              fr.onerror = () => reject(new Error('read fail'));
              fr.readAsDataURL(blob);
            });
          } catch {
            img.removeAttribute('crossorigin');
            img.src = TRANSPARENT; // không tải được → để trống, tránh taint
          }
          await new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) resolve();
            else {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            }
          });
        }),
      );
      // Ảnh đã inline data: nên không cần cacheBust nữa.
      const opts = { pixelRatio: 2, backgroundColor: '#ffffff' } as const;
      // Nạp html-to-image theo yêu cầu — chỉ tải khi user chụp thẻ gửi khách.
      const { toBlob } = await import('html-to-image');
      // html-to-image hay miss ảnh ở lần chụp đầu (nhất là mobile) → warm-up rồi chụp thật.
      await toBlob(node, opts);
      const blob = await toBlob(node, opts);
      if (!blob) throw new Error('no blob');
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setPreviewBlob(blob);
    } catch {
      toast.error(t('detail.copyImageError') || 'Không tạo được ảnh đơn');
    } finally {
      toast.dismiss(shareToastId);
      setCopyingImg(false);
    }
  };

  // Copy ảnh trong modal preview vào clipboard, GIỮ NGUYÊN modal mở.
  // Trình duyệt không hỗ trợ / fail → toast hướng dẫn tải ảnh hoặc chụp màn hình.
  const copyPreviewImage = async () => {
    if (!previewBlob || copyingPreview) return;
    const canClipboard = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
    if (!canClipboard) {
      toast.error(t('detail.copyImageUnsupported') || 'Trình duyệt không hỗ trợ copy — hãy tải ảnh hoặc chụp màn hình');
      return;
    }
    setCopyingPreview(true);
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': previewBlob })]);
      toast.success(t('detail.copyImageSuccess') || 'Đã copy ảnh đơn vào clipboard');
    } catch {
      toast.error(t('detail.copyImageUnsupported') || 'Trình duyệt không hỗ trợ copy — hãy tải ảnh hoặc chụp màn hình');
    } finally {
      setCopyingPreview(false);
    }
  };

  // Đóng modal preview + giải phóng object URL + clear blob.
  const closePreview = () => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPreviewBlob(null);
  };

  // Tải ảnh đơn từ modal preview xuống máy.
  const downloadPreview = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `${currentOrder.orderNumber || 'don-hang'}.png`;
    a.click();
  };

  /**
   * Map (entry, field) -> category. 3 block:
   * - status: chuyển trạng thái đơn (PENDING/PROCESSING/DELIVERED…)
   * - payment: CHỈ ghi nhận tự động từ SePay (entry.byUid === 'system')
   *            → đây là thời điểm hệ thống nhận tiền thật
   * - info: mọi thay đổi do người chỉnh (kể cả paymentStatus / paymentMethod /
   *         total / shippingCost / items / customer / note / delivery)
   */
  const changeToCategory = (entry: any, field: string): 'status' | 'payment' | 'info' => {
    if (field === 'status') return 'status';
    if (entry?.byUid === 'system') return 'payment';
    return 'info';
  };

  const formatHistoryValue = (field: string, value: any): string => {
    if (value === null || value === undefined || value === '' || value === '—') return '—';
    const s = String(value);
    if (field === 'status' && ['PENDING','PROCESSING','DELIVERED','CANCELLED','RETURNED'].includes(s)) {
      return t(`orders.statusLabels.${s}`);
    }
    if (field === 'paymentStatus' && ['PAID','UNPAID','REFUNDED'].includes(s)) {
      return t(`orders.paymentStatusLabels.${s}`);
    }
    if (field === 'paymentMethod') {
      if (s === 'BANKING') return t('paymentMethod.banking');
      if (s === 'CASH') return t('paymentMethod.cash');
    }
    if (field === 'deliveryType') {
      if (s === 'SHIP') return t('deliveryType.ship');
      if (s === 'PICKUP') return t('deliveryType.pickup');
      if (s === 'SHIP_PROVINCE') return t('deliveryType.shipProvince');
      if (s === 'DINE_IN') return t('deliveryType.dineIn');
    }
    if (field === 'total' || field === 'shippingCost') {
      const n = Number(value);
      if (!isNaN(n)) return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
    }
    return s;
  };

  const handleCancelRefund = async (result: CancelRefundResult) => {
    if (!currentOrder?.id || !onUpdateOrder) throw new Error('Không thể cập nhật đơn');
    const isCancel = crMode === 'cancel';
    const nowIso = new Date().toISOString();
    const patch: Partial<Order> = {};
    if (isCancel) {
      patch.status = OrderStatus.CANCELLED;
      patch.cancelReason = result.reason;
      patch.cancelledAt = nowIso;
    } else {
      patch.refundReason = result.reason;
    }
    if (result.refund && result.refundAmount) {
      patch.paymentStatus = PaymentStatus.REFUNDED;
      patch.refundedAt = nowIso;
      patch.refundedAmount = result.refundAmount;
      patch.refundReason = patch.refundReason || result.reason;
    }
    await onUpdateOrder(currentOrder.id, { ...currentOrder, ...patch });
  };

  /* ── Đối soát phiếu hoàn (#186) ── */

  // Map mã code lỗi BE → message i18n để toast rõ ràng.
  const reconcileErrorMessage = (e: unknown): string => {
    const code = e instanceof Error ? e.message : '';
    switch (code) {
      case 'TRANSACTION_ALREADY_LINKED':
        return t('reconcile.errAlreadyLinked');
      case 'TRANSACTION_NOT_OUTGOING':
        return t('reconcile.errNotOutgoing');
      case 'TRANSACTION_NOT_FOUND':
        return t('reconcile.errTxNotFound');
      case 'REFUND_NOT_FOUND':
        return t('reconcile.errRefundNotFound');
      default:
        return t('reconcile.errGeneric');
    }
  };

  // Mở/đóng panel chọn giao dịch cho 1 phiếu hoàn; load danh sách khi mở.
  const handleOpenPicker = async (refundId: string) => {
    if (pickerRefundId === refundId) {
      setPickerRefundId(null);
      return;
    }
    setPickerRefundId(refundId);
    setOutTxLoading(true);
    try {
      const list = await fetchOutUnlinkedTransactions();
      setOutTx(list);
    } catch (e) {
      console.error(e);
      toast.error(t('reconcile.loadTxFailed'));
      setOutTx([]);
    } finally {
      setOutTxLoading(false);
    }
  };

  // Gắn 1 GD SePay cho phiếu hoàn → BE trả Order đầy đủ → refresh state đơn.
  const handleReconcileSepay = async (refundId: string, transactionId: string) => {
    if (!currentOrder?.id || reconcilingId) return;
    setReconcilingId(refundId);
    try {
      const updated = await reconcileRefund(currentOrder.id, refundId, transactionId);
      setLocalOrder(updated);
      setPickerRefundId(null);
      toast.success(t('reconcile.reconciledSepay'));
    } catch (e) {
      console.error(e);
      toast.error(reconcileErrorMessage(e));
    } finally {
      setReconcilingId(null);
    }
  };

  // Đánh dấu phiếu hoàn trả tiền mặt.
  const handleReconcileCash = async (refundId: string) => {
    if (!currentOrder?.id || reconcilingId) return;
    setReconcilingId(refundId);
    try {
      const updated = await markRefundCash(currentOrder.id, refundId);
      setLocalOrder(updated);
      setPickerRefundId(null);
      toast.success(t('reconcile.markedCash'));
    } catch (e) {
      console.error(e);
      toast.error(reconcileErrorMessage(e));
    } finally {
      setReconcilingId(null);
    }
  };

  // Gỡ đối soát phiếu hoàn.
  const handleUnreconcile = async (refundId: string) => {
    if (!currentOrder?.id || reconcilingId) return;
    setReconcilingId(refundId);
    try {
      const updated = await unreconcileRefund(currentOrder.id, refundId);
      setLocalOrder(updated);
      toast.success(t('reconcile.unreconciled'));
    } catch (e) {
      console.error(e);
      toast.error(reconcileErrorMessage(e));
    } finally {
      setReconcilingId(null);
    }
  };

  const handleUpdateField = async (patch: Partial<Order>, setLoading: (v: boolean) => void) => {
    if (!canEdit || !currentOrder?.id || !onUpdateOrder) return;
    setLoading(true);
    try {
      // Đường NHẸ/NHANH (optimistic, không gửi cả đơn) cho các field đơn giản:
      const keys = Object.keys(patch);
      // status → hàm chuyên (order_update_status).
      if (onChangeStatus && keys.length === 1 && keys[0] === 'status' && patch.status) {
        await onChangeStatus(currentOrder.id, patch.status as string);
        setIsStatusOpen(false);
        return;
      }
      // paymentStatus/paymentMethod/deliveryType → order_patch_fields.
      const LIGHT_FIELDS = ['paymentStatus', 'paymentMethod', 'deliveryType'];
      if (onPatchFields && keys.length > 0 && keys.every((k) => LIGHT_FIELDS.includes(k))) {
        await onPatchFields(currentOrder.id, patch as Record<string, unknown>);
        return;
      }
      await onUpdateOrder(currentOrder.id, { ...currentOrder, ...patch });
      // KHONG can setLocalOrder optimistic nua — parent da auto-sync selectedOrder
      // qua useEffect khi orders list refresh, va useEffect([order]) cua component
      // se reset localOrder = order moi (kem history moi).
      setIsStatusOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === ORDER_EDIT_DENIED) {
        toast.error(t('orders.editDeniedCollaborator'));
      } else {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  };

  // In xong (đã bung hộp thoại in) → đánh dấu "đã in bill" trên BE + cập nhật badge (local + list).
  // Chỉ đánh dấu khi in BILL khách; in phiếu bếp không ảnh hưởng badge "đã in bill".
  // Bắt đầu in: disable nút + hiện toast loading (thay vì đổi chữ trên nút).
  const startPrint = (mode: 'bill' | 'kitchen') => {
    printToastRef.current = toast.loading(mode === 'bill' ? 'Đang in bill...' : 'Đang in bếp...');
    setPrintMode(mode);
  };
  const dismissPrintToast = () => {
    if (printToastRef.current) {
      toast.dismiss(printToastRef.current);
      printToastRef.current = null;
    }
  };

  const handlePrintDone = () => {
    const mode = printMode;
    setPrintMode(null);
    dismissPrintToast();
    if (mode) toast.success(mode === 'bill' ? 'Đã in bill' : 'Đã in bếp');
    if (mode !== 'bill') return;
    void (async () => {
      try {
        const updated = await markOrderBillPrinted(currentOrder.id);
        const ts = updated?.billPrintedAt ?? new Date().toISOString();
        setLocalOrder((prev) => (prev ? { ...prev, billPrintedAt: ts } : prev));
        queryClient.setQueryData<Order[]>(qk.orders.all, (old) =>
          old?.map((o) => (o.id === currentOrder.id ? { ...o, billPrintedAt: ts } : o)),
        );
        queryClient.invalidateQueries({ queryKey: qk.orders.all });
      } catch {
        toast.error('Đã in nhưng chưa lưu được trạng thái in');
      }
    })();
  };

  const headerContent = (
    <Box layoutClassName="flex w-full items-start justify-between">
      <Box>
        <Box layoutClassName="mb-1 flex items-center gap-3">
          <Heading level={2} textClassName="text-xl font-bold">
            {currentOrder.orderNumber || `Order #${currentOrder.id}`}
          </Heading>
          <Badge
            size="sm"
            layoutClassName="px-2.5 py-0.5 text-xs font-medium"
            backgroundClassName={STATUS_COLORS[currentOrder.status]}
          >
            {t(`orders.statusLabels.${currentOrder.status}`)}
          </Badge>
          <Badge
            size="sm"
            layoutClassName="px-2.5 py-0.5 text-xs font-medium"
            backgroundClassName={billPrinted ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-700'}
            textClassName={billPrinted ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-300'}
          >
            {billPrinted ? '🖨 Đã in bill' : 'Chưa in bill'}
          </Badge>
        </Box>
        <Typography size="sm" variant="muted">
          {t('detail.placedOn')} {new Date(currentOrder.createdAt.toDate()).toLocaleString()}
        </Typography>
        {currentOrder.deliveryDate ? (
          <Typography size="sm" variant="muted">
            Ngày nhận hàng: {new Date(currentOrder.deliveryDate).toLocaleDateString()}
            {currentOrder.deliveryTime ? ` • ${currentOrder.deliveryTime}` : ''}
          </Typography>
        ) : null}
        {currentOrder.trackingNumber ? (
          <Typography size="sm" layoutClassName="font-medium" textClassName="text-primary-600 dark:text-primary-400">
            🚚 Mã vận đơn:{' '}
            {currentOrder.trackingLink ? (
              <Typography
                as="span"
                size="inherit"
                textClassName="underline hover:opacity-80 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(currentOrder.trackingLink!, '_blank', 'noopener,noreferrer');
                }}
              >
                {currentOrder.trackingNumber}
              </Typography>
            ) : (
              currentOrder.trackingNumber
            )}
            {(() => {
              const latest = trackingQuery.data?.events?.[0]?.label || currentOrder.trackingStatus;
              return latest ? ` · ${latest}` : '';
            })()}
          </Typography>
        ) : null}
      </Box>
      <IconButton
        type="button"
        label={t('detail.close')}
        variant="secondary"
        layoutClassName="rounded-full"
        backgroundClassName="bg-slate-50 dark:bg-slate-700"
        hoverClassName="hover:bg-slate-100 dark:hover:bg-slate-600"
        textClassName="text-slate-400 dark:text-slate-300"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </IconButton>
    </Box>
  );

  // 1 dòng menu trong "Thêm" (dùng cho cả bottom sheet mobile + popover desktop).
  const MoreRow: React.FC<{
    icon: typeof Printer;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
  }> = ({ icon: Icon, label, onClick, disabled, danger }) => (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      variant="ghost"
      disableVariantHover
      disableVariantTextColor
      leftIcon={<Icon className="h-4 w-4" />}
      iconClassName={`inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4 ${danger ? 'text-red-500' : 'text-slate-400'}`}
      layoutClassName="flex w-full items-center gap-2.5"
      sizeClassName="px-2.5 py-2.5 text-sm"
      textClassName={danger ? 'font-medium text-red-600 dark:text-red-400' : 'font-medium text-slate-700 dark:text-slate-200'}
      roundedClassName="rounded-lg"
      backgroundClassName="bg-transparent"
      hoverClassName={danger ? 'hover:bg-red-50 dark:hover:bg-red-900/20' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}
      stateClassName="transition-colors disabled:opacity-50"
    >
      {label}
    </Button>
  );

  // ── Gửi Zalo cảm ơn + link tra đơn CHO KHÁCH (nút tay; auto đã chạy lúc tạo đơn) ──
  const customerNotifiedAt = currentOrder?.customerNotifiedAt ?? null;
  const handleNotifyCustomer = async () => {
    if (!currentOrder?.id) return;
    if (customerNotifiedAt && !window.confirm('Đơn này đã gửi tin cho khách. Gửi lại?')) return;
    setNotifyingCustomer(true);
    try {
      const r = await notifyCustomerZalo(currentOrder.id, true);
      if (r.sent) {
        toast.success('Đã xếp gửi Zalo cho khách (rải tin để tránh bị Zalo chặn)');
        setLocalOrder({ ...currentOrder, customerNotifiedAt: new Date().toISOString() });
      } else {
        const why: Record<string, string> = {
          no_phone: 'Đơn không có số điện thoại khách',
          opt_out: 'Khách đã chọn không nhận thông báo',
          daily_limit: 'Đã đạt hạn mức tin/ngày — thử lại mai',
          already_sent: 'Đơn này đã gửi rồi',
          disabled: 'Tính năng đang tắt ở Cài đặt Zalo',
          no_order: 'Không tìm thấy đơn',
          test_order: 'Đơn test — không gửi cho khách',
        };
        toast.error(why[r.reason ?? ''] ?? 'Không gửi được tin cho khách');
      }
    } catch {
      toast.error('Không gửi được tin cho khách');
    } finally {
      setNotifyingCustomer(false);
    }
  };

  const renderMoreMenu = (close: () => void) => (
    <Box layoutClassName="flex flex-col gap-0.5">
      <MoreRow icon={Printer} label="In bill" disabled={printMode !== null} onClick={() => { close(); startPrint('bill'); }} />
      <MoreRow icon={ChefHat} label="In bếp" disabled={printMode !== null} onClick={() => { close(); startPrint('kitchen'); }} />
      <MoreRow icon={Share2} label="Chia sẻ" disabled={copyingImg} onClick={() => { close(); handleShareOrder(); }} />
      <MoreRow
        icon={Send}
        label={customerNotifiedAt ? 'Gửi lại Zalo cho khách' : 'Gửi Zalo cho khách'}
        disabled={notifyingCustomer}
        onClick={() => { close(); void handleNotifyCustomer(); }}
      />
      {canDelete && onDelete ? (
        <MoreRow icon={Trash2} label={t('orders.delete')} danger onClick={() => { close(); onDelete(); }} />
      ) : null}
    </Box>
  );

  const moreButton = (onClick?: () => void) => (
    <Button
      type="button"
      onClick={onClick}
      variant="secondary"
      disableVariantHover
      disableVariantTextColor
      leftIcon={<MoreHorizontal className="h-4 w-4" />}
      iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
      borderClassName="border border-slate-200 dark:border-slate-600"
      backgroundClassName="bg-white dark:bg-slate-800"
      hoverClassName="hover:bg-slate-50 dark:hover:bg-slate-700"
      textClassName="text-sm font-medium text-slate-700 dark:text-slate-200"
      roundedClassName="rounded-lg"
      sizeClassName="px-4 py-2.5 sm:py-2"
      layoutClassName="flex-1 justify-center sm:flex-none"
      stateClassName="transition-colors"
    >
      {t('common.more')}
    </Button>
  );

  // Nút hành động dạng inline (PC hiện đủ nút thay vì gom vào "Thêm").
  // `label` để NGẮN cho vừa 1 hàng (6 nút), nhãn đầy đủ đưa vào `title` (tooltip) —
  // trước đây nhãn dài làm chữ ngắt dòng giữa từ ("In / bill", "Xóa đơn / hàng").
  const ActionButton: React.FC<{
    icon: typeof Printer;
    label: string;
    title?: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
  }> = ({ icon: Icon, label, title, onClick, disabled, danger }) => (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      variant="secondary"
      disableVariantHover
      disableVariantTextColor
      leftIcon={<Icon className="h-4 w-4" />}
      iconClassName={`inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4 ${danger ? 'text-red-500' : 'text-slate-400'}`}
      borderClassName={danger ? 'border border-red-200 dark:border-red-800' : 'border border-slate-200 dark:border-slate-600'}
      backgroundClassName="bg-white dark:bg-slate-800"
      hoverClassName={danger ? 'hover:bg-red-50 dark:hover:bg-red-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}
      textClassName={danger ? 'text-sm font-medium text-red-600 dark:text-red-400' : 'text-sm font-medium text-slate-700 dark:text-slate-200'}
      roundedClassName="rounded-lg"
      sizeClassName="px-2.5 py-2"
      layoutClassName="shrink-0 justify-center whitespace-nowrap"
      stateClassName="transition-colors disabled:opacity-50"
    >
      {label}
    </Button>
  );

  const desktopActions = (
    <>
      <ActionButton icon={Printer} label="Bill" title="In bill" disabled={printMode !== null} onClick={() => startPrint('bill')} />
      <ActionButton icon={ChefHat} label="Bếp" title="In phiếu bếp" disabled={printMode !== null} onClick={() => startPrint('kitchen')} />
      <ActionButton icon={Share2} label="Chia sẻ" title="Chia sẻ ảnh đơn" disabled={copyingImg} onClick={handleShareOrder} />
      <ActionButton
        icon={Send}
        label={customerNotifiedAt ? 'Gửi lại' : 'Gửi khách'}
        title={customerNotifiedAt
          ? `Gửi lại Zalo cho khách (đã gửi ${new Date(customerNotifiedAt).toLocaleString('vi-VN')})`
          : 'Gửi Zalo cảm ơn + trạng thái đơn cho khách'}
        disabled={notifyingCustomer}
        onClick={() => void handleNotifyCustomer()}
      />
      {canDelete && onDelete ? (
        <ActionButton icon={Trash2} label="Xoá" title={t('orders.delete')} danger onClick={onDelete} />
      ) : null}
    </>
  );

  const footer = (
    <Box layoutClassName="flex items-center gap-2 overflow-x-auto sm:justify-end sm:gap-2">
      {onEdit ? (
        <Button
          type="button"
          onClick={onEdit}
          backgroundClassName="bg-primary-600 dark:bg-primary-500"
          hoverClassName="hover:bg-primary-700 dark:hover:bg-primary-600"
          textClassName="text-sm font-medium text-white"
          roundedClassName="rounded-lg"
          shadowClassName="shadow-sm shadow-primary-200 dark:shadow-none"
          sizeClassName="px-4 py-2.5 sm:py-2"
          layoutClassName="flex-1 justify-center sm:flex-none"
          stateClassName="transition-colors"
          variant="primary"
          disableVariantHover
          disableVariantTextColor
        >
          {t('detail.edit')}
        </Button>
      ) : null}

      {isMobile ? (
        <>
          {moreButton(() => setMoreOpen(true))}
          <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t('common.more')}>
            {renderMoreMenu(() => setMoreOpen(false))}
          </BottomSheet>
        </>
      ) : (
        desktopActions
      )}
    </Box>
  );

  return (
    <>
    {printMode ? (
      <OrderPrintPortal
        mode={printMode}
        order={currentOrder}
        subtotal={subtotal}
        finalTotal={finalTotal}
        shippingCost={shippingCost}
        description={shareDescription}
        bankCode={qrAccount?.bankCode}
        accountNumber={qrAccount?.accountNumber}
        accountHolder={qrAccount?.accountHolder}
        onDone={handlePrintDone}
        onError={(msg) => {
          setPrintMode(null);
          dismissPrintToast();
          toast.error(`Không in được (${msg}). Kiểm tra máy in đã bật + cầu nối in đang chạy.`);
        }}
      />
    ) : null}
    <BaseSlidePanel
      isOpen={isOpen && !!order}
      onClose={onClose}
      maxWidth="2xl"
      headerContent={headerContent}
      footer={footer}
    >
      <Box layoutClassName="flex flex-col h-full">
        <Box
          layoutClassName="flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:gap-6 sm:px-6"
          borderClassName="border-b border-slate-100 dark:border-slate-700"
          backgroundClassName="bg-white dark:bg-slate-800"
          stateClassName="transition-colors"
        >
          <Button
            type="button"
            onClick={() => setActiveTab('details')}
            variant="ghost"
            disableVariantHover
            disableVariantTextColor
            borderClassName={
              activeTab === 'details' ? 'border-b-2 border-primary-600' : 'border-b-2 border-transparent'
            }
            textClassName={
              activeTab === 'details'
                ? 'text-sm font-medium text-primary-600 dark:text-primary-400'
                : 'text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }
            layoutClassName="shrink-0 whitespace-nowrap rounded-none py-3.5 shadow-none"
            stateClassName="transition-colors"
          >
            {t('detail.tabDetails')}
          </Button>
          <Button
            type="button"
            onClick={() => setActiveTab('refund')}
            variant="ghost"
            disableVariantHover
            disableVariantTextColor
            borderClassName={
              activeTab === 'refund' ? 'border-b-2 border-amber-600' : 'border-b-2 border-transparent'
            }
            textClassName={
              activeTab === 'refund'
                ? 'text-sm font-medium text-amber-600 dark:text-amber-400'
                : 'text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }
            layoutClassName="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-none py-3.5 shadow-none"
            stateClassName="transition-colors"
            leftIcon={<Wallet className="h-4 w-4" />}
          >
            {t('detail.tabRefund')}
            {Array.isArray(currentOrder.refunds) && currentOrder.refunds.length > 0 ? (
              <Box
                layoutClassName="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center px-1.5"
                roundedClassName="rounded-full"
                backgroundClassName="bg-amber-100 dark:bg-amber-900/40"
                textClassName="text-[10px] font-bold text-amber-700 dark:text-amber-300"
              >
                {currentOrder.refunds.length}
              </Box>
            ) : null}
          </Button>
          <Button
            type="button"
            onClick={() => setActiveTab('history')}
            variant="ghost"
            disableVariantHover
            disableVariantTextColor
            borderClassName={
              activeTab === 'history' ? 'border-b-2 border-sky-600' : 'border-b-2 border-transparent'
            }
            textClassName={
              activeTab === 'history'
                ? 'text-sm font-medium text-sky-600 dark:text-sky-400'
                : 'text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }
            layoutClassName="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-none py-3.5 shadow-none"
            stateClassName="transition-colors"
            leftIcon={<History className="h-4 w-4" />}
          >
            {t('detail.tabHistory')}
            {(() => {
              // Tổng số dòng lịch sử = sum(changes) trong order.history + số transactions ghi nhận
              const historyChangesCount = Array.isArray(currentOrder.history)
                ? currentOrder.history.reduce(
                    (sum: number, entry: any) => sum + (Array.isArray(entry?.changes) ? entry.changes.length : 0),
                    0,
                  )
                : 0;
              const total = historyChangesCount + relatedTransactions.length;
              return total > 0 ? (
                <Box
                  layoutClassName="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center px-1.5"
                  roundedClassName="rounded-full"
                  backgroundClassName="bg-sky-100 dark:bg-sky-900/40"
                  textClassName="text-[10px] font-bold text-sky-700 dark:text-sky-300"
                >
                  {total}
                </Box>
              ) : null;
            })()}
          </Button>
          {currentOrder.trackingNumber ? (
            <Button
              type="button"
              onClick={() => setActiveTab('tracking')}
              variant="ghost"
              disableVariantHover
              disableVariantTextColor
              borderClassName={
                activeTab === 'tracking' ? 'border-b-2 border-primary-600' : 'border-b-2 border-transparent'
              }
              textClassName={
                activeTab === 'tracking'
                  ? 'text-sm font-medium text-primary-600 dark:text-primary-400'
                  : 'text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }
              layoutClassName="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-none py-3.5 shadow-none"
              stateClassName="transition-colors"
              leftIcon={<Truck className="h-4 w-4" />}
            >
              Hành trình
            </Button>
          ) : null}
        </Box>

        <Box
          layoutClassName="flex-1 overflow-y-auto p-6"
          backgroundClassName="bg-slate-50/50 dark:bg-slate-900/50"
          stateClassName="transition-colors"
        >
            {activeTab === 'details' ? (
              <Box layoutClassName="space-y-6">
                <Box
                  layoutClassName="p-5"
                  backgroundClassName="bg-white dark:bg-slate-800"
                  roundedClassName="rounded-xl"
                  borderClassName="border border-slate-100 dark:border-slate-700"
                  shadowClassName="shadow-sm"
                  stateClassName="transition-colors"
                >
                  <Box layoutClassName="flex items-center justify-between mb-4">
                    <Heading level={3} textClassName="text-sm font-semibold text-slate-900 dark:text-white" layoutClassName="uppercase tracking-wide">{t('detail.customer')}</Heading>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Copy className="w-4 h-4" />}
                      onClick={handleCopyCustomer}
                    >
                      {t('detail.copyCustomer')}
                    </Button>
                  </Box>
                  <Box layoutClassName="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Box layoutClassName="space-y-3">
                      {currentOrder.customer.name && (
                        <Box layoutClassName="flex items-center gap-3">
                          <Box layoutClassName="p-2" backgroundClassName="bg-slate-100 dark:bg-slate-700" roundedClassName="rounded-lg" textClassName="text-slate-500 dark:text-slate-300">
                            <User className="w-4 h-4" />
                          </Box>
                          <Box layoutClassName="text-sm">
                            <Typography as="p" size="inherit" layoutClassName="font-medium" textClassName="text-slate-900 dark:text-white">{t('detail.customerName')}</Typography>
                            <Typography as="p" size="inherit" textClassName="text-slate-600 dark:text-slate-300">{currentOrder.customer.name}</Typography>
                          </Box>
                        </Box>
                      )}
                      {currentOrder.customer.email && (
                        <Box layoutClassName="flex items-center gap-3">
                           <Box layoutClassName="p-2" backgroundClassName="bg-slate-100 dark:bg-slate-700" roundedClassName="rounded-lg" textClassName="text-slate-500 dark:text-slate-300">
                             <Mail className="w-4 h-4" />
                           </Box>
                           <Box layoutClassName="text-sm">
                             <Typography as="p" size="inherit" layoutClassName="font-medium" textClassName="text-slate-900 dark:text-white">{t('detail.email')}</Typography>
                             <Typography as="span" size="inherit" textClassName="text-slate-600 dark:text-slate-300">{currentOrder.customer.email}</Typography>
                           </Box>
                        </Box>
                      )}
                      {currentOrder.customer.phone && (
                        <Box layoutClassName="flex items-center gap-3">
                           <Box layoutClassName="p-2" backgroundClassName="bg-slate-100 dark:bg-slate-700" roundedClassName="rounded-lg" textClassName="text-slate-500 dark:text-slate-300">
                             <Phone className="w-4 h-4" />
                           </Box>
                           <Box layoutClassName="text-sm">
                             <Typography as="p" size="inherit" layoutClassName="font-medium" textClassName="text-slate-900 dark:text-white">{t('detail.phone')}</Typography>
                             <Typography as="span" size="inherit" textClassName="text-slate-600 dark:text-slate-300">{currentOrder.customer.phone}</Typography>
                           </Box>
                        </Box>
                      )}
                    </Box>
                    <Box layoutClassName="flex items-start gap-3">
                      <Box layoutClassName="p-2" backgroundClassName="bg-slate-100 dark:bg-slate-700" roundedClassName="rounded-lg" textClassName="text-slate-500 dark:text-slate-300">
                        {!currentOrder.customer.address && currentOrder.deliveryType === DeliveryType.PICKUP ? (
                          <Store className="w-4 h-4" />
                        ) : !currentOrder.customer.address && currentOrder.deliveryType === DeliveryType.SHIP_PROVINCE ? (
                          <Globe className="w-4 h-4" />
                        ) : (
                          <MapPin className="w-4 h-4" />
                        )}
                      </Box>
                      <Box layoutClassName="text-sm">
                        <Typography as="p" size="inherit" layoutClassName="font-medium" textClassName="text-slate-900 dark:text-white">{t('detail.shippingAddress')}</Typography>
                        <Typography as="p" size="inherit" textClassName="text-slate-500 dark:text-slate-400">{currentOrder.customer.address || t(orderAddressFallbackKey(currentOrder.deliveryType))}</Typography>
                        {currentOrder.customer.city && <Typography as="p" size="inherit" textClassName="text-slate-500 dark:text-slate-400">{currentOrder.customer.city}, {currentOrder.customer.country}</Typography>}
                      </Box>
                    </Box>
                    {/* Địa chỉ SPX đã "làm mịn" — chỉ đơn ship tỉnh (dùng để xuất file tạo đơn SPX).
                        2 khối: 3 cấp (sheet "địa chỉ cũ", SPX đang đọc) + 2 cấp (sheet "địa chỉ mới"). */}
                    {currentOrder.deliveryType === DeliveryType.SHIP_PROVINCE && (
                      <>
                        <SpxAddressPanel order={currentOrder} onUpdated={setLocalOrder} />
                        <Spx2AddressPanel order={currentOrder} onUpdated={setLocalOrder} />
                      </>
                    )}
                  </Box>
                </Box>

                {/* Note Section - Separate card */}
                <Box
                  layoutClassName="p-5"
                  backgroundClassName="bg-white dark:bg-slate-800"
                  roundedClassName="rounded-xl"
                  borderClassName="border border-slate-100 dark:border-slate-700"
                  shadowClassName="shadow-sm"
                  stateClassName="transition-colors"
                >
                  <Heading level={3} textClassName="text-sm font-semibold text-slate-900 dark:text-white" layoutClassName="mb-4 flex items-center gap-2 uppercase tracking-wide">
                    {t('detail.note')}
                  </Heading>
                  {currentOrder.note ? (
                    <Box
                      layoutClassName="p-4"
                      backgroundClassName="bg-slate-50 dark:bg-slate-700/30"
                      borderClassName="border border-slate-100 dark:border-slate-700"
                      roundedClassName="rounded-lg"
                    >
                      <Typography as="p" size="sm" layoutClassName="font-medium leading-relaxed whitespace-pre-wrap" textClassName="text-slate-900 dark:text-white">
                        {currentOrder.note}
                      </Typography>
                    </Box>
                  ) : (
                    <Box
                      layoutClassName="p-4"
                      backgroundClassName="bg-slate-50 dark:bg-slate-700/30"
                      borderClassName="border border-slate-100 dark:border-slate-700"
                      roundedClassName="rounded-lg"
                    >
                      <Typography as="p" size="sm" layoutClassName="italic" textClassName="text-slate-400 dark:text-slate-500">
                        {t('detail.noNote') || 'No note provided'}
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Box
                  layoutClassName="p-5"
                  backgroundClassName="bg-white dark:bg-slate-800"
                  roundedClassName="rounded-xl"
                  borderClassName="border border-slate-100 dark:border-slate-700"
                  shadowClassName="shadow-sm"
                  stateClassName="transition-colors"
                >
                   <Heading level={3} textClassName="text-sm font-semibold text-slate-900 dark:text-white" layoutClassName="mb-4 uppercase tracking-wide">{t('detail.items')}</Heading>
                   <Box layoutClassName="space-y-4">
                     {currentOrder.items.flatMap((item) => {
                       const product = products.find((p) => p.id === item.productId);
                       const flavors = item.flavors ?? [];
                       // Sản phẩm tính giá theo vị + nhiều vị → tách mỗi vị 1 dòng item riêng.
                       // Mix (bếp tự phối) → không tách, rơi xuống dòng mặc định hiện chip "Mix".
                       if (product && productUsesFlavorPricing(product) && flavors.length > 0 && !isMixFlavors(flavors)) {
                         // Gom vị lặp → mỗi vị 1 dòng, SL = số cái vị đó, giá = giá vị × SL.
                         return groupFlavors(flavors).map(({ name: fl, qty }) => {
                           const variant = product.flavorVariants?.find((v) => v.name === fl);
                           const img = variant?.image || item.image;
                           const color = variant?.color || '#64748b';
                           const lineTotal = (variant?.price ?? 0) * qty;
                           return (
                             <Box key={`${item.id}-${fl}`} layoutClassName="flex items-center gap-4 py-2">
                               <Box layoutClassName="h-16 w-16 shrink-0 overflow-hidden" roundedClassName="rounded-lg" backgroundClassName="bg-slate-100 dark:bg-slate-700">
                                 <Image src={img} alt={fl} layoutClassName="h-full w-full object-cover" />
                               </Box>
                               <Box layoutClassName="min-w-0 flex-1">
                                 <Heading level={4} textClassName="text-sm font-medium text-slate-900 dark:text-white">{item.name} · {fl}</Heading>
                                 <Box layoutClassName="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5" roundedClassName="rounded-full" borderClassName="border" style={{ borderColor: color + '80', backgroundColor: color + '26' }}>
                                   <Box layoutClassName="h-2 w-2 shrink-0" roundedClassName="rounded-full" style={{ backgroundColor: color }} />
                                   <Typography as="span" size="xs" layoutClassName="font-medium" textClassName="text-slate-700 dark:text-slate-200">{fl}</Typography>
                                 </Box>
                                 {item.packagingOption ? (
                                   <Box layoutClassName="mt-1 inline-flex items-center gap-1 px-2 py-0.5" roundedClassName="rounded-full" backgroundClassName="bg-amber-50 dark:bg-amber-900/30" borderClassName="border border-amber-200 dark:border-amber-800">
                                     <Typography as="span" size="xs" layoutClassName="font-medium" textClassName="text-amber-700 dark:text-amber-300">📦 {item.packagingOption}</Typography>
                                   </Box>
                                 ) : null}
                               </Box>
                               <Box layoutClassName="text-right">
                                 <Typography as="p" size="sm" layoutClassName="font-medium" textClassName="text-slate-900 dark:text-white">{formatVND(lineTotal)}</Typography>
                                 <Typography as="p" size="xs" textClassName="text-slate-500 dark:text-slate-400">Qty: {qty}</Typography>
                               </Box>
                             </Box>
                           );
                         });
                       }
                       // Có sizeCounts.units → mỗi đơn vị (combo/lẻ) 1 dòng kèm VỊ RIÊNG.
                       const scs = item.sizeCounts ?? [];
                       if (product && scs.some((s) => s.units && s.units.length)) {
                         return scs.flatMap((sc) => {
                           const per = sizeCount(product, sc.name) ?? 1;
                           const price = product.sizes?.find((z) => z.name === sc.name)?.price ?? 0;
                           const img = sizeImage(product, sc.name) || item.image;
                           return (sc.units ?? []).map((unit, u) => (
                             <Box key={`${item.id}-${sc.name}-${u}`} layoutClassName="flex items-center gap-4 py-2">
                               <Box layoutClassName="h-16 w-16 shrink-0 overflow-hidden" roundedClassName="rounded-lg" backgroundClassName="bg-slate-100 dark:bg-slate-700">
                                 <Image src={img} alt={sc.name} layoutClassName="h-full w-full object-cover" />
                               </Box>
                               <Box layoutClassName="min-w-0 flex-1">
                                 <Heading level={4} textClassName="text-sm font-medium text-slate-900 dark:text-white">{item.name} · {sc.name}{sc.qty > 1 ? ` #${u + 1}` : ''}</Heading>
                                 {unit.length ? (
                                   <Box layoutClassName="mt-1 flex flex-wrap gap-1">
                                     {groupFlavors(unit).map(({ name: fl, qty }) => {
                                       const color = flavorVariantColor(product, fl);
                                       return (
                                         <Box key={fl} layoutClassName="inline-flex items-center gap-1 px-2 py-0.5" roundedClassName="rounded-full" borderClassName="border" style={{ borderColor: color + '80', backgroundColor: color + '26' }}>
                                           <Box layoutClassName="h-2 w-2 shrink-0" roundedClassName="rounded-full" style={{ backgroundColor: color }} />
                                           <Typography as="span" size="xs" layoutClassName="font-medium" textClassName="text-slate-700 dark:text-slate-200">{fl}{qty > 1 ? ` ×${qty}` : ''}</Typography>
                                         </Box>
                                       );
                                     })}
                                   </Box>
                                 ) : null}
                                 {item.packagingOption ? (
                                   <Box layoutClassName="mt-1 inline-flex items-center gap-1 px-2 py-0.5" roundedClassName="rounded-full" backgroundClassName="bg-amber-50 dark:bg-amber-900/30" borderClassName="border border-amber-200 dark:border-amber-800">
                                     <Typography as="span" size="xs" layoutClassName="font-medium" textClassName="text-amber-700 dark:text-amber-300">📦 {item.packagingOption}</Typography>
                                   </Box>
                                 ) : null}
                               </Box>
                               <Box layoutClassName="text-right">
                                 <Typography as="p" size="sm" layoutClassName="font-medium" textClassName="text-slate-900 dark:text-white">{formatVND(price)}</Typography>
                                 <Typography as="p" size="xs" textClassName="text-slate-500 dark:text-slate-400">Qty: 1</Typography>
                               </Box>
                             </Box>
                           ));
                         });
                       }
                       // Mặc định: 1 dòng (kèm size + vị dạng chip nếu có).
                       return [(
                         <Box key={item.id} layoutClassName="flex items-center gap-4 py-2">
                           <Box layoutClassName="h-16 w-16 shrink-0 overflow-hidden" roundedClassName="rounded-lg" backgroundClassName="bg-slate-100 dark:bg-slate-700">
                             <Image src={item.image || product?.image || ''} alt={item.name} layoutClassName="h-full w-full object-cover" />
                           </Box>
                           <Box layoutClassName="min-w-0 flex-1">
                             <Heading level={4} textClassName="text-sm font-medium text-slate-900 dark:text-white">{item.name}{sizeCountsLabel(item.sizeCounts) ? ` · ${sizeCountsLabel(item.sizeCounts)}` : item.size ? ` · ${item.size}` : ''}</Heading>
                             {flavors.length ? (
                               <Box layoutClassName="mt-1 flex flex-wrap gap-1">
                                 {groupFlavors(flavors).map(({ name: fl, qty }) => {
                                   const color = product ? flavorVariantColor(product, fl) : '#64748b';
                                   return (
                                     <Box key={fl} layoutClassName="inline-flex items-center gap-1 px-2 py-0.5" roundedClassName="rounded-full" borderClassName="border" style={{ borderColor: color + '80', backgroundColor: color + '26' }}>
                                       <Box layoutClassName="h-2 w-2 shrink-0" roundedClassName="rounded-full" style={{ backgroundColor: color }} />
                                       <Typography as="span" size="xs" layoutClassName="font-medium" textClassName="text-slate-700 dark:text-slate-200">{fl}{qty > 1 ? ` ×${qty}` : ''}</Typography>
                                     </Box>
                                   );
                                 })}
                               </Box>
                             ) : null}
                             {item.packagingOption ? (
                               <Box layoutClassName="mt-1 inline-flex items-center gap-1 px-2 py-0.5" roundedClassName="rounded-full" backgroundClassName="bg-amber-50 dark:bg-amber-900/30" borderClassName="border border-amber-200 dark:border-amber-800">
                                 <Typography as="span" size="xs" layoutClassName="font-medium" textClassName="text-amber-700 dark:text-amber-300">📦 {item.packagingOption}</Typography>
                               </Box>
                             ) : null}
                           </Box>
                           <Box layoutClassName="text-right">
                             <Typography as="p" size="sm" layoutClassName="font-medium" textClassName="text-slate-900 dark:text-white">{formatVND(calculateLineItemTotal(item))}</Typography>
                             <Typography as="p" size="xs" textClassName="text-slate-500 dark:text-slate-400">Qty: {item.quantity}</Typography>
                           </Box>
                         </Box>
                       )];
                     })}
                   </Box>

                   {currentOrder.decorations && currentOrder.decorations.length > 0 ? (
                     <Box layoutClassName="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                       <Typography as="p" size="xs" layoutClassName="mb-2 font-semibold uppercase tracking-wide" textClassName="text-slate-400 dark:text-slate-500">Trang trí thêm</Typography>
                       <Box layoutClassName="space-y-1.5">
                         {currentOrder.decorations.map((d, idx) => (
                           <Box key={`${d.materialId}-${idx}`} layoutClassName="flex items-center justify-between gap-2">
                             <Typography as="span" size="sm" textClassName="text-slate-700 dark:text-slate-300">{d.quantity}× {d.name}</Typography>
                             <Typography as="span" size="sm" layoutClassName="font-medium" textClassName="text-slate-900 dark:text-white">{formatVND(d.price * d.quantity)}</Typography>
                           </Box>
                         ))}
                       </Box>
                     </Box>
                   ) : null}

                   {currentOrder.surchargeAmount && currentOrder.surchargeAmount > 0 ? (
                     <Box layoutClassName="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                       <Typography as="p" size="xs" layoutClassName="mb-2 font-semibold uppercase tracking-wide" textClassName="text-slate-400 dark:text-slate-500">{t('detail.surcharge')}</Typography>
                       <Box layoutClassName="space-y-1.5">
                         {surchargeRows.map((s, i) => (
                           <Box key={i} layoutClassName="flex items-center justify-between gap-2">
                             <Badge
                               size="sm"
                               borderClassName="border-primary-300 dark:border-primary-700"
                               backgroundClassName="bg-white dark:bg-slate-800"
                               textClassName="text-primary-700 dark:text-primary-300"
                             >
                               <Sparkles className="h-3 w-3" /> {surchargeTagLabel(s.tag, surchargeTags)}
                             </Badge>
                             <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-900 dark:text-white">{formatVND(s.amount)}</Typography>
                           </Box>
                         ))}
                       </Box>
                       <Typography as="p" size="xs" layoutClassName="mt-1.5" textClassName="text-slate-400 dark:text-slate-500">
                         {t('detail.surchargeSplit')}: {allocateSurcharge(currentOrder.surchargeAmount, currentOrder.items).map((share, idx) => (
                           `${currentOrder.items[idx]?.name ?? ''} +${formatVND(share)}`
                         )).join(' · ')}
                       </Typography>
                     </Box>
                   ) : null}

                   <Box layoutClassName="mt-4 pt-4 space-y-2" borderClassName="border-t border-slate-100 dark:border-slate-700">
                     <Box layoutClassName="flex justify-between items-center" textClassName="text-sm text-slate-500 dark:text-slate-400">
                       <Typography as="span" size="inherit">{t('detail.subtotal')}</Typography>
                       <Typography as="span" size="inherit">{formatVND(subtotal)}</Typography>
                     </Box>
                     {surchargeRows.map((s, i) => (
                       <Box key={i} layoutClassName="flex items-center justify-between" textClassName="text-sm text-primary-600 dark:text-primary-400">
                         <Typography as="span" size="sm">
                           {t('detail.surcharge')}
                           <Typography as="span" size="xs" layoutClassName="ml-1.5" textClassName="text-slate-400 dark:text-slate-500">· {surchargeTagLabel(s.tag, surchargeTags)}</Typography>
                         </Typography>
                         <Typography as="span" size="sm">+{formatVND(s.amount)}</Typography>
                       </Box>
                     ))}
                     <Box layoutClassName="flex justify-between items-center" textClassName="text-sm text-slate-500 dark:text-slate-400">
                       <Typography as="span" size="inherit">{t('detail.shipping')}</Typography>
                       <Typography as="span" size="inherit">{formatVND(shippingCost)}</Typography>
                     </Box>
                     {currentOrder.decorations && currentOrder.decorations.length > 0 ? (
                       <Box layoutClassName="flex items-center justify-between" textClassName="text-sm text-slate-500 dark:text-slate-400">
                         <Typography as="span" size="sm">Trang trí</Typography>
                         <Typography as="span" size="sm">{formatVND(currentOrder.decorations.reduce((s, d) => s + d.price * d.quantity, 0))}</Typography>
                       </Box>
                     ) : null}
                     {currentOrder.discountAmount && currentOrder.discountAmount > 0 ? (
                       <Box layoutClassName="flex items-start justify-between gap-2">
                         <Box layoutClassName="min-w-0">
                           <Typography as="span" size="sm" layoutClassName="font-medium" textClassName="text-emerald-600 dark:text-emerald-400">Khuyến mãi</Typography>
                           {(currentOrder.appliedPromotions ?? []).map((ap) => (
                             <Typography key={ap.promotionId} as="p" size="xs" textClassName="text-slate-500 dark:text-slate-400">• {ap.name}</Typography>
                           ))}
                         </Box>
                         <Typography as="span" size="sm" layoutClassName="shrink-0 font-medium" textClassName="text-emerald-600 dark:text-emerald-400">−{formatVND(currentOrder.discountAmount)}</Typography>
                       </Box>
                     ) : null}
                     {currentOrder.manualDiscountAmount && currentOrder.manualDiscountAmount > 0 ? (
                       <Box layoutClassName="flex items-start justify-between gap-2">
                         <Box layoutClassName="min-w-0">
                           <Typography as="span" size="sm" layoutClassName="font-medium" textClassName="text-rose-600 dark:text-rose-400">Giảm giá</Typography>
                           {(currentOrder.discounts ?? []).filter((d) => Number(d.amount) > 0).map((d, idx) => (
                             <Typography key={idx} as="p" size="xs" textClassName="text-slate-500 dark:text-slate-400">• {d.note?.trim() || 'Giảm giá'} · −{formatVND(Number(d.amount))}</Typography>
                           ))}
                         </Box>
                         <Typography as="span" size="sm" layoutClassName="shrink-0 font-medium" textClassName="text-rose-600 dark:text-rose-400">−{formatVND(currentOrder.manualDiscountAmount)}</Typography>
                       </Box>
                     ) : null}
                     <Box layoutClassName="flex justify-between items-center pt-2" borderClassName="border-t border-slate-50 dark:border-slate-700">
                       <Typography as="span" size="inherit" layoutClassName="font-medium" textClassName="text-slate-900 dark:text-white">{t('detail.total')}</Typography>
                       <Typography as="span" size="lg" layoutClassName="font-bold" textClassName="text-primary-600 dark:text-primary-400">{formatVND(finalTotal)}</Typography>
                     </Box>
                   </Box>
                </Box>

                {/* STATUS STEPPER CARD */}
                <Box
                  layoutClassName="p-5"
                  backgroundClassName="bg-white dark:bg-slate-800"
                  roundedClassName="rounded-xl"
                  borderClassName="border border-slate-100 dark:border-slate-700"
                  shadowClassName="shadow-sm"
                  stateClassName="transition-colors"
                >
                  <Heading level={3} textClassName="text-sm font-semibold text-slate-900 dark:text-white" layoutClassName="mb-4 flex items-center gap-2 uppercase tracking-wide">
                    <StickyNote className="w-4 h-4" />
                    {t('orders.tableStatus')}
                  </Heading>

                  {currentOrder.status === OrderStatus.CANCELLED || currentOrder.status === OrderStatus.RETURNED ? (
                    /* Terminal state banner */
                    <Box
                      layoutClassName="flex flex-col items-center gap-3 p-5"
                      roundedClassName="rounded-xl"
                      borderClassName={
                        currentOrder.status === OrderStatus.CANCELLED
                          ? 'border border-red-200 dark:border-red-800'
                          : 'border border-primary-200 dark:border-primary-800'
                      }
                      backgroundClassName={
                        currentOrder.status === OrderStatus.CANCELLED
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : 'bg-primary-50 dark:bg-primary-900/20'
                      }
                    >
                      <Typography
                        as="span"
                        size="base"
                        layoutClassName="font-bold"
                        textClassName={
                          currentOrder.status === OrderStatus.CANCELLED
                            ? 'text-red-700 dark:text-red-200'
                            : 'text-primary-700 dark:text-primary-200'
                        }
                      >
                        {t(`orders.statusLabels.${currentOrder.status}`)}
                      </Typography>
                      <Typography as="span" size="xs" layoutClassName="text-center" textClassName="text-slate-500 dark:text-slate-400">
                        {currentOrder.status === OrderStatus.CANCELLED
                          ? 'Đơn này đã bị huỷ. Bấm "Khôi phục" để đưa về trạng thái Chờ xử lý.'
                          : 'Đơn này đã được trả hàng. Bấm "Khôi phục" để đưa về trạng thái Chờ xử lý.'}
                      </Typography>
                      {canEdit ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disableVariantHover
                          disableVariantTextColor
                          onClick={() => handleUpdateField({ status: OrderStatus.PENDING }, setUpdatingStatus)}
                          disabled={updatingStatus}
                          sizeClassName="px-4 py-2"
                          textClassName="text-sm font-semibold text-slate-700 dark:text-slate-200"
                          backgroundClassName="bg-white dark:bg-slate-800"
                          borderClassName="border border-slate-300 dark:border-slate-600"
                          hoverClassName="hover:bg-slate-50 dark:hover:bg-slate-700"
                          roundedClassName="rounded-lg"
                          shadowClassName=""
                          stateClassName="mt-1 transition-colors"
                        >
                          Khôi phục đơn
                        </Button>
                      ) : null}
                    </Box>
                  ) : (
                    /* Stepper for happy path: PENDING -> PROCESSING -> DELIVERED */
                    (() => {
                      const HAPPY_PATH = [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.DELIVERED];
                      const currentIdx = HAPPY_PATH.indexOf(currentOrder.status);
                      const nextStatus = currentIdx >= 0 && currentIdx < HAPPY_PATH.length - 1 ? HAPPY_PATH[currentIdx + 1] : null;
                      return (
                        <>
                          <Box layoutClassName="flex items-center justify-between gap-1 sm:gap-2">
                            {HAPPY_PATH.map((step, idx, arr) => {
                              const isActive = currentOrder.status === step;
                              const isPast = currentIdx > idx;
                              const isReached = isActive || isPast;
                              const baseCircle = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all';
                              const circleCls = isReached
                                ? 'bg-primary-500 text-white shadow-sm shadow-primary-300 dark:bg-primary-500 dark:shadow-none'
                                : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
                              const labelCls = isActive
                                ? 'text-slate-900 font-bold dark:text-white'
                                : isPast
                                  ? 'text-slate-600 font-medium dark:text-slate-300'
                                  : 'text-slate-400 dark:text-slate-500';
                              return (
                                <React.Fragment key={step}>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    disableVariantHover
                                    disableVariantTextColor
                                    disabled={!canEdit || updatingStatus}
                                    onClick={() => handleUpdateField({ status: step }, setUpdatingStatus)}
                                    layoutClassName="group flex flex-col items-center gap-1.5"
                                    sizeClassName=""
                                    shadowClassName=""
                                    backgroundClassName=""
                                    borderClassName=""
                                    roundedClassName=""
                                    stateClassName={!canEdit || updatingStatus ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                                  >
                                    <Typography as="span" size="inherit" layoutClassName={baseCircle} stateClassName={circleCls}>
                                      {idx + 1}
                                    </Typography>
                                    <Typography as="span" size="inherit" layoutClassName="text-[11px] sm:text-xs text-center whitespace-nowrap" stateClassName={labelCls}>
                                      {t(`orders.statusLabels.${step}`)}
                                    </Typography>
                                  </Button>
                                  {idx < arr.length - 1 ? (
                                    <Box
                                      layoutClassName="mb-5 h-1 flex-1"
                                      roundedClassName="rounded-full"
                                      backgroundClassName={isPast ? 'bg-primary-500 dark:bg-primary-500' : 'bg-slate-200 dark:bg-slate-700'}
                                    />
                                  ) : null}
                                </React.Fragment>
                              );
                            })}
                          </Box>

                          {canEdit ? (
                            <Box
                              layoutClassName="mt-5 flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between"
                              borderClassName="border-t border-slate-100 dark:border-slate-700"
                            >
                              <Box layoutClassName="flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  disableVariantHover
                                  disableVariantTextColor
                                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                                  onClick={() => setCrMode('cancel')}
                                  disabled={updatingStatus}
                                  sizeClassName="px-3 py-1.5"
                                  textClassName="text-xs font-semibold text-red-700 dark:text-red-200"
                                  backgroundClassName="bg-red-50 dark:bg-red-900/20"
                                  borderClassName="border border-red-200 dark:border-red-800"
                                  hoverClassName="hover:bg-red-100 dark:hover:bg-red-900/30"
                                  roundedClassName="rounded-lg"
                                  shadowClassName=""
                                  stateClassName="transition-colors"
                                >
                                  Huỷ đơn
                                </Button>
                                {currentOrder.paymentStatus === PaymentStatus.PAID ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    disableVariantHover
                                    disableVariantTextColor
                                    leftIcon={<Wallet className="h-3.5 w-3.5" />}
                                    onClick={() => setCrMode('refund')}
                                    disabled={updatingStatus}
                                    sizeClassName="px-3 py-1.5"
                                    textClassName="text-xs font-semibold text-amber-700 dark:text-amber-200"
                                    backgroundClassName="bg-amber-50 dark:bg-amber-900/20"
                                    borderClassName="border border-amber-200 dark:border-amber-800"
                                    hoverClassName="hover:bg-amber-100 dark:hover:bg-amber-900/30"
                                    roundedClassName="rounded-lg"
                                    shadowClassName=""
                                    stateClassName="transition-colors"
                                  >
                                    Hoàn tiền
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="secondary"
                                  disableVariantHover
                                  disableVariantTextColor
                                  onClick={() => handleUpdateField({ status: OrderStatus.RETURNED }, setUpdatingStatus)}
                                  disabled={updatingStatus}
                                  sizeClassName="px-3 py-1.5"
                                  textClassName="text-xs font-semibold text-slate-600 dark:text-slate-300"
                                  backgroundClassName="bg-white dark:bg-slate-800"
                                  borderClassName="border border-slate-200 dark:border-slate-600"
                                  hoverClassName="hover:bg-slate-50 dark:hover:bg-slate-700"
                                  roundedClassName="rounded-lg"
                                  shadowClassName=""
                                  stateClassName="transition-colors"
                                >
                                  Trả hàng
                                </Button>
                              </Box>
                              {nextStatus ? (
                                <Button
                                  type="button"
                                  variant="primary"
                                  disableVariantHover
                                  onClick={() => handleUpdateField({ status: nextStatus }, setUpdatingStatus)}
                                  disabled={updatingStatus}
                                  sizeClassName="px-4 py-2"
                                  textClassName="text-sm font-semibold text-white"
                                  backgroundClassName="bg-primary-500 dark:bg-primary-500"
                                  hoverClassName="hover:bg-primary-600 dark:hover:bg-primary-600"
                                  shadowClassName="shadow-sm shadow-primary-300 dark:shadow-none"
                                  roundedClassName="rounded-lg"
                                  stateClassName="transition-colors"
                                >
                                  Chuyển sang {t(`orders.statusLabels.${nextStatus}`)}
                                  <Typography as="span" size="inherit" aria-hidden="true">→</Typography>
                                </Button>
                              ) : (
                                <Box
                                  layoutClassName="inline-flex items-center justify-center gap-2 px-4 py-2"
                                  roundedClassName="rounded-lg"
                                  backgroundClassName="bg-emerald-50 dark:bg-emerald-900/30"
                                  textClassName="text-sm font-semibold text-emerald-700 dark:text-emerald-200"
                                >
                                  ✓ Đơn đã hoàn tất
                                </Box>
                              )}
                            </Box>
                          ) : null}
                        </>
                      );
                    })()
                  )}
                </Box>

                <Box
                  layoutClassName="p-5"
                  backgroundClassName="bg-white dark:bg-slate-800"
                  roundedClassName="rounded-xl"
                  borderClassName="border border-slate-100 dark:border-slate-700"
                  shadowClassName="shadow-sm"
                  stateClassName="transition-colors"
                >
                   <Heading level={3} textClassName="text-sm font-semibold text-slate-900 dark:text-white" layoutClassName="mb-4 uppercase tracking-wide">{t('detail.fulfillment')}</Heading>
                   <Box layoutClassName="flex flex-col gap-3">
                      <Box
                        layoutClassName="flex justify-between items-center p-3"
                        backgroundClassName="bg-slate-50 dark:bg-slate-700/50"
                        roundedClassName="rounded-lg"
                        borderClassName="border border-slate-100 dark:border-slate-700"
                      >
                        <Box layoutClassName="flex items-center gap-3">
                          <Truck className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <Typography as="span" size="sm" textClassName="text-slate-600 dark:text-slate-300">Order Number</Typography>
                        </Box>
                        <Typography as="span" size="sm" layoutClassName="font-mono font-medium" textClassName="text-slate-900 dark:text-white">{currentOrder.orderNumber || t('detail.notAssigned')}</Typography>
                      </Box>
                      <Box
                        layoutClassName="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-3"
                        backgroundClassName="bg-slate-50 dark:bg-slate-700/50"
                        roundedClassName="rounded-lg"
                        borderClassName="border border-slate-100 dark:border-slate-700"
                      >
                        <Box layoutClassName="flex items-center gap-3">
                          <CreditCard className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <Typography as="span" size="sm" textClassName="text-slate-600 dark:text-slate-300">{t('detail.payment')}</Typography>
                        </Box>
                        <Box layoutClassName="flex items-center gap-2 flex-wrap">
                          {[PaymentStatus.PAID, PaymentStatus.UNPAID].map((status) => {
                            const isActive = currentOrder.paymentStatus === status;
                            return (
                              <Button
                                key={status}
                                type="button"
                                variant="ghost"
                                disableVariantHover
                                disableVariantTextColor
                                onClick={() => handleUpdateField({ paymentStatus: status }, setUpdatingPayment)}
                                disabled={!canEdit || updatingPayment}
                                sizeClassName="px-3 py-1"
                                roundedClassName="rounded-full"
                                shadowClassName=""
                                stateClassName="transition-all whitespace-nowrap"
                                textClassName={isActive
                                  ? (status === PaymentStatus.PAID
                                      ? 'text-xs font-bold uppercase text-emerald-700 dark:text-emerald-200'
                                      : 'text-xs font-bold uppercase text-red-700 dark:text-red-200')
                                  : 'text-xs font-bold uppercase text-slate-500 dark:text-slate-300'}
                                backgroundClassName={isActive
                                  ? (status === PaymentStatus.PAID
                                      ? 'bg-emerald-50 dark:bg-emerald-900/30'
                                      : 'bg-red-50 dark:bg-red-900/30')
                                  : 'bg-white dark:bg-slate-800'}
                                borderClassName={isActive
                                  ? (status === PaymentStatus.PAID
                                      ? 'border border-emerald-300 dark:border-emerald-700'
                                      : 'border border-red-300 dark:border-red-700')
                                  : 'border border-slate-200 dark:border-slate-600'}
                                hoverClassName={isActive ? '' : (status === PaymentStatus.PAID
                                  ? 'hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:border-emerald-700'
                                  : 'hover:border-red-300 hover:bg-red-50/50 dark:hover:border-red-700')}
                              >
                                {t(`orders.paymentStatusLabels.${status}`)}
                              </Button>
                            );
                          })}
                        </Box>
                      </Box>
                      <Box
                        layoutClassName="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-3"
                        backgroundClassName="bg-slate-50 dark:bg-slate-700/50"
                        roundedClassName="rounded-lg"
                        borderClassName="border border-slate-100 dark:border-slate-700"
                      >
                        <Box layoutClassName="flex items-center gap-3">
                          <Wallet className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <Typography as="span" size="sm" textClassName="text-slate-600 dark:text-slate-300">{t('detail.paymentMethod')}</Typography>
                        </Box>
                        <Box layoutClassName="flex items-center gap-2 flex-wrap">
                          {[PaymentMethod.BANKING, PaymentMethod.CASH].map((method) => {
                            const isActive = currentOrder.paymentMethod === method;
                            return (
                              <Button
                                key={method}
                                type="button"
                                variant="ghost"
                                disableVariantHover
                                disableVariantTextColor
                                onClick={() => handleUpdateField({ paymentMethod: method }, setUpdatingPayment)}
                                disabled={!canEdit || updatingPayment}
                                sizeClassName="px-3 py-1"
                                roundedClassName="rounded-full"
                                shadowClassName=""
                                stateClassName="transition-all whitespace-nowrap"
                                textClassName={isActive
                                  ? 'text-xs font-semibold text-blue-600 dark:text-blue-300'
                                  : 'text-xs font-semibold text-slate-500 dark:text-slate-300'}
                                backgroundClassName={isActive
                                  ? 'bg-blue-50 dark:bg-blue-900/20'
                                  : 'bg-white dark:bg-slate-800'}
                                borderClassName={isActive
                                  ? 'border border-blue-200 dark:border-blue-800'
                                  : 'border border-slate-200 dark:border-slate-600'}
                                hoverClassName={isActive ? '' : 'hover:border-blue-300'}
                              >
                                {method === PaymentMethod.BANKING ? t('paymentMethod.banking') : t('paymentMethod.cash')}
                              </Button>
                            );
                          })}
                        </Box>
                      </Box>
                      {/* Delivery type row */}
                      <Box
                        layoutClassName="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-3"
                        backgroundClassName="bg-slate-50 dark:bg-slate-700/50"
                        roundedClassName="rounded-lg"
                        borderClassName="border border-slate-100 dark:border-slate-700"
                      >
                        <Box layoutClassName="flex items-center gap-3">
                          {currentOrder.deliveryType === DeliveryType.PICKUP
                            ? <Store className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            : currentOrder.deliveryType === DeliveryType.SHIP_PROVINCE
                              ? <Globe className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                              : <Truck className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
                          <Typography as="span" size="sm" textClassName="text-slate-600 dark:text-slate-300">{t('deliveryType.label')}</Typography>
                        </Box>
                        <Box layoutClassName="flex items-center gap-2 flex-wrap">
                          {([
                            { dt: DeliveryType.SHIP,          label: t('deliveryType.ship') },
                            { dt: DeliveryType.SHIP_PROVINCE,  label: t('deliveryType.shipProvince') },
                            { dt: DeliveryType.PICKUP,         label: t('deliveryType.pickup') },
                          ]).map(({ dt, label }) => {
                            const isActive = (currentOrder.deliveryType ?? DeliveryType.SHIP) === dt;
                            return (
                              <Button
                                key={dt}
                                type="button"
                                variant="ghost"
                                disableVariantHover
                                disableVariantTextColor
                                onClick={() => handleUpdateField({ deliveryType: dt }, setUpdatingPayment)}
                                disabled={!canEdit || updatingPayment}
                                sizeClassName="px-3 py-1"
                                roundedClassName="rounded-full"
                                shadowClassName=""
                                stateClassName="transition-all whitespace-nowrap"
                                textClassName={isActive
                                  ? 'text-xs font-semibold text-primary-700 dark:text-primary-200'
                                  : 'text-xs font-semibold text-slate-500 dark:text-slate-300'}
                                backgroundClassName={isActive
                                  ? 'bg-primary-50 dark:bg-primary-900/30'
                                  : 'bg-white dark:bg-slate-800'}
                                borderClassName={isActive
                                  ? 'border border-primary-300 dark:border-primary-700'
                                  : 'border border-slate-200 dark:border-slate-600'}
                                hoverClassName={isActive ? '' : 'hover:border-primary-300'}
                              >
                                {label}
                              </Button>
                            );
                          })}
                        </Box>
                      </Box>

                      <Box
                        layoutClassName="flex justify-between items-center p-3"
                        backgroundClassName="bg-slate-50 dark:bg-slate-700/50"
                        roundedClassName="rounded-lg"
                        borderClassName="border border-slate-100 dark:border-slate-700"
                      >
                        <Box layoutClassName="flex items-center gap-3">
                          <Receipt className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <Typography as="span" size="sm" textClassName="text-slate-600 dark:text-slate-300">{t('detail.transactionNumber')}</Typography>
                        </Box>
                        <Typography as="span" size="sm" layoutClassName="font-mono font-medium" textClassName="text-slate-900 dark:text-white">
                            {currentOrder.sepayId ? `#${currentOrder.sepayId}` : t('detail.notAssigned')}
                        </Typography>
                      </Box>
                   </Box>
                </Box>

                {/* Payment QR Section — gộp QR cọc + còn lại vào 1 section (bỏ toggle tab) */}
                {qrAccount && qrBlocks.length > 0 ? (
                  <Box
                    layoutClassName="p-5 animate-fade-in"
                    backgroundClassName="bg-white dark:bg-slate-800"
                    roundedClassName="rounded-xl"
                    borderClassName="border border-slate-100 dark:border-slate-700"
                    shadowClassName="shadow-sm"
                    stateClassName="transition-colors"
                  >
                     <Heading level={3} textClassName="text-sm font-semibold text-slate-900 dark:text-white" layoutClassName="mb-4 uppercase tracking-wide">{t('qr.sectionTitle')}</Heading>
                     <Box layoutClassName="space-y-4">
                       {qrBlocks.map((blk) => {
                         const blkUrl = buildQrUrl(blk.amount, blk.isDeposit);
                         const blkDes = `${blk.isDeposit ? 'C' : ''}${currentOrder.orderNumber}`;
                         return (
                     <Box
                       key={blk.key}
                       layoutClassName="p-4 flex flex-col sm:flex-row gap-4 items-center sm:items-start"
                       backgroundClassName="bg-blue-50 dark:bg-blue-900/20"
                       borderClassName="border border-blue-100 dark:border-blue-800"
                       roundedClassName="rounded-xl"
                     >
                        <Box
                          layoutClassName="shrink-0 p-2"
                          backgroundClassName="bg-white"
                          roundedClassName="rounded-lg"
                          borderClassName="border border-slate-200"
                          shadowClassName="shadow-sm"
                        >
                            <Image
                              src={blkUrl}
                              alt="Payment QR"
                              layoutClassName="w-32 h-32 object-contain"
                            />
                        </Box>

                        <Box layoutClassName="flex-1 space-y-2 w-full text-center sm:text-left">
                            <Box layoutClassName="flex items-center justify-center sm:justify-start gap-2 font-semibold" textClassName="text-blue-800 dark:text-blue-300">
                              <QrCode className="w-4 h-4" />
                              <Typography as="span" size="inherit">{blk.label || t('qr.title')}</Typography>
                            </Box>

                            <Box layoutClassName="space-y-1" textClassName="text-sm text-slate-600 dark:text-slate-400">
                              <Box
                                layoutClassName="flex justify-between sm:justify-start sm:gap-4 items-center px-3 py-1.5"
                                backgroundClassName="bg-white dark:bg-slate-800"
                                roundedClassName="rounded"
                                borderClassName="border border-slate-200 dark:border-slate-700"
                              >
                                  <Typography as="span" size="xs" layoutClassName="uppercase font-medium min-w-[60px]" textClassName="text-slate-500">{t('qr.bank')}</Typography>
                                  <Typography as="span" size="inherit" layoutClassName="font-bold" textClassName="text-slate-800 dark:text-slate-200">{qrAccount.bankCode}</Typography>
                              </Box>
                              <Box
                                layoutClassName="flex justify-between sm:justify-start sm:gap-4 items-center px-3 py-1.5 group cursor-pointer"
                                backgroundClassName="bg-white dark:bg-slate-800"
                                roundedClassName="rounded"
                                borderClassName="border border-slate-200 dark:border-slate-700"
                                onClick={() => copyToClipboard(qrAccount.accountNumber)}
                              >
                                  <Typography as="span" size="xs" layoutClassName="uppercase font-medium min-w-[60px]" textClassName="text-slate-500">{t('qr.account')}</Typography>
                                  <Box layoutClassName="flex items-center gap-2">
                                    <Typography as="span" size="inherit" layoutClassName="font-bold font-mono" textClassName="text-slate-800 dark:text-slate-200">{qrAccount.accountNumber}</Typography>
                                    <Copy className="w-3 h-3 text-slate-400 group-hover:text-blue-500" />
                                  </Box>
                              </Box>
                              <Box
                                layoutClassName="flex justify-between sm:justify-start sm:gap-4 items-center px-3 py-1.5"
                                backgroundClassName="bg-white dark:bg-slate-800"
                                roundedClassName="rounded"
                                borderClassName="border border-slate-200 dark:border-slate-700"
                              >
                                  <Typography as="span" size="xs" layoutClassName="uppercase font-medium min-w-[60px]" textClassName="text-slate-500">{t('qr.accountName')}</Typography>
                                  <Typography as="span" size="inherit" layoutClassName="font-bold uppercase" textClassName="text-slate-800 dark:text-slate-200">{qrAccount.accountHolder}</Typography>
                              </Box>
                              <Box
                                layoutClassName="flex justify-between sm:justify-start sm:gap-4 items-center px-3 py-1.5"
                                backgroundClassName="bg-white dark:bg-slate-800"
                                roundedClassName="rounded"
                                borderClassName="border border-slate-200 dark:border-slate-700"
                              >
                                  <Typography as="span" size="xs" layoutClassName="uppercase font-medium min-w-[60px]" textClassName="text-slate-500">{t('qr.amount')}</Typography>
                                  <Typography as="span" size="inherit" layoutClassName="font-bold" textClassName="text-primary-600 dark:text-primary-400">
                                    {formatVND(blk.amount)}
                                  </Typography>
                              </Box>
                              <Box
                                layoutClassName="flex justify-between sm:justify-start sm:gap-4 items-center px-3 py-1.5"
                                backgroundClassName="bg-white dark:bg-slate-800"
                                roundedClassName="rounded"
                                borderClassName="border border-slate-200 dark:border-slate-700"
                              >
                                  <Typography as="span" size="xs" layoutClassName="uppercase font-medium min-w-[60px]" textClassName="text-slate-500">{t('qr.content')}</Typography>
                                  <Typography as="span" size="inherit" layoutClassName="font-bold break-all" textClassName="text-slate-800 dark:text-slate-200">
                                    {blkDes}
                                  </Typography>
                              </Box>
                            </Box>
                            <Typography as="p" size="inherit" layoutClassName="text-[10px] mt-2" textClassName="text-slate-400">
                               {t('qr.instruction')}
                            </Typography>
                            <Box layoutClassName="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                              <Button
                                type="button"
                                onClick={() => void handlePushPos(blk.amount, blk.isDeposit)}
                                disabled={posBusy || blk.amount <= 0}
                                variant="primary"
                                leftIcon={<MonitorSmartphone />}
                                iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
                                sizeClassName="px-3 py-2 text-xs"
                                roundedClassName="rounded-lg"
                                layoutClassName="inline-flex w-full items-center justify-center gap-1.5 sm:w-auto"
                                disableVariantHover
                              >
                                {posBusy ? t('pos.qrPushing') : `${t('pos.pushToDevice')} · ${formatVND(blk.amount)}`}
                              </Button>
                            </Box>
                        </Box>
                     </Box>
                         );
                       })}
                     </Box>
                     {/* Nút về màn hình chờ POS — dùng chung cho cả section */}
                     <Box layoutClassName="mt-3">
                       <Button
                         type="button"
                         onClick={() => void handleCancelPos()}
                         disabled={posBusy}
                         variant="secondary"
                         leftIcon={<Home />}
                         iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
                         sizeClassName="px-3 py-2 text-xs"
                         roundedClassName="rounded-lg"
                         borderClassName="border border-slate-200 dark:border-slate-600"
                         backgroundClassName="bg-white dark:bg-slate-800"
                         layoutClassName="inline-flex w-full items-center justify-center gap-1.5 sm:w-auto"
                         disableVariantHover
                       >
                         {t('pos.backToHome')}
                       </Button>
                     </Box>
                  </Box>
                ) : null}

              </Box>
            ) : activeTab === 'refund' ? (
              /* REFUND TAB (#186) — tách từ tab Chi tiết; rỗng → EmptyState */
              Array.isArray(currentOrder.refunds) && currentOrder.refunds.length > 0 ? (
                <Box layoutClassName="space-y-6">
                  <Box
                    layoutClassName="rounded-xl border p-5"
                    backgroundClassName="bg-white dark:bg-slate-800"
                    borderClassName="border-amber-200 dark:border-amber-800"
                    shadowClassName="shadow-sm"
                    stateClassName="transition-colors"
                  >
                    <Heading
                      level={3}
                      textClassName="text-sm font-semibold text-slate-900 dark:text-white"
                      layoutClassName="mb-4 flex items-center gap-2 uppercase tracking-wide"
                    >
                      <Wallet className="h-4 w-4 text-amber-600" />
                      {t('refund.historyTitle')}
                      {typeof currentOrder.refundedAmount === 'number' && currentOrder.refundedAmount > 0 ? (
                        <Typography
                          as="span"
                          size="xs"
                          layoutClassName="ml-auto font-bold"
                          textClassName="text-amber-700 dark:text-amber-300"
                        >
                          {t('refund.totalRefunded')}: {formatVND(currentOrder.refundedAmount)}
                        </Typography>
                      ) : null}
                    </Heading>
                    <Box layoutClassName="space-y-3">
                      {currentOrder.refunds.map((rf) => {
                        const at = (rf.createdAt as any)?.toDate
                          ? (rf.createdAt as any).toDate()
                          : rf.createdAt
                            ? new Date(rf.createdAt as any)
                            : null;
                        const atLabel =
                          at && !isNaN(at.getTime())
                            ? at.toLocaleString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—';
                        const reconciled = rf.reconciled === true;
                        const method = rf.reconcileMethod ?? null;
                        const linkedTx = rf.transactionId
                          ? relatedTransactions.find((tx) => tx.id === rf.transactionId)
                          : undefined;
                        const isBusy = reconcilingId === rf.id;
                        const isPickerOpen = pickerRefundId === rf.id;
                        return (
                          <Box
                            key={rf.id}
                            layoutClassName="rounded-lg border p-3"
                            borderClassName="border-amber-100 dark:border-amber-900/50"
                            backgroundClassName="bg-amber-50/60 dark:bg-amber-950/30"
                          >
                            <Box layoutClassName="flex items-center justify-between gap-2">
                              <Typography size="xs" variant="muted">
                                {atLabel}
                                {rf.createdBy ? ` • ${rf.createdBy}` : ''}
                              </Typography>
                              <Typography
                                size="sm"
                                layoutClassName="font-bold"
                                textClassName="text-amber-700 dark:text-amber-300"
                              >
                                {formatVND(rf.amount)}
                              </Typography>
                            </Box>
                            {rf.category ? (
                              <Box layoutClassName="mt-1">
                                <Badge size="sm" layoutClassName="px-2 py-0.5 text-[10px] font-semibold"
                                  borderClassName="border-amber-200 dark:border-amber-700"
                                  backgroundClassName="bg-amber-100/70 dark:bg-amber-900/30"
                                  textClassName="text-amber-700 dark:text-amber-300">
                                  {refundCategoryLabel(rf.category)}
                                </Badge>
                              </Box>
                            ) : null}
                            {rf.reason ? (
                              <Typography size="xs" variant="muted" layoutClassName="mt-1">
                                {t('refund.reasonLabel')}: {rf.reason}
                              </Typography>
                            ) : null}
                            {Array.isArray(rf.items) && rf.items.length > 0 ? (
                              <Box layoutClassName="mt-2 space-y-1 border-t border-amber-100 pt-2 dark:border-amber-900/50">
                                {rf.items.map((it, idx) => (
                                  <Box
                                    key={`${rf.id}-${idx}`}
                                    layoutClassName="flex items-center justify-between gap-2"
                                  >
                                    <Typography size="xs" textClassName="text-slate-700 dark:text-slate-300">
                                      {it.productName}
                                      <Typography
                                        as="span"
                                        size="xs"
                                        layoutClassName="ml-1.5"
                                        textClassName="text-slate-400 dark:text-slate-500"
                                      >
                                        −{it.qtyRefunded} × {formatVND(it.unitPrice)}
                                      </Typography>
                                    </Typography>
                                    <Typography size="xs" textClassName="text-slate-600 dark:text-slate-400">
                                      {formatVND(it.amount)}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            ) : null}

                            {/* ── Đối soát (#186) ── */}
                            <Box layoutClassName="mt-3 border-t border-amber-100 pt-3 dark:border-amber-900/50">
                              <Box layoutClassName="flex flex-wrap items-center justify-between gap-2">
                                {/* Badge trạng thái */}
                                {reconciled && method === 'sepay' ? (
                                  <Badge
                                    size="sm"
                                    borderClassName="border-emerald-200 dark:border-emerald-800"
                                    backgroundClassName="bg-emerald-50 dark:bg-emerald-950/40"
                                    textClassName="text-emerald-700 dark:text-emerald-300"
                                  >
                                    <BadgeCheck className="h-3.5 w-3.5" />
                                    {t('reconcile.badgeSepay')}
                                  </Badge>
                                ) : reconciled && method === 'cash' ? (
                                  <Badge
                                    size="sm"
                                    borderClassName="border-slate-200 dark:border-slate-700"
                                    backgroundClassName="bg-slate-100 dark:bg-slate-700/40"
                                    textClassName="text-slate-600 dark:text-slate-300"
                                  >
                                    <Banknote className="h-3.5 w-3.5" />
                                    {t('reconcile.badgeCash')}
                                  </Badge>
                                ) : (
                                  <Badge
                                    size="sm"
                                    borderClassName="border-amber-300 dark:border-amber-700"
                                    backgroundClassName="bg-amber-100 dark:bg-amber-900/40"
                                    textClassName="text-amber-700 dark:text-amber-300"
                                  >
                                    <Clock className="h-3.5 w-3.5" />
                                    {t('reconcile.badgeUnreconciled')}
                                  </Badge>
                                )}

                                {/* Hành động (chỉ Admin/Super Admin) */}
                                {canReconcile ? (
                                  reconciled ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={isBusy}
                                      leftIcon={
                                        isBusy ? (
                                          <Spinner size="sm" />
                                        ) : (
                                          <Unlink className="h-3.5 w-3.5" />
                                        )
                                      }
                                      onClick={() => handleUnreconcile(rf.id)}
                                    >
                                      {t('reconcile.unlinkCta')}
                                    </Button>
                                  ) : (
                                    <Box layoutClassName="flex items-center gap-2">
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        disabled={isBusy}
                                        leftIcon={<Link2 className="h-3.5 w-3.5" />}
                                        onClick={() => handleOpenPicker(rf.id)}
                                      >
                                        {t('reconcile.sepayCta')}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={isBusy}
                                        leftIcon={
                                          isBusy ? (
                                            <Spinner size="sm" />
                                          ) : (
                                            <Banknote className="h-3.5 w-3.5" />
                                          )
                                        }
                                        onClick={() => handleReconcileCash(rf.id)}
                                      >
                                        {t('reconcile.cashCta')}
                                      </Button>
                                    </Box>
                                  )
                                ) : null}
                              </Box>

                              {/* Chi tiết GD đã gắn khi đã đối soát SePay */}
                              {reconciled && method === 'sepay' ? (
                                <Typography size="xs" variant="muted" layoutClassName="mt-1.5">
                                  {t('reconcile.linkedTx')}:{' '}
                                  <Typography
                                    as="span"
                                    size="xs"
                                    layoutClassName="font-semibold"
                                    textClassName="text-slate-700 dark:text-slate-300"
                                  >
                                    {linkedTx
                                      ? `#${linkedTx.sepayId} • ${formatVND(linkedTx.transferAmount)}`
                                      : rf.transactionId}
                                  </Typography>
                                  {rf.reconciledBy ? ` • ${rf.reconciledBy}` : ''}
                                </Typography>
                              ) : reconciled && method === 'cash' ? (
                                <Typography size="xs" variant="muted" layoutClassName="mt-1.5">
                                  {reconcileMethodLabel(method)}
                                  {rf.reconciledBy ? ` • ${rf.reconciledBy}` : ''}
                                </Typography>
                              ) : null}

                              {/* Panel chọn GD SePay tiền ra để gắn */}
                              {isPickerOpen && !reconciled ? (
                                <Box
                                  layoutClassName="mt-3 space-y-2 rounded-lg border p-3"
                                  borderClassName="border-slate-200 dark:border-slate-700"
                                  backgroundClassName="bg-white dark:bg-slate-800"
                                >
                                  <Typography
                                    size="xs"
                                    layoutClassName="font-semibold uppercase tracking-wide"
                                    textClassName="text-slate-600 dark:text-slate-300"
                                  >
                                    {t('reconcile.pickerTitle')}
                                  </Typography>
                                  {outTxLoading ? (
                                    <Box layoutClassName="flex items-center justify-center gap-2 py-4">
                                      <Spinner size="sm" textClassName="text-slate-400" />
                                      <Typography size="xs" variant="muted">
                                        {t('reconcile.loadingTx')}
                                      </Typography>
                                    </Box>
                                  ) : outTx.length === 0 ? (
                                    <EmptyState
                                      icon={<Wallet className="h-6 w-6" />}
                                      title={t('reconcile.noOutTx')}
                                      layoutClassName="!min-h-0"
                                    />
                                  ) : (
                                    <Box layoutClassName="max-h-56 space-y-1.5 overflow-y-auto">
                                      {outTx.map((tx) => {
                                        const amountMatch =
                                          tx.transferAmount === rf.amount;
                                        const txAt = tx.transactionDate
                                          ? new Date(tx.transactionDate)
                                          : tx.receivedAt
                                            ? new Date(tx.receivedAt)
                                            : null;
                                        const txAtLabel =
                                          txAt && !isNaN(txAt.getTime())
                                            ? txAt.toLocaleString('vi-VN', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })
                                            : '—';
                                        return (
                                          <Box
                                            key={tx.id}
                                            layoutClassName="flex items-center justify-between gap-2 rounded-md border p-2"
                                            borderClassName={
                                              amountMatch
                                                ? 'border-emerald-300 dark:border-emerald-700'
                                                : 'border-slate-100 dark:border-slate-700'
                                            }
                                            backgroundClassName={
                                              amountMatch
                                                ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                                                : 'bg-slate-50/60 dark:bg-slate-700/20'
                                            }
                                          >
                                            <Box layoutClassName="min-w-0">
                                              <Typography
                                                size="xs"
                                                layoutClassName="font-semibold"
                                                textClassName="text-slate-800 dark:text-slate-200"
                                              >
                                                #{tx.sepayId} • {formatVND(tx.transferAmount)}
                                                {amountMatch ? (
                                                  <Typography
                                                    as="span"
                                                    size="xs"
                                                    layoutClassName="ml-1.5 font-medium"
                                                    textClassName="text-emerald-600 dark:text-emerald-400"
                                                  >
                                                    • {t('reconcile.amountMatch')}
                                                  </Typography>
                                                ) : null}
                                              </Typography>
                                              <Typography size="xs" variant="muted">
                                                {txAtLabel}
                                                {tx.referenceCode ? ` • ${tx.referenceCode}` : ''}
                                              </Typography>
                                            </Box>
                                            <Button
                                              variant="primary"
                                              size="sm"
                                              disabled={isBusy}
                                              leftIcon={
                                                isBusy ? (
                                                  <Spinner size="sm" />
                                                ) : (
                                                  <Check className="h-3.5 w-3.5" />
                                                )
                                              }
                                              onClick={() =>
                                                handleReconcileSepay(rf.id, tx.id)
                                              }
                                            >
                                              {t('reconcile.pickCta')}
                                            </Button>
                                          </Box>
                                        );
                                      })}
                                    </Box>
                                  )}
                                </Box>
                              ) : null}
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                </Box>
              ) : (
                <EmptyState
                  icon={<Wallet className="h-6 w-6" />}
                  title={t('refund.emptyTitle')}
                />
              )
            ) : activeTab === 'history' ? (
              (() => {
                const allHistory = Array.isArray(currentOrder.history) ? [...currentOrder.history].reverse() : [];

                // Group: cho moi category, build list { entry, change }
                type CategoryKey = 'status' | 'payment' | 'info';
                type GroupedChange = { entry: any; change: any };
                const groups: Record<CategoryKey, GroupedChange[]> = { status: [], payment: [], info: [] };
                allHistory.forEach((entry: any) => {
                  (entry?.changes || []).forEach((c: any) => {
                    const cat = changeToCategory(entry, c.field);
                    groups[cat].push({ entry, change: c });
                  });
                });

                // Inject synthetic entries từ transactions vào block "Lịch sử nhận tiền".
                // Mỗi transaction = 1 lần SePay ghi nhận tiền — at = receivedAt.
                // Sort desc theo receivedAt để mới nhất hiện trên đầu.
                const txSorted = [...relatedTransactions].sort((a, b) => {
                  const ta = new Date(a.receivedAt).getTime();
                  const tb = new Date(b.receivedAt).getTime();
                  return tb - ta;
                });
                txSorted.forEach((tx) => {
                  const syntheticEntry = {
                    at: tx.receivedAt,
                    by: 'System (Ngân hàng)',
                    byUid: 'system',
                  };
                  const syntheticChange = {
                    field: 'paymentReceived',
                    label: `Đã nhận thanh toán • #${tx.sepayId}`,
                    oldValue: '—',
                    newValue: formatVND(tx.transferAmount),
                  };
                  groups.payment.push({ entry: syntheticEntry, change: syntheticChange });
                });

                const CATEGORY_META: Array<{
                  key: CategoryKey;
                  title: string;
                  icon: any;
                  borderClass: string;
                  iconBgClass: string;
                  dotClass: string;
                  dotRingClass: string;
                }> = [
                  { key: 'status', title: 'Lịch sử trạng thái', icon: StickyNote,
                    borderClass: 'border-primary-200 dark:border-primary-800',
                    iconBgClass: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200',
                    dotClass: 'bg-primary-500', dotRingClass: 'ring-primary-200 dark:ring-primary-900' },
                  { key: 'payment', title: 'Lịch sử nhận tiền', icon: Wallet,
                    borderClass: 'border-emerald-200 dark:border-emerald-800',
                    iconBgClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
                    dotClass: 'bg-emerald-500', dotRingClass: 'ring-emerald-200 dark:ring-emerald-900' },
                  { key: 'info', title: 'Lịch sử thông tin', icon: FileText,
                    borderClass: 'border-slate-200 dark:border-slate-700',
                    iconBgClass: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
                    dotClass: 'bg-slate-400', dotRingClass: 'ring-slate-200 dark:ring-slate-700' },
                ];

                return (
                  <Box layoutClassName="space-y-4">
                    {CATEGORY_META.map((meta) => {
                      const Icon = meta.icon;
                      const items = groups[meta.key];
                      const isEmpty = items.length === 0;
                      return (
                        <Box
                          key={meta.key}
                          layoutClassName="p-5"
                          roundedClassName="rounded-xl"
                          borderClassName={`border-2 ${meta.borderClass}`}
                          backgroundClassName="bg-white dark:bg-slate-800"
                          shadowClassName="shadow-sm"
                          stateClassName="transition-colors"
                        >
                          {/* Category header */}
                          <Box layoutClassName="mb-4 flex items-center gap-3">
                            <Typography as="span" size="inherit" layoutClassName="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" backgroundClassName={meta.iconBgClass}>
                              <Icon className="h-5 w-5" />
                            </Typography>
                            <Box layoutClassName="min-w-0 flex-1">
                              <Box layoutClassName="text-sm font-bold uppercase tracking-wide" textClassName="text-slate-900 dark:text-white">
                                {meta.title}
                              </Box>
                              <Box layoutClassName="text-xs" textClassName="text-slate-500 dark:text-slate-400">
                                {isEmpty ? 'Chưa có thay đổi' : `${items.length} thay đổi`}
                              </Box>
                            </Box>
                          </Box>

                          {isEmpty ? (
                            /* Empty placeholder */
                            <EmptyState
                              icon={<Clock className="h-6 w-6" />}
                              title="Chưa có lịch sử cho mục này"
                              layoutClassName="!min-h-0"
                            />
                          ) : (
                            /* Timeline */
                            <Box
                              layoutClassName="relative space-y-4 pl-5"
                              borderClassName="border-l-2 border-slate-200 dark:border-slate-700"
                            >
                              {items.map((g, ci) => {
                                const at = g.entry?.at?.toDate ? g.entry.at.toDate() : new Date(g.entry?.at);
                                const atLabel = at && !isNaN(at.getTime())
                                  ? at.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                  : '—';
                                return (
                                  <Box key={ci} layoutClassName="relative">
                                    <Typography as="span" size="inherit" layoutClassName="absolute -left-[27px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white ring-2 dark:border-slate-800" backgroundClassName={meta.dotClass} stateClassName={meta.dotRingClass} />
                                    <Box layoutClassName="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                      <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-900 dark:text-white">
                                        {g.entry?.byUid === 'system'
                                          ? (g.entry?.by || 'System')
                                          : (g.entry?.by || 'Unknown')}
                                      </Typography>
                                      {g.entry?.byUid === 'system' ? (
                                        <Box
                                          layoutClassName="px-1.5 py-0.5"
                                          roundedClassName="rounded-full"
                                          backgroundClassName="bg-indigo-100 dark:bg-indigo-900/40"
                                          textClassName="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200"
                                        >
                                          AUTO
                                        </Box>
                                      ) : null}
                                      <Typography as="span" size="xs" textClassName="text-slate-500 dark:text-slate-400">
                                        {atLabel}
                                      </Typography>
                                    </Box>
                                    <Box
                                      layoutClassName="mt-2 flex flex-wrap items-center gap-2 p-2 text-xs"
                                      roundedClassName="rounded-md"
                                      borderClassName="border border-slate-100 dark:border-slate-700"
                                      backgroundClassName="bg-slate-50/70 dark:bg-slate-700/30"
                                    >
                                      <Box
                                        layoutClassName="px-1.5 py-0.5 font-semibold"
                                        roundedClassName="rounded"
                                        backgroundClassName="bg-slate-200 dark:bg-slate-600"
                                        textClassName="text-slate-700 dark:text-slate-200"
                                      >
                                        {g.change.label || g.change.field}
                                      </Box>
                                      <Typography as="span" size="inherit" layoutClassName="line-through break-all" textClassName="text-slate-500 dark:text-slate-400">
                                        {formatHistoryValue(g.change.field, g.change.oldValue)}
                                      </Typography>
                                      <Typography as="span" size="inherit" textClassName="text-slate-400" aria-hidden="true">→</Typography>
                                      <Typography as="span" size="inherit" layoutClassName="font-semibold break-all" textClassName="text-primary-700 dark:text-primary-300">
                                        {formatHistoryValue(g.change.field, g.change.newValue)}
                                      </Typography>
                                    </Box>
                                  </Box>
                                );
                              })}
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                );
              })()
            ) : activeTab === 'tracking' ? (
              <Box
                layoutClassName="space-y-3 p-5"
                backgroundClassName="bg-white dark:bg-slate-800"
                roundedClassName="rounded-xl"
                borderClassName="border border-slate-100 dark:border-slate-700"
                shadowClassName="shadow-sm"
              >
                <Box layoutClassName="flex items-center justify-between gap-2">
                  <Heading level={3} textClassName="text-sm font-semibold text-slate-900 dark:text-white" layoutClassName="uppercase tracking-wide">
                    Hành trình vận đơn
                  </Heading>
                  {trackingQuery.data?.status ? (
                    <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-primary-600 dark:text-primary-400">
                      {trackingQuery.data.status}
                    </Typography>
                  ) : null}
                </Box>
                <Typography as="p" size="xs" variant="muted">
                  Mã: {currentOrder.trackingNumber}
                  {currentOrder.trackingLink ? (
                    <>
                      {' · '}
                      <Typography
                        as="span"
                        size="inherit"
                        textClassName="underline cursor-pointer text-primary-600 dark:text-primary-400"
                        onClick={() => window.open(currentOrder.trackingLink!, '_blank', 'noopener,noreferrer')}
                      >
                        tra cứu trên hãng
                      </Typography>
                    </>
                  ) : null}
                </Typography>

                {trackingQuery.isFetching ? (
                  <Typography as="p" size="sm" variant="muted">Đang tải hành trình…</Typography>
                ) : trackingQuery.data?.events?.length ? (
                  <Box layoutClassName="space-y-3 pt-1">
                    {trackingQuery.data.events.map((ev, i) => (
                      <Box key={i} layoutClassName="flex gap-3">
                        <Box layoutClassName="flex flex-col items-center">
                          <Box
                            layoutClassName="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                            backgroundClassName={i === 0 ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}
                          />
                          {i < trackingQuery.data!.events.length - 1 ? (
                            <Box layoutClassName="mt-1 w-px flex-1" backgroundClassName="bg-slate-200 dark:bg-slate-600" />
                          ) : null}
                        </Box>
                        <Box layoutClassName="min-w-0 flex-1 pb-1">
                          <Typography as="p" size="sm" layoutClassName={i === 0 ? 'font-semibold' : ''} textClassName="text-slate-700 dark:text-slate-200">
                            {ev.label}{ev.location ? ` · ${ev.location}` : ''}
                          </Typography>
                          <Typography as="span" size="xs" variant="muted">
                            {new Date(ev.time * 1000).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography as="p" size="sm" variant="muted">
                    Chưa lấy được hành trình (chỉ hỗ trợ đơn SPX, hoặc hãng chưa cập nhật).
                  </Typography>
                )}
              </Box>
            ) : null}
        </Box>
      </Box>
    </BaseSlidePanel>

    <CancelRefundModal
      open={crMode !== null}
      mode={crMode ?? 'cancel'}
      order={currentOrder}
      onClose={() => setCrMode(null)}
      onConfirm={handleCancelRefund}
    />

    {/* Modal preview ảnh đơn (mobile / khi clipboard không khả dụng).
        z-index cao hơn slide panel chi tiết để nổi trên cùng. */}
    {previewUrl ? (
      <Box
        layoutClassName="fixed inset-0 z-[120] flex items-center justify-center p-4"
        onClick={closePreview}
      >
        <Box
          layoutClassName="absolute inset-0"
          backgroundClassName="bg-black/60"
          aria-hidden
        />
        <Box
          layoutClassName="relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl"
          backgroundClassName="bg-white dark:bg-slate-800"
          shadowClassName="shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <Box
            layoutClassName="flex items-center justify-between gap-3 border-b px-4 py-3"
            borderClassName="border-slate-200 dark:border-slate-700"
          >
            <Heading level={3} textClassName="text-base font-semibold text-slate-800 dark:text-slate-100">
              {t('detail.previewTitle') || 'Ảnh đơn — copy hoặc chụp màn hình để gửi khách'}
            </Heading>
            <IconButton
              type="button"
              layoutClassName="p-1.5"
              roundedClassName="rounded-lg"
              hoverClassName="hover:bg-slate-100 dark:hover:bg-slate-700"
              textClassName="text-slate-400 dark:text-slate-300"
              onClick={closePreview}
              label={t('detail.close')}
            >
              <X className="h-5 w-5" />
            </IconButton>
          </Box>

          {/* Ảnh + hint (scrollable) */}
          <Box layoutClassName="flex-1 space-y-3 overflow-y-auto p-4">
            <Image
              src={previewUrl}
              alt={currentOrder.orderNumber || 'don-hang'}
              disableFade
              loading="eager"
              layoutClassName="mx-auto h-auto max-w-full rounded-lg"
              borderClassName="border border-slate-200 dark:border-slate-700"
            />
            <Typography as="p" size="xs" layoutClassName="text-center" textClassName="text-slate-500 dark:text-slate-400">
              {t('detail.previewHint') || 'Bấm Copy, hoặc chụp màn hình khung này để gửi khách'}
            </Typography>
          </Box>

          {/* Footer */}
          <Box
            layoutClassName="flex flex-wrap justify-end gap-3 border-t px-4 py-3"
            borderClassName="border-slate-200 dark:border-slate-700"
          >
            <Button
              type="button"
              onClick={copyPreviewImage}
              disabled={copyingPreview}
              disableVariantHover
              disableVariantTextColor
              borderClassName="border border-primary-200 dark:border-primary-700/50"
              backgroundClassName="bg-primary-600 dark:bg-primary-500"
              hoverClassName="hover:bg-primary-700 dark:hover:bg-primary-600"
              textClassName="text-sm font-medium text-white"
              roundedClassName="rounded-lg"
              layoutClassName="mr-auto px-4 py-2"
              stateClassName="transition-colors disabled:opacity-50"
              leftIcon={<Copy className="h-4 w-4" />}
              iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
            >
              {t('detail.copyImage') || 'Copy ảnh'}
            </Button>
            <Button
              type="button"
              onClick={downloadPreview}
              disableVariantHover
              disableVariantTextColor
              borderClassName="border border-primary-200 dark:border-primary-700/50"
              backgroundClassName="bg-primary-50 dark:bg-primary-900/20"
              hoverClassName="hover:bg-primary-100 dark:hover:bg-primary-900/30"
              textClassName="text-sm font-medium text-primary-700 dark:text-primary-300"
              roundedClassName="rounded-lg"
              layoutClassName="px-4 py-2"
            >
              {t('detail.previewDownload') || 'Tải ảnh'}
            </Button>
            <Button
              type="button"
              onClick={closePreview}
              variant="secondary"
              disableVariantHover
              disableVariantTextColor
              borderClassName="border border-slate-200 dark:border-slate-600"
              backgroundClassName="bg-transparent"
              hoverClassName="hover:bg-slate-50 dark:hover:bg-slate-700"
              textClassName="text-sm font-medium text-slate-700 dark:text-slate-300"
              roundedClassName="rounded-lg"
              layoutClassName="px-4 py-2"
            >
              {t('detail.close') || 'Đóng'}
            </Button>
          </Box>
        </Box>
      </Box>
    ) : null}

    {/* Thẻ gửi khách render OFF-SCREEN để chụp ảnh (html-to-image). Không hiển thị cho user. */}
    <Box layoutClassName="pointer-events-none fixed left-[-99999px] top-0" aria-hidden>
      <ShareableOrderCard
        ref={shareRef}
        order={currentOrder}
        subtotal={subtotal}
        finalTotal={finalTotal}
        shippingCost={shippingCost}
        surchargeLabel={surchargeTagLabel(currentOrder.surchargeTag, surchargeTags)}
        deliveryLabel={
          currentOrder.deliveryType === DeliveryType.PICKUP ? t('deliveryType.pickup')
          : currentOrder.deliveryType === DeliveryType.SHIP_PROVINCE ? t('deliveryType.shipProvince')
          : currentOrder.deliveryType === DeliveryType.SHIP ? t('deliveryType.ship') : ''
        }
        paymentLabel={
          currentOrder.paymentMethod === PaymentMethod.CASH ? t('paymentMethod.cash')
          : currentOrder.paymentMethod === PaymentMethod.BANKING ? t('paymentMethod.banking') : ''
        }
        qrUrl={shareQrUrl}
        description={shareDescription}
        qrAmount={sharePrimaryAmount}
        qrLabel={sharePrimaryLabel}
        bankCode={qrAccount?.bankCode}
        accountNumber={qrAccount?.accountNumber}
        accountHolder={qrAccount?.accountHolder}
        depositQrUrl={shareDepositQrUrl}
        depositAmount={depositAmt}
        depositDescription={shareDepositDescription}
      />
    </Box>
    </>
  );
};

export default OrderDetail;
