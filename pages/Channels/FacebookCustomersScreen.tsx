import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import MessagesInbox from './components/MessagesInbox';

/** Khách đã inbox fanpage + gửi tin hàng loạt (chỉ trong cửa sổ 24h của Meta). */
const FacebookCustomersScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
  <ChannelScreen
    title={t('channels.fbMessagesTitle')}
    desc={t('channels.fbMessagesDesc')}
  >
    <MessagesInbox platform="facebook" />
  </ChannelScreen>
  );
};

export default FacebookCustomersScreen;
