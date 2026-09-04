import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import ChannelScreen from './ChannelScreen';
import InstagramConnectionCard from './components/InstagramConnectionCard';
import CommentAutoRulesCard from './components/CommentAutoRulesCard';

/** Cài đặt Instagram: tài khoản đang nối + luật tự động (dùng chung với Facebook). */
const InstagramSettingsScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
    <ChannelScreen title={t('channels.igSettingsTitle')} desc={t('channels.igSettingsDesc')}>
      <Box layoutClassName="space-y-4">
        <InstagramConnectionCard />
        <CommentAutoRulesCard />
      </Box>
    </ChannelScreen>
  );
};

export default InstagramSettingsScreen;
