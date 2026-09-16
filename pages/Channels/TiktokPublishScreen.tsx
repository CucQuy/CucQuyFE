import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChannelScreen from './ChannelScreen';
import TiktokPublishTab from './components/TiktokPublishTab';

/** Đăng video lên TikTok từ app — đăng thẳng hoặc gửi vào nháp, có hẹn giờ. */
const TiktokPublishScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
    <ChannelScreen title={t('channels.ttPublishTitle')} desc={t('channels.ttPublishDesc')}>
      <TiktokPublishTab />
    </ChannelScreen>
  );
};

export default TiktokPublishScreen;
