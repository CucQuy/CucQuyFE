import React, { useEffect, useState } from 'react';
import { Eye, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchCustomerNotifyPreview } from '@/services/orderService';
import { usePromotions } from '@/hooks/queries/usePromotionsQuery';
import { useSaveZaloGroups, useZaloGroups } from '@/hooks/queries/useConfigQuery';
import { useAuth } from '@/contexts/AuthContext';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Checkbox from '@/components/ui/Checkbox';
import Heading from '@/components/ui/Heading';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';
import Typography from '@/components/ui/Typography';

/**
 * Cài đặt tin Zalo gửi cho KHÁCH sau khi tạo đơn (cảm ơn + link tra đơn + mã KM).
 * Tách riêng khỏi màn Nhóm Zalo: nhóm là chuyện gửi nội bộ, màn này gửi cho khách.
 * Lưu chung endpoint zalo-groups nên phải gửi kèm `groups` hiện tại (BE ghi đè cả list).
 */
const ZaloSettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { data: zaloConfig, loading } = useZaloGroups();
  const { save: saveZaloGroups } = useSaveZaloGroups();
  const { promotions } = usePromotions();

  const [enabled, setEnabled] = useState(false);
  const [promotionId, setPromotionId] = useState('');
  const [dailyLimit, setDailyLimit] = useState(40);
  const [preview, setPreview] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!zaloConfig) return;
    setEnabled(zaloConfig.customerNotifyEnabled === true);
    setPromotionId(zaloConfig.customerNotifyPromotionId ?? '');
    setDailyLimit(
      typeof zaloConfig.customerNotifyDailyLimit === 'number'
        ? zaloConfig.customerNotifyDailyLimit
        : 40,
    );
  }, [zaloConfig]);

  const loadPreview = async () => {
    setLoadingPreview(true);
    try {
      const r = await fetchCustomerNotifyPreview();
      setPreview(r.message);
    } catch {
      toast.error('Không lấy được nội dung xem trước');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveZaloGroups({
        groups: zaloConfig?.groups ?? [],
        updatedBy: currentUser?.uid ?? null,
        customerSettings: {
          customerNotifyEnabled: enabled,
          customerNotifyPromotionId: promotionId,
          customerNotifyDailyLimit: dailyLimit,
        },
      });
      toast.success('Đã lưu cài đặt tin gửi khách');
    } catch {
      toast.error('Lưu cài đặt thất bại');
    } finally {
      setSaving(false);
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
    <Card layoutClassName="space-y-4 p-4">
      <Box layoutClassName="flex flex-wrap items-start justify-between gap-2">
        <Box layoutClassName="space-y-1">
          <Heading
            level={3}
            textClassName="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
          >
            Thông báo cho khách
          </Heading>
          <Typography size="xs" variant="muted">
            Sau khi tạo đơn, gửi Zalo cho khách: cảm ơn + thông tin đơn + link tự tra trạng thái
            + mã khuyến mãi lần sau. Gửi rải để không bị Zalo chặn.
          </Typography>
        </Box>
        <Checkbox
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          label="Bật gửi tự động"
          labelClassName="text-sm font-medium text-slate-700 dark:text-slate-200"
        />
      </Box>

      <Box layoutClassName="grid gap-3 sm:grid-cols-2">
        <Box layoutClassName="space-y-1">
          <Label>Mã khuyến mãi chèn vào tin</Label>
          <Select value={promotionId} searchable onChange={(e) => setPromotionId(e.target.value)}>
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
          <Label>Hạn mức tin/ngày</Label>
          <Input
            type="number"
            min={0}
            value={String(dailyLimit)}
            onChange={(e) => setDailyLimit(Math.max(0, Number(e.target.value) || 0))}
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
          onClick={() => void loadPreview()}
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
        {preview ? (
          <Box
            layoutClassName="whitespace-pre-wrap rounded-xl p-3"
            backgroundClassName="bg-slate-50 dark:bg-slate-800/60"
            borderClassName="border border-slate-200 dark:border-slate-600"
          >
            <Typography size="xs" textClassName="text-slate-700 dark:text-slate-200">
              {preview}
            </Typography>
          </Box>
        ) : null}
      </Box>

      <Box layoutClassName="flex justify-end">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          leftIcon={saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
        >
          {saving ? 'Đang lưu…' : 'Lưu cài đặt'}
        </Button>
      </Box>
    </Card>
  );
};

export default ZaloSettingsPage;
