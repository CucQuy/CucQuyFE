import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw, Send, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchZaloBridgeGroups, sendZaloTestMessage, type ZaloBridgeGroup } from '@/services/zaloService';
import { useSaveZaloGroups, useZaloGroups } from '@/hooks/queries/useConfigQuery';
import { useAuth } from '@/contexts/AuthContext';
import {
  ZALO_NOTIFY_FEATURES,
  ZALO_TRACKABLE_FIELDS,
  ZaloGroupConfig,
  ZaloNotifyFeature,
} from '@/types';
import Badge from '@/components/ui/Badge';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Image from '@/components/ui/Image';
import EmptyState from '@/components/ui/EmptyState';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import Typography from '@/components/ui/Typography';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/Table';

/** 1 dòng của bảng = 1 nhóm Zalo + cấu hình thông báo đang gán cho nó. */
export interface GroupDraft {
  /** ID nhóm Zalo thật (từ danh sách nhóm của nick đang gửi). */
  zaloGroupId: string;
  name: string;
  members: number;
  /** Ảnh đại diện nhóm từ Zalo; rỗng → hiện chữ cái đầu. */
  avatar: string;
  features: ZaloNotifyFeature[];
  updateFieldWhitelist: string[];
}

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
 * nhận" nhưng tin không tới nhóm nào). Mỗi nhóm 1 dòng bảng, cột Chức năng là dãy chip
 * bật/tắt ngay tại dòng (lưu luôn, không cần bấm Lưu) — kiểu bảng tài khoản thanh toán.
 * Cấu hình lưu ở zalo_groups; nhóm chưa gán gì thì không nhận thông báo nào.
 */
const ZaloGroupsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { data: zaloConfig, loading: configLoading } = useZaloGroups();
  const { save: saveZaloGroups } = useSaveZaloGroups();

  const [bridgeGroups, setBridgeGroups] = useState<ZaloBridgeGroup[] | null>(null);
  const [loadingBridge, setLoadingBridge] = useState(false);
  const [bridgeError, setBridgeError] = useState('');
  const [search, setSearch] = useState('');
  /** ID nhóm đang lưu — khoá chip của đúng dòng đó trong lúc gọi API. */
  const [savingId, setSavingId] = useState<string | null>(null);
  /** Dòng đang mở để chỉnh chức năng (1 dòng tại 1 thời điểm). */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

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
        avatar: b.avatar,
        features: (cfg?.features ?? []) as ZaloNotifyFeature[],
        updateFieldWhitelist: cfg?.updateFieldWhitelist ?? [],
      };
    });
    const orphans: GroupDraft[] = (zaloConfig?.groups ?? [])
      .filter((g) => g.zaloGroupId.trim() && !bridgeIds.has(g.zaloGroupId.trim()))
      .map((g) => ({
        zaloGroupId: g.zaloGroupId.trim(),
        name: g.name || g.zaloGroupId.trim(),
        members: 0,
        avatar: '',
        features: (g.features ?? []) as ZaloNotifyFeature[],
        updateFieldWhitelist: g.updateFieldWhitelist ?? [],
      }));
    const q = search.trim().toLowerCase();
    return [...fromBridge, ...orphans].filter(
      (r) => !q || r.name.toLowerCase().includes(q) || r.zaloGroupId.includes(q),
    );
  }, [bridgeGroups, bridgeIds, configByZaloId, zaloConfig, search]);

  /** Lưu cấu hình 1 nhóm (BE ghi đè cả list nên phải gửi kèm các nhóm khác). */
  const handleSaveGroup = async (next: GroupDraft) => {
    setSavingId(next.zaloGroupId);
    try {
      const others = (zaloConfig?.groups ?? []).filter(
        (g) => g.zaloGroupId.trim() !== next.zaloGroupId,
      );
      const existing = configByZaloId.get(next.zaloGroupId);
      const hasConfig = next.features.length > 0 || next.updateFieldWhitelist.length > 0;

      // Không gán gì → bỏ khỏi cấu hình cho gọn (nhóm vẫn hiện vì lấy từ Zalo).
      const groups: ZaloGroupConfig[] = hasConfig
        ? [
            ...others,
            {
              id: existing?.id ?? newConfigId(),
              name: next.name,
              zaloGroupId: next.zaloGroupId,
              features: next.features,
              updateFieldWhitelist: next.updateFieldWhitelist,
            },
          ]
        : others;

      await saveZaloGroups({ groups, updatedBy: currentUser?.uid ?? null });
    } catch {
      toast.error('Lưu cấu hình nhóm thất bại');
    } finally {
      setSavingId(null);
    }
  };

  /** Bật/tắt 1 chức năng của 1 nhóm — lưu ngay như toggle ở bảng tài khoản. */
  const toggleFeature = (row: GroupDraft, feature: ZaloNotifyFeature) => {
    const on = row.features.includes(feature);
    void handleSaveGroup({
      ...row,
      features: on ? row.features.filter((f) => f !== feature) : [...row.features, feature],
      // Tắt "sửa đơn" thì bộ lọc field của nó cũng hết nghĩa → dọn luôn.
      updateFieldWhitelist:
        on && feature === 'order_update' ? [] : row.updateFieldWhitelist,
    });
  };

  /** Chọn field được phép báo khi SỬA đơn (rỗng = báo mọi thay đổi). */
  const toggleField = (row: GroupDraft, key: string) => {
    const on = row.updateFieldWhitelist.includes(key);
    void handleSaveGroup({
      ...row,
      updateFieldWhitelist: on
        ? row.updateFieldWhitelist.filter((f) => f !== key)
        : [...row.updateFieldWhitelist, key],
    });
  };

  const handleTest = async (row: GroupDraft) => {
    setTestingId(row.zaloGroupId);
    const r = await sendZaloTestMessage(row.zaloGroupId);
    setTestingId(null);
    if (r.ok) toast.success(`Đã gửi tin test vào "${row.name}"`);
    else toast.error(r.error || 'Gửi test thất bại');
  };

  const loading = configLoading || (loadingBridge && !bridgeGroups);

  return (
    <Card padding="lg" layoutClassName="space-y-3">
      <Box layoutClassName="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm nhóm theo tên hoặc ID…"
          containerClassName="w-full sm:w-72"
        />
        <Typography size="xs" variant="muted">
          {bridgeGroups ? `${bridgeGroups.length} nhóm từ Zalo` : '—'}
        </Typography>
        <Box layoutClassName="ml-auto">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void loadBridgeGroups()}
            disabled={loadingBridge}
            sizeClassName="px-3 py-1.5 text-xs"
            leftIcon={loadingBridge ? <Spinner size="sm" /> : <RefreshCw className="h-3.5 w-3.5" />}
            iconClassName="inline-flex shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5"
            layoutClassName="inline-flex items-center gap-1.5"
          >
            {loadingBridge ? 'Đang nạp…' : 'Nạp lại'}
          </Button>
        </Box>
      </Box>

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
        <Box layoutClassName="overflow-x-auto">
          <Table>
            <TableHead
              backgroundClassName="bg-slate-50 dark:bg-slate-700/60"
              borderClassName="border-b border-slate-200 dark:border-slate-600"
            >
              <TableRow textClassName="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                <TableHeaderCell layoutClassName="px-4 py-3.5">Nhóm</TableHeaderCell>
                <TableHeaderCell layoutClassName="px-4 py-3.5 text-right">Thành viên</TableHeaderCell>
                <TableHeaderCell layoutClassName="px-4 py-3.5">Chức năng thông báo</TableHeaderCell>
                <TableHeaderCell layoutClassName="px-4 py-3.5 text-right">Thao tác</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, idx) => {
                const gone = bridgeIds.size > 0 && !bridgeIds.has(row.zaloGroupId);
                const busy = savingId === row.zaloGroupId;
                const open = expandedId === row.zaloGroupId;
                return (
                  <React.Fragment key={row.zaloGroupId}>
                  <TableRow
                    backgroundClassName={
                      row.features.length > 0
                        ? 'bg-primary-50/50 dark:bg-primary-900/10'
                        : idx % 2 === 0
                          ? ''
                          : 'bg-slate-50/50 dark:bg-slate-700/20'
                    }
                    hoverClassName="hover:bg-primary-50/60 dark:hover:bg-primary-900/10"
                    stateClassName="transition-colors"
                    borderClassName="border-b border-slate-100 dark:border-slate-700/60 last:border-0"
                  >
                    <TableCell layoutClassName="px-4 py-3">
                      <Box layoutClassName="flex items-center gap-2.5">
                        {row.avatar ? (
                          <Image
                            src={row.avatar}
                            alt={row.name}
                            layoutClassName="h-9 w-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <Box
                            layoutClassName="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                            backgroundClassName="bg-slate-100 dark:bg-slate-700"
                          >
                            <Typography as="span" size="sm" textClassName="font-semibold text-slate-500 dark:text-slate-300">
                              {(row.name || '?').trim().charAt(0).toUpperCase()}
                            </Typography>
                          </Box>
                        )}
                        <Box layoutClassName="min-w-0">
                          <Typography as="div" size="sm" textClassName="font-semibold text-slate-900 dark:text-white">
                            {row.name}
                          </Typography>
                          <Typography as="div" size="xs" variant="muted" layoutClassName="font-mono">
                            {row.zaloGroupId}
                          </Typography>
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
                    </TableCell>

                    <TableCell layoutClassName="whitespace-nowrap px-4 py-3 text-right">
                      <Typography as="span" size="sm" variant={row.members ? undefined : 'muted'}>
                        {row.members || '—'}
                      </Typography>
                    </TableCell>

                    {/* Chỉ tóm tắt số chức năng — bấm để mở hàng chỉnh bên dưới. */}
                    <TableCell layoutClassName="px-4 py-3">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setExpandedId(open ? null : row.zaloGroupId)}
                        sizeClassName="px-2 py-1 text-xs"
                        roundedClassName="rounded-lg"
                        layoutClassName="inline-flex items-center gap-1.5"
                        borderClassName="border border-transparent"
                        hoverClassName="hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-700/40"
                        stateClassName="transition-colors"
                        disableVariantHover
                        disableVariantTextColor
                        textClassName={
                          row.features.length > 0
                            ? 'font-semibold text-primary-700 dark:text-primary-300'
                            : 'text-slate-400 dark:text-slate-500'
                        }
                      >
                        {open ? (
                          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                        )}
                        {row.features.length > 0
                          ? `${row.features.length} chức năng`
                          : 'Chưa gán'}
                        {busy ? <Spinner size="sm" /> : null}
                      </Button>
                    </TableCell>

                    <TableCell layoutClassName="whitespace-nowrap px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={testingId === row.zaloGroupId}
                        onClick={() => void handleTest(row)}
                        sizeClassName="px-2.5 py-1.5 text-xs"
                        leftIcon={
                          testingId === row.zaloGroupId ? (
                            <Spinner size="sm" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )
                        }
                        iconClassName="inline-flex shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5"
                        layoutClassName="inline-flex items-center gap-1.5"
                      >
                        Gửi test
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* Hàng chỉnh: chỉ hiện khi mở đúng nhóm này. */}
                  {open ? (
                    <TableRow
                      backgroundClassName="bg-slate-50/70 dark:bg-slate-800/40"
                      borderClassName="border-b border-slate-100 dark:border-slate-700/60"
                    >
                      <TableCell colSpan={4} layoutClassName="px-4 py-3">
                        <Box layoutClassName="space-y-2">
                          <Typography size="xs" variant="muted">
                            Bấm chip để bật/tắt loại thông báo nhóm này nhận — lưu ngay.
                          </Typography>
                          <Box layoutClassName="flex flex-wrap items-center gap-1.5">
                            {ZALO_NOTIFY_FEATURES.map((f) => {
                              const on = row.features.includes(f.value);
                              return (
                                <Button
                                  key={f.value}
                                  type="button"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => toggleFeature(row, f.value)}
                                  sizeClassName="px-2 py-1 text-[11px]"
                                  roundedClassName="rounded-full"
                                  layoutClassName="font-medium"
                                  borderClassName={
                                    on
                                      ? 'border border-primary-300 dark:border-primary-700'
                                      : 'border border-slate-200 dark:border-slate-600'
                                  }
                                  backgroundClassName={
                                    on ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-transparent'
                                  }
                                  textClassName={
                                    on
                                      ? 'text-primary-800 dark:text-primary-200'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }
                                  hoverClassName="hover:border-primary-300 dark:hover:border-primary-700"
                                  stateClassName="transition-colors"
                                  disableVariantHover
                                  disableVariantTextColor
                                >
                                  {f.label}
                                </Button>
                              );
                            })}
                          </Box>

                          {row.features.includes('order_update') ? (
                            <Box layoutClassName="space-y-1 pt-1">
                              <Typography size="xs" variant="muted">
                                Chỉ báo khi sửa (không chọn = báo mọi thay đổi):
                              </Typography>
                              <Box layoutClassName="flex flex-wrap items-center gap-1">
                                {ZALO_TRACKABLE_FIELDS.map((f) => {
                                  const on = row.updateFieldWhitelist.includes(f.key);
                                  return (
                                    <Button
                                      key={f.key}
                                      type="button"
                                      variant="ghost"
                                      disabled={busy}
                                      onClick={() => toggleField(row, f.key)}
                                      sizeClassName="px-1.5 py-0.5 text-[10px]"
                                      roundedClassName="rounded"
                                      borderClassName={
                                        on
                                          ? 'border border-emerald-300 dark:border-emerald-700'
                                          : 'border border-dashed border-slate-200 dark:border-slate-600'
                                      }
                                      backgroundClassName={
                                        on ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-transparent'
                                      }
                                      textClassName={
                                        on
                                          ? 'text-emerald-700 dark:text-emerald-300'
                                          : 'text-slate-400 dark:text-slate-500'
                                      }
                                      stateClassName="transition-colors"
                                      disableVariantHover
                                      disableVariantTextColor
                                    >
                                      {f.label}
                                    </Button>
                                  );
                                })}
                              </Box>
                            </Box>
                          ) : null}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : null}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}

      <Typography size="xs" variant="muted">
        Bấm ô "N chức năng" để mở danh sách và bật/tắt — lưu ngay, không cần bấm Lưu.
        Nhóm chưa gán chức năng nào thì không nhận thông báo nào.
      </Typography>
    </Card>
  );
};

export default ZaloGroupsPage;
