import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import ChannelScreen from './ChannelScreen';
import ZaloGroupsPage from '@/pages/Channels/ZaloGroups';

/**
 * Màn Zalo: bảng nhóm nhận thông báo — mỗi nhóm 1 dòng, chức năng bật/tắt bằng chip
 * ngay tại dòng đó.
 */
const ZaloScreen: React.FC = () => {
  const { t } = useLanguage();

  return (
    <ChannelScreen title={t('channels.zaloTitle')} desc={t('channels.zaloDesc')}>
      <Box layoutClassName="h-full overflow-y-auto">
        <ZaloGroupsPage />
      </Box>
    </ChannelScreen>
  );
};

export default ZaloScreen;
