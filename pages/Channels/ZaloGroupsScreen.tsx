import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import ZaloGroupsPage from '@/pages/Channels/ZaloGroups';

/** Nhóm Zalo + gán tính năng thông báo cho từng nhóm (tin gửi khách ở màn riêng). */
const ZaloGroupsScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
  <ChannelScreen
    title={t('channels.zaloGroupsTitle')}
    desc={t('channels.zaloGroupsDesc')}
  >
    <ZaloGroupsPage />
  </ChannelScreen>
  );
};

export default ZaloGroupsScreen;
