import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Box from '@/components/ui/Box';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';
import FacebookPanel from './components/FacebookPanel';

/**
 * Screen "Facebook" trong nhóm Kết nối đa kênh: khách đã inbox + gửi tin hàng loạt,
 * quản lý bình luận fanpage, và trạng thái kết nối (page / token / quyền / webhook).
 */
const FacebookChannelPage: React.FC = () => {
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
        <Heading level={2}>Facebook</Heading>
        <Typography variant="muted" size="sm">
          Fanpage: khách đã inbox, gửi tin hàng loạt và quản lý bình luận.
        </Typography>
      </Box>
      <Box layoutClassName="min-h-0 flex-1">
        <FacebookPanel sub={sub} onSubChange={setSub} />
      </Box>
    </Box>
  );
};

export default FacebookChannelPage;
