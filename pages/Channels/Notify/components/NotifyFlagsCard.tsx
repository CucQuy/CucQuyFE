import React, { useState } from 'react';
import toast from 'react-hot-toast';
import type {
  NotifyFeatureDef,
  NotifyFeatureSection,
  NotifyFlag,
} from '@/services/notifySettingsService';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import Switch from '@/components/ui/Switch';
import Typography from '@/components/ui/Typography';

const SECTION_LABEL: Record<NotifyFeatureSection, string> = {
  order: 'Đơn hàng',
  payment: 'Thanh toán',
  daily: 'Nhắc việc theo ngày',
  other: 'Tổng hợp & khác',
};

interface Props {
  features: NotifyFeatureDef[];
  flags: NotifyFlag[];
  onToggle: (feature: string, enabled: boolean) => Promise<void>;
}

/**
 * Cờ tổng từng loại thông báo — áp cho MỌI kênh: tắt ở đây là không gửi, kể cả nơi
 * nhận đã bật chức năng đó.
 */
const NotifyFlagsCard: React.FC<Props> = ({ features, flags, onToggle }) => {
  const [pending, setPending] = useState<string | null>(null);
  const enabledOf = (key: string) =>
    flags.find((f) => f.feature === key)?.enabled !== false;

  const handle = async (key: string, next: boolean) => {
    setPending(key);
    try {
      await onToggle(key, next);
    } catch {
      toast.error('Không đổi được trạng thái chức năng');
    } finally {
      setPending(null);
    }
  };

  const sections = (['order', 'payment', 'daily', 'other'] as NotifyFeatureSection[])
    .map((s) => ({ section: s, items: features.filter((f) => f.section === s) }))
    .filter((s) => s.items.length > 0);

  return (
    <Card padding="lg" layoutClassName="space-y-3">
      <Box>
        <Typography size="sm" textClassName="font-semibold">
          Cờ tổng chức năng
        </Typography>
        <Typography size="xs" variant="muted">
          Áp cho mọi kênh. Tắt ở đây là không gửi, kể cả nơi nhận đã bật chức năng đó.
        </Typography>
      </Box>

      <Box layoutClassName="grid gap-4 md:grid-cols-2">
        {sections.map((sec) => (
          <Box key={sec.section} layoutClassName="space-y-1">
            <Typography
              size="xs"
              layoutClassName="block font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {SECTION_LABEL[sec.section]}
            </Typography>
            <Box layoutClassName="divide-y divide-slate-100 dark:divide-slate-700/60">
              {sec.items.map((f) => {
                const on = enabledOf(f.key);
                return (
                  <Box
                    key={f.key}
                    layoutClassName="flex items-center justify-between gap-3 py-2"
                  >
                    <Typography size="sm" textClassName={on ? undefined : 'text-slate-400 dark:text-slate-500'}>
                      {f.label}
                    </Typography>
                    {pending === f.key ? (
                      <Spinner size="sm" />
                    ) : (
                      <Switch
                        checked={on}
                        onCheckedChange={(v) => void handle(f.key, v)}
                        aria-label={f.label}
                      />
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        ))}
      </Box>
    </Card>
  );
};

export default NotifyFlagsCard;
