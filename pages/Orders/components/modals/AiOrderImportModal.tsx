/**
 * AiOrderImportModal — "Nhập đơn bằng AI": user đưa ảnh khách đặt hàng (ảnh chụp
 * màn hình chat, giấy ghi tay…), AI quét rồi trả dữ liệu để ĐIỀN SẴN form tạo đơn.
 * Modal có 2 bước: chọn ảnh → xem tóm tắt + cảnh báo → bấm điền vào form (user vẫn
 * soát lại trong form trước khi lưu). AI chỉ gợi ý, không tự tạo đơn.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Camera, ImagePlus, Sparkles, Trash2, Upload } from 'lucide-react';
import { formatVND } from '@/utils/format/currencyUtil';
import { extractOrderFromImages, AI_ORDER_MAX_IMAGES } from '@/services/aiOrderService';
import { AiOrderExtracted } from '@/types/aiOrder';
import { Product } from '@/types/index';
import BaseModal from '@/components/BaseModal';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import IconButton from '@/components/ui/IconButton';
import Image from '@/components/ui/Image';
import Spinner from '@/components/ui/Spinner';
import Typography from '@/components/ui/Typography';

interface AiOrderImportModalProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
  /** Kết quả đã quét → mở form tạo đơn với dữ liệu điền sẵn. */
  onApply: (data: AiOrderExtracted) => void;
}

/** 1 ảnh đã chọn + URL preview (revoke khi bỏ ảnh / đóng modal). */
interface PickedImage {
  file: File;
  url: string;
}

const AiOrderImportModal: React.FC<AiOrderImportModalProps> = ({
  open,
  onClose,
  products,
  onApply,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<AiOrderExtracted | null>(null);

  // Dọn object URL + state mỗi lần đóng modal (tránh rò bộ nhớ preview).
  useEffect(() => {
    if (open) return;
    setImages((prev) => {
      prev.forEach((i) => URL.revokeObjectURL(i.url));
      return [];
    });
    setResult(null);
    setScanning(false);
    setDragActive(false);
  }, [open]);

  const addFiles = useCallback((files: (File | undefined | null)[]) => {
    const imgs = files.filter((f): f is File => !!f && f.type.startsWith('image/'));
    if (imgs.length === 0) {
      toast.error('File không phải ảnh — chọn ảnh chụp/chụp màn hình đơn khách đặt.');
      return;
    }
    setResult(null);
    setImages((prev) => {
      const room = AI_ORDER_MAX_IMAGES - prev.length;
      if (room <= 0) {
        toast.error(`Tối đa ${AI_ORDER_MAX_IMAGES} ảnh mỗi lần quét.`);
        return prev;
      }
      if (imgs.length > room) toast(`Chỉ nhận thêm ${room} ảnh (tối đa ${AI_ORDER_MAX_IMAGES}).`);
      return [
        ...prev,
        ...imgs.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) })),
      ];
    });
  }, []);

  // Dán ảnh (Ctrl/⌘+V) khi modal mở — cách nhanh nhất với ảnh chat vừa chụp màn hình.
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = Array.from(items)
        .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
        .map((it) => it.getAsFile());
      if (files.length === 0) return;
      e.preventDefault();
      addFiles(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, addFiles]);

  const removeImage = (url: string) => {
    setImages((prev) => {
      prev.filter((i) => i.url === url).forEach((i) => URL.revokeObjectURL(i.url));
      return prev.filter((i) => i.url !== url);
    });
    setResult(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    addFiles(files);
  };

  const handleScan = async () => {
    if (images.length === 0 || scanning) return;
    setScanning(true);
    try {
      const data = await extractOrderFromImages(images.map((i) => i.file), products);
      setResult(data);
      if (data.items.length === 0) {
        toast.error('AI không đọc được món nào trong ảnh — thử ảnh rõ hơn.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Quét ảnh thất bại — thử lại hoặc nhập tay.');
    } finally {
      setScanning(false);
    }
  };

  const unmatchedCount = result?.items.filter((i) => !i.productId).length ?? 0;

  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      title="Nhập đơn bằng AI"
      size="lg"
      footer={
        <Box layoutClassName="flex items-center justify-end gap-2">
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            disableVariantHover
            disableVariantTextColor
            sizeClassName="px-4 py-2 text-xs"
            backgroundClassName="bg-white dark:bg-slate-800"
            borderClassName="border border-slate-200 dark:border-slate-600"
            textClassName="font-medium text-slate-700 dark:text-slate-200"
            roundedClassName="rounded-xl"
            stateClassName="transition-colors"
          >
            Đóng
          </Button>
          {result ? (
            <Button
              type="button"
              onClick={() => onApply(result)}
              variant="primary"
              disableVariantHover
              disableVariantTextColor
              leftIcon={<Sparkles />}
              iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
              sizeClassName="px-4 py-2 text-xs"
              backgroundClassName="bg-primary-600"
              hoverClassName="hover:bg-primary-700"
              textClassName="font-medium text-white"
              roundedClassName="rounded-xl"
              layoutClassName="inline-flex items-center gap-1.5"
              stateClassName="transition-colors"
            >
              Điền vào form tạo đơn
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleScan}
              disabled={images.length === 0 || scanning}
              variant="primary"
              disableVariantHover
              disableVariantTextColor
              leftIcon={scanning ? undefined : <Sparkles />}
              iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
              sizeClassName="px-4 py-2 text-xs"
              backgroundClassName="bg-primary-600 disabled:opacity-60"
              hoverClassName="hover:bg-primary-700"
              textClassName="font-medium text-white"
              roundedClassName="rounded-xl"
              layoutClassName="inline-flex items-center gap-1.5"
              stateClassName="transition-colors"
            >
              {scanning ? (
                <Box layoutClassName="inline-flex items-center gap-2">
                  <Spinner size="sm" textClassName="text-white" />
                  <Typography as="span" size="xs">Đang quét ảnh…</Typography>
                </Box>
              ) : (
                'Quét ảnh'
              )}
            </Button>
          )}
        </Box>
      }
    >
      <Box layoutClassName="space-y-4 p-1">
        {/* File input thô: chưa có UI component cho input file (giống BillImportSourceModal). */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />

        {/* ===== Dropzone: kéo-thả / dán / bấm chọn ===== */}
        <Box
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            addFiles(Array.from(e.dataTransfer.files ?? []));
          }}
          layoutClassName="group flex cursor-pointer flex-col items-center justify-center gap-2 px-6 py-8 text-center"
          borderClassName={
            dragActive
              ? 'border-2 border-dashed border-primary-500'
              : 'border-2 border-dashed border-slate-200 hover:border-primary-400 dark:border-slate-700'
          }
          backgroundClassName={
            dragActive
              ? 'bg-primary-50 dark:bg-primary-950/30'
              : 'bg-slate-50/70 hover:bg-primary-50/40 dark:bg-slate-900/40'
          }
          roundedClassName="rounded-2xl"
          stateClassName="transition-colors duration-150"
        >
          <Box
            layoutClassName="flex h-12 w-12 items-center justify-center transition-transform duration-150 group-hover:scale-105"
            roundedClassName="rounded-2xl"
            backgroundClassName="bg-primary-100 dark:bg-primary-900/40"
          >
            <ImagePlus className="h-6 w-6 text-primary-600 dark:text-primary-300" />
          </Box>
          <Typography size="sm" layoutClassName="font-semibold">
            Kéo-thả, dán (Ctrl/⌘+V) hoặc bấm để chọn ảnh đơn
          </Typography>
          <Typography size="xs" variant="muted">
            Ảnh chat khách đặt, giấy ghi tay, phiếu đặt bánh — tối đa {AI_ORDER_MAX_IMAGES} ảnh cho 1 đơn
          </Typography>
        </Box>

        <Box layoutClassName="grid grid-cols-2 gap-2">
          {[
            { onClick: () => cameraInputRef.current?.click(), icon: <Camera />, label: 'Chụp ảnh' },
            { onClick: () => fileInputRef.current?.click(), icon: <Upload />, label: 'Tải ảnh lên' },
          ].map((o) => (
            <Button
              key={o.label}
              type="button"
              onClick={o.onClick}
              leftIcon={o.icon}
              iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
              sizeClassName="px-2 py-2.5 text-xs"
              backgroundClassName="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/70"
              borderClassName="border border-slate-200 dark:border-slate-600"
              textClassName="font-medium text-slate-700 dark:text-slate-200"
              roundedClassName="rounded-xl"
              stateClassName="transition-colors"
              layoutClassName="inline-flex items-center justify-center gap-1.5"
              disableVariantHover
              disableVariantTextColor
            >
              {o.label}
            </Button>
          ))}
        </Box>

        {/* ===== Ảnh đã chọn ===== */}
        {images.length > 0 && (
          <Box layoutClassName="grid grid-cols-4 gap-2">
            {images.map((img) => (
              <Box key={img.url} layoutClassName="relative overflow-hidden" roundedClassName="rounded-xl">
                <Image
                  src={img.url}
                  alt="Ảnh đơn khách đặt"
                  layoutClassName="h-24 w-full object-cover"
                  roundedClassName="rounded-xl"
                  borderClassName="border border-slate-200 dark:border-slate-700"
                />
                <IconButton
                  variant="secondary"
                  size="sm"
                  label="Bỏ ảnh"
                  onClick={() => removeImage(img.url)}
                  layoutClassName="absolute right-1 top-1"
                  backgroundClassName="bg-white/90 dark:bg-slate-900/90"
                  roundedClassName="rounded-lg"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        {/* ===== Kết quả quét ===== */}
        {result && (
          <Box
            layoutClassName="space-y-3 p-3.5"
            borderClassName="border border-primary-200 dark:border-primary-900/60"
            backgroundClassName="bg-primary-50/50 dark:bg-primary-950/20"
            roundedClassName="rounded-2xl"
          >
            <Box layoutClassName="flex items-center justify-between gap-2">
              <Typography size="sm" layoutClassName="font-semibold">
                AI đọc được
              </Typography>
              <Badge
                size="sm"
                backgroundClassName={result.confidence >= 0.6 ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-amber-100 dark:bg-amber-900/40'}
                textClassName={result.confidence >= 0.6 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}
                borderClassName="border-transparent"
              >
                Độ chắc {Math.round(result.confidence * 100)}%
              </Badge>
            </Box>

            <Box layoutClassName="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {[
                { label: 'Khách', value: result.customerName },
                { label: 'SĐT', value: result.phone },
                { label: 'Ngày giao', value: [result.deliveryDate, result.deliveryTime].filter(Boolean).join(' ') || null },
                { label: 'Địa chỉ', value: result.address },
              ].map((f) => (
                <Typography key={f.label} size="xs" variant="muted">
                  {f.label}: <Typography as="span" size="xs" layoutClassName="font-medium" textClassName="text-slate-700 dark:text-slate-200">{f.value || '—'}</Typography>
                </Typography>
              ))}
            </Box>

            <Box layoutClassName="space-y-1.5">
              {result.items.map((it, idx) => (
                <Box
                  key={`${it.productName}-${idx}`}
                  layoutClassName="flex items-center justify-between gap-2 px-2.5 py-2"
                  backgroundClassName="bg-white dark:bg-slate-800"
                  borderClassName="border border-slate-200 dark:border-slate-700"
                  roundedClassName="rounded-xl"
                >
                  <Box layoutClassName="min-w-0">
                    <Typography size="xs" layoutClassName="font-semibold truncate">
                      {it.quantity} × {it.productName}
                      {it.size ? ` (${it.size})` : ''}
                    </Typography>
                    {(it.flavors.length > 0 || it.note) && (
                      <Typography size="xs" variant="muted" layoutClassName="block truncate">
                        {[it.flavors.join(', '), it.note].filter(Boolean).join(' · ')}
                      </Typography>
                    )}
                  </Box>
                  <Box layoutClassName="flex shrink-0 items-center gap-2">
                    {it.unitPrice ? (
                      <Typography as="span" size="xs" variant="muted">{formatVND(it.unitPrice)}</Typography>
                    ) : null}
                    {!it.productId && (
                      <Badge
                        size="sm"
                        backgroundClassName="bg-amber-100 dark:bg-amber-900/40"
                        textClassName="text-amber-700 dark:text-amber-300"
                        borderClassName="border-transparent"
                      >
                        Chưa khớp SP
                      </Badge>
                    )}
                  </Box>
                </Box>
              ))}
              {result.items.length === 0 && (
                <Typography size="xs" variant="muted">Không đọc được món nào trong ảnh.</Typography>
              )}
            </Box>

            {(result.warningsVi.length > 0 || unmatchedCount > 0) && (
              <Box layoutClassName="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <Box layoutClassName="min-w-0 space-y-0.5">
                  {unmatchedCount > 0 && (
                    <Typography size="xs" variant="muted" layoutClassName="block">
                      {unmatchedCount} món chưa khớp sản phẩm — chọn lại trong form trước khi lưu.
                    </Typography>
                  )}
                  {result.warningsVi.map((w, i) => (
                    <Typography key={i} size="xs" variant="muted" layoutClassName="block">
                      {w}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </BaseModal>
  );
};

export default AiOrderImportModal;
