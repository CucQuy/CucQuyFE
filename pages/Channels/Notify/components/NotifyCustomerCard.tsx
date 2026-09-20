import React, { useEffect, useState } from 'react';
import { Eye, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchCustomerNotifyPreview } from '@/services/orderService';
import { usePromotions } from '@/hooks/queries/usePromotionsQuery';
import type {
  NotifyChannelSettings,
  NotifyCustomerConfig,
} from '@/services/notifySettingsService';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Checkbox from '@/components/ui/Checkbox';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';
import Typography from '@/components/ui/Typography';

interface Props {
  channel: NotifyChannelSettings;
  onSave: (patch: Partial<NotifyCustomerConfig>) => Promise<void>;
}

/**
 * Tin gửi cho KHÁCH của 1 kênh (cảm ơn + link tra đơn + mã KM). Kênh nào không có
 * khái niệm này (customer = null) thì parent không render card.
 */
const NotifyCustomerCard: React.FC<Props> = ({ channel, onSave }) => {
  const { promotions } = usePromotions();
  const cfg = channel.customer;

  const [enabled, setEnabled] = useState(cfg?.enabled === true);
  const [promotionId, setPromotionId] = useState(cfg?.promotionId ?? '');
  const [dailyLimit, setDailyLimit] = useState(cfg?.dailyLimit ?? 40);
  const [preview, setPreview] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  // Đổi kênh hoặc refetch xong → đồng bộ lại form theo dữ liệu mới nhất.
  useEffect(() => {
    setEnabled(cfg?.enabled === true);
    setPromotionId(cfg?.promotionId ?? '');
    setDailyLimit(cfg?.dailyLimit ?? 40);
  }, [cfg?.enabled, cfg?.promotionId, cfg?.dailyLimit]);

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
      await onSave({ enabled, promotionId, dailyLimit });
      toast.success('Đã lưu cài đặt tin gửi khách');
    } catch {
      toast.error('Lưu cài đặt thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="lg" layoutClassName="space-y-3">
      <Box>
        <Typography size="sm" textClassName="font-semibold">
          Tin gửi khách qua {channel.label}
        </Typography>
        <Typography size="xs" variant="muted">
          Tin gửi cho khách sau khi tạo đơn: cảm ơn, link tra đơn, mã khuyến mãi.
        </Typography>
      </Box>

      <Checkbox
        checked={enabled}
        onChange={(e) => setEnabled(e.target.checked)}
        label="Bật gửi tin cho khách"
        labelClassName="text-sm font-medium text-slate-700 dark:text-slate-200"
      />

      <Box layoutClassName="grid gap-4 sm:grid-cols-2">
        <Field label="Khuyến mãi chèn kèm">
          <Select
            value={promotionId}
            onChange={(e) => setPromotionId(e.target.value)}
            fullWidth
            stateClassName="dark:[color-scheme:dark]"
          >
            <option value="">Không chèn</option>
            {promotions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Hạn mức tin/ngày">
          <Input
            type="number"
            min={0}
            value={dailyLimit}
            onChange={(e) => setDailyLimit(Number(e.target.value) || 0)}
          />
        </Field>
      </Box>

      <Box layoutClassName="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => void loadPreview()}
          disabled={loadingPreview}
          sizeClassName="px-3 py-1.5 text-xs"
          leftIcon={loadingPreview ? <Spinner size="sm" /> : <Eye className="h-3.5 w-3.5" />}
          iconClassName="inline-flex shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5"
          layoutClassName="inline-flex items-center gap-1.5"
        >
          {loadingPreview ? 'Đang tải…' : 'Xem trước tin'}
        </Button>
        <Box layoutClassName="ml-auto">
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            sizeClassName="px-3 py-1.5 text-xs"
            leftIcon={saving ? <Spinner size="sm" /> : <Save className="h-3.5 w-3.5" />}
            iconClassName="inline-flex shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5"
            layoutClassName="inline-flex items-center gap-1.5"
          >
            {saving ? 'Đang lưu…' : 'Lưu cài đặt'}
          </Button>
        </Box>
      </Box>

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
    </Card>
  );
};

export default NotifyCustomerCard;
