import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import FacebookCommentsTab from './components/FacebookCommentsTab';

/** Bình luận fanpage: trả lời, nhắn riêng, ẩn/xoá + luật tự động. */
const FacebookCommentsScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
  <ChannelScreen
    title={t('channels.fbCommentsTitle')}
    desc={t('channels.fbCommentsDesc')}
  >
    <FacebookCommentsTab />
  </ChannelScreen>
  );
};

export default FacebookCommentsScreen;
