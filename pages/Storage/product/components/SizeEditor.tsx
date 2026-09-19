/**
 * SizeEditor — khai báo size (biến thể giá) của sản phẩm: tên + giá + ảnh riêng.
 * Giá bán dòng đơn lấy theo size chọn. UI dạng bảng gọn (VariantTable).
 */
import React from 'react';
import { Ruler } from 'lucide-react';
import type { ProductSize } from '@/types';
import VariantTable, { VariantRow } from '@/pages/Storage/product/components/VariantTable';

interface SizeEditorProps {
  sizes: ProductSize[];
  onChange: (sizes: ProductSize[]) => void;
  galleryImages: string[];
  /** Bỏ khung card + header khi đã nằm trong khối có tiêu đề. */
  flat?: boolean;
}

const SizeEditor: React.FC<SizeEditorProps> = ({ sizes, onChange, galleryImages, flat }) => (
  <VariantTable
    icon={<Ruler className="h-4 w-4 text-primary-500" />}
    title="Size"
    hint="giá dòng theo size chọn"
    namePlaceholder="Tên size (vd: Combo Gia Đình 5 cái)"
    withCount
    galleryImages={galleryImages}
    flat={flat}
    items={sizes as VariantRow[]}
    onChange={(rows) => onChange(rows.map((r) => ({ name: r.name, price: r.price ?? 0, image: r.image, count: r.count })))}
  />
);

export default SizeEditor;
