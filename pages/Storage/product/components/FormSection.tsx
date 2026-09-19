/**
 * FormSection — 1 nhóm câu hỏi trong 1 tab của form sản phẩm.
 * Chỉ tiêu đề mảnh + 1 dòng giải thích + đường kẻ ngăn — KHÔNG bọc card, vì các editor
 * bên trong (bảng vị/size/thành phần) đã có khung riêng, lồng 2 tầng nhìn rất rối.
 */
import React from 'react';
import Box from '@/components/ui/Box';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';

interface Props {
  title: string;
  /** Giải thích NGẮN (1 dòng, cắt bớt nếu dài) — viết cho người bán, không dùng từ kỹ thuật. */
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const FormSection: React.FC<Props> = ({ title, hint, icon, children }) => (
  <Box layoutClassName="space-y-2 pt-4 first:pt-0" borderClassName="border-t border-slate-100 first:border-0 dark:border-slate-700/60">
    <Box layoutClassName="flex items-baseline gap-2">
      <Heading level={3} layoutClassName="flex items-center gap-2" textClassName="text-sm font-semibold">
        {icon}
        {title}
      </Heading>
      {hint ? (
        <Typography as="span" size="xs" variant="muted" layoutClassName="min-w-0 flex-1 truncate">
          {hint}
        </Typography>
      ) : null}
    </Box>
    {children}
  </Box>
);

export default FormSection;
