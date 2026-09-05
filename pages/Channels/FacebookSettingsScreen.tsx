import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import ChannelScreen from './ChannelScreen';
import FacebookConnectionCard from './components/FacebookConnectionCard';
import CommentAutoRulesCard from './components/CommentAutoRulesCard';
import FeedbackTab from './components/FeedbackTab';

/** Cài đặt Facebook: trạng thái kết nối (token/quyền/webhook) + luật tự động cho bình luận. */
const FacebookSettingsScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
    <ChannelScreen title={t('channels.fbSettingsTitle')} desc={t('channels.fbSettingsDesc')}>
      <Box layoutClassName="space-y-4">
        <FacebookConnectionCard />
        <CommentAutoRulesCard />
        {/* Đánh giá khách để lại + lead từ quảng cáo — chỉ đọc, gộp vào đây cho gọn màn. */}
        <FeedbackTab />
      </Box>
    </ChannelScreen>
  );
};

export default FacebookSettingsScreen;
