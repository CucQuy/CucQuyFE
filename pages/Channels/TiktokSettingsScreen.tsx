import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import ChannelScreen from './ChannelScreen';
import TiktokConnectionCard from './components/TiktokConnectionCard';

/** Cài đặt TikTok: tài khoản đang nối (OAuth) + token đang có quyền gì. */
const TiktokSettingsScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
    <ChannelScreen title={t('channels.ttSettingsTitle')} desc={t('channels.ttSettingsDesc')}>
      <Box layoutClassName="space-y-4">
        <TiktokConnectionCard />
      </Box>
    </ChannelScreen>
  );
};

export default TiktokSettingsScreen;
