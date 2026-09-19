import React, { useState } from 'react';
import { Send, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendZaloTestMessage } from '@/services/zaloService';
import {
  ZALO_NOTIFY_FEATURES,
  ZALO_TRACKABLE_FIELDS,
  ZaloGroupConfig,
  ZaloNotifyFeature,
} from '@/types';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Checkbox from '@/components/ui/Checkbox';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';
import Switch from '@/components/ui/Switch';
import Typography from '@/components/ui/Typography';

export interface GroupDraft {
  /** ID nhóm Zalo thật (từ danh sách nhóm của nick đang gửi). */
  zaloGroupId: string;
  name: string;
  members: number;
  features: ZaloNotifyFeature[];
  updateFieldWhitelist: string[];
}

interface Props {
  group: GroupDraft | null;
  saving: boolean;
  onSave: (next: GroupDraft) => Promise<void>;
}

/**
 * Panel chức năng của 1 nhóm Zalo — nằm ngay cạnh danh sách nhóm (không modal):
 * bật/tắt loại thông báo nhóm nhận và lọc field khi báo sửa đơn. Parent truyền `key`
 * theo id nhóm để panel mount lại (seed draft) mỗi lần đổi nhóm.
 */
const GroupFeaturePanel: React.FC<Props> = ({ group, saving, onSave }) => {
  const [draft, setDraft] = useState<GroupDraft | null>(group);
  const [testing, setTesting] = useState(false);

  const current = draft ?? group;

  if (!current) {
    return (
      <Card
        padding="none"
        layoutClassName="flex h-full items-center justify-center"
        borderClassName="border-slate-100 dark:border-slate-700"
      >
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Chọn một nhóm bên trái"
          description="Chức năng thông báo của nhóm đó sẽ hiện ở đây để bật/tắt."
        />
      </Card>
    );
  }

  const patch = (p: Partial<GroupDraft>) => setDraft({ ...current, ...p });

  const toggleFeature = (f: ZaloNotifyFeature, on: boolean) =>
    patch({
      features: on ? [...new Set([...current.features, f])] : current.features.filter((x) => x !== f),
    });

  const toggleField = (key: string, on: boolean) =>
    patch({
      updateFieldWhitelist: on
        ? [...new Set([...current.updateFieldWhitelist, key])]
        : current.updateFieldWhitelist.filter((x) => x !== key),
    });

  const handleTest = async () => {
    setTesting(true);
    const r = await sendZaloTestMessage(current.zaloGroupId);
    setTesting(false);
    if (r.ok) toast.success(`Đã gửi tin test vào "${current.name}"`);
    else toast.error(r.error || 'Gửi test thất bại');
  };

  return (
    <Card
      padding="none"
      layoutClassName="flex h-full flex-col overflow-hidden"
      borderClassName="border-slate-100 dark:border-slate-700"
    >
      <Box
        layoutClassName="shrink-0 space-y-0.5 px-4 py-3"
        borderClassName="border-b border-slate-100 dark:border-slate-700"
      >
        <Typography size="sm" textClassName="font-semibold">
          {current.name || current.zaloGroupId}
        </Typography>
        <Typography size="xs" variant="muted">
          {current.members ? `${current.members} thành viên · ` : ''}ID {current.zaloGroupId}
        </Typography>
      </Box>

      <Box layoutClassName="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <Box layoutClassName="space-y-1">
          <Typography
            size="xs"
            layoutClassName="block font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            Chức năng thông báo
          </Typography>
          <Box layoutClassName="divide-y divide-slate-100 dark:divide-slate-700/60">
            {ZALO_NOTIFY_FEATURES.map((f) => (
              <Box key={f.value} layoutClassName="flex items-center justify-between gap-3 py-2">
                <Typography size="sm" textClassName="text-slate-700 dark:text-slate-200">
                  {f.label}
                </Typography>
                <Switch
                  checked={current.features.includes(f.value)}
                  onCheckedChange={(v) => toggleFeature(f.value, v)}
                  aria-label={f.label}
                />
              </Box>
            ))}
          </Box>
        </Box>

        {current.features.includes('order_update') ? (
          <Box
            layoutClassName="space-y-2 rounded-xl p-3"
            borderClassName="border border-slate-100 dark:border-slate-700/80"
            backgroundClassName="bg-slate-50/70 dark:bg-slate-800/40"
          >
            <Typography
              size="xs"
              layoutClassName="block font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              Chỉ báo khi sửa các field
            </Typography>
            <Typography size="xs" variant="muted">
              Không chọn gì = báo mọi thay đổi.
            </Typography>
            <Box layoutClassName="grid gap-1.5 sm:grid-cols-2">
              {ZALO_TRACKABLE_FIELDS.map((f) => (
                <Checkbox
                  key={f.key}
                  checked={current.updateFieldWhitelist.includes(f.key)}
                  onChange={(e) => toggleField(f.key, e.target.checked)}
                  label={f.label}
                  labelClassName="text-xs font-medium text-slate-700 dark:text-slate-200"
                />
              ))}
            </Box>
          </Box>
        ) : null}

      </Box>

      <Box
        layoutClassName="flex shrink-0 items-center justify-between gap-2 px-4 py-3"
        borderClassName="border-t border-slate-100 dark:border-slate-700"
      >
        <Button
          type="button"
          onClick={() => void handleTest()}
          disabled={testing}
          variant="secondary"
          leftIcon={testing ? <Spinner size="sm" /> : <Send className="h-3.5 w-3.5" />}
        >
          {testing ? 'Đang gửi…' : 'Gửi tin test'}
        </Button>
        <Button
          type="button"
          onClick={() => void onSave(current)}
          disabled={saving}
          leftIcon={saving ? <Spinner size="sm" /> : undefined}
        >
          {saving ? 'Đang lưu…' : 'Lưu nhóm này'}
        </Button>
      </Box>
    </Card>
  );
};

export default GroupFeaturePanel;
export type { ZaloGroupConfig };
