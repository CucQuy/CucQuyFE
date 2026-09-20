import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendZaloTestMessage } from '@/services/zaloService';
import type {
  NotifyChannelSettings,
  NotifyFeatureDef,
  NotifyTarget,
} from '@/services/notifySettingsService';
import { NOTIFY_TRACKABLE_FIELDS } from '@/types/notify';
import Badge from '@/components/ui/Badge';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Image from '@/components/ui/Image';
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

interface Props {
  channel: NotifyChannelSettings;
  features: NotifyFeatureDef[];
  /** Ghi cấu hình 1 nơi nhận (parent gọi API + invalidate). */
  onSave: (target: NotifyTarget, patch: { features?: string[]; updateFieldWhitelist?: string[] }) => Promise<void>;
}

/**
 * Bảng "nơi nhận thông báo" của 1 kênh — KHÔNG biết kênh nào: nhóm Zalo, page
 * Facebook hay tài khoản TikTok đều render y hệt. Cột chức năng chỉ hiện số, bấm
 * mới mở dãy chip bật/tắt (lưu ngay).
 */
const NotifyTargetTable: React.FC<Props> = ({ channel, features, onSave }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const save = async (
    target: NotifyTarget,
    patch: { features?: string[]; updateFieldWhitelist?: string[] },
  ) => {
    setSavingId(target.id);
    try {
      await onSave(target, patch);
    } catch {
      toast.error('Lưu cấu hình thất bại');
    } finally {
      setSavingId(null);
    }
  };

  const toggleFeature = (target: NotifyTarget, key: string) => {
    const on = target.features.includes(key);
    void save(target, {
      features: on ? target.features.filter((f) => f !== key) : [...target.features, key],
      // Tắt "sửa đơn" thì bộ lọc field hết nghĩa → dọn luôn.
      updateFieldWhitelist:
        on && key === 'order_update' ? [] : target.updateFieldWhitelist,
    });
  };

  const toggleField = (target: NotifyTarget, key: string) => {
    const on = target.updateFieldWhitelist.includes(key);
    void save(target, {
      updateFieldWhitelist: on
        ? target.updateFieldWhitelist.filter((f) => f !== key)
        : [...target.updateFieldWhitelist, key],
    });
  };

  /** Gửi tin test — hiện chỉ Zalo có API test, kênh khác ẩn nút. */
  const handleTest = async (target: NotifyTarget) => {
    setTestingId(target.id);
    const r = await sendZaloTestMessage(target.id);
    setTestingId(null);
    if (r.ok) toast.success(`Đã gửi tin test vào "${target.name}"`);
    else toast.error(r.error || 'Gửi test thất bại');
  };

  if (channel.targets.length === 0) {
    return (
      <EmptyState
        icon={<Send className="h-8 w-8" />}
        title={`Chưa có nơi nhận nào cho ${channel.label}`}
        description={channel.note || 'Thêm tài khoản vào nhóm/trang rồi bấm Nạp lại.'}
      />
    );
  }

  return (
    <Box layoutClassName="overflow-x-auto">
      <Table>
        <TableHead
          backgroundClassName="bg-slate-50 dark:bg-slate-700/60"
          borderClassName="border-b border-slate-200 dark:border-slate-600"
        >
          <TableRow textClassName="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <TableHeaderCell layoutClassName="px-4 py-3.5">Nơi nhận</TableHeaderCell>
            <TableHeaderCell layoutClassName="px-4 py-3.5 text-right">Thành viên</TableHeaderCell>
            <TableHeaderCell layoutClassName="px-4 py-3.5">Chức năng thông báo</TableHeaderCell>
            <TableHeaderCell layoutClassName="px-4 py-3.5 text-right">Thao tác</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {channel.targets.map((target, idx) => {
            const open = expandedId === target.id;
            const busy = savingId === target.id;
            return (
              <React.Fragment key={target.id}>
                <TableRow
                  backgroundClassName={
                    target.features.length > 0
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
                      {target.avatar ? (
                        <Image
                          src={target.avatar}
                          alt={target.name}
                          layoutClassName="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <Box
                          layoutClassName="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                          backgroundClassName="bg-slate-100 dark:bg-slate-700"
                        >
                          <Typography as="span" size="sm" textClassName="font-semibold text-slate-500 dark:text-slate-300">
                            {(target.name || '?').trim().charAt(0).toUpperCase()}
                          </Typography>
                        </Box>
                      )}
                      <Box layoutClassName="min-w-0">
                        <Typography as="div" size="sm" textClassName="font-semibold text-slate-900 dark:text-white">
                          {target.name}
                        </Typography>
                        <Typography as="div" size="xs" variant="muted" layoutClassName="font-mono">
                          {target.id}
                        </Typography>
                        {target.missing ? (
                          <Badge
                            size="sm"
                            borderClassName="border-amber-200 dark:border-amber-800"
                            backgroundClassName="bg-amber-50 dark:bg-amber-950/40"
                            textClassName="text-amber-700 dark:text-amber-300"
                          >
                            Không còn trong {channel.label}
                          </Badge>
                        ) : null}
                      </Box>
                    </Box>
                  </TableCell>

                  <TableCell layoutClassName="whitespace-nowrap px-4 py-3 text-right">
                    <Typography as="span" size="sm" variant={target.members ? undefined : 'muted'}>
                      {target.members || '—'}
                    </Typography>
                  </TableCell>

                  <TableCell layoutClassName="px-4 py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setExpandedId(open ? null : target.id)}
                      sizeClassName="px-2 py-1 text-xs"
                      roundedClassName="rounded-lg"
                      layoutClassName="inline-flex items-center gap-1.5"
                      borderClassName="border border-transparent"
                      hoverClassName="hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-700/40"
                      stateClassName="transition-colors"
                      disableVariantHover
                      disableVariantTextColor
                      textClassName={
                        target.features.length > 0
                          ? 'font-semibold text-primary-700 dark:text-primary-300'
                          : 'text-slate-400 dark:text-slate-500'
                      }
                    >
                      {open ? (
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                      )}
                      {target.features.length > 0
                        ? `${target.features.length} chức năng`
                        : 'Chưa gán'}
                      {busy ? <Spinner size="sm" /> : null}
                    </Button>
                  </TableCell>

                  <TableCell layoutClassName="whitespace-nowrap px-4 py-3 text-right">
                    {channel.channel === 'zalo' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={testingId === target.id}
                        onClick={() => void handleTest(target)}
                        sizeClassName="px-2.5 py-1.5 text-xs"
                        leftIcon={
                          testingId === target.id ? (
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
                    ) : (
                      <Typography as="span" size="xs" variant="muted">
                        —
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>

                {open ? (
                  <TableRow
                    backgroundClassName="bg-slate-50/70 dark:bg-slate-800/40"
                    borderClassName="border-b border-slate-100 dark:border-slate-700/60"
                  >
                    <TableCell colSpan={4} layoutClassName="px-4 py-3">
                      <Box layoutClassName="space-y-2">
                        <Typography size="xs" variant="muted">
                          Bấm chip để bật/tắt loại thông báo nơi này nhận — lưu ngay.
                        </Typography>
                        <Box layoutClassName="flex flex-wrap items-center gap-1.5">
                          {features.map((f) => {
                            const on = target.features.includes(f.key);
                            return (
                              <Button
                                key={f.key}
                                type="button"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => toggleFeature(target, f.key)}
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

                        {target.features.includes('order_update') ? (
                          <Box layoutClassName="space-y-1 pt-1">
                            <Typography size="xs" variant="muted">
                              Chỉ báo khi sửa (không chọn = báo mọi thay đổi):
                            </Typography>
                            <Box layoutClassName="flex flex-wrap items-center gap-1">
                              {NOTIFY_TRACKABLE_FIELDS.map((f) => {
                                const on = target.updateFieldWhitelist.includes(f.key);
                                return (
                                  <Button
                                    key={f.key}
                                    type="button"
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() => toggleField(target, f.key)}
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
  );
};

export default NotifyTargetTable;
