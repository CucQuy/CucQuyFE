import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlignLeft, DollarSign, Image, Loader2, Save, Tag, Upload } from 'lucide-react';
import BaseSlidePanel from '@/components/BaseSlidePanel';
import Tabs from '@/components/ui/Tabs';
import Textarea from '@/components/ui/Textarea';
import type { ComboItem, Product, PriceTier, PackagingOption, ProductType } from '@/types';
import ProductTypePricingSection from '@/pages/Storage/product/components/ProductTypePricingSection';
import { useLanguage } from '@/contexts/LanguageContext';
import { getProductImagePath, uploadImage } from '@/services/imageService';
import { useBadges } from '@/hooks/queries/useBadgesQuery';
import { useCategories } from '@/hooks/queries/useCategoriesQuery';
import { useProductVersions, useProducts } from '@/hooks/queries/useProductsQuery';
import { fetchProductCombo, saveProductCombo } from '@/services/productService';
import type { ProductBadge } from '@/types/badge';
import GallerySection from '@/pages/Storage/product/components/GallerySection';
import CategoryPicker from '@/pages/Storage/product/components/CategoryPicker';
import TagPicker from '@/pages/Storage/product/components/TagPicker';
import FlavorVariantEditor from '@/pages/Storage/product/components/FlavorVariantEditor';
import SizeEditor from '@/pages/Storage/product/components/SizeEditor';
import ComboEditor from '@/pages/Storage/product/components/ComboEditor';
import type { ProductSize, ProductFlavorVariant } from '@/types';
import ProductHistoryView from '@/pages/Storage/product/components/ProductHistoryView';
import Field from '@/components/ui/Field';
import Select from '@/components/ui/Select';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface ProductFormProps {
  initialData?: Product | null;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}

const MAX_GALLERY = 20;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ProductForm: React.FC<ProductFormProps> = ({ initialData, onSave, onCancel }) => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [image, setImage] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [flavorVariants, setFlavorVariants] = useState<ProductFlavorVariant[]>([]);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [type, setType] = useState<ProductType>('cake');
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);
  const [packagingOptions, setPackagingOptions] = useState<PackagingOption[]>([]);
  // Combo: thành phần trỏ sản phẩm có sẵn (bảng riêng → fetch/lưu tách khỏi product)
  const [comboItems, setComboItems] = useState<ComboItem[]>([]);
  const [comboLoading, setComboLoading] = useState(false);

  // Tabs + history
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');

  // Configs (badges + categories) qua React Query
  const { productBadges } = useBadges();
  const { categories } = useCategories();
  const { products: allProducts } = useProducts();

  // Lịch sử version — chỉ fetch khi mở tab history + có sản phẩm
  const { versions, loading: historyLoading } = useProductVersions(
    initialData?.id,
    activeTab === 'history',
  );

  const badgeByName = useMemo(() => {
    const m = new Map<string, ProductBadge>();
    productBadges.forEach((b) => m.set(b.name, b));
    return m;
  }, [productBadges]);

  // Hydrate from initialData
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setPrice(initialData.price);
      setImage(initialData.image || '');
      setGallery(initialData.gallery || []);
      setCategory(initialData.category);
      const allowed = new Set(productBadges.map((b) => b.name.toLowerCase()));
      setTags((initialData.tags || []).filter((tag) => allowed.has(tag.trim().toLowerCase())));
      setFlavorVariants(
        initialData.flavorVariants && initialData.flavorVariants.length
          ? initialData.flavorVariants
          : (initialData.flavors || []).map((n) => ({ name: n })),
      );
      setSizes(initialData.sizes || []);
      setDescription(initialData.description || '');
      setStatus(initialData.status);
      setType((initialData.type as ProductType) || 'cake');
      setPriceTiers(initialData.priceTiers || []);
      setPackagingOptions(initialData.packagingOptions || []);
    } else {
      setName('');
      setPrice(0);
      setImage('');
      setGallery([]);
      setCategory('');
      setTags([]);
      setFlavorVariants([]);
      setSizes([]);
      setDescription('');
      setStatus('active');
      setType('cake');
      setPriceTiers([]);
      setPackagingOptions([]);
    }
  }, [initialData, productBadges]);

  useEffect(() => { setActiveTab('details'); }, [initialData?.id]);

  // Thành phần combo nằm ở bảng riêng → nạp theo id sản phẩm đang mở.
  useEffect(() => {
    const id = initialData?.id;
    if (!id) {
      setComboItems([]);
      return;
    }
    let alive = true;
    setComboLoading(true);
    fetchProductCombo(id)
      .then((combo) => { if (alive) setComboItems(combo?.items ?? []); })
      .catch(() => { if (alive) setComboItems([]); })
      .finally(() => { if (alive) setComboLoading(false); });
    return () => { alive = false; };
  }, [initialData?.id]);

  // === Primary image upload ===
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file ảnh');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Kích thước ảnh không được vượt quá 5MB');
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const productId = initialData?.id || 'new';
      const path = getProductImagePath(productId, file.name);
      setImage(await uploadImage(file, path));
    } catch (err: any) {
      setError(err.message || 'Không thể upload ảnh');
    } finally {
      setIsUploading(false);
    }
  };

  // === Gallery upload ===
  const handleGalleryUpload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const available = MAX_GALLERY - gallery.length - (image ? 1 : 0);
    if (available <= 0) {
      setError(`Tối đa ${MAX_GALLERY} ảnh / sản phẩm`);
      return;
    }
    const toUpload = list.slice(0, available);
    for (const f of toUpload) {
      if (!f.type.startsWith('image/')) { setError('Vui lòng chỉ chọn file ảnh'); return; }
      if (f.size > MAX_IMAGE_BYTES) { setError(`Ảnh "${f.name}" vượt quá 5MB`); return; }
    }
    setGalleryUploading(true);
    setError(null);
    try {
      const productId = initialData?.id || 'new';
      const uploaded: string[] = [];
      for (const f of toUpload) {
        const path = getProductImagePath(productId, `gallery_${Date.now()}_${f.name}`);
        uploaded.push(await uploadImage(f, path));
      }
      setGallery((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      setError(err.message || 'Không thể upload gallery');
    } finally {
      setGalleryUploading(false);
    }
  };

  const handleSetPrimary = (idx: number) => {
    setGallery((prev) => {
      const next = [...prev];
      const promoted = next.splice(idx, 1)[0];
      if (image) next.unshift(image);
      setImage(promoted);
      return next;
    });
  };

  // === Submit ===
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (!name.trim()) throw new Error('Tên sản phẩm là bắt buộc');
      if (price < 0) throw new Error('Giá không được âm');
      await onSave({
        id: initialData?.id,
        name,
        price,
        image,
        gallery,
        category: category || 'General',
        tags: tags.filter((tag) => badgeByName.has(tag)),
        flavors: flavorVariants.map((v) => v.name),
        flavorVariants,
        sizes,
        description,
        status,
        type,
        priceTiers: priceTiers.filter((t) => Number(t.minQty) > 0 && Number(t.price) > 0),
        packagingOptions: packagingOptions.filter((o) => o.label.trim()),
      });
      // Thành phần combo lưu riêng (bảng product_combo_items) — chỉ khi sửa SP đã có id.
      if (initialData?.id) {
        await saveProductCombo(
          initialData.id,
          comboItems.filter((it) => it.productId && Number(it.qty) > 0),
        );
      }
    } catch (err: any) {
      setError(err.message || 'Không thể lưu sản phẩm');
      setIsSubmitting(false);
    }
  };

  const footer = (
    <Box layoutClassName="flex justify-end gap-3">
      <Button
        type="button"
        onClick={onCancel}
        disabled={isSubmitting}
        variant="secondary"
        sizeClassName="px-4 py-2"
        roundedClassName="rounded-lg"
        textClassName="text-sm font-medium"
        stateClassName="disabled:opacity-50 transition-colors"
      >
        {t('form.cancel')}
      </Button>
      <Button
        type="submit"
        form="product-form"
        disabled={isSubmitting || isUploading}
        leftIcon={isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}
        iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
        sizeClassName="px-6 py-2"
        backgroundClassName="bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600"
        textClassName="text-sm font-medium text-white"
        roundedClassName="rounded-lg"
        borderClassName="border border-transparent"
        shadowClassName="shadow-sm"
        layoutClassName="inline-flex items-center justify-center gap-2"
        stateClassName="disabled:opacity-70 transition-colors"
        disableVariantHover
        disableVariantTextColor
      >
        {isSubmitting ? t('form.saving') : t('form.save')}
      </Button>
    </Box>
  );

  return (
    <BaseSlidePanel
      isOpen
      onClose={onCancel}
      maxWidth="2xl"
      title={initialData ? t('inventory.formTitleEdit') : t('inventory.formTitleAdd')}
      footer={footer}
    >
      <form id="product-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
        <Tabs
          items={[
            { id: 'details', label: 'Thông tin' },
            { id: 'history', label: 'Lịch sử', disabled: !initialData?.id },
          ]}
          value={activeTab}
          onChange={(v) => setActiveTab(v as 'details' | 'history')}
        />

        {activeTab === 'history' ? (
          <ProductHistoryView versions={versions} loading={historyLoading} hasProduct={!!initialData?.id} />
        ) : (
          <>
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Primary image */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-40 h-40 rounded-lg overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-sm relative bg-slate-50 dark:bg-slate-900">
                {image ? (
                  <img
                    src={image}
                    alt="Preview"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=No+Image'; }}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Image className="w-12 h-12" />
                  </div>
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleImageUpload(f);
                  }}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  leftIcon={<Upload />}
                  iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
                  sizeClassName="px-4 py-2 text-sm"
                  backgroundClassName="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
                  textClassName="font-medium text-slate-700 dark:text-slate-300"
                  roundedClassName="rounded-lg"
                  borderClassName="border border-transparent"
                  layoutClassName="inline-flex items-center gap-2"
                  stateClassName="transition-colors disabled:opacity-50"
                  disableVariantHover
                  disableVariantTextColor
                >
                  {isUploading ? 'Đang upload...' : 'Upload ảnh chính'}
                </Button>
                <p className="text-xs text-slate-500 dark:text-slate-400">JPG, PNG tối đa 5MB</p>
              </div>
            </div>

            {/* Gallery */}
            <GallerySection
              image={image}
              gallery={gallery}
              uploading={galleryUploading}
              maxImages={MAX_GALLERY}
              onChange={setGallery}
              onSetPrimary={handleSetPrimary}
              onUploadFiles={handleGalleryUpload}
            />

            <Box layoutClassName="space-y-4">
              {/* Name */}
              <Field label={`${t('inventory.name')} *`}>
                <Input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  leftIcon={<Tag className="h-4 w-4" />}
                  placeholder="VD: Bánh kem chocolate"
                  backgroundClassName="bg-slate-50 dark:bg-slate-700"
                />
              </Field>

              {/* Price + Category */}
              <Box layoutClassName="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('inventory.price')}>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    leftIcon={<DollarSign className="h-4 w-4" />}
                    backgroundClassName="bg-slate-50 dark:bg-slate-700"
                  />
                </Field>
                <CategoryPicker
                  value={category}
                  onChange={setCategory}
                  categories={categories}
                  label={t('inventory.category')}
                />
              </Box>

              {/* Tag picker */}
              <TagPicker tags={tags} productBadges={productBadges} onChange={setTags} />

              {/* Vị — biến thể có ảnh + giá riêng */}
              <FlavorVariantEditor
                variants={flavorVariants}
                onChange={setFlavorVariants}
                galleryImages={[image, ...gallery].filter(Boolean)}
              />

              {/* Size (biến thể giá) */}
              <SizeEditor sizes={sizes} onChange={setSizes} galleryImages={[image, ...gallery].filter(Boolean)} />

              {/* Combo: chọn món từ sản phẩm có sẵn (lưu ở bảng riêng, cần SP đã tạo) */}
              {initialData?.id ? (
                <ComboEditor
                  selfId={initialData.id}
                  comboPrice={price}
                  items={comboItems}
                  setItems={setComboItems}
                  products={allProducts}
                  loading={comboLoading}
                />
              ) : null}

              {/* Phân loại + giá bậc theo SL + phụ phí gói tự thêm */}
              <ProductTypePricingSection
                type={type}
                setType={setType}
                basePrice={price}
                priceTiers={priceTiers}
                setPriceTiers={setPriceTiers}
                packagingOptions={packagingOptions}
                setPackagingOptions={setPackagingOptions}
              />

              {/* Status */}
              <Field label={t('inventory.status')}>
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  fullWidth
                  backgroundClassName="bg-slate-50 dark:bg-slate-700"
                  stateClassName="dark:[color-scheme:dark]"
                >
                  <option value="active">{t('inventory.active')}</option>
                  <option value="inactive">{t('inventory.inactive')}</option>
                </Select>
              </Field>

              {/* Description */}
              <Field label={t('inventory.description')}>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="resize-none"
                  placeholder="Mô tả sản phẩm..."
                  leftIcon={<AlignLeft className="h-4 w-4" />}
                />
              </Field>
            </Box>
          </>
        )}
      </form>
    </BaseSlidePanel>
  );
};

export default ProductForm;
