import React, { useState } from 'react';
import { Printer, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  isKitchenStationEnabled,
  setKitchenStationEnabled,
  playNotificationSound,
  speakNewOrder,
} from '@/utils/sound';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Heading from '@/components/ui/Heading';
import Switch from '@/components/ui/Switch';
import Typography from '@/components/ui/Typography';

/**
 * Card "Máy quán": bật/tắt chế độ máy đặt tại quán (kiosk) — khi có ĐƠN MỚI sẽ
 * PHÁT ÂM "bạn có đơn hàng mới" + TỰ IN PHIẾU BẾP. Cài đặt theo TỪNG THIẾT BỊ
 * (lưu localStorage) → chỉ bật trên máy quán, điện thoại/máy khác để tắt cho khỏi
 * kêu + in trùng. Nút test chỉ nghe thử âm báo (không in).
 */
const KitchenStationCard: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(() => isKitchenStationEnabled());

  const handleToggle = (next: boolean) => {
    setEnabled(next);
    setKitchenStationEnabled(next);
  };

  const handleTest = () => {
    playNotificationSound();
    speakNewOrder();
    toast.success('Đang phát thử âm báo đơn mới');
  };

  return (
    <Card padding="lg">
      <Box layoutClassName="flex items-center gap-2 mb-3">
        <Printer className="h-5 w-5 text-primary-500" />
        <Heading level={3} textClassName="text-base font-semibold">
          Máy quán (in bếp + loa đơn mới)
        </Heading>
      </Box>

      <Typography size="sm" variant="muted" layoutClassName="mb-4">
        Bật trên ĐÚNG máy đặt ở quán (nối máy in + loa). Khi có đơn mới, máy này sẽ
        phát âm "bạn có đơn hàng mới từ Cúc Quy" và tự in phiếu bếp. Các máy khác
        (điện thoại...) hãy để TẮT để không kêu và in trùng.
      </Typography>

      <Box layoutClassName="flex items-center justify-between gap-4">
        <Box layoutClassName="flex items-center gap-3">
          <Switch checked={enabled} onCheckedChange={handleToggle} />
          <Typography as="span" size="sm" textClassName="text-slate-700 dark:text-slate-200">
            Đặt máy này làm máy quán
          </Typography>
        </Box>

        <Button
          type="button"
          onClick={handleTest}
          leftIcon={<Bell />}
          iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
          sizeClassName="px-4 py-2"
          backgroundClassName="bg-primary-600"
          hoverClassName="hover:bg-primary-700"
          textClassName="text-sm font-medium text-white"
          roundedClassName="rounded-lg"
          layoutClassName="inline-flex items-center gap-2"
          stateClassName="transition-colors"
          disableVariantHover
          disableVariantTextColor
        >
          Nghe thử
        </Button>
      </Box>
    </Card>
  );
};

export default KitchenStationCard;
