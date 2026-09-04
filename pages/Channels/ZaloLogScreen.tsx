import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import CustomerNotifyTab from '@/pages/Notifications/components/CustomerNotifyTab';

/** Nhật ký từng lần gửi tin Zalo cho khách + gửi lại khi lỗi. */
const ZaloLogScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
  <ChannelScreen
    title={t('channels.zaloLogTitle')}
    desc={t('channels.zaloLogDesc')}
  >
    <CustomerNotifyTab />
  </ChannelScreen>
  );
};

export default ZaloLogScreen;
