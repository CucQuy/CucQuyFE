import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import PagePostsTab from './components/PagePostsTab';

/** Bài viết trên fanpage — bấm vào bài để xem/trả lời bình luận của chính bài đó. */
const FacebookPostsScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
    <ChannelScreen title={t('channels.fbPostsTitle')} desc={t('channels.fbPostsDesc')}>
      <PagePostsTab lockPlatform="facebook" />
    </ChannelScreen>
  );
};

export default FacebookPostsScreen;
