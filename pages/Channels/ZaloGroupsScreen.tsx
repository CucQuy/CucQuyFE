import React from 'react';
import ChannelScreen from './ChannelScreen';
import ZaloSettingsTab from '@/pages/Settings/ZaloSettingsTab';

/** Nhóm Zalo nhận thông báo + cài đặt tin gửi khách (màn /settings/zalo cũ). */
const ZaloGroupsScreen: React.FC = () => (
  <ChannelScreen
    title="Zalo · Nhóm & cài đặt"
    desc="Nhóm nhận thông báo đơn, ID nhóm và cài đặt tin gửi cho khách."
  >
    <ZaloSettingsTab />
  </ChannelScreen>
);

export default ZaloGroupsScreen;
