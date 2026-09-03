import React, { useCallback, useEffect, useRef, useState } from 'react';
import { uploadImage } from '@/services/imageService';
import { sendZaloOrderImage, sendNewOrderZaloNotifications } from '@/services/zaloService';
import { dequeueOrderShare, setZaloShareListener, type ZaloShareJob } from '@/services/zaloShareQueue';
import { captureShareCard } from '@/utils/order/captureShareCard';
import { formatOrderImageCaption } from '@/utils/zalo/zaloUtil';
import { generateQRCodeImage, getOrderTotal } from '@/utils/order/orderUtils';
import { surchargeTagLabel } from '@/types/order';
import { TEST_PAYMENT_ACCOUNT } from '@/types/paymentConfig';
import { DeliveryType, PaymentMethod } from '@/types';
import { usePaymentAccounts } from '@/hooks/usePaymentAccounts';
import { useSurchargeTags } from '@/hooks/queries/useSurchargeTagsQuery';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import ShareableOrderCard from '@/pages/Orders/components/modals/ShareableOrderCard';

/**
 * Host xử lý HÀNG ĐỢI gửi ẢNH đơn mới vào Zalo (mount 1 lần ở gốc app).
 * Với mỗi job: render thẻ chia sẻ OFF-SCREEN → chụp PNG (html-to-image) → upload
 * RiceService → gửi ảnh vào nhóm. Lỗi bất kỳ → fallback gửi TEXT (như cũ).
 * Xử lý TUẦN TỰ 1 job/lần để không nghẽn; hoàn toàn nền, không chặn tạo đơn.
 */
const ZaloShareQueueHost: React.FC = () => {
  const { t } = useLanguage();
  const { activeAccount } = usePaymentAccounts();
  const { surchargeTags } = useSurchargeTags();
  const [job, setJob] = useState<ZaloShareJob | null>(null);
  const busy = useRef(false);
  const shareRef = useRef<HTMLDivElement>(null);

  const pump = useCallback(() => {
    if (busy.current) return;
    const next = dequeueOrderShare();
    if (!next) return;
    busy.current = true;
    setJob(next);
  }, []);

  useEffect(() => {
    setZaloShareListener(pump);
    pump();
    return () => setZaloShareListener(null);
  }, [pump]);

  // Có job + thẻ đã render → chụp + gửi.
  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    const run = async () => {
      // Text kèm ảnh: mã đơn + tên/SĐT khách + địa chỉ (chi tiết còn lại nằm trong ảnh)
      // → đọc được ngay trên thông báo Zalo, khỏi phải mở ảnh.
      const message = formatOrderImageCaption(job.order);
      try {
        // Chờ thẻ + ảnh render xong (font/ảnh SP) trước khi chụp.
        await new Promise((r) => setTimeout(r, 450));
        const node = shareRef.current;
        if (!node) throw new Error('no node');
        const blob = await captureShareCard(node);
        const file = new File([blob], `don-${job.order?.orderNumber || 'order'}.png`, { type: 'image/png' });
        const url = await uploadImage(file, 'zalo-orders');
        if (cancelled) return;
        await sendZaloOrderImage(job.groupIds, message, message, url);
      } catch (e) {
        console.error('Zalo share image failed → fallback text:', e);
        try { await sendNewOrderZaloNotifications(job.order, job.groupIds); } catch { /* bỏ qua */ }
      } finally {
        if (!cancelled) {
          busy.current = false;
          setJob(null);
          setTimeout(pump, 0);
        }
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [job, pump]);

  if (!job) return null;

  const order = job.order;
  const finalTotal = getOrderTotal(order);
  const subtotal = typeof order?.subtotal === 'number' ? order.subtotal : 0;
  const shippingCost = typeof order?.shippingCost === 'number' ? order.shippingCost : 0;
  const qrAccount = order?.isTest ? TEST_PAYMENT_ACCOUNT : activeAccount;
  const orderNumber = order?.orderNumber || order?.id || '';
  const depositAmt = Number(order?.depositAmount) || 0;
  const paidAmt = Number(order?.paidAmount) || 0;
  // QR chia sẻ: ĐÃ CỌC (paidAmt>0) → QR CÒN LẠI; CHƯA CỌC → QR tổng (+ QR cọc nếu có mức cọc).
  const hasPaidDeposit = paidAmt > 0;
  const shareRemaining = Math.max(0, finalTotal - paidAmt);
  const sharePrimaryAmount = hasPaidDeposit && shareRemaining > 0 ? shareRemaining : finalTotal;
  const sharePrimaryLabel = hasPaidDeposit && shareRemaining > 0
    ? 'Chuyển khoản còn lại'
    : (!hasPaidDeposit && depositAmt > 0 ? 'Chuyển khoản đủ' : 'Chuyển khoản');
  const shareQrUrl = qrAccount ? generateQRCodeImage(orderNumber, sharePrimaryAmount, qrAccount, false) : '';
  const shareDepositQrUrl = qrAccount && !hasPaidDeposit && depositAmt > 0
    ? generateQRCodeImage(orderNumber, depositAmt, qrAccount, true) : '';

  return (
    <Box layoutClassName="pointer-events-none fixed left-[-99999px] top-0" aria-hidden>
      <ShareableOrderCard
        ref={shareRef}
        order={order}
        subtotal={subtotal}
        finalTotal={finalTotal}
        shippingCost={shippingCost}
        surchargeLabel={surchargeTagLabel(order?.surchargeTag, surchargeTags)}
        deliveryLabel={
          order?.deliveryType === DeliveryType.PICKUP ? t('deliveryType.pickup')
          : order?.deliveryType === DeliveryType.SHIP_PROVINCE ? t('deliveryType.shipProvince')
          : order?.deliveryType === DeliveryType.SHIP ? t('deliveryType.ship') : ''
        }
        paymentLabel={
          order?.paymentMethod === PaymentMethod.CASH ? t('paymentMethod.cash')
          : order?.paymentMethod === PaymentMethod.BANKING ? t('paymentMethod.banking') : ''
        }
        qrUrl={shareQrUrl}
        description={orderNumber}
        qrAmount={sharePrimaryAmount}
        qrLabel={sharePrimaryLabel}
        bankCode={qrAccount?.bankCode}
        accountNumber={qrAccount?.accountNumber}
        accountHolder={qrAccount?.accountHolder}
        depositQrUrl={shareDepositQrUrl}
        depositAmount={depositAmt}
        depositDescription={`C${orderNumber}`}
      />
    </Box>
  );
};

export default ZaloShareQueueHost;
