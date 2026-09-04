import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import InstagramConnectionCard from './components/InstagramConnectionCard';

/** Tài khoản Instagram đang nối với fanpage (dùng chung page token). */
const InstagramConnectionScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
    <ChannelScreen title={t('channels.igConnectionTitle')} desc={t('channels.igConnectionDesc')}>
      <InstagramConnectionCard />
    </ChannelScreen>
  );
};

export default InstagramConnectionScreen;
