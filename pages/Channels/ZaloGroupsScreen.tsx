import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import ZaloSettingsTab from '@/pages/Settings/ZaloSettingsTab';

/** Nhóm Zalo nhận thông báo + cài đặt tin gửi khách (màn /settings/zalo cũ). */
const ZaloGroupsScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
  <ChannelScreen
    title={t('channels.zaloGroupsTitle')}
    desc={t('channels.zaloGroupsDesc')}
  >
    <ZaloSettingsTab />
  </ChannelScreen>
  );
};

export default ZaloGroupsScreen;
