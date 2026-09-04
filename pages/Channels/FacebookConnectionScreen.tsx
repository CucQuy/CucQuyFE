import React from 'react';
import ChannelScreen from './ChannelScreen';
import FacebookConnectionCard from './components/FacebookConnectionCard';

/** Trạng thái kết nối fanpage: page, token, quyền, webhook đang đăng ký. */
const FacebookConnectionScreen: React.FC = () => (
  <ChannelScreen
    title="Facebook · Kết nối"
    desc="Fanpage đang nối, token còn hiệu lực không, có quyền gì và webhook nhận sự kiện nào."
  >
    <FacebookConnectionCard />
  </ChannelScreen>
);

export default FacebookConnectionScreen;
