import React from 'react';
import { QrCode } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';
import PaymentSettingsTab from '@/pages/Settings/PaymentSettingsTab';

/**
 * Trang cài đặt SePay (tài khoản nhận tiền / QR thanh toán).
 * Tách riêng khỏi "Cài đặt đơn hàng" để thành một tab độc lập trong menu Cài đặt.
 */
const SepaySettingsPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <Box layoutClassName="space-y-6">
      <Box>
        <Heading level={2} textClassName="flex items-center gap-2 text-xl font-semibold">
          <QrCode className="h-6 w-6 text-primary-500" />
          {t('nav.settingsSepay')}
        </Heading>
        <Typography size="sm" variant="muted" layoutClassName="mt-1">
          Cấu hình tài khoản SePay nhận tiền / QR thanh toán.
        </Typography>
      </Box>

      <PaymentSettingsTab />
    </Box>
  );
};

export default SepaySettingsPage;
