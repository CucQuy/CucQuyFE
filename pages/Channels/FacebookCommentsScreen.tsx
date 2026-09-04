import React from 'react';
import ChannelScreen from './ChannelScreen';
import FacebookCommentsTab from './components/FacebookCommentsTab';

/** Bình luận fanpage: trả lời, nhắn riêng, ẩn/xoá + luật tự động. */
const FacebookCommentsScreen: React.FC = () => (
  <ChannelScreen
    title="Facebook · Bình luận"
    desc="Trả lời, nhắn riêng, ẩn hoặc xoá bình luận; đặt luật tự ẩn SĐT / từ khoá."
  >
    <FacebookCommentsTab />
  </ChannelScreen>
);

export default FacebookCommentsScreen;
