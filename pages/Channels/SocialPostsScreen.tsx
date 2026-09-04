import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import SocialPostsTab from './components/SocialPostsTab';

/** Soạn 1 bài, đăng lên fanpage + Instagram (ngay hoặc hẹn giờ). */
const SocialPostsScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
    <ChannelScreen title={t('channels.postsTitle')} desc={t('channels.postsDesc')}>
      <SocialPostsTab />
    </ChannelScreen>
  );
};

export default SocialPostsScreen;
