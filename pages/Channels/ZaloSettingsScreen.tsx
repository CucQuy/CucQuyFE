import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import ZaloSettingsPage from '@/pages/Channels/ZaloSettings';

/** Cài đặt Zalo (hiện có: tin gửi khách) — tách khỏi màn Nhóm Zalo. */
const ZaloSettingsScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
    <ChannelScreen
      title={t('channels.zaloSettingsTitle')}
      desc={t('channels.zaloSettingsDesc')}
    >
      <ZaloSettingsPage />
    </ChannelScreen>
  );
};

export default ZaloSettingsScreen;
