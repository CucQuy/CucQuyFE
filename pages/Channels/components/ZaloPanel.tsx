import React from 'react';
import Box from '@/components/ui/Box';
import Tabs from '@/components/ui/Tabs';
import ZaloSettingsTab from '@/pages/Settings/ZaloSettingsTab';
import CustomerNotifyTab from '@/pages/Notifications/components/CustomerNotifyTab';
import OrderNotifyTable from '@/pages/OrderNotify/index';

interface Props {
  /** sub-tab hiện tại (đến từ ?sub= trên URL); rỗng → tab đầu. */
  sub: string;
  onSubChange: (id: string) => void;
}

const SUBS = [
  { id: 'groups', label: 'Nhóm & cài đặt' },
  { id: 'orders', label: 'Thông báo đơn' },
  { id: 'log', label: 'Nhật ký gửi' },
];

/**
 * Kênh Zalo trong "Kết nối đa kênh": cài đặt nhóm + thông báo cho khách (màn cũ
 * /settings/zalo), bảng trạng thái thông báo theo đơn (cũ /order-notify) và nhật ký
 * từng lần gửi (cũ: tab trong /notifications). Tái dùng nguyên component, không viết lại.
 */
const ZaloPanel: React.FC<Props> = ({ sub, onSubChange }) => {
  const active = SUBS.some((s) => s.id === sub) ? sub : SUBS[0].id;

  return (
    <Box layoutClassName="flex h-full flex-col gap-3">
      <Tabs items={SUBS} value={active} onChange={onSubChange} />
      <Box layoutClassName="min-h-0 flex-1 overflow-auto">
        {active === 'groups' ? <ZaloSettingsTab /> : null}
        {active === 'orders' ? <OrderNotifyTable /> : null}
        {active === 'log' ? <CustomerNotifyTab /> : null}
      </Box>
    </Box>
  );
};

export default ZaloPanel;
