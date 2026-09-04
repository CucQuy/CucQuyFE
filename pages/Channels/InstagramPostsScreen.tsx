import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import PagePostsTab from './components/PagePostsTab';

/** Bài đăng Instagram — bấm vào bài để xem/trả lời bình luận của bài đó. */
const InstagramPostsScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
    <ChannelScreen title={t('channels.igPostsTitle')} desc={t('channels.igPostsDesc')}>
      <PagePostsTab lockPlatform="instagram" />
    </ChannelScreen>
  );
};

export default InstagramPostsScreen;
