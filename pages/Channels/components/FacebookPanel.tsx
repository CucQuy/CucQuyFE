import React from 'react';
import Box from '@/components/ui/Box';
import Tabs from '@/components/ui/Tabs';
import FacebookCustomers from '@/pages/FacebookCustomers/index';
import FacebookConnectionCard from './FacebookConnectionCard';
import FacebookCommentsTab from './FacebookCommentsTab';

interface Props {
  sub: string;
  onSubChange: (id: string) => void;
}

const SUBS = [
  { id: 'customers', label: 'Khách & gửi tin' },
  { id: 'comments', label: 'Bình luận' },
  { id: 'connection', label: 'Kết nối' },
];

/**
 * Kênh Facebook: khách đã inbox + gửi tin hàng loạt (màn cũ /facebook), quản lý bình luận
 * fanpage, và trạng thái kết nối (page, webhook, quyền token).
 */
const FacebookPanel: React.FC<Props> = ({ sub, onSubChange }) => {
  const active = SUBS.some((s) => s.id === sub) ? sub : SUBS[0].id;

  return (
    <Box layoutClassName="flex h-full flex-col gap-3">
      <Tabs items={SUBS} value={active} onChange={onSubChange} />
      <Box layoutClassName="min-h-0 flex-1 overflow-auto">
        {active === 'customers' ? <FacebookCustomers /> : null}
        {active === 'comments' ? <FacebookCommentsTab /> : null}
        {active === 'connection' ? <FacebookConnectionCard /> : null}
      </Box>
    </Box>
  );
};

export default FacebookPanel;
