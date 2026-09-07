import React, { useMemo, useState } from 'react';
import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSaveZaloFeatures, useZaloFeatures } from '@/hooks/queries/useConfigQuery';
import { ZaloFeatureFlag } from '@/types';
import Badge from '@/components/ui/Badge';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import IconButton from '@/components/ui/IconButton';
import Spinner from '@/components/ui/Spinner';
import Switch from '@/components/ui/Switch';
import Typography from '@/components/ui/Typography';
import FeatureFormModal from './components/FeatureFormModal';

/**
 * Danh sách chức năng thông báo Zalo + công tắc bật/tắt.
 *
 * Danh mục lấy từ API (bảng zalo_features) nên **thêm chức năng mới làm ngay ở đây**,
 * không cần deploy: đặt tên + gõ nội dung có biến {{...}} → xong thì sang màn Nhóm gán
 * nhóm nhận và màn Lịch nhắc đặt giờ gửi. Chức năng "mặc định" (nội dung do code soạn)
 * chỉ bật/tắt được, không sửa/xoá.
 */
const ZaloFeaturesPage: React.FC = () => {
  const { data: features, loading } = useZaloFeatures();
  const { save, upsert, remove, saving } = useSaveZaloFeatures();
  const [pending, setPending] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ZaloFeatureFlag | null>(null);

  /** Gom theo section do DB khai (chức năng tự soạn tự tạo section mới). */
  const sections = useMemo(() => {
    const m = new Map<string, ZaloFeatureFlag[]>();
    for (const f of features) {
      const list = m.get(f.section) ?? [];
      list.push(f);
      m.set(f.section, list);
    }
    return [...m.entries()];
  }, [features]);

  const toggle = async (feature: string, enabled: boolean) => {
    setPending(feature);
    try {
      await save([{ feature, enabled }]);
    } catch {
      toast.error('Không đổi được trạng thái chức năng');
    } finally {
      setPending(null);
    }
  };

  const submitForm = async (input: {
    feature?: string;
    label: string;
    description: string;
    section: string;
    template: string;
  }) => {
    try {
      await upsert(input);
      toast.success(input.feature ? 'Đã cập nhật chức năng' : 'Đã thêm chức năng');
      setFormOpen(false);
      setEditing(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Lưu chức năng thất bại');
    }
  };

  const removeFeature = async (f: ZaloFeatureFlag) => {
    if (!window.confirm(`Xoá chức năng "${f.label}"? Lịch nhắc của nó cũng bị xoá.`)) return;
    try {
      await remove(f.feature);
      toast.success('Đã xoá chức năng');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Xoá chức năng thất bại');
    }
  };

  if (loading) {
    return (
      <Box layoutClassName="flex h-full items-center justify-center">
        <Spinner />
      </Box>
    );
  }

  return (
    <Box layoutClassName="h-full space-y-4 overflow-y-auto">
      <Box layoutClassName="flex flex-wrap items-center justify-between gap-2">
        <Typography size="xs" variant="muted">
          Tắt là không gửi, kể cả nhóm đã được gán. Chức năng tự soạn thêm được ngay ở
          đây, không cần lập trình.
        </Typography>
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Thêm chức năng
        </Button>
      </Box>

      {sections.map(([section, list]) => (
        <Card key={section} padding="none" layoutClassName="overflow-hidden">
          <Box
            layoutClassName="px-4 py-3"
            borderClassName="border-b border-slate-100 dark:border-slate-700"
          >
            <Typography size="sm" textClassName="font-semibold">
              {section}
            </Typography>
          </Box>
          <Box layoutClassName="divide-y divide-slate-100 dark:divide-slate-700">
            {list.map((f) => (
              <Box
                key={f.feature}
                layoutClassName="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <Box layoutClassName="min-w-0 space-y-1">
                  <Box layoutClassName="flex flex-wrap items-center gap-2">
                    <Typography size="sm" textClassName="font-medium">
                      {f.label}
                    </Typography>
                    {f.kind === 'template' ? (
                      <Badge
                        size="sm"
                        borderClassName="border-primary-200 dark:border-primary-800"
                        backgroundClassName="bg-primary-50 dark:bg-primary-950/40"
                        textClassName="text-primary-700 dark:text-primary-300"
                      >
                        Tự soạn
                      </Badge>
                    ) : null}
                    {f.schedulable ? <Badge size="sm">Đặt lịch được</Badge> : null}
                  </Box>
                  {f.description ? (
                    <Typography size="xs" variant="muted">
                      {f.description}
                    </Typography>
                  ) : null}
                  {f.groups.length > 0 ? (
                    <Box layoutClassName="flex flex-wrap items-center gap-1">
                      {f.groups.map((g) => (
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
                  {f.kind === 'template' ? (
                    <>
                      <IconButton
                        label="Sửa"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(f);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        label="Xoá"
                        size="sm"
                        variant="danger"
                        onClick={() => void removeFeature(f)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </>
                  ) : null}
                  <Typography size="xs" variant="muted">
                    {f.enabled ? 'Đang bật' : 'Đang tắt'}
                  </Typography>
                  {pending === f.feature ? (
                    <Spinner size="sm" />
                  ) : (
                    <Switch
                      checked={f.enabled}
                      onCheckedChange={(v) => void toggle(f.feature, v)}
                      aria-label={f.label}
                    />
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </Card>
      ))}

      {formOpen ? (
        <FeatureFormModal
          key={editing?.feature ?? 'new'}
          feature={editing}
          saving={saving}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={submitForm}
        />
      ) : null}
    </Box>
  );
};

export default ZaloFeaturesPage;
