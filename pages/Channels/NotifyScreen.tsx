import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import ChannelScreen from './ChannelScreen';
import NotifyPage from '@/pages/Channels/Notify';

/** Tổng hợp cài đặt thông báo của mọi kênh (Zalo, và các kênh nối thêm sau). */
const NotifyScreen: React.FC = () => {
  const { t } = useLanguage();
  return (
    <ChannelScreen title={t('channels.notifyTitle')} desc={t('channels.notifyDesc')}>
      <Box layoutClassName="h-full overflow-y-auto">
        <NotifyPage />
      </Box>
    </ChannelScreen>
  );
};

export default NotifyScreen;
