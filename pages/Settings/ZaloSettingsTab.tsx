import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Hash,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { sendZaloTestMessage, fetchZaloBridgeGroups, type ZaloBridgeGroup } from '@/services/zaloService';
import { fetchCustomerNotifyPreview } from '@/services/orderService';
import { usePromotions } from '@/hooks/queries/usePromotionsQuery';
import { useSaveZaloGroups, useZaloGroups } from '@/hooks/queries/useConfigQuery';
import { useUsers, useUserMutations } from '@/hooks/queries/useUsersQuery';
import { useAuth } from '@/contexts/AuthContext';
import { UserData, UserRole } from '@/types/user';
import { ZALO_TRACKABLE_FIELDS, ZaloGroupConfig } from '@/types';
import toast from 'react-hot-toast';
import BaseModal from '@/components/BaseModal';
import Badge from '@/components/ui/Badge';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import IconButton from '@/components/ui/IconButton';
import FilterToolbar from '@/components/shared/FilterToolbar';
import Heading from '@/components/ui/Heading';
import Input from '@/components/ui/Input';
import Checkbox from '@/components/ui/Checkbox';
import Label from '@/components/ui/Label';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';
import Typography from '@/components/ui/Typography';
import ZaloIcon from '@/components/ui/ZaloIcon';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table';

const userLabel = (u: UserData) =>
  u.customName || u.displayName || u.email || u.uid;

const initials = (u: UserData) => {
  const s = userLabel(u).trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
};

const maskZaloGroupId = (id: string): string => {
  const t = id.trim();
  if (!t) return '';
  if (t.length <= 6) return '•'.repeat(Math.min(t.length, 8));
  return `${'•'.repeat(Math.max(4, t.length - 4))}${t.slice(-4)}`;
};

const uidInOtherGroup = (groups: ZaloGroupConfig[], uid: string, excludeGroupId: string) =>
  groups.some((g) => g.id !== excludeGroupId && g.memberUids.includes(uid));

type AvatarSize = 'sm' | 'md' | 'lg';

const avatarSizeClass: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-12 w-12 text-sm',
};

const UserAvatar: React.FC<{
  user: UserData | null | undefined;
  size?: AvatarSize;
}> = ({ user, size = 'sm' }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const url = user?.photoURL?.trim();

  useEffect(() => {
    setImgFailed(false);
  }, [url, user?.uid]);

  const dim = avatarSizeClass[size];
  const ring = 'ring-2 ring-white dark:ring-slate-900';

  if (url && !imgFailed) {
    return (
      <span
        className={`relative inline-flex shrink-0 overflow-hidden rounded-full shadow-sm ${dim} ${ring}`}
      >
        <img
          src={url}
          alt={user ? userLabel(user) : ''}
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-sm ${dim} bg-gradient-to-br from-primary-500 to-primary-600 ${ring}`}
    >
      {user ? initials(user) : '?'}
    </span>
  );
};

const ZaloSettingsTab: React.FC = () => {
  const { currentUser } = useAuth();
  const { data: zaloConfig, loading: zaloLoading, error: zaloError } = useZaloGroups();
  const { users, loading: usersLoading } = useUsers();
  const { save: saveZaloGroups } = useSaveZaloGroups();
  const { updateRole: updateUserRoleMut } = useUserMutations();
  const [groups, setGroups] = useState<ZaloGroupConfig[]>([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [mainGroupId, setMainGroupId] = useState('');
  // ── Thông báo Zalo cho KHÁCH (cảm ơn + link tra đơn + mã KM) ──
  const { promotions } = usePromotions();
  const [custEnabled, setCustEnabled] = useState(false);
  const [custPromotionId, setCustPromotionId] = useState('');
  const [custDailyLimit, setCustDailyLimit] = useState(40);
  const [custPreview, setCustPreview] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  // Danh sách nhóm THẬT lấy từ Zalo (qua bridge) để chọn đúng ID thay vì copy tay.
  // Chống bấm Test dồn: bridge Abit có anti-abuse, bắn liên tiếp là bị CHẶN IP
  // (mọi noti sau đó fail với "fetch failed"). Khoá nút 15s sau mỗi lần gửi.
  const [testCooldownUntil, setTestCooldownUntil] = useState(0);
  const [bridgeGroups, setBridgeGroups] = useState<ZaloBridgeGroup[] | null>(null);
  const [loadingBridgeGroups, setLoadingBridgeGroups] = useState(false);
  const [mainNotifyOnCreate, setMainNotifyOnCreate] = useState(true);
  const [mainNotifyOnUpdate, setMainNotifyOnUpdate] = useState(true);
  const [mainNotifyOnDelete, setMainNotifyOnDelete] = useState(true);
  const [mainUpdateFieldWhitelist, setMainUpdateFieldWhitelist] = useState<string[]>([]);
  const [testingGroupId, setTestingGroupId] = useState<string | null>(null);
  const [groupModalId, setGroupModalId] = useState<string | null>(null);
  const [pickUidsModal, setPickUidsModal] = useState<string[]>([]);
  const [editingZaloId, setEditingZaloId] = useState(false);
  const [peekZaloId, setPeekZaloId] = useState(false);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [pickerDropdownRect, setPickerDropdownRect] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const userPickerRef = useRef<HTMLDivElement>(null);
  const userPickerAnchorRef = useRef<HTMLButtonElement>(null);
  const userPickerDropdownRef = useRef<HTMLDivElement>(null);

  const loading = zaloLoading || usersLoading;

  // Seed local (optimistic) state từ React Query khi config tải xong / refetch.
  // Component vẫn giữ local copy vì mutate nhiều state cục bộ trước khi persist.
  useEffect(() => {
    if (!zaloConfig) return;
    setGroups(zaloConfig.groups);
    setMainGroupId(zaloConfig.mainGroupId ?? '');
    setMainNotifyOnCreate(zaloConfig.mainNotifyOnCreate !== false);
    setMainNotifyOnUpdate(zaloConfig.mainNotifyOnUpdate !== false);
    setMainNotifyOnDelete(zaloConfig.mainNotifyOnDelete !== false);
    setMainUpdateFieldWhitelist(zaloConfig.mainUpdateFieldWhitelist ?? []);
    setCustEnabled(zaloConfig.customerNotifyEnabled === true);
    setCustPromotionId(zaloConfig.customerNotifyPromotionId ?? '');
    setCustDailyLimit(
      typeof zaloConfig.customerNotifyDailyLimit === 'number' ? zaloConfig.customerNotifyDailyLimit : 40,
    );
  }, [zaloConfig]);

  useEffect(() => {
    if (zaloError) {
      console.error(zaloError);
      toast.error('Không tải được cấu hình Zalo');
    }
  }, [zaloError]);

  const userByUid = useMemo(() => {
    const m = new Map<string, UserData>();
    users.forEach((u) => m.set(u.uid, u));
    return m;
  }, [users]);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) => g.name.toLowerCase().includes(q) || g.zaloGroupId.toLowerCase().includes(q),
    );
  }, [groups, groupSearch]);

  const previewPickUsers = useMemo(
    () => pickUidsModal.map((uid) => userByUid.get(uid)).filter(Boolean) as UserData[],
    [pickUidsModal, userByUid]
  );

  const activeGroup = useMemo(
    () => (groupModalId ? groups.find((g) => g.id === groupModalId) ?? null : null),
    [groupModalId, groups]
  );

  useEffect(() => {
    if (groupModalId && !groups.some((g) => g.id === groupModalId)) {
      setGroupModalId(null);
    }
  }, [groupModalId, groups]);

  useLayoutEffect(() => {
    if (!userPickerOpen) {
      setPickerDropdownRect(null);
      return;
    }
    const updateRect = () => {
      const el = userPickerAnchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPickerDropdownRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 220) });
    };
    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [userPickerOpen]);

  useEffect(() => {
    if (!userPickerOpen) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (userPickerRef.current?.contains(t)) return;
      if (userPickerDropdownRef.current?.contains(t)) return;
      setUserPickerOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [userPickerOpen]);

  const openGroupModal = (id: string) => {
    const g = groups.find((x) => x.id === id);
    setGroupModalId(id);
    setPickUidsModal([]);
    setEditingZaloId(!g?.zaloGroupId?.trim());
    setPeekZaloId(false);
    setUserPickerOpen(false);
  };

  const closeGroupModal = () => {
    setGroupModalId(null);
    setPickUidsModal([]);
    setEditingZaloId(false);
    setPeekZaloId(false);
    setUserPickerOpen(false);
  };

  const persistGroups = async (next: ZaloGroupConfig[]) => {
    await saveZaloGroups({
      groups: next,
      updatedBy: currentUser?.uid ?? null,
      mainSettings: {
        mainGroupId,
        mainNotifyOnCreate,
        mainNotifyOnUpdate,
        mainNotifyOnDelete,
        mainUpdateFieldWhitelist,
        customerNotifyEnabled: custEnabled,
        customerNotifyPromotionId: custPromotionId,
        customerNotifyDailyLimit: custDailyLimit,
      },
    });
    setGroups(next);
  };

  const handleTestGroup = async (groupId: string, groupName: string) => {
    const id = groupId.trim();
    if (!id) {
      toast.error('Group ID trống');
      return;
    }
    const waitMs = testCooldownUntil - Date.now();
    if (waitMs > 0) {
      toast.error(`Chờ ${Math.ceil(waitMs / 1000)}s nữa hãy test lại (tránh bị Zalo chặn)`);
      return;
    }
    setTestingGroupId(id);
    try {
      const result = await sendZaloTestMessage(id);
      if (result.ok) {
        toast.success(`Đã gửi test tới "${groupName || id}"`);
      } else {
        toast.error(`Gửi test thất bại: ${result.error}`);
      }
    } finally {
      setTestingGroupId(null);
      setTestCooldownUntil(Date.now() + 15000);
    }
  };

  const handleSaveAll = async () => {
    if (groups.length > 0) {
      const missingId = groups.some((g) => !g.zaloGroupId.trim());
      if (missingId) {
        toast.error('Mỗi nhóm phải có ID nhóm Zalo (nhập thủ công)');
        return;
      }
    }
    setSaving(true);
    try {
      await persistGroups(groups);
      toast.success('Đã lưu cấu hình Zalo');
      setEditingZaloId(false);
      setPeekZaloId(false);
    } catch (e) {
      console.error(e);
      toast.error('Không lưu được cấu hình Zalo');
    } finally {
      setSaving(false);
    }
  };

  /** Xem trước tin sẽ gửi cho khách (BE dựng từ 1 đơn mẫu, không gửi gì). */
  const loadCustPreview = async () => {
    setLoadingPreview(true);
    try {
      const r = await fetchCustomerNotifyPreview();
      setCustPreview(r.message);
    } catch {
      toast.error('Không lấy được nội dung xem trước');
    } finally {
      setLoadingPreview(false);
    }
  };

  /** Lấy danh sách nhóm thật của nick Zalo đang gửi (bridge Abit) để chọn ID. */
  const loadBridgeGroups = async () => {
    setLoadingBridgeGroups(true);
    try {
      const list = await fetchZaloBridgeGroups();
      setBridgeGroups(list);
      if (list.length === 0) toast.error('Nick Zalo đang gửi không có nhóm nào');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Không lấy được danh sách nhóm';
      toast.error(String(msg));
    } finally {
      setLoadingBridgeGroups(false);
    }
  };

  /** Lưu từ trong modal nhóm → lưu cả cấu hình rồi đóng modal (khỏi phải tìm nút ngoài). */
  const handleSaveGroupModal = async () => {
    const g = groups.find((x) => x.id === groupModalId);
    if (g && !g.zaloGroupId.trim()) {
      toast.error('Nhóm này chưa có ID nhóm Zalo');
      return;
    }
    await handleSaveAll();
    closeGroupModal();
  };

  const addGroup = () => {
    const newId = crypto.randomUUID();
    setGroups((prev) => [...prev, { id: newId, name: '', zaloGroupId: '', memberUids: [] }]);
    setGroupModalId(newId);
    setPickUidsModal([]);
    setEditingZaloId(true);
    setPeekZaloId(false);
  };

  const removeGroup = async (groupId: string) => {
    const next = groups.filter((g) => g.id !== groupId);
    setSaving(true);
    try {
      await persistGroups(next);
      toast.success('Đã xóa nhóm');
      if (groupModalId === groupId) closeGroupModal();
    } catch (e) {
      console.error(e);
      toast.error('Không xóa được nhóm');
    } finally {
      setSaving(false);
    }
  };

  const updateGroup = (groupId: string, patch: Partial<ZaloGroupConfig>) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...patch } : g)));
  };

  const addMembersBatch = async (groupId: string, uids: string[]) => {
    const unique = [...new Set(uids.map((x) => x.trim()).filter(Boolean))];
    if (unique.length === 0) return;
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    const userMap = new Map<string, UserData>(userByUid);
    const toAdd: string[] = [];
    let blockedOther = false;
    let blockedSuper = false;

    for (const uid of unique) {
      if (group.memberUids.includes(uid)) continue;
      const target = userMap.get(uid);
      if (!target) continue;
      if (target.role === UserRole.SUPER_ADMIN) {
        blockedSuper = true;
        continue;
      }
      if (uidInOtherGroup(groups, uid, groupId)) {
        blockedOther = true;
        continue;
      }
      toAdd.push(uid);
    }

    if (toAdd.length === 0) {
      if (blockedSuper) toast.error('Không thể gán Super Admin vào nhóm CTV Zalo');
      else if (blockedOther) toast.error('Mỗi CTV chỉ thuộc tối đa một nhóm Zalo');
      else toast.error('Không có user hợp lệ để thêm');
      return;
    }

    setSaving(true);
    try {
      for (const uid of toAdd) {
        const target = userMap.get(uid);
        if (!target) continue;
        if (target.role !== UserRole.COLABORATOR) {
          await updateUserRoleMut({ uid, role: UserRole.COLABORATOR });
          // Cập nhật map cục bộ trong vòng lặp; React Query sẽ refetch users sau invalidate.
          userMap.set(uid, { ...target, role: UserRole.COLABORATOR as const });
        }
      }

      const toAddSet = new Set(toAdd);
      const stripped = groups.map((g) => ({
        ...g,
        memberUids: g.memberUids.filter((x) => !toAddSet.has(x)),
      }));
      const next = stripped.map((g) =>
        g.id === groupId ? { ...g, memberUids: [...g.memberUids, ...toAdd] } : g
      );
      await persistGroups(next);
      setPickUidsModal([]);
      setUserPickerOpen(false);
      toast.success(toAdd.length === 1 ? 'Đã thêm CTV vào nhóm' : `Đã thêm ${toAdd.length} CTV vào nhóm`);
      if (unique.length > toAdd.length) {
        toast('Một số user không được thêm (Super Admin, nhóm khác, hoặc không tồn tại).', { icon: '⚠️' });
      }
    } catch (e) {
      console.error(e);
      toast.error('Không thêm được thành viên');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (groupId: string, uid: string) => {
    setSaving(true);
    try {
      const next = groups.map((g) =>
        g.id === groupId ? { ...g, memberUids: g.memberUids.filter((x) => x !== uid) } : g
      );
      await persistGroups(next);
      toast.success('Đã gỡ thành viên khỏi nhóm');
    } catch (e) {
      console.error(e);
      toast.error('Không cập nhật được nhóm');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box
        layoutClassName="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 py-20 dark:border-slate-600"
        backgroundClassName="bg-slate-50/50 dark:bg-slate-900/30"
      >
        <Box
          layoutClassName="flex h-14 w-14 items-center justify-center rounded-2xl shadow-inner"
          backgroundClassName="bg-primary-100 dark:bg-primary-900/40"
        >
          <MessageCircle className="h-7 w-7 text-primary-600 dark:text-primary-400" />
        </Box>
        <Spinner size="md" />
        <Typography size="sm" variant="muted">
          Đang tải cấu hình Zalo…
        </Typography>
      </Box>
    );
  }

  const modalCandidates = activeGroup
    ? users.filter(
        (u) =>
          u.role !== UserRole.SUPER_ADMIN &&
          !activeGroup.memberUids.includes(u.uid) &&
          !uidInOtherGroup(groups, u.uid, activeGroup.id)
      )
    : [];

  const modalFooter = activeGroup ? (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => removeGroup(activeGroup.id)}
        disabled={saving}
        leftIcon={<Trash2 className="h-4 w-4" />}
        textClassName="mr-auto text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
        sizeClassName="rounded-xl px-3 py-2"
        layoutClassName="inline-flex items-center gap-2"
      >
        Xóa nhóm
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={closeGroupModal}
        borderClassName="border border-slate-200 dark:border-slate-600"
        backgroundClassName="bg-white dark:bg-slate-800"
        textClassName="text-sm text-slate-700 dark:text-slate-200"
        roundedClassName="rounded-xl"
        sizeClassName="px-4 py-2"
      >
        Đóng
      </Button>
      {/* Lưu NGAY trong modal: nút "Lưu cấu hình" ở toolbar bị modal che → sửa ID nhóm
          xong không lưu được. Lưu xong đóng modal luôn cho gọn. */}
      <Button
        type="button"
        onClick={() => void handleSaveGroupModal()}
        disabled={saving}
        leftIcon={saving ? <Spinner size="sm" textClassName="text-white" borderClassName="border-white" /> : <Check className="h-4 w-4" />}
        backgroundClassName="bg-primary-600"
        hoverClassName="hover:bg-primary-700"
        textClassName="text-sm font-semibold text-white"
        roundedClassName="rounded-xl"
        sizeClassName="px-4 py-2"
        layoutClassName="inline-flex items-center gap-1.5"
        stateClassName="transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        variant="primary"
        disableVariantHover
        disableVariantTextColor
      >
        {saving ? 'Đang lưu…' : 'Lưu'}
      </Button>
    </>
  ) : undefined;

  return (
    <Box layoutClassName="space-y-4">
      <FilterToolbar
        search={groupSearch}
        onSearchChange={setGroupSearch}
        searchPlaceholder="Tìm nhóm / ID Zalo…"
        actions={
          <>
            <Button
              type="button"
              onClick={addGroup}
              disabled={saving}
              leftIcon={<Plus />}
              iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
              borderClassName="border border-slate-200 dark:border-slate-600"
              backgroundClassName="bg-white dark:bg-slate-800"
              hoverClassName="hover:border-primary-300 hover:bg-primary-50/80 dark:hover:border-primary-700 dark:hover:bg-slate-700"
              textClassName="text-sm font-semibold text-slate-800 dark:text-slate-100"
              roundedClassName="rounded-xl"
              sizeClassName="px-3 py-2"
              layoutClassName="inline-flex items-center gap-1.5"
              stateClassName="transition-colors"
            >
              Thêm nhóm
            </Button>
            <Button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              leftIcon={saving ? <Spinner size="sm" textClassName="text-white" borderClassName="border-white" /> : undefined}
              backgroundClassName="bg-primary-600"
              hoverClassName="hover:bg-primary-700"
              textClassName="text-sm font-semibold text-white"
              roundedClassName="rounded-xl"
              shadowClassName="shadow-sm shadow-primary-200 dark:shadow-none"
              sizeClassName="px-4 py-2"
              layoutClassName="inline-flex items-center gap-1.5"
              stateClassName="transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              variant="primary"
              disableVariantHover
              disableVariantTextColor
            >
              {saving ? 'Đang lưu…' : 'Lưu cấu hình'}
            </Button>
          </>
        }
        stats={
          <Typography size="xs" variant="muted" layoutClassName="text-right">
            {filteredGroups.length} / {groups.length} nhóm
          </Typography>
        }
      />

      {filteredGroups.length === 0 ? (
        <EmptyState
          icon={<ZaloIcon className="h-6 w-6 rounded-md" />}
          title={groups.length === 0 ? 'Chưa có nhóm Zalo' : 'Không có nhóm phù hợp'}
          description="Bấm &quot;Thêm nhóm&quot; để tạo nhóm gửi thông báo."
        />
      ) : (
        <Card
          padding="none"
          layoutClassName="overflow-hidden"
          borderClassName="border-slate-100 dark:border-slate-700"
          backgroundClassName="bg-white dark:bg-slate-800"
        >
          <Box layoutClassName="overflow-x-auto">
            <Table>
            <TableHead
              backgroundClassName="bg-slate-50 dark:bg-slate-700/60"
              borderClassName="border-b border-slate-200 dark:border-slate-600"
            >
              <TableRow textClassName="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                <TableHeaderCell layoutClassName="px-5 py-3.5 w-12">STT</TableHeaderCell>
                <TableHeaderCell layoutClassName="px-5 py-3.5">Nhóm</TableHeaderCell>
                <TableHeaderCell layoutClassName="px-5 py-3.5">ID Zalo</TableHeaderCell>
                <TableHeaderCell layoutClassName="px-5 py-3.5">Loại thông báo</TableHeaderCell>
                <TableHeaderCell layoutClassName="px-5 py-3.5">Thành viên</TableHeaderCell>
                <TableHeaderCell layoutClassName="px-5 py-3.5 text-right">Thao tác</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
                {filteredGroups.map((g, idx) => {
                  const hasId = Boolean(g.zaloGroupId.trim());
                  return (
                    <TableRow
                      key={g.id}
                      onClick={() => openGroupModal(g.id)}
                      backgroundClassName={idx % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-700/20'}
                      hoverClassName="hover:bg-primary-50/60 dark:hover:bg-primary-900/10"
                      stateClassName="group cursor-pointer transition-colors"
                      borderClassName="border-b border-slate-100 dark:border-slate-700/60 last:border-0"
                    >
                      <TableCell layoutClassName="whitespace-nowrap px-5 py-3.5" textClassName="text-slate-400 dark:text-slate-500">
                        {idx + 1}
                      </TableCell>
                      <TableCell layoutClassName="whitespace-nowrap px-5 py-3.5">
                        <Box layoutClassName="flex items-center gap-2.5">
                          <Box
                            layoutClassName="h-8 w-1.5 shrink-0 rounded-full"
                            backgroundClassName={idx % 3 === 0 ? 'bg-primary-500' : idx % 3 === 1 ? 'bg-sky-500' : 'bg-rose-400'}
                          />
                          <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-900 dark:text-white">
                            {g.name.trim() || 'Nhóm chưa đặt tên'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell layoutClassName="px-5 py-3.5">
                        {hasId ? (
                          <Typography as="span" size="xs" layoutClassName="font-mono" textClassName="text-slate-600 dark:text-slate-300">
                            {g.zaloGroupId}
                          </Typography>
                        ) : (
                          <Badge size="sm" borderClassName="border-amber-200 dark:border-amber-800" backgroundClassName="bg-amber-50 dark:bg-amber-950/40" textClassName="text-amber-800 dark:text-amber-200">
                            Thiếu ID
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell layoutClassName="px-5 py-3.5">
                        {(() => {
                          const hasOrder = g.notifyOnCreate !== false || g.notifyOnUpdate !== false || g.notifyOnDelete !== false;
                          const hasPayment = g.notifyOnPayment === true;
                          if (!hasOrder && !hasPayment) return <Typography as="span" size="xs" variant="muted">Tắt</Typography>;
                          return (
                            <Box layoutClassName="flex flex-wrap items-center gap-1">
                              {hasOrder ? (
                                <Badge size="sm" borderClassName="border-primary-200 dark:border-primary-800" backgroundClassName="bg-primary-50 dark:bg-primary-950/40" textClassName="text-primary-700 dark:text-primary-300">
                                  Đơn hàng
                                </Badge>
                              ) : null}
                              {hasPayment ? (
                                <Badge size="sm" borderClassName="border-amber-200 dark:border-amber-800" backgroundClassName="bg-amber-50 dark:bg-amber-950/40" textClassName="text-amber-700 dark:text-amber-300">
                                  Thanh toán
                                </Badge>
                              ) : null}
                            </Box>
                          );
                        })()}
                      </TableCell>
                      <TableCell layoutClassName="whitespace-nowrap px-5 py-3.5">
                        {g.memberUids.length > 0 ? (
                          <Box layoutClassName="flex items-center gap-2">
                            <Box layoutClassName="flex items-center">
                              {g.memberUids.slice(0, 5).map((uid, i) => (
                                <Box key={uid} layoutClassName={`relative shrink-0 ${i > 0 ? '-ml-2' : ''}`} style={{ zIndex: 10 - i }}>
                                  <UserAvatar user={userByUid.get(uid)} size="sm" />
                                </Box>
                              ))}
                            </Box>
                            <Typography as="span" size="xs" variant="muted">{g.memberUids.length}</Typography>
                          </Box>
                        ) : (
                          <Typography as="span" size="xs" variant="muted">—</Typography>
                        )}
                      </TableCell>
                      <TableCell layoutClassName="whitespace-nowrap px-5 py-3.5 text-right">
                        <Box layoutClassName="inline-flex items-center gap-1">
                          <IconButton label="Sửa" size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openGroupModal(g.id); }}>
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton label="Xoá" size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); removeGroup(g.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Card>
      )}

      {/* ── Thông báo Zalo cho KHÁCH HÀNG (cảm ơn + link tra đơn + mã KM) ── */}
      <Card layoutClassName="space-y-4 p-4">
        <Box layoutClassName="flex flex-wrap items-start justify-between gap-2">
          <Box layoutClassName="space-y-1">
            <Heading level={3} textClassName="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Thông báo cho khách
            </Heading>
            <Typography size="xs" variant="muted">
              Sau khi tạo đơn, gửi Zalo cho khách: cảm ơn + thông tin đơn + link tự tra trạng thái
              + mã khuyến mãi lần sau. Gửi rải để không bị Zalo chặn.
            </Typography>
          </Box>
          <Checkbox
            checked={custEnabled}
            onChange={(e) => setCustEnabled(e.target.checked)}
            label="Bật gửi tự động"
            labelClassName="text-sm font-medium text-slate-700 dark:text-slate-200"
          />
        </Box>

        <Box layoutClassName="grid gap-3 sm:grid-cols-2">
          <Box layoutClassName="space-y-1">
            <Label className="mb-0">Mã khuyến mãi chèn vào tin</Label>
            <Select value={custPromotionId} searchable onChange={(e) => setCustPromotionId(e.target.value)}>
              <option value="">— Không chèn mã —</option>
              {promotions
                .filter((p) => (p.code ?? '').trim() !== '')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
            </Select>
            <Typography size="xs" variant="muted">
              Chỉ hiện khuyến mãi có MÃ. Mã hết hạn/hết lượt thì tin tự bỏ dòng mã.
            </Typography>
          </Box>
          <Box layoutClassName="space-y-1">
            <Label className="mb-0">Hạn mức tin/ngày</Label>
            <Input
              type="number"
              min={0}
              value={String(custDailyLimit)}
              onChange={(e) => setCustDailyLimit(Math.max(0, Number(e.target.value) || 0))}
              containerClassName="w-full"
            />
            <Typography size="xs" variant="muted">
              Zalo giới hạn tin gửi người lạ — vượt hạn mức thì bỏ qua, hôm sau gửi tiếp.
            </Typography>
          </Box>
        </Box>

        <Box layoutClassName="space-y-2">
          <Button
            type="button"
            onClick={() => void loadCustPreview()}
            disabled={loadingPreview}
            leftIcon={loadingPreview ? <Spinner size="sm" /> : <Eye className="h-3.5 w-3.5" />}
            variant="secondary"
            borderClassName="border border-slate-200 dark:border-slate-600"
            backgroundClassName="bg-white dark:bg-slate-800"
            textClassName="text-xs font-medium text-slate-700 dark:text-slate-200"
            roundedClassName="rounded-lg"
            sizeClassName="px-2.5 py-1.5"
            layoutClassName="inline-flex items-center gap-1.5"
          >
            {loadingPreview ? 'Đang tải…' : 'Xem trước tin gửi khách'}
          </Button>
          {custPreview ? (
            <Box
              layoutClassName="whitespace-pre-wrap rounded-xl p-3"
              backgroundClassName="bg-slate-50 dark:bg-slate-800/60"
              borderClassName="border border-slate-200 dark:border-slate-600"
            >
              <Typography size="xs" textClassName="text-slate-700 dark:text-slate-200">
                {custPreview}
              </Typography>
            </Box>
          ) : null}
        </Box>
      </Card>

      <BaseModal
        isOpen={Boolean(activeGroup)}
        onClose={closeGroupModal}
        title={
          <span className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-[#0068FF]" />
            {activeGroup?.name.trim() || 'Nhóm Zalo'}
          </span>
        }
        size="xl"
        footer={modalFooter}
      >
        {activeGroup ? (
          <div className="max-h-[min(80vh,720px)] overflow-y-auto pr-1">
            <Typography size="xs" variant="muted" layoutClassName="mb-4">
              Chỉ cần ID nhóm Zalo và loại thông báo. Nhớ bấm &quot;Lưu cấu hình&quot; để lưu thay đổi.
            </Typography>

            <div className="space-y-4">
              {/* ID nhóm Zalo */}
              <Box
                layoutClassName="rounded-xl border border-slate-200 p-4 dark:border-slate-600"
                backgroundClassName="bg-slate-50/70 dark:bg-slate-800/40"
              >
                <Box layoutClassName="mb-2 flex items-center justify-between gap-2">
                  <Typography size="xs" layoutClassName="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    ID nhóm Zalo <span className="text-red-500">*</span>
                  </Typography>
                  <Button
                    type="button"
                    onClick={() => handleTestGroup(activeGroup.zaloGroupId, activeGroup.name)}
                    disabled={!activeGroup.zaloGroupId.trim() || testingGroupId === activeGroup.zaloGroupId.trim()}
                    leftIcon={<Send className="h-3 w-3" />}
                    sizeClassName="px-2.5 py-1"
                    backgroundClassName="bg-slate-800 dark:bg-slate-700"
                    textClassName="text-[11px] font-semibold text-white"
                    roundedClassName="rounded-md"
                    disableVariantHover
                    disableVariantTextColor
                  >
                    {testingGroupId === activeGroup.zaloGroupId.trim() ? 'Đang gửi…' : 'Test'}
                  </Button>
                </Box>
                <Input
                  value={activeGroup.zaloGroupId}
                  onChange={(e) => updateGroup(activeGroup.id, { zaloGroupId: e.target.value })}
                  placeholder="Dán hoặc nhập ID nhóm từ Zalo"
                  containerClassName="w-full"
                />
                {/* Chọn từ danh sách nhóm THẬT của nick Zalo đang gửi — ID copy tay dễ sai
                    (bridge vẫn báo "đã nhận" nhưng tin không tới nhóm nào). */}
                <Box layoutClassName="mt-2 space-y-2">
                  <Button
                    type="button"
                    onClick={() => void loadBridgeGroups()}
                    disabled={loadingBridgeGroups}
                    leftIcon={loadingBridgeGroups ? <Spinner size="sm" /> : <Users className="h-3.5 w-3.5" />}
                    variant="secondary"
                    borderClassName="border border-slate-200 dark:border-slate-600"
                    backgroundClassName="bg-white dark:bg-slate-800"
                    textClassName="text-xs font-medium text-slate-700 dark:text-slate-200"
                    roundedClassName="rounded-lg"
                    sizeClassName="px-2.5 py-1.5"
                    layoutClassName="inline-flex items-center gap-1.5"
                  >
                    {loadingBridgeGroups ? 'Đang lấy…' : 'Lấy danh sách nhóm từ Zalo'}
                  </Button>
                  {bridgeGroups && bridgeGroups.length > 0 ? (
                    <Select
                      value={activeGroup.zaloGroupId}
                      searchable
                      onChange={(e) => updateGroup(activeGroup.id, { zaloGroupId: e.target.value })}
                    >
                      <option value="">— Chọn nhóm ({bridgeGroups.length} nhóm) —</option>
                      {bridgeGroups.map((g) => (
                        <option key={g.groupId} value={g.groupId}>
                          {g.name || g.groupId} · {g.members} thành viên
                        </option>
                      ))}
                    </Select>
                  ) : null}
                </Box>
              </Box>

              {/* Loại thông báo */}
              <Box
                layoutClassName="rounded-xl border border-slate-100 p-4 dark:border-slate-700/80"
                backgroundClassName="bg-slate-50/70 dark:bg-slate-800/40"
              >
                <Typography size="xs" layoutClassName="mb-2 font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Loại thông báo
                </Typography>
                <Box layoutClassName="flex flex-wrap gap-1.5">
                  {([
                    ['Tạo đơn', activeGroup.notifyOnCreate !== false, 'notifyOnCreate'],
                    ['Sửa đơn', activeGroup.notifyOnUpdate !== false, 'notifyOnUpdate'],
                    ['Xoá đơn', activeGroup.notifyOnDelete !== false, 'notifyOnDelete'],
                    ['Thanh toán', activeGroup.notifyOnPayment === true, 'notifyOnPayment'],
                  ] as Array<[string, boolean, 'notifyOnCreate' | 'notifyOnUpdate' | 'notifyOnDelete' | 'notifyOnPayment']>).map(
                    ([label, val, key]) => (
                      <Button
                        key={key}
                        type="button"
                        onClick={() => updateGroup(activeGroup.id, { [key]: !val } as Partial<ZaloGroupConfig>)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                          val
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                       variant="ghost" disableVariantHover disableVariantTextColor borderClassName="border-transparent">
                        {val ? <Check className="h-3 w-3" /> : null}
                        {label}
                      </Button>
                    ),
                  )}
                </Box>
              </Box>
            </div>

            {/* removed: tên nhóm / whitelist / danh sách CTV */}
            {false ? (
              <div className="space-y-4">
              <div className="space-y-4">
                <Typography size="xs" layoutClassName="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  CTV &amp; thêm người
                </Typography>

                <Box
                  layoutClassName="rounded-xl border border-slate-100 p-4 dark:border-slate-700/80"
                  backgroundClassName="bg-slate-50/50 dark:bg-slate-800/30"
                >
                  <Box layoutClassName="mb-3 flex flex-wrap items-end justify-between gap-2">
                    <Box layoutClassName="min-w-0">
                      <Box layoutClassName="flex items-center gap-2">
                        <Box
                          layoutClassName="flex h-8 w-8 items-center justify-center rounded-lg"
                          backgroundClassName="bg-primary-100 dark:bg-primary-950/50"
                        >
                          <Users className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                        </Box>
                        <Typography size="sm" layoutClassName="font-semibold text-slate-900 dark:text-white">
                          Trong nhóm
                        </Typography>
                      </Box>
                      <Typography size="xs" variant="muted" layoutClassName="mt-1 pl-10 leading-relaxed">
                        Mỗi người một nhóm. Gỡ khỏi nhóm không đổi vai trò tài khoản.
                      </Typography>
                    </Box>
                    <Badge
                      size="sm"
                      borderClassName="border-slate-200 dark:border-slate-600"
                      backgroundClassName="bg-white dark:bg-slate-800"
                      textClassName="text-slate-600 dark:text-slate-300"
                    >
                      {activeGroup.memberUids.length} người
                    </Badge>
                  </Box>

                  {activeGroup.memberUids.length === 0 ? (
                    <Box
                      layoutClassName="mb-4 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-8 dark:border-slate-600"
                      backgroundClassName="bg-white/60 dark:bg-slate-900/40"
                    >
                      <Users className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                      <Typography size="xs" variant="muted" layoutClassName="text-center">
                        Chưa có CTV.
                      </Typography>
                    </Box>
                  ) : (
                    <Box layoutClassName="mb-4 max-h-48 space-y-2 overflow-y-auto pr-0.5">
                      {activeGroup.memberUids.map((uid) => {
                        const u = userByUid.get(uid);
                        return (
                          <Box
                            key={uid}
                            layoutClassName="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm dark:border-slate-600 dark:bg-slate-900"
                          >
                            <UserAvatar user={u} size="sm" />
                            <Box layoutClassName="min-w-0 flex-1">
                              <Typography size="sm" layoutClassName="truncate font-medium text-slate-900 dark:text-slate-100">
                                {u ? userLabel(u) : uid}
                              </Typography>
                              {u?.email ? (
                                <Box layoutClassName="mt-0.5 flex items-center gap-1">
                                  <Mail className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                                  <Typography size="xs" variant="muted" layoutClassName="truncate">
                                    {u.email}
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography size="xs" variant="muted" layoutClassName="mt-0.5 truncate font-mono">
                                  {uid}
                                </Typography>
                              )}
                            </Box>
                            <Button
                              type="button"
                              variant="ghost"
                              sizeClassName="h-8 w-8 shrink-0 rounded-lg p-0"
                              onClick={() => removeMember(activeGroup.id, uid)}
                              disabled={saving}
                              borderClassName="border border-transparent hover:border-red-200 dark:hover:border-red-900/50"
                              textClassName="text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                              aria-label="Remove member"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </Box>
                        );
                      })}
                    </Box>
                  )}

                  <Box
                    ref={userPickerRef}
                    layoutClassName="rounded-2xl border border-primary-200/70 p-4 dark:border-primary-900/40"
                    backgroundClassName="bg-gradient-to-br from-primary-50/90 via-white to-white dark:from-primary-950/25 dark:via-slate-900 dark:to-slate-900"
                  >
                    <Box layoutClassName="mb-3 flex items-start gap-2">
                      <Box
                        layoutClassName="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        backgroundClassName="bg-primary-500 shadow-sm"
                      >
                        <UserPlus className="h-4 w-4 text-white" />
                      </Box>
                      <Box layoutClassName="min-w-0 flex-1">
                        <Typography size="sm" layoutClassName="font-semibold text-slate-900 dark:text-white">
                          Thêm CTV
                        </Typography>
                        <Typography size="xs" variant="muted" layoutClassName="mt-0.5 leading-relaxed">
                          Chọn một hoặc nhiều user — bấm dòng để chọn/bỏ, rồi Thêm.
                        </Typography>
                      </Box>
                    </Box>

                    <Button
                      ref={userPickerAnchorRef}
                      type="button"
                      onClick={() => setUserPickerOpen((o) => !o)}
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-inner transition-colors hover:border-primary-300 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-primary-600"
                     variant="ghost" disableVariantHover disableVariantTextColor borderClassName="border-transparent">
                      {pickUidsModal.length === 0 ? (
                        <Typography size="sm" variant="muted" layoutClassName="flex-1">
                          Chọn user…
                        </Typography>
                      ) : pickUidsModal.length === 1 && previewPickUsers[0] ? (
                        <>
                          <UserAvatar user={previewPickUsers[0]} size="md" />
                          <Box layoutClassName="min-w-0 flex-1">
                            <Typography size="sm" layoutClassName="truncate font-semibold text-slate-900 dark:text-white">
                              {userLabel(previewPickUsers[0])}
                            </Typography>
                            {previewPickUsers[0].email ? (
                              <Typography size="xs" variant="muted" layoutClassName="truncate">
                                {previewPickUsers[0].email}
                              </Typography>
                            ) : null}
                          </Box>
                        </>
                      ) : (
                        <>
                          <Box
                            layoutClassName="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                            backgroundClassName="bg-primary-100 dark:bg-primary-900/40"
                          >
                            <Users className="h-5 w-5 text-primary-600 dark:text-primary-300" aria-hidden />
                          </Box>
                          <Box layoutClassName="min-w-0 flex-1">
                            <Typography size="sm" layoutClassName="font-semibold text-slate-900 dark:text-white">
                              Đã chọn {pickUidsModal.length} user
                            </Typography>
                            <Typography size="xs" variant="muted" layoutClassName="truncate">
                              {previewPickUsers.slice(0, 2).map((u) => userLabel(u)).join(', ')}
                              {pickUidsModal.length > 2 ? ` +${pickUidsModal.length - 2}` : ''}
                            </Typography>
                          </Box>
                        </>
                      )}
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${userPickerOpen ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                    </Button>

                    {typeof document !== 'undefined' &&
                      userPickerOpen &&
                      pickerDropdownRect &&
                      createPortal(
                        <div
                          ref={userPickerDropdownRef}
                          className="fixed z-[200] max-h-56 space-y-0.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-600 dark:bg-slate-900"
                          style={{
                            top: pickerDropdownRect.top,
                            left: pickerDropdownRect.left,
                            width: pickerDropdownRect.width,
                          }}
                          role="listbox"
                          aria-multiselectable
                        >
                          {modalCandidates.length === 0 ? (
                            <p className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                              Không có user trong danh sách.
                            </p>
                          ) : (
                            modalCandidates.map((u) => {
                              const selected = pickUidsModal.includes(u.uid);
                              return (
                                <Button
                                  key={u.uid}
                                  type="button"
                                  role="option"
                                  aria-selected={selected}
                                  onClick={() => {
                                    setPickUidsModal((prev) =>
                                      prev.includes(u.uid) ? prev.filter((x) => x !== u.uid) : [...prev, u.uid]
                                    );
                                  }}
                                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
                                    selected
                                      ? 'bg-primary-50 dark:bg-primary-950/40'
                                      : 'hover:bg-primary-50/80 dark:hover:bg-primary-950/30'
                                  }`}
                                 variant="ghost" disableVariantHover disableVariantTextColor borderClassName="border-transparent">
                                  <UserAvatar user={u} size="sm" />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">
                                      {userLabel(u)}
                                    </span>
                                    {u.email ? (
                                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                        {u.email}
                                      </span>
                                    ) : (
                                      <span className="block truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                                        {u.uid}
                                      </span>
                                    )}
                                  </span>
                                  {selected ? (
                                    <Check className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
                                  ) : (
                                    <span className="h-4 w-4 shrink-0" aria-hidden />
                                  )}
                                </Button>
                              );
                            })
                          )}
                        </div>,
                        document.body
                      )}

                    {modalCandidates.length === 0 ? (
                      <Typography
                        size="xs"
                        layoutClassName="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                      >
                        Không còn user khả dụng (đã ở nhóm khác hoặc Super Admin).
                      </Typography>
                    ) : null}

                    <Button
                      type="button"
                      onClick={() => addMembersBatch(activeGroup.id, pickUidsModal)}
                      disabled={saving || pickUidsModal.length === 0}
                      leftIcon={<UserPlus className="h-4 w-4" />}
                      sizeClassName="mt-3 w-full justify-center py-2.5 sm:py-3"
                      backgroundClassName="bg-gradient-to-r from-primary-600 to-primary-600"
                      hoverClassName="hover:from-primary-700 hover:to-primary-700"
                      textClassName="text-sm font-semibold text-white"
                      roundedClassName="rounded-xl"
                      layoutClassName="inline-flex items-center gap-2 shadow-md"
                      stateClassName="transition-all disabled:cursor-not-allowed disabled:opacity-50"
                      disableVariantHover
                      disableVariantTextColor
                    >
                      {pickUidsModal.length <= 1
                        ? 'Thêm vào nhóm này'
                        : `Thêm ${pickUidsModal.length} CTV vào nhóm`}
                    </Button>
                  </Box>
                </Box>
              </div>
            </div>
            ) : null}
          </div>
        ) : null}
      </BaseModal>
    </Box>
  );
};

export default ZaloSettingsTab;
