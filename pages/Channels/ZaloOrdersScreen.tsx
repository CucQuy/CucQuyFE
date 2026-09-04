import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import OrderNotifyTable from '@/pages/OrderNotify/index';

/** Bảng đơn × trạng thái thông báo đã gửi cho khách (màn /order-notify cũ). */
const ZaloOrdersScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
  <ChannelScreen
    title={t('channels.zaloOrdersTitle')}
    desc={t('channels.zaloOrdersDesc')}
  >
    <OrderNotifyTable />
  </ChannelScreen>
  );
};

export default ZaloOrdersScreen;
