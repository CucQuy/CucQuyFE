/**
 * TagPicker — chọn tag sản phẩm từ ProductBadge config.
 */
import React from 'react';
import type { ProductBadge } from '@/types/badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

import Heading from '@/components/ui/Heading';
import Box from '@/components/ui/Box';
import Typography from '@/components/ui/Typography';

interface TagPickerProps {
  tags: string[];
  productBadges: ProductBadge[];
  onChange: (tags: string[]) => void;
  /** Nằm trong khối đã có tiêu đề → bỏ khung card + header. */
  flat?: boolean;
}

const normalizeTag = (raw: string) => raw.trim().replace(/\s+/g, ' ');

const TagPicker: React.FC<TagPickerProps> = ({ tags, productBadges, onChange, flat }) => {
  const hasTag = (value: string) => {
    const n = normalizeTag(value).toLowerCase();
    return tags.some((t) => t.toLowerCase() === n);
  };

  const toggle = (raw: string) => {
    const n = normalizeTag(raw);
    if (!n) return;
    if (hasTag(n)) onChange(tags.filter((t) => t.toLowerCase() !== n.toLowerCase()));
    else onChange([...tags, n]);
  };

  const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    flat ? (
      <Box layoutClassName="space-y-2">{children}</Box>
    ) : (
      <Card padding="md" layoutClassName="space-y-3">{children}</Card>
    );

  return (
    <Shell>
      {flat ? null : (
      <Box layoutClassName="flex items-center justify-between">
        <Heading level={3} textClassName="text-sm font-semibold uppercase tracking-wide text-slate-900 dark:text-white">
          Nhãn nổi bật
        </Heading>
        <Typography as="span" size="xs" variant="muted">{tags.length} đã chọn</Typography>
      </Box>
      )}

      {productBadges.length > 0 ? (
        <Box layoutClassName="flex flex-wrap gap-2">
          {productBadges.map((badge) => {
            const selected = hasTag(badge.name);
            return (
              <Button
                key={badge.id}
                type="button"
                variant="ghost"
                disableVariantHover
                disableVariantTextColor
                onClick={() => toggle(badge.name)}
                sizeClassName="px-2.5 py-1 text-xs"
                roundedClassName="rounded-full"
                borderClassName="border-2"
                layoutClassName="inline-flex items-center gap-1"
                textClassName="font-medium"
                stateClassName="transition-all"
                style={{
                  backgroundColor: selected ? badge.color + '33' : 'transparent',
                  color: badge.color,
                  borderColor: selected ? badge.color : badge.color + '55',
                  opacity: selected ? 1 : 0.75,
                }}
              >
                {badge.icon ? <Typography as="span" size="xs">{badge.icon}</Typography> : null}
                {badge.name}
                {selected ? <Typography as="span" size="xs">✓</Typography> : null}
              </Button>
            );
          })}
        </Box>
      ) : (
        <Typography as="p" size="xs" variant="muted">
          Chưa có nhãn nào. Tạo trong Cài đặt → Badges.
        </Typography>
      )}
    </Shell>
  );
};

export default TagPicker;
