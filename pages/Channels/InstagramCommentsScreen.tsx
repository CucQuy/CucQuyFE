import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import FacebookCommentsTab from './components/FacebookCommentsTab';

/** Bình luận Instagram — cùng bộ máy với Facebook, khoá nguồn về 'instagram'. */
const InstagramCommentsScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
    <ChannelScreen title={t('channels.igCommentsTitle')} desc={t('channels.igCommentsDesc')}>
      <FacebookCommentsTab lockPlatform="instagram" />
    </ChannelScreen>
  );
};

export default InstagramCommentsScreen;
