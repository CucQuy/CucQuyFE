import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useZaloTemplateVars } from '@/hooks/queries/useConfigQuery';
import { ZaloFeatureFlag } from '@/types';
import BaseModal from '@/components/BaseModal';
import Badge from '@/components/ui/Badge';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Spinner from '@/components/ui/Spinner';
import Textarea from '@/components/ui/Textarea';
import Typography from '@/components/ui/Typography';

interface Props {
  /** null = tạo mới; có giá trị = sửa 1 chức năng tự soạn. */
  feature: ZaloFeatureFlag | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (input: {
    feature?: string;
    label: string;
    description: string;
    section: string;
    template: string;
  }) => Promise<void>;
}

/**
 * Tạo/sửa chức năng thông báo TỰ SOẠN: đặt tên, gõ nội dung, chèn biến {{...}}.
 * Không cần deploy — BE lưu vào zalo_features, lịch nhắc render lúc gửi.
 */
const FeatureFormModal: React.FC<Props> = ({ feature, saving, onClose, onSubmit }) => {
  const { data: vars, loading: loadingVars } = useZaloTemplateVars();
  const [label, setLabel] = useState(feature?.label ?? '');
  const [description, setDescription] = useState(feature?.description ?? '');
  const [section, setSection] = useState(feature?.section ?? 'Tự soạn');
  const [template, setTemplate] = useState(feature?.template ?? '');

  const preview = useMemo(
    () => vars.reduce((acc, v) => acc.split(`{{${v.key}}}`).join(`«${v.label}»`), template || ''),
    [template, vars],
  );

  const submit = async () => {
    if (!label.trim()) {
      toast.error('Chưa đặt tên chức năng');
      return;
    }
    if (!template.trim()) {
      toast.error('Chưa có nội dung tin');
      return;
    }
    await onSubmit({
      feature: feature?.feature,
      label: label.trim(),
      description: description.trim(),
      section: section.trim() || 'Tự soạn',
      template,
    });
  };

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title={feature ? `Sửa: ${feature.label}` : 'Thêm chức năng thông báo'}
      size="xl"
      footer={
        <Box layoutClassName="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Đóng
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            leftIcon={saving ? <Spinner size="sm" /> : undefined}
          >
            {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </Box>
      }
    >
      <Box layoutClassName="max-h-[min(80vh,720px)] space-y-4 overflow-y-auto pr-1">
        <Box layoutClassName="grid gap-3 sm:grid-cols-2">
          <Box layoutClassName="space-y-1">
            <Label>Tên chức năng</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="VD: Nhắc dọn tủ bánh"
              containerClassName="w-full"
            />
          </Box>
          <Box layoutClassName="space-y-1">
            <Label>Nhóm hiển thị</Label>
            <Input
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="Tự soạn"
              containerClassName="w-full"
            />
          </Box>
        </Box>

        <Box layoutClassName="space-y-1">
          <Label>Mô tả (tuỳ chọn)</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ghi chú để người sau hiểu chức năng này làm gì"
            containerClassName="w-full"
          />
        </Box>

        <Box layoutClassName="space-y-1">
          <Label>Nội dung tin</Label>
          <Textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={6}
            placeholder="VD: 🧹 {{thu}} {{ngay}} — nhớ dọn tủ bánh. Hôm nay {{so_don_hom_nay}} đơn."
          />
          <Typography size="xs" variant="muted">
            Bấm biến bên dưới để chèn vào cuối nội dung. Lúc gửi, biến được thay bằng số
            liệu thật.
          </Typography>
        </Box>

        <Box layoutClassName="space-y-2">
          <Typography
            size="xs"
            layoutClassName="block font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            Biến chèn được
          </Typography>
          {loadingVars ? (
            <Spinner size="sm" />
          ) : (
            <Box layoutClassName="flex flex-wrap gap-1.5">
              {vars.map((v) => (
                <Button
                  key={v.key}
                  type="button"
                  variant="secondary"
                  sizeClassName="px-2 py-1"
                  textClassName="text-xs"
                  leftIcon={<Plus className="h-3 w-3" />}
                  onClick={() => setTemplate((t) => `${t}{{${v.key}}}`)}
                >
                  {v.label}
                </Button>
              ))}
            </Box>
          )}
        </Box>

        {template.trim() ? (
          <Box layoutClassName="space-y-1">
            <Typography
              size="xs"
              layoutClassName="block font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              Xem trước
            </Typography>
            <Box
              layoutClassName="whitespace-pre-wrap rounded-xl p-3"
              backgroundClassName="bg-slate-50 dark:bg-slate-800/60"
              borderClassName="border border-slate-200 dark:border-slate-600"
            >
              <Typography size="xs" textClassName="text-slate-700 dark:text-slate-200">
                {preview}
              </Typography>
            </Box>
            {feature ? (
              <Badge size="sm">key: {feature.feature}</Badge>
            ) : (
              <Typography size="xs" variant="muted">
                Key sẽ được sinh tự động từ tên.
              </Typography>
            )}
          </Box>
        ) : null}
      </Box>
    </BaseModal>
  );
};

export default FeatureFormModal;
