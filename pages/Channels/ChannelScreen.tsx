import React from 'react';
import Box from '@/components/ui/Box';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';

interface Props {
  title: string;
  desc: string;
  children: React.ReactNode;
}

/**
 * Khung chung cho các screen trong "Kết nối đa kênh" — mỗi việc 1 màn riêng (không tab)
 * để phân quyền lẻ từng màn ở Cài đặt → Màn hình.
 */
const ChannelScreen: React.FC<Props> = ({ title, desc, children }) => (
  <Box layoutClassName="flex h-full flex-col gap-4 p-4">
    <Box>
      <Heading level={2}>{title}</Heading>
      <Typography variant="muted" size="sm">
        {desc}
      </Typography>
    </Box>
    <Box layoutClassName="min-h-0 flex-1">{children}</Box>
  </Box>
);

export default ChannelScreen;
