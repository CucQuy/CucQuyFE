import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import TiktokVideosTab from './components/TiktokVideosTab';

/** Video TikTok của tiệm + chỉ số từng bài (Display API). */
const TiktokVideosScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
    <ChannelScreen title={t('channels.ttVideosTitle')} desc={t('channels.ttVideosDesc')}>
      <TiktokVideosTab />
    </ChannelScreen>
  );
};

export default TiktokVideosScreen;
