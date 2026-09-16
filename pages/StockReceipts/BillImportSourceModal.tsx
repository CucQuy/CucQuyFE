import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, ImagePlus, MessageSquareText, PencilLine, Upload } from 'lucide-react';
import { fetchZaloBills, startOfTodayMs, type ZaloTextBill } from '@/services/zaloBillsService';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Typography from '@/components/ui/Typography';
import BillImportModal from '@/pages/StockReceipts/BillImportModal';
import { useLanguage } from '@/contexts/LanguageContext';

export interface BillImportSourceModalProps {
  open: boolean;
  onClose: () => void;
  /** Ảnh bill được chọn (1 ảnh: kéo-thả / dán / tải lên / chụp) → chạy OCR đơn. */
  onImageSelected: (file: File) => void;
  /** NHIỀU ảnh bill cùng lúc → hàng đợi nhập hàng loạt. */
  onImagesSelected?: (files: File[]) => void;
  /** Mở form nhập phiếu THỦ CÔNG (không OCR). */
  onStartManual: () => void;
  /** Bill TEXT từ Zalo (đã AI phân tích) → hàng đợi review, bỏ OCR. */
  onZaloTextBills?: (bills: ZaloTextBill[]) => void;
}

/**
 * Modal chọn nguồn nhập phiếu: 1 dropzone (kéo-thả + dán Ctrl/⌘+V + bấm chọn),
 * kèm 3 lựa chọn nhanh — chụp ảnh (camera), tải ảnh lên, nhập thủ công.
 * Ảnh hợp lệ → onImageSelected (chạy OCR); nhập tay → onStartManual.
 */
const BillImportSourceModal: React.FC<BillImportSourceModalProps> = ({
  open,
  onClose,
  onImageSelected,
  onImagesSelected,
  onStartManual,
  onZaloTextBills,
}) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [zaloLoading, setZaloLoading] = useState(false);

  // Nạp ảnh bill từ nhóm Zalo "Hoá đơn Tiệm" qua agent (BE relay) → hàng đợi hàng loạt.
  // sinceTs=0 → tất cả; startOfTodayMs() → chỉ bill hôm nay.
  const handleZalo = useCallback(
    async (sinceTs: number) => {
      setZaloLoading(true);
      try {
        const { files, textBills, result } = await fetchZaloBills({ sinceTs });
        if (!result.ok) {
          toast.error(result.error || 'Không lấy được bill từ Zalo');
          return;
        }
        if (files.length === 0 && textBills.length === 0) {
          toast(sinceTs ? 'Không có bill nào hôm nay trong nhóm Zalo' : 'Không có bill trong nhóm Zalo');
          return;
        }
        if (files.length > 0) {
          if (files.length > 1 && onImagesSelected) onImagesSelected(files);
          else onImageSelected(files[0]);
        }
        if (textBills.length > 0 && onZaloTextBills) onZaloTextBills(textBills);
        const parts: string[] = [];
        if (files.length) parts.push(`${files.length} ảnh`);
        if (textBills.length) parts.push(`${textBills.length} bill chữ`);
        const more = result.total > files.length ? ` (còn ${result.total - files.length} ảnh nữa)` : '';
        toast.success(`Đã nạp ${parts.join(' + ')} từ Zalo${more}`);
      } catch {
        toast.error('Lỗi gọi máy đọc Zalo (agent offline?)');
      } finally {
        setZaloLoading(false);
      }
    },
    [onImageSelected, onImagesSelected, onZaloTextBills],
  );

  // Nhận 1..n file ảnh từ mọi nguồn → validate; 1 ảnh chạy OCR đơn, nhiều ảnh vào hàng đợi.
  const acceptImages = useCallback(
    (files: (File | undefined | null)[]) => {
      const imgs = files.filter((f): f is File => !!f && f.type.startsWith('image/'));
      if (imgs.length === 0) {
        toast.error(t('billImport.invalidFile'));
        return;
      }
      if (imgs.length > 1 && onImagesSelected) onImagesSelected(imgs);
      else onImageSelected(imgs[0]);
    },
    [onImageSelected, onImagesSelected, t],
  );

  // Dán ảnh (Ctrl/⌘+V) khi modal đang mở. Clipboard không có ảnh → bỏ qua.
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
      acceptImages(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, acceptImages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    acceptImages(files);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    acceptImages(Array.from(e.dataTransfer.files ?? []));
  };

  const openFilePicker = () => fileInputRef.current?.click();
  const openCamera = () => cameraInputRef.current?.click();

  return (
    <BillImportModal open={open} onClose={onClose} title="Nhập phiếu nhập">
      <Box layoutClassName="mx-auto w-full max-w-lg space-y-4">
        {/* File input thô: chưa có UI component cho input file (giống BillImportEntryTab). */}
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

        {/* ===== DROPZONE: kéo-thả / dán / bấm chọn ===== */}
        <Box
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openFilePicker();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          layoutClassName="group flex cursor-pointer flex-col items-center justify-center gap-3 px-6 py-12 text-center"
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
            layoutClassName="flex h-14 w-14 items-center justify-center transition-transform duration-150 group-hover:scale-105"
            roundedClassName="rounded-2xl"
            backgroundClassName="bg-primary-100 dark:bg-primary-900/40"
          >
            <ImagePlus className="h-7 w-7 text-primary-600 dark:text-primary-300" />
          </Box>
          <Box layoutClassName="space-y-1">
            <Typography size="sm" layoutClassName="font-semibold">
              {t('billImport.dropzoneTitle')}
            </Typography>
            <Typography size="xs" variant="muted">
              {t('billImport.dropzoneHint')}
            </Typography>
          </Box>
        </Box>

        {/* ===== Divider "hoặc" ===== */}
        <Box layoutClassName="flex items-center gap-3">
          <Box layoutClassName="h-px flex-1" backgroundClassName="bg-slate-200 dark:bg-slate-700" />
          <Typography size="xs" variant="muted" layoutClassName="uppercase tracking-wide">
            hoặc chọn nguồn
          </Typography>
          <Box layoutClassName="h-px flex-1" backgroundClassName="bg-slate-200 dark:bg-slate-700" />
        </Box>

        {/* ===== 3 lựa chọn nhanh (tile icon xếp dọc) ===== */}
        <Box layoutClassName="grid grid-cols-3 gap-2">
          {[
            { onClick: openCamera, icon: <Camera />, label: t('billImport.optCamera') },
            { onClick: openFilePicker, icon: <Upload />, label: t('billImport.optUpload') },
            { onClick: onStartManual, icon: <PencilLine />, label: t('billImport.optManual') },
          ].map((o, i) => (
            <Button
              key={i}
              type="button"
              onClick={o.onClick}
              leftIcon={o.icon}
              iconClassName="inline-flex shrink-0 [&_svg]:h-5 [&_svg]:w-5"
              sizeClassName="px-2 py-3 text-xs"
              backgroundClassName="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/70"
              borderClassName="border border-slate-200 dark:border-slate-600"
              textClassName="font-medium text-slate-700 dark:text-slate-200"
              roundedClassName="rounded-xl"
              stateClassName="transition-colors"
              layoutClassName="flex flex-col items-center justify-center gap-1.5"
              disableVariantHover
              disableVariantTextColor
            >
              {o.label}
            </Button>
          ))}
        </Box>

        {/* ===== Card: Nạp bill từ nhóm Zalo "Hoá đơn Tiệm" ===== */}
        <Box
          layoutClassName="space-y-3 p-3.5"
          borderClassName="border border-sky-200 dark:border-sky-900/60"
          backgroundClassName="bg-sky-50/60 dark:bg-sky-950/20"
          roundedClassName="rounded-2xl"
        >
          <Box layoutClassName="flex items-center gap-2.5">
            <Box
              layoutClassName="flex h-9 w-9 items-center justify-center"
              roundedClassName="rounded-xl"
              backgroundClassName="bg-sky-600"
            >
              <MessageSquareText className="h-4 w-4 text-white" />
            </Box>
            <Box layoutClassName="min-w-0">
              <Typography size="sm" layoutClassName="font-semibold text-sky-900 dark:text-sky-200">
                Nạp từ Zalo
              </Typography>
              <Typography size="xs" variant="muted">
                Nhóm “Hoá đơn Tiệm” — tự lấy ảnh bill
              </Typography>
            </Box>
          </Box>
          <Box layoutClassName="grid grid-cols-3 gap-2">
            <Button
              type="button"
              onClick={() => handleZalo(startOfTodayMs())}
              disabled={zaloLoading}
              sizeClassName="px-3 py-2 text-xs"
              backgroundClassName="bg-sky-600 hover:bg-sky-700 disabled:opacity-60"
              textClassName="font-semibold text-white"
              borderClassName="border border-transparent"
              roundedClassName="rounded-xl"
              stateClassName="transition-colors"
              layoutClassName="col-span-2 inline-flex items-center justify-center gap-1.5"
              disableVariantHover
              disableVariantTextColor
            >
              {zaloLoading ? 'Đang lấy bill…' : 'Hôm nay'}
            </Button>
            <Button
              type="button"
              onClick={() => handleZalo(0)}
              disabled={zaloLoading}
              sizeClassName="px-3 py-2 text-xs"
              backgroundClassName="bg-white hover:bg-sky-50 dark:bg-slate-800 disabled:opacity-60"
              borderClassName="border border-sky-300 dark:border-sky-800"
              textClassName="font-medium text-sky-700 dark:text-sky-300"
              roundedClassName="rounded-xl"
              stateClassName="transition-colors"
              layoutClassName="inline-flex items-center justify-center gap-1.5"
              disableVariantHover
              disableVariantTextColor
            >
              Tất cả
            </Button>
          </Box>
        </Box>
      </Box>
    </BillImportModal>
  );
};

export default BillImportSourceModal;
