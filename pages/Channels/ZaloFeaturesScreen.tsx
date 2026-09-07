import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import ZaloFeaturesPage from '@/pages/Channels/ZaloFeatures';

/** Bật/tắt từng chức năng thông báo Zalo (cờ tổng, độc lập với việc gán nhóm). */
const ZaloFeaturesScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
    <ChannelScreen
      title={t('channels.zaloFeaturesTitle')}
      desc={t('channels.zaloFeaturesDesc')}
    >
      <ZaloFeaturesPage />
    </ChannelScreen>
  );
};

export default ZaloFeaturesScreen;
