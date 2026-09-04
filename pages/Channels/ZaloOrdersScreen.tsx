import React from 'react';
import ChannelScreen from './ChannelScreen';
import OrderNotifyTable from '@/pages/OrderNotify/index';

/** Bảng đơn × trạng thái thông báo đã gửi cho khách (màn /order-notify cũ). */
const ZaloOrdersScreen: React.FC = () => (
  <ChannelScreen
    title="Zalo · Thông báo đơn"
    desc="Đơn nào đã gửi tin cho khách, đơn nào lỗi hoặc chưa gửi."
  >
    <OrderNotifyTable />
  </ChannelScreen>
);

export default ZaloOrdersScreen;
