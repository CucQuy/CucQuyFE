import React, { useMemo } from 'react';
import { MessageSquare, SlidersHorizontal } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useZaloFeatures, useZaloGroups } from '@/hooks/queries/useConfigQuery';
import { ZALO_NOTIFY_FEATURES } from '@/types';
import Box from '@/components/ui/Box';
import ChannelScreen from './ChannelScreen';
import CollapsibleSection from '@/pages/Channels/components/CollapsibleSection';
import ZaloGroupsPage from '@/pages/Channels/ZaloGroups';
import ZaloFeaturesPage from '@/pages/Channels/ZaloFeatures';
import ZaloSettingsPage from '@/pages/Channels/ZaloSettings';

/**
 * Màn Zalo gộp: nhóm nhận thông báo (chính) + cờ tổng chức năng + tin gửi khách.
 * Bấm 1 nhóm trong bảng → modal bật/tắt chức năng của riêng nhóm đó; hai khối dưới
 * là cấu hình chung, mặc định thu gọn.
 */
const ZaloScreen: React.FC = () => {
  const { t } = useLanguage();
  const { data: flags } = useZaloFeatures();
  const { data: zaloConfig } = useZaloGroups();

  // Tóm tắt hiện ở đầu khối khi đang thu gọn — đỡ phải mở ra mới biết đang bật gì.
  const featuresSummary = useMemo(() => {
    const total = ZALO_NOTIFY_FEATURES.length;
    const off = flags.filter((f) => f.enabled === false).length;
    return `${total - off}/${total} đang bật`;
  }, [flags]);

  const customerSummary = zaloConfig?.customerNotifyEnabled === true ? 'Đang bật' : 'Đang tắt';

  return (
    <ChannelScreen title={t('channels.zaloTitle')} desc={t('channels.zaloDesc')}>
      <Box layoutClassName="h-full space-y-4 overflow-y-auto">
        {/* Nhóm: khối chính, tự cuộn trong bảng nên cần chiều cao cố định. */}
        <Box layoutClassName="h-[58vh] min-h-[360px]">
          <ZaloGroupsPage />
        </Box>

        <CollapsibleSection
          title="Chức năng thông báo (cờ tổng)"
          desc="Tắt ở đây là không gửi, kể cả nhóm đã được gán chức năng đó."
          summary={featuresSummary}
          icon={<SlidersHorizontal className="h-4 w-4 text-primary-500" />}
        >
          <ZaloFeaturesPage />
        </CollapsibleSection>

        <CollapsibleSection
          title="Tin gửi khách"
          desc="Tin Zalo gửi cho khách sau khi tạo đơn: cảm ơn, link tra đơn, mã khuyến mãi."
          summary={customerSummary}
          icon={<MessageSquare className="h-4 w-4 text-primary-500" />}
        >
          <ZaloSettingsPage />
        </CollapsibleSection>
      </Box>
    </ChannelScreen>
  );
};

export default ZaloScreen;
