import React, { useMemo, useState } from 'react';
import { Send, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendZaloTestMessage } from '@/services/zaloService';
import { UserData, UserRole } from '@/types/user';
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
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import Switch from '@/components/ui/Switch';
import Typography from '@/components/ui/Typography';

const userLabel = (u: UserData) => u.customName || u.displayName || u.email || u.uid;

export interface GroupDraft {
  /** ID nhóm Zalo thật (từ danh sách nhóm của nick đang gửi). */
  zaloGroupId: string;
  name: string;
  members: number;
  features: ZaloNotifyFeature[];
  memberUids: string[];
  updateFieldWhitelist: string[];
}

interface Props {
  group: GroupDraft | null;
  users: UserData[];
  /** uid → id nhóm khác đang giữ CTV đó (1 CTV chỉ thuộc 1 nhóm). */
  uidTakenBy: Map<string, string>;
  saving: boolean;
  onSave: (next: GroupDraft) => Promise<void>;
}

/**
 * Panel chức năng của 1 nhóm Zalo — nằm ngay cạnh danh sách nhóm (không modal):
 * bật/tắt loại thông báo nhóm nhận, chọn CTV thuộc nhóm (nhóm có CTV chỉ nhận đơn của
 * CTV đó) và lọc field khi báo sửa đơn. Parent truyền `key` theo id nhóm để panel
 * mount lại (seed draft) mỗi lần đổi nhóm.
 */
const GroupFeaturePanel: React.FC<Props> = ({ group, users, uidTakenBy, saving, onSave }) => {
  const [draft, setDraft] = useState<GroupDraft | null>(group);
  const [userSearch, setUserSearch] = useState('');
  const [testing, setTesting] = useState(false);

  const current = draft ?? group;

  const collaborators = useMemo(
    () =>
      users
        .filter((u) => u.role === UserRole.COLABORATOR)
        .filter((u) => {
          const q = userSearch.trim().toLowerCase();
          if (!q) return true;
          return userLabel(u).toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q);
        })
        .sort((a, b) => userLabel(a).localeCompare(userLabel(b))),
    [users, userSearch],
  );

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

  const toggleMember = (uid: string, on: boolean) =>
    patch({
      memberUids: on
        ? [...new Set([...current.memberUids, uid])]
        : current.memberUids.filter((x) => x !== uid),
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

        <Box
          layoutClassName="space-y-2 rounded-xl p-3"
          borderClassName="border border-slate-100 dark:border-slate-700/80"
          backgroundClassName="bg-slate-50/70 dark:bg-slate-800/40"
        >
          <Typography
            size="xs"
            layoutClassName="block font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            CTV thuộc nhóm ({current.memberUids.length})
          </Typography>
          <Typography size="xs" variant="muted">
            Có CTV trong nhóm → nhóm CHỈ nhận thông báo đơn do chính CTV đó tạo. Để trống nếu đây
            là nhóm nội bộ nhận theo chức năng ở trên.
          </Typography>
          <Input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Tìm CTV…"
            containerClassName="w-full"
          />
          <Box layoutClassName="max-h-48 space-y-1 overflow-y-auto">
            {collaborators.length === 0 ? (
              <Typography size="xs" variant="muted">
                Không có CTV nào khớp.
              </Typography>
            ) : (
              collaborators.map((u) => {
                const takenBy = uidTakenBy.get(u.uid);
                const inThis = current.memberUids.includes(u.uid);
                const blocked = !inThis && !!takenBy && takenBy !== current.zaloGroupId;
                return (
                  <Checkbox
                    key={u.uid}
                    checked={inThis}
                    disabled={blocked}
                    onChange={(e) => toggleMember(u.uid, e.target.checked)}
                    label={blocked ? `${userLabel(u)} · đã ở nhóm khác` : userLabel(u)}
                    labelClassName="text-xs font-medium text-slate-700 dark:text-slate-200"
                  />
                );
              })
            )}
          </Box>
        </Box>
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
