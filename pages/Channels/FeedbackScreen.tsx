import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import FeedbackTab from './components/FeedbackTab';

/** Đánh giá fanpage + lead từ quảng cáo thu SĐT (chỉ đọc). */
const FeedbackScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
    <ChannelScreen title={t('channels.feedbackTitle')} desc={t('channels.feedbackDesc')}>
      <FeedbackTab />
    </ChannelScreen>
  );
};

export default FeedbackScreen;
