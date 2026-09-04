import React from 'react';
import ChannelScreen from './ChannelScreen';
import FacebookCustomers from '@/pages/FacebookCustomers/index';

/** Khách đã inbox fanpage + gửi tin hàng loạt (chỉ trong cửa sổ 24h của Meta). */
const FacebookCustomersScreen: React.FC = () => (
  <ChannelScreen
    title="Facebook · Khách & gửi tin"
    desc="Người đã nhắn fanpage; gửi tin hàng loạt cho nhóm còn nhắn được."
  >
    <FacebookCustomers />
  </ChannelScreen>
);

export default FacebookCustomersScreen;
