import React, { useState } from 'react';
import Box from '@/components/ui/Box';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';
import Tabs from '@/components/ui/Tabs';
import ScheduleTab from './components/ScheduleTab';
import CustomerNotifyTab from './components/CustomerNotifyTab';

type TabId = 'schedule' | 'customer';

const TABS: { id: TabId; label: string; desc: string }[] = [
  {
    id: 'schedule',
    label: 'Lịch định kỳ',
    desc: 'Lịch gửi thông báo tự động theo định kỳ — gom mọi kênh (hiện có Zalo + trong ứng dụng).',
  },
  {
    id: 'customer',
    label: 'Trạng thái thông báo',
    desc: 'Tin Zalo gửi cho KHÁCH theo SĐT: đơn nào gửi thành công, đơn nào lỗi (kèm lý do) và gửi lại.',
  },
];

/** Trang Thông báo: lịch gửi định kỳ + nhật ký trạng thái tin gửi cho khách. */
const NotificationsPage: React.FC = () => {
  const [tab, setTab] = useState<TabId>('schedule');
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <Box layoutClassName="space-y-4 p-4">
      <Box>
        <Heading level={2}>Thông báo</Heading>
        <Typography variant="muted" size="sm">
          {active.desc}
        </Typography>
      </Box>

      <Tabs items={TABS.map((t) => ({ id: t.id, label: t.label }))} value={tab} onChange={(v) => setTab(v as TabId)} />

      {tab === 'schedule' ? <ScheduleTab /> : <CustomerNotifyTab />}
    </Box>
  );
};

export default NotificationsPage;
