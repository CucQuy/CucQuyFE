import React from 'react';
import ChannelScreen from './ChannelScreen';
import CustomerNotifyTab from '@/pages/Notifications/components/CustomerNotifyTab';

/** Nhật ký từng lần gửi tin Zalo cho khách + gửi lại khi lỗi. */
const ZaloLogScreen: React.FC = () => (
  <ChannelScreen
    title="Zalo · Nhật ký gửi"
    desc="Từng lần gửi tin cho khách: thành công, lỗi kèm lý do và nút gửi lại."
  >
    <CustomerNotifyTab />
  </ChannelScreen>
);

export default ZaloLogScreen;
