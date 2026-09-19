import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSaveZaloFeatures, useZaloFeatures } from '@/hooks/queries/useConfigQuery';
import { ZALO_NOTIFY_FEATURES, ZaloNotifyFeature } from '@/types';
import Badge from '@/components/ui/Badge';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import Switch from '@/components/ui/Switch';
import Typography from '@/components/ui/Typography';

/** Gom chức năng theo mảng việc để danh sách dài 12 dòng vẫn dễ đọc. */
const SECTIONS: { title: string; desc: string; features: ZaloNotifyFeature[] }[] = [
  {
    title: 'Đơn hàng',
    desc: 'Bắn vào nhóm khi đơn được tạo / sửa / xoá.',
    features: ['order_create', 'order_update', 'order_delete'],
  },
  {
    title: 'Thanh toán',
    desc: 'Webhook SePay báo tiền về.',
    features: ['payment'],
  },
  {
    title: 'Nhắc việc theo ngày',
    desc: 'Cron + nút gửi tay ở màn Thông báo.',
    features: ['delivery_due', 'production_tomorrow', 'unpaid', 'pending', 'stuck_pending'],
  },
  {
    title: 'Tổng hợp & khác',
    desc: 'Tổng kết ngày, tin gõ tay, kiểm tra kết nối.',
    features: ['daily_summary', 'custom', 'health_check'],
  },
];

/**
 * Bật/tắt từng chức năng thông báo Zalo (cờ tổng — 096).
 * Tắt là KHÔNG gửi kể cả nhóm đã được gán ở màn Nhóm; bật/tắt có hiệu lực ngay,
 * không cần bấm Lưu. Chức năng đang bật mà chưa nhóm nào nhận sẽ được cảnh báo.
 */
const ZaloFeaturesPage: React.FC = () => {
  const { data: flags, loading } = useZaloFeatures();
  const { save } = useSaveZaloFeatures();
  const [pending, setPending] = useState<string | null>(null);

  const byFeature = useMemo(() => {
    const m = new Map<string, (typeof flags)[number]>();
    for (const f of flags) m.set(f.feature, f);
    return m;
  }, [flags]);

  const toggle = async (feature: ZaloNotifyFeature, enabled: boolean) => {
    setPending(feature);
    try {
      await save([{ feature, enabled }]);
    } catch {
      toast.error('Không đổi được trạng thái chức năng');
    } finally {
      setPending(null);
    }
  };

  if (loading) {
    return (
      <Box layoutClassName="flex items-center justify-center py-10">
        <Spinner />
      </Box>
    );
  }

  return (
    <Box layoutClassName="space-y-4">
      {SECTIONS.map((sec) => (
        <Card key={sec.title} layoutClassName="space-y-1 p-0 overflow-hidden">
          <Box
            layoutClassName="px-4 py-3"
            borderClassName="border-b border-slate-100 dark:border-slate-700"
          >
            <Typography size="sm" textClassName="font-semibold">
              {sec.title}
            </Typography>
            <Typography size="xs" variant="muted">
              {sec.desc}
            </Typography>
          </Box>
          <Box layoutClassName="divide-y divide-slate-100 dark:divide-slate-700">
            {sec.features.map((key) => {
              const label = ZALO_NOTIFY_FEATURES.find((x) => x.value === key)?.label ?? key;
              const flag = byFeature.get(key);
              const enabled = flag?.enabled !== false;
              const groups = flag?.groups ?? [];
              return (
                <Box
                  key={key}
                  layoutClassName="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <Box layoutClassName="min-w-0 space-y-1">
                    <Typography size="sm" textClassName="font-medium">
                      {label}
                    </Typography>
                    {groups.length > 0 ? (
                      <Box layoutClassName="flex flex-wrap items-center gap-1">
                        {groups.map((g) => (
                          <Badge key={g.zaloGroupId} size="sm">
                            {g.name || g.zaloGroupId}
                          </Badge>
                        ))}
                      </Box>
                    ) : (
                      <Box layoutClassName="flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        <Typography size="xs" textClassName="text-amber-600 dark:text-amber-400">
                          Chưa nhóm nào nhận — gán ở màn Nhóm
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Box layoutClassName="flex shrink-0 items-center gap-2">
                    <Typography size="xs" variant="muted">
                      {enabled ? 'Đang bật' : 'Đang tắt'}
                    </Typography>
                    {pending === key ? (
                      <Spinner size="sm" />
                    ) : (
                      <Switch
                        checked={enabled}
                        onCheckedChange={(v) => void toggle(key, v)}
                        aria-label={label}
                      />
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Card>
      ))}
    </Box>
  );
};

export default ZaloFeaturesPage;
