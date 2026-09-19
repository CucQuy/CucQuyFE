/**
 * FormSection — 1 nhóm câu hỏi trong form sản phẩm: tiêu đề + 1 dòng giải thích + nội dung.
 * Dùng để form hỏi theo TỪNG VIỆC thay vì đổ hết mọi ô vào một cột dài.
 */
import React from 'react';
import Box from '@/components/ui/Box';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';

interface Props {
  title: string;
  /** Một câu giải thích khối này dùng làm gì (viết cho người bán, không dùng từ kỹ thuật). */
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const FormSection: React.FC<Props> = ({ title, hint, icon, children }) => (
  <Box
    layoutClassName="space-y-3 p-4"
    roundedClassName="rounded-xl"
    borderClassName="border border-slate-200 dark:border-slate-700"
    backgroundClassName="bg-white dark:bg-slate-800"
  >
    <Box layoutClassName="space-y-1">
      <Heading level={3} layoutClassName="flex items-center gap-2" textClassName="text-sm font-semibold">
        {icon}
        {title}
      </Heading>
      {hint ? (
        <Typography as="p" size="xs" variant="muted">
          {hint}
        </Typography>
      ) : null}
    </Box>
    {children}
  </Box>
);

export default FormSection;
