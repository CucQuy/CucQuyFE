export interface ProductMaterial {
  materialId: string;
  quantity: number;
}

/** 1 size của sản phẩm: tên + giá + ảnh + số cái (combo). Giá dòng đơn lấy theo size chọn. */
export interface ProductSize {
  name: string;
  price: number;
  image?: string;
  /** Số cái của combo (vd 3, 5). >1 → khi bán phân bổ vị theo số cái (stepper). */
  count?: number;
}

/** 1 biến thể vị: tên + màu + ảnh riêng (từ gallery) + giá riêng (tùy chọn). Khai báo per-sản phẩm. */
export interface ProductFlavorVariant {
  name: string;
  color?: string;
  image?: string;
  price?: number;
}

/** Phân loại sản phẩm (mô hình "mọi thứ là sản phẩm"). */
export type ProductType = 'cake' | 'giftset' | 'packaging' | 'decoration' | 'accessory' | 'service';

export const PRODUCT_TYPES: { value: ProductType; label: string; hint: string }[] = [
  { value: 'cake', label: 'Bánh / Nước', hint: 'Món bán lẻ — có thể khai báo vị, size' },
  { value: 'giftset', label: 'Set quà / Box combo', hint: 'Hộp gồm nhiều món lấy từ sản phẩm có sẵn' },
  { value: 'packaging', label: 'Bao bì, hộp đựng', hint: 'Bán kèm hoặc tính phụ phí gói' },
  { value: 'decoration', label: 'Trang trí', hint: 'Nến, topper, phụ kiện gắn lên bánh' },
  { value: 'accessory', label: 'Phụ kiện', hint: 'Dao, đĩa, ly, thìa…' },
  { value: 'service', label: 'Dịch vụ / khác', hint: 'Ship, viết chữ, thuê đồ…' },
];

/**
 * Khối nào nên hiện cho loại sản phẩm nào — để form chỉ hỏi thứ thật sự cần.
 * Sản phẩm đã có sẵn dữ liệu ở khối bị ẩn thì form vẫn hiện khối đó (không giấu mất dữ liệu).
 */
export interface ProductTypeSections {
  /** Vị + size (khách chọn khi mua). */
  variants: boolean;
  /** Thành phần hộp (chọn từ sản phẩm có sẵn). */
  combo: boolean;
  /** Mua nhiều giảm giá. */
  priceTiers: boolean;
  /** Cách gói — khách chọn, cộng thêm tiền. */
  packaging: boolean;
  /** Nhãn hiển thị trên web/menu. */
  badges: boolean;
}

export const productTypeSections = (t?: string): ProductTypeSections => {
  switch (t) {
    case 'giftset':
      return { variants: false, combo: true, priceTiers: true, packaging: true, badges: true };
    case 'packaging':
      return { variants: false, combo: false, priceTiers: true, packaging: false, badges: false };
    case 'decoration':
    case 'accessory':
      return { variants: false, combo: false, priceTiers: true, packaging: false, badges: false };
    case 'service':
      return { variants: false, combo: false, priceTiers: false, packaging: false, badges: false };
    case 'cake':
    default:
      return { variants: true, combo: false, priceTiers: true, packaging: true, badges: true };
  }
};

export const productTypeLabel = (t?: string): string =>
  PRODUCT_TYPES.find((x) => x.value === t)?.label ?? 'Bánh';

/** 1 bậc giá theo số lượng. price = đơn giá khi tổng SL của SP trong đơn >= minQty. */
export interface PriceTier {
  minQty: number;
  price: number; // VND / đơn vị
}

/** 1 option gói: nhãn + phí cộng thêm mỗi đơn vị (cộng vào giá bậc). */
export interface PackagingOption {
  label: string;
  perUnit: number; // VND / đơn vị
}

/**
 * Giá theo bậc SL: chọn bậc CAO NHẤT có minQty <= qty; không bậc nào khớp → base.
 * Bỏ qua bậc giá <= 0. Dùng chung form đơn + báo giá.
 */
export const resolveTierPrice = (
  base: number,
  tiers: PriceTier[] | undefined,
  qty: number,
): number => {
  if (!tiers || tiers.length === 0) return base;
  const sorted = [...tiers]
    .filter((t) => Number(t.price) > 0 && Number(t.minQty) > 0)
    .sort((a, b) => Number(a.minQty) - Number(b.minQty));
  let price = base;
  for (const t of sorted) if (qty >= Number(t.minQty)) price = Number(t.price);
  return price;
};

export interface Product {
  id: string;
  name: string;
  price: number;
  /** Phân loại (cake mặc định / packaging / decoration / accessory / service). */
  type?: ProductType;
  /** Giá bậc theo SL (tính theo tổng SL của SP này trong đơn). */
  priceTiers?: PriceTier[];
  /** SP phụ phí tự thêm (qty đồng bộ) — legacy, thay bằng packagingOptions. */
  addOnProductIds?: string[];
  /** Option gói: chọn 1/dòng, phí/đơn vị cộng vào giá bậc (vd Đóng gói +2k, Gói hộp+thiệp +6k). */
  packagingOptions?: PackagingOption[];
  image: string;
  /** Ảnh phụ (gallery) — các góc chụp/chi tiết khác. Primary vẫn là `image` */
  gallery?: string[];
  category: string;
  tags?: string[];
  /** Vị (multi-select) — không ảnh hưởng giá */
  flavors?: string[];
  /** Size (biến thể giá) — giá dòng đơn lấy theo size chọn */
  sizes?: ProductSize[];
  /** Biến thể vị: mỗi vị có ảnh + giá riêng (giá dòng = tổng vị chọn) */
  flavorVariants?: ProductFlavorVariant[];
  description?: string;
  status: 'active' | 'inactive';
  materials?: ProductMaterial[];
  createdAt?: string;
  /** Giá vốn / cost price */
  costPrice?: number;
  /** Tỷ lệ hoa hồng cố định (legacy / override), VD: 0.1 = 10% trên giá bán */
  commissionRate?: number;
  /** Badge IDs gán cho sản phẩm */
  badgeIds?: string[];
  /** Đơn vị tồn kho */
  stockUnit?: string;
  /** Số lượng tồn kho hiện tại */
  currentStock?: number;
  /** Ngưỡng cảnh báo low stock */
  lowStockThreshold?: number;
}

export interface ProductVersion {
  id: string;
  productId: string;
  action: 'update' | string;
  editedAt?: string;
  before?: Record<string, unknown>;
  changes?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/** Sản phẩm tính giá theo tổng vị chọn khi: không có size + có ≥1 vị đặt giá. */
export const productUsesFlavorPricing = (p: {
  sizes?: ProductSize[];
  flavorVariants?: ProductFlavorVariant[];
}): boolean =>
  (!p.sizes || p.sizes.length === 0) &&
  !!p.flavorVariants?.some((v) => (v.price ?? 0) > 0);

/** Tổng giá các vị đang chọn — cộng theo TỪNG lần xuất hiện (mảng có thể lặp = số cái mỗi vị). */
export const flavorSumPrice = (
  p: { flavorVariants?: ProductFlavorVariant[] },
  selected: string[],
): number =>
  (selected ?? []).reduce((s, name) => {
    const v = (p.flavorVariants ?? []).find((x) => x.name === name);
    return s + (v?.price ?? 0);
  }, 0);

/** Ảnh riêng của 1 vị (nếu có). */
export const flavorImage = (
  p: { flavorVariants?: ProductFlavorVariant[] },
  name: string,
): string | undefined =>
  (p.flavorVariants ?? []).find((v) => v.name === name)?.image;

/** Màu của 1 vị theo khai báo trong sản phẩm (fallback xám). */
export const flavorVariantColor = (
  p: { flavorVariants?: ProductFlavorVariant[] },
  name: string,
): string =>
  (p.flavorVariants ?? []).find((v) => v.name === name)?.color || '#64748b';

/** Ảnh của 1 size (nếu có). */
export const sizeImage = (
  p: { sizes?: ProductSize[] },
  name?: string,
): string | undefined =>
  name ? (p.sizes ?? []).find((s) => s.name === name)?.image : undefined;

/** Số cái của 1 size (combo). undefined nếu không phải combo nhiều cái. */
export const sizeCount = (
  p: { sizes?: ProductSize[] },
  name?: string,
): number | undefined =>
  name ? (p.sizes ?? []).find((s) => s.name === name)?.count : undefined;

/** 1 dòng đơn có thể chứa nhiều size + số lượng. */
export interface OrderSizeCount { name: string; qty: number; }

/** Tổng giá theo sizeCounts = Σ(qty × giá size). */
export const sizeCountsPrice = (
  p: { sizes?: ProductSize[] },
  sc?: OrderSizeCount[],
): number =>
  (sc ?? []).reduce((s, x) => {
    const sz = (p.sizes ?? []).find((z) => z.name === x.name);
    return s + (sz?.price ?? 0) * (x.qty || 0);
  }, 0);

/** Tổng số cái theo sizeCounts = Σ(qty × số cái mỗi size). */
export const sizeCountsCakes = (
  p: { sizes?: ProductSize[] },
  sc?: OrderSizeCount[],
): number =>
  (sc ?? []).reduce((s, x) => {
    const sz = (p.sizes ?? []).find((z) => z.name === x.name);
    return s + (sz?.count ?? 1) * (x.qty || 0);
  }, 0);

/** Nhãn "Gia Đình ×2, Lẻ" từ sizeCounts (bỏ qty 0, bỏ ×1 cho gọn). */
export const sizeCountsLabel = (sc?: OrderSizeCount[]): string =>
  (sc ?? [])
    .filter((x) => x.qty > 0)
    .map((x) => (x.qty > 1 ? `${x.name} ×${x.qty}` : x.name))
    .join(', ');

/**
 * Vị "Mix" — token đánh dấu 1 dòng/phần để BẾP tự phối, KHÔNG chọn vị cụ thể.
 * Lưu trong mảng `flavors`/`units` như 1 phần tử `MIX_FLAVOR`; hiển thị ra "Mix".
 */
export const MIX_FLAVOR = '__MIX__';
export const MIX_LABEL = 'Mix';

/** 1 dòng/phần đang ở chế độ Mix (mảng vị chứa token mix). */
export const isMixFlavors = (flavors?: string[]): boolean =>
  !!flavors && flavors.some((f) => f === MIX_FLAVOR);

/** Gom mảng vị (có lặp) thành [{name, qty}] để hiển thị: vd ['M','M','S'] → [{M,2},{S,1}].
 *  Token `MIX_FLAVOR` được đổi tên hiển thị thành "Mix" ngay tại đây → mọi chỗ render
 *  qua groupFlavors tự hiện "Mix" thay vì token thô. */
export const groupFlavors = (flavors?: string[]): { name: string; qty: number }[] => {
  const m = new Map<string, number>();
  (flavors ?? []).forEach((f) => m.set(f, (m.get(f) || 0) + 1));
  return Array.from(m.entries()).map(([name, qty]) => ({ name: name === MIX_FLAVOR ? MIX_LABEL : name, qty }));
};

/**
 * Ảnh nên hiển thị cho 1 dòng đơn theo biến thể khách chọn:
 * ưu tiên ảnh size → ảnh vị (đầu tiên có ảnh) → ảnh gốc sản phẩm.
 */
export const orderLineImage = (
  p: { image?: string; sizes?: ProductSize[]; flavorVariants?: ProductFlavorVariant[] },
  opts: { size?: string; flavors?: string[] },
): string | undefined => {
  const si = sizeImage(p, opts.size);
  if (si) return si;
  const fi = (opts.flavors ?? []).map((n) => flavorImage(p, n)).find(Boolean);
  if (fi) return fi;
  return p.image;
};

/** 1 món trong combo — trỏ sản phẩm có sẵn (bảng product_combo_items). */
export interface ComboItem {
  id?: number;
  productId: string;
  name?: string;
  /** Số phần trong hộp (2 viên phô mai dẻo → 2). */
  qty: number;
  /** 1 phần = bao nhiêu đơn vị bán lẻ của SP đó (hộp 10 cái → 0.1). */
  portion: number;
  unitLabel?: string | null;
  note?: string | null;
  sortOrder?: number;
  /** BE tính sẵn, chỉ đọc. */
  unitRetail?: number;
  lineRetail?: number;
  unitCost?: number;
  lineCost?: number;
}

/** Combo + đối chiếu giá lẻ (GET /products/:id/combo). */
export interface ProductCombo {
  comboId: string;
  name: string;
  price?: number;
  costPrice?: number;
  status?: string;
  itemCount: number;
  retailSum: number;
  saving: number;
  savingPct: number;
  items: ComboItem[];
}
