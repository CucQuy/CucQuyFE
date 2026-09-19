/**
 * FlavorVariantEditor — khai báo vị NGAY TRONG sản phẩm (tên + màu + giá + ảnh riêng).
 * Giá dòng đơn = tổng giá các vị chọn. UI dạng bảng gọn (VariantTable).
 */
import React from 'react';
import { IceCream } from 'lucide-react';
import type { ProductFlavorVariant } from '@/types';
import VariantTable, { VariantRow } from '@/pages/Storage/product/components/VariantTable';

interface FlavorVariantEditorProps {
  variants: ProductFlavorVariant[];
  onChange: (variants: ProductFlavorVariant[]) => void;
  galleryImages: string[];
  /** Bỏ khung card + header khi đã nằm trong khối có tiêu đề. */
  flat?: boolean;
}

const FlavorVariantEditor: React.FC<FlavorVariantEditorProps> = ({ variants, onChange, galleryImages, flat }) => (
  <VariantTable
    icon={<IceCream className="h-4 w-4 text-primary-500" />}
    title="Vị"
    hint="giá dòng = tổng vị chọn"
    namePlaceholder="Tên vị (vd: Matcha)"
    withColor
    galleryImages={galleryImages}
    flat={flat}
    items={variants as VariantRow[]}
    onChange={(rows) => onChange(rows.map((r) => ({ name: r.name, color: r.color, image: r.image, price: r.price })))}
  />
);

export default FlavorVariantEditor;
