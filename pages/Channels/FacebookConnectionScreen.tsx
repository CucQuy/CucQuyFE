import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import FacebookConnectionCard from './components/FacebookConnectionCard';

/** Trạng thái kết nối fanpage: page, token, quyền, webhook đang đăng ký. */
const FacebookConnectionScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
  <ChannelScreen
    title={t('channels.fbConnectionTitle')}
    desc={t('channels.fbConnectionDesc')}
  >
    <FacebookConnectionCard />
  </ChannelScreen>
  );
};

export default FacebookConnectionScreen;
