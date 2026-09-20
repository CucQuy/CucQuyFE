import React, { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
  useNotifySettings,
  useNotifySettingsMutations,
} from '@/hooks/queries/useNotifySettingsQuery';
import type { NotifyChannelId } from '@/services/notifySettingsService';
import Badge from '@/components/ui/Badge';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import Typography from '@/components/ui/Typography';
import ScheduleTab from '@/pages/Notifications/components/ScheduleTab';
import NotifyTargetTable from './components/NotifyTargetTable';
import NotifyFlagsCard from './components/NotifyFlagsCard';
import NotifyCustomerCard from './components/NotifyCustomerCard';

/**
 * Màn "Thông báo" (Kết nối đa kênh) — 1 chỗ cho toàn bộ cài đặt thông báo:
 *   • chọn kênh (Zalo hôm nay; Facebook/Instagram/TikTok hiện sẵn, mờ tới khi nối)
 *   • bảng nơi nhận của kênh + bật/tắt chức năng từng nơi
 *   • tin gửi khách của kênh
 *   • cờ tổng chức năng (áp mọi kênh) + lịch gửi định kỳ
 * Mọi thứ render từ payload /notify-settings nên thêm kênh KHÔNG phải sửa màn này.
 */
const NotifyPage: React.FC = () => {
  const { data, loading, refetch } = useNotifySettings();
  const { setFlags, setTarget, setCustomer } = useNotifySettingsMutations();
  const [active, setActive] = useState<NotifyChannelId>('zalo');

  const channels = data?.channels ?? [];
  const channel = useMemo(
    () => channels.find((c) => c.channel === active) ?? channels[0] ?? null,
    [channels, active],
  );

  if (loading && !data) {
    return (
      <Box layoutClassName="flex items-center justify-center py-16">
        <Spinner />
      </Box>
    );
  }

  return (
    <Box layoutClassName="space-y-4">
      {/* Chọn kênh — kênh chưa nối vẫn hiện để biết sắp có gì. */}
      <Card padding="lg" layoutClassName="space-y-3">
        <Box layoutClassName="flex flex-wrap items-center gap-2">
          {channels.map((c) => {
            const on = c.channel === channel?.channel;
            return (
              <Button
                key={c.channel}
                type="button"
                variant="ghost"
                onClick={() => setActive(c.channel)}
                disabled={!c.supported}
                sizeClassName="px-3 py-1.5 text-xs"
                roundedClassName="rounded-full"
                layoutClassName="inline-flex items-center gap-1.5 font-medium"
                borderClassName={
                  on
                    ? 'border border-primary-300 dark:border-primary-700'
                    : 'border border-slate-200 dark:border-slate-600'
                }
                backgroundClassName={on ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-transparent'}
                textClassName={
                  on
                    ? 'text-primary-800 dark:text-primary-200'
                    : 'text-slate-500 dark:text-slate-400'
                }
                stateClassName="transition-colors"
                disableVariantHover
                disableVariantTextColor
              >
                {c.label}
                {!c.supported ? (
                  <Badge size="sm" textClassName="text-slate-400 dark:text-slate-500">
                    sắp có
                  </Badge>
                ) : !c.connected ? (
                  <Badge
                    size="sm"
                    borderClassName="border-amber-200 dark:border-amber-800"
                    backgroundClassName="bg-amber-50 dark:bg-amber-950/40"
                    textClassName="text-amber-700 dark:text-amber-300"
                  >
                    chưa nối
                  </Badge>
                ) : (
                  <Badge
                    size="sm"
                    borderClassName="border-primary-200 dark:border-primary-800"
                    backgroundClassName="bg-primary-50 dark:bg-primary-950/40"
                    textClassName="text-primary-700 dark:text-primary-300"
                  >
                    {c.targets.length}
                  </Badge>
                )}
              </Button>
            );
          })}
          <Box layoutClassName="ml-auto">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void refetch()}
              disabled={loading}
              sizeClassName="px-3 py-1.5 text-xs"
              leftIcon={loading ? <Spinner size="sm" /> : <RefreshCw className="h-3.5 w-3.5" />}
              iconClassName="inline-flex shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5"
              layoutClassName="inline-flex items-center gap-1.5"
            >
              {loading ? 'Đang nạp…' : 'Nạp lại'}
            </Button>
          </Box>
        </Box>

        {channel?.note ? (
          <Box layoutClassName="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <Typography size="xs" textClassName="text-amber-700 dark:text-amber-300">
              {channel.note}
            </Typography>
          </Box>
        ) : null}

        {channel ? (
          <NotifyTargetTable
            channel={channel}
            features={data?.features ?? []}
            onSave={(target, patch) =>
              setTarget({
                channel: channel.channel,
                targetId: target.id,
                name: target.name,
                ...patch,
              })
            }
          />
        ) : null}
      </Card>

      {channel?.customer ? (
        <NotifyCustomerCard
          key={channel.channel}
          channel={channel}
          onSave={(patch) => setCustomer({ channel: channel.channel, patch })}
        />
      ) : null}

      <NotifyFlagsCard
        features={data?.features ?? []}
        flags={data?.flags ?? []}
        onToggle={(feature, enabled) => setFlags([{ feature, enabled }])}
      />

      {/* Lịch gửi định kỳ — dùng chung, không thuộc kênh nào. */}
      <Card padding="lg" layoutClassName="space-y-3">
        <Box>
          <Typography size="sm" textClassName="font-semibold">
            Lịch gửi định kỳ
          </Typography>
          <Typography size="xs" variant="muted">
            Cron gửi tự động theo giờ — áp cho nơi nhận đã bật chức năng tương ứng.
          </Typography>
        </Box>
        <ScheduleTab />
      </Card>
    </Box>
  );
};

export default NotifyPage;
