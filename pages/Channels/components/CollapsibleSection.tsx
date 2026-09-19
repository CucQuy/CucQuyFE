import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';

interface CollapsibleSectionProps {
  title: string;
  /** Dòng phụ dưới tiêu đề (mô tả ngắn khối này làm gì). */
  desc?: string;
  /** Tóm tắt hiện bên phải khi đang thu gọn (vd "8/12 đang bật"). */
  summary?: React.ReactNode;
  icon?: React.ReactNode;
  /** Mở sẵn khi vào màn (mặc định thu gọn cho màn đỡ dài). */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Khối gấp/mở dùng trong màn Zalo gộp — phần phụ (cờ tổng, tin gửi khách) nằm dưới
 * danh sách nhóm, mặc định thu gọn để nhóm vẫn là thứ thấy đầu tiên.
 */
const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  desc,
  summary,
  icon,
  defaultOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card padding="none" layoutClassName="overflow-hidden" borderClassName="border-slate-100 dark:border-slate-700">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        layoutClassName="w-full text-left"
        sizeClassName="px-4 py-3"
        roundedClassName="rounded-none"
        disableVariantHover
        disableVariantTextColor
      >
        <Box layoutClassName="flex w-full items-center gap-3">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          {icon ? <Box layoutClassName="shrink-0">{icon}</Box> : null}
          <Box layoutClassName="min-w-0 flex-1">
            <Typography size="sm" textClassName="font-semibold">
              {title}
            </Typography>
            {desc ? (
              <Typography size="xs" variant="muted">
                {desc}
              </Typography>
            ) : null}
          </Box>
          {summary ? (
            <Typography as="span" size="xs" variant="muted" layoutClassName="shrink-0">
              {summary}
            </Typography>
          ) : null}
        </Box>
      </Button>
      {open ? (
        <Box
          layoutClassName="p-4"
          borderClassName="border-t border-slate-100 dark:border-slate-700"
        >
          {children}
        </Box>
      ) : null}
    </Card>
  );
};

export default CollapsibleSection;
