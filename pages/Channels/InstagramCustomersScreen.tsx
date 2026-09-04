import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import FacebookCustomers from '@/pages/FacebookCustomers/index';

/** Người nhắn tin Instagram Direct — dùng lại màn khách, lọc theo nền tảng. */
const InstagramCustomersScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
    <ChannelScreen title={t('channels.igMessagesTitle')} desc={t('channels.igMessagesDesc')}>
      <FacebookCustomers platform="instagram" />
    </ChannelScreen>
  );
};

export default InstagramCustomersScreen;
