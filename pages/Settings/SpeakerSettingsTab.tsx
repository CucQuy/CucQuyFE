import React from 'react';
import { Volume2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';
import PaymentSpeakerCard from '@/pages/Settings/PaymentSpeakerCard';
import KitchenStationCard from '@/pages/Settings/KitchenStationCard';

/**
 * Màn "Loa" — gom các cấu hình âm thanh của máy quán:
 * - Loa thanh toán (đọc số tiền khi có tiền vào).
 * - Máy quán (loa "đơn hàng mới" + tự in phiếu bếp).
 * Tách riêng khỏi cài đặt SePay để dễ tìm.
 */
const SpeakerSettingsTab: React.FC = () => {
  const { t } = useLanguage();

  return (
    <Box layoutClassName="space-y-6">
      <Box>
        <Heading level={2} textClassName="flex items-center gap-2 text-xl font-semibold">
          <Volume2 className="h-6 w-6 text-primary-500" />
          {t('nav.settingsSpeaker')}
        </Heading>
        <Typography size="sm" variant="muted" layoutClassName="mt-1">
          Cấu hình âm thanh máy quán: loa đọc tiền thanh toán và loa báo đơn hàng mới.
        </Typography>
      </Box>

      <PaymentSpeakerCard />

      <KitchenStationCard />
    </Box>
  );
};

export default SpeakerSettingsTab;
