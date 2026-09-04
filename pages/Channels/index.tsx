import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Box from '@/components/ui/Box';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';
import Tabs from '@/components/ui/Tabs';
import ZaloPanel from './components/ZaloPanel';
import FacebookPanel from './components/FacebookPanel';

export type ChannelId = 'zalo' | 'facebook';

const CHANNELS: { id: ChannelId; label: string; desc: string }[] = [
  {
    id: 'zalo',
    label: 'Zalo',
    desc: 'Nhóm nhận thông báo đơn, tin gửi khách và nhật ký đã gửi.',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    desc: 'Fanpage: khách đã inbox, gửi tin hàng loạt và quản lý bình luận.',
  },
];

/**
 * "Kết nối đa kênh" — gom mọi thứ liên quan kênh chat về 1 chỗ (trước đây nằm rải ở
 * /settings/zalo, /facebook, /order-notify và tab trong /notifications).
 *
 * Tab được đồng bộ lên URL (?tab=zalo&sub=groups) để F5 / gửi link cho nhau vẫn đúng chỗ —
 * các trang tab khác trong app đang dùng useState nên mất tab khi tải lại.
 */
const ChannelsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') === 'facebook' ? 'facebook' : 'zalo') as ChannelId;
  const sub = params.get('sub') ?? '';

  const active = useMemo(() => CHANNELS.find((c) => c.id === tab) ?? CHANNELS[0], [tab]);

  const setTab = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    next.delete('sub'); // đổi kênh → về sub-tab đầu của kênh đó
    setParams(next, { replace: true });
  };

  const setSub = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', tab);
    next.set('sub', id);
    setParams(next, { replace: true });
  };

  return (
    <Box layoutClassName="flex h-full flex-col gap-4 p-4">
      <Box>
        <Heading level={2}>Kết nối đa kênh</Heading>
        <Typography variant="muted" size="sm">
          {active.desc}
        </Typography>
      </Box>

      <Tabs
        items={CHANNELS.map((c) => ({ id: c.id, label: c.label }))}
        value={tab}
        onChange={setTab}
      />

      <Box layoutClassName="min-h-0 flex-1">
        {tab === 'zalo' ? <ZaloPanel sub={sub} onSubChange={setSub} /> : null}
        {tab === 'facebook' ? <FacebookPanel sub={sub} onSubChange={setSub} /> : null}
      </Box>
    </Box>
  );
};

export default ChannelsPage;
