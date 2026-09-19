import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchZaloBridgeGroups, type ZaloBridgeGroup } from '@/services/zaloService';
import { useSaveZaloGroups, useZaloGroups } from '@/hooks/queries/useConfigQuery';
import { useUsers } from '@/hooks/queries/useUsersQuery';
import { useAuth } from '@/contexts/AuthContext';
import { ZaloGroupConfig, ZaloNotifyFeature, zaloFeatureLabel } from '@/types';
import Badge from '@/components/ui/Badge';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import Typography from '@/components/ui/Typography';
import GroupFeaturePanel, { type GroupDraft } from './components/GroupFeaturePanel';

/** Id cho row cấu hình mới (BE tự sinh nếu trống, nhưng giữ ổn định ở FE). */
const newConfigId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `grp_${Date.now()}`;

/**
 * Nhóm Zalo nhận thông báo.
 *
 * Danh sách = TOÀN BỘ nhóm của nick Zalo đang gửi (listAllGroupForPartner qua BE), tự
 * nạp khi vào màn — không nhập/dán ID nhóm tay nữa (sai 1 ký tự là bridge vẫn báo "đã
 * nhận" nhưng tin không tới nhóm nào). Màn chia 2: DANH SÁCH nhóm bên trái, bấm 1 nhóm
 * → panel bên phải hiện đúng chức năng của nhóm đó để bật/tắt.
 * Cấu hình lưu ở zalo_groups; nhóm chưa gán gì thì không nhận thông báo nào.
 */
const ZaloGroupsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { data: zaloConfig, loading: configLoading } = useZaloGroups();
  const { save: saveZaloGroups } = useSaveZaloGroups();
  const { users } = useUsers();

  const [bridgeGroups, setBridgeGroups] = useState<ZaloBridgeGroup[] | null>(null);
  const [loadingBridge, setLoadingBridge] = useState(false);
  const [bridgeError, setBridgeError] = useState('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadBridgeGroups = useCallback(async () => {
    setLoadingBridge(true);
    setBridgeError('');
    try {
      setBridgeGroups(await fetchZaloBridgeGroups());
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setBridgeError(
        err?.response?.data?.message || err?.message || 'Không lấy được danh sách nhóm',
      );
      setBridgeGroups(null);
    } finally {
      setLoadingBridge(false);
    }
  }, []);

  useEffect(() => {
    void loadBridgeGroups();
  }, [loadBridgeGroups]);

  /** Cấu hình đã lưu, tra theo ID nhóm Zalo. */
  const configByZaloId = useMemo(() => {
    const m = new Map<string, ZaloGroupConfig>();
    for (const g of zaloConfig?.groups ?? []) {
      const id = g.zaloGroupId.trim();
      if (id) m.set(id, g);
    }
    return m;
  }, [zaloConfig]);

  /** uid CTV → ID nhóm đang giữ (1 CTV chỉ nên thuộc 1 nhóm). */
  const uidTakenBy = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of zaloConfig?.groups ?? []) {
      for (const uid of g.memberUids ?? []) m.set(uid, g.zaloGroupId.trim());
    }
    return m;
  }, [zaloConfig]);

  const bridgeIds = useMemo(
    () => new Set((bridgeGroups ?? []).map((b) => b.groupId)),
    [bridgeGroups],
  );

  /**
   * Hàng của bảng = nhóm từ Zalo + nhóm CHỈ CÒN trong cấu hình (nick đã rời nhóm đó)
   * để user thấy mà dọn, chứ không âm thầm mất cấu hình.
   */
  const rows = useMemo(() => {
    const fromBridge: GroupDraft[] = (bridgeGroups ?? []).map((b) => {
      const cfg = configByZaloId.get(b.groupId);
      return {
        zaloGroupId: b.groupId,
        name: b.name || cfg?.name || b.groupId,
        members: b.members,
        features: (cfg?.features ?? []) as ZaloNotifyFeature[],
        memberUids: cfg?.memberUids ?? [],
        updateFieldWhitelist: cfg?.updateFieldWhitelist ?? [],
      };
    });
    const orphans: GroupDraft[] = (zaloConfig?.groups ?? [])
      .filter((g) => g.zaloGroupId.trim() && !bridgeIds.has(g.zaloGroupId.trim()))
      .map((g) => ({
        zaloGroupId: g.zaloGroupId.trim(),
        name: g.name || g.zaloGroupId.trim(),
        members: 0,
        features: (g.features ?? []) as ZaloNotifyFeature[],
        memberUids: g.memberUids ?? [],
        updateFieldWhitelist: g.updateFieldWhitelist ?? [],
      }));
    const q = search.trim().toLowerCase();
    return [...fromBridge, ...orphans].filter(
      (r) => !q || r.name.toLowerCase().includes(q) || r.zaloGroupId.includes(q),
    );
  }, [bridgeGroups, bridgeIds, configByZaloId, zaloConfig, search]);

  const activeGroup = useMemo(
    () => rows.find((r) => r.zaloGroupId === openId) ?? null,
    [rows, openId],
  );

  // Vào màn (hoặc lọc mất nhóm đang xem) → tự chọn nhóm đầu để panel không trống trơn.
  useEffect(() => {
    if (rows.length === 0) return;
    if (!openId || !rows.some((r) => r.zaloGroupId === openId)) {
      setOpenId(rows[0].zaloGroupId);
    }
  }, [rows, openId]);

  /** Lưu cấu hình 1 nhóm (BE ghi đè cả list nên phải gửi kèm các nhóm khác). */
  const handleSaveGroup = async (next: GroupDraft) => {
    setSaving(true);
    try {
      const others = (zaloConfig?.groups ?? []).filter(
        (g) => g.zaloGroupId.trim() !== next.zaloGroupId,
      );
      const existing = configByZaloId.get(next.zaloGroupId);
      const hasConfig =
        next.features.length > 0 ||
        next.memberUids.length > 0 ||
        next.updateFieldWhitelist.length > 0;

      // Không gán gì → bỏ khỏi cấu hình cho gọn (nhóm vẫn hiện vì lấy từ Zalo).
      const groups: ZaloGroupConfig[] = hasConfig
        ? [
            ...others,
            {
              id: existing?.id ?? newConfigId(),
              name: next.name,
              zaloGroupId: next.zaloGroupId,
              memberUids: next.memberUids,
              features: next.features,
              updateFieldWhitelist: next.updateFieldWhitelist,
            },
          ]
        : others;

      await saveZaloGroups({ groups, updatedBy: currentUser?.uid ?? null });
      toast.success(`Đã lưu chức năng cho "${next.name}"`);
    } catch {
      toast.error('Lưu cấu hình nhóm thất bại');
    } finally {
      setSaving(false);
    }
  };

  const loading = configLoading || (loadingBridge && !bridgeGroups);

  return (
    <Box layoutClassName="grid h-full min-h-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* Cột trái: danh sách nhóm */}
      <Card
        padding="none"
        layoutClassName="flex min-h-0 flex-col overflow-hidden"
        borderClassName="border-slate-100 dark:border-slate-700"
      >
        <Box
          layoutClassName="shrink-0 space-y-2 px-3 py-3"
          borderClassName="border-b border-slate-100 dark:border-slate-700"
        >
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm nhóm theo tên hoặc ID…"
            containerClassName="w-full"
          />
          <Box layoutClassName="flex items-center justify-between gap-2">
            <Typography size="xs" variant="muted">
              {bridgeGroups ? `${bridgeGroups.length} nhóm từ Zalo` : '—'}
            </Typography>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void loadBridgeGroups()}
              disabled={loadingBridge}
              sizeClassName="px-2 py-1 text-xs"
              leftIcon={loadingBridge ? <Spinner size="sm" /> : <RefreshCw className="h-3.5 w-3.5" />}
              iconClassName="inline-flex shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5"
              layoutClassName="inline-flex items-center gap-1.5"
            >
              {loadingBridge ? 'Đang nạp…' : 'Nạp lại'}
            </Button>
          </Box>
        </Box>

        <Box layoutClassName="max-h-72 min-h-0 flex-1 overflow-auto lg:max-h-none">
          {loading ? (
            <Box layoutClassName="flex items-center justify-center py-10">
              <Spinner />
            </Box>
          ) : bridgeError && rows.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-8 w-8" />}
              title="Không lấy được danh sách nhóm"
              description={bridgeError}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="Nick Zalo đang gửi không có nhóm nào"
              description="Thêm tài khoản Zalo vào nhóm rồi bấm Nạp lại."
            />
          ) : (
            <Box layoutClassName="divide-y divide-slate-100 dark:divide-slate-700/60">
              {rows.map((r) => {
                const active = r.zaloGroupId === openId;
                const gone = bridgeIds.size > 0 && !bridgeIds.has(r.zaloGroupId);
                return (
                  <Button
                    key={r.zaloGroupId}
                    type="button"
                    variant="ghost"
                    onClick={() => setOpenId(r.zaloGroupId)}
                    layoutClassName="w-full text-left"
                    sizeClassName="px-3 py-2.5"
                    roundedClassName="rounded-none"
                    backgroundClassName={active ? 'bg-primary-50 dark:bg-primary-950/30' : undefined}
                    hoverClassName={active ? undefined : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'}
                    disableVariantHover
                    disableVariantTextColor
                  >
                    <Box layoutClassName="w-full min-w-0 space-y-1">
                      <Typography
                        size="sm"
                        layoutClassName={`truncate ${active ? 'font-semibold text-primary-800 dark:text-primary-200' : 'font-medium'}`}
                      >
                        {r.name}
                      </Typography>
                      <Box layoutClassName="flex flex-wrap items-center gap-1.5">
                        <Typography size="xs" variant="muted">
                          {r.members ? `${r.members} TV` : 'Không rõ TV'}
                        </Typography>
                        {r.features.length > 0 ? (
                          <Badge
                            size="sm"
                            borderClassName="border-primary-200 dark:border-primary-800"
                            backgroundClassName="bg-primary-50 dark:bg-primary-950/40"
                            textClassName="text-primary-700 dark:text-primary-300"
                          >
                            {r.features.length === 1
                              ? zaloFeatureLabel(r.features[0])
                              : `${r.features.length} chức năng`}
                          </Badge>
                        ) : (
                          <Typography size="xs" variant="muted">
                            Chưa gán
                          </Typography>
                        )}
                        {r.memberUids.length ? (
                          <Typography size="xs" variant="muted">
                            · {r.memberUids.length} CTV
                          </Typography>
                        ) : null}
                        {gone ? (
                          <Badge
                            size="sm"
                            borderClassName="border-amber-200 dark:border-amber-800"
                            backgroundClassName="bg-amber-50 dark:bg-amber-950/40"
                            textClassName="text-amber-700 dark:text-amber-300"
                          >
                            Không còn trong Zalo
                          </Badge>
                        ) : null}
                      </Box>
                    </Box>
                  </Button>
                );
              })}
            </Box>
          )}
        </Box>
      </Card>

      {/* Cột phải: chức năng của nhóm đang chọn */}
      <Box layoutClassName="min-h-[420px] min-w-0">
        <GroupFeaturePanel
          key={activeGroup?.zaloGroupId ?? 'empty'}
          group={activeGroup}
          users={users}
          uidTakenBy={uidTakenBy}
          saving={saving}
          onSave={handleSaveGroup}
        />
      </Box>
    </Box>
  );
};

export default ZaloGroupsPage;
