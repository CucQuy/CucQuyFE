import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Box from '@/components/ui/Box';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';
import ZaloPanel from './components/ZaloPanel';

/**
 * Screen "Zalo" trong nhóm Kết nối đa kênh: nhóm nhận thông báo + cài đặt tin gửi khách,
 * bảng trạng thái thông báo theo đơn, nhật ký từng lần gửi.
 * Sub-tab đồng bộ lên URL (?sub=) để F5 / gửi link vẫn đúng chỗ.
 */
const ZaloChannelPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const sub = params.get('sub') ?? '';

  const setSub = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('sub', id);
    setParams(next, { replace: true });
  };

  return (
    <Box layoutClassName="flex h-full flex-col gap-4 p-4">
      <Box>
        <Heading level={2}>Zalo</Heading>
        <Typography variant="muted" size="sm">
          Nhóm nhận thông báo đơn, tin gửi khách và nhật ký đã gửi.
        </Typography>
      </Box>
      <Box layoutClassName="min-h-0 flex-1">
        <ZaloPanel sub={sub} onSubChange={setSub} />
      </Box>
    </Box>
  );
};

export default ZaloChannelPage;
