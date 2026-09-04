import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import type {
  BillLineItem,
  BillValidationResult,
  ImportedSupplierSummary,
  SavedStockReceiptDetail,
  StockReceiptStructured,
  SupplierContactInfo,
} from '@/types/billReceipt';
import {
  useImportedMaterials,
  useImportedSuppliers,
  useStockReceiptDetail,
  useStockReceiptMutations,
  useStockReceiptSummaries,
} from '@/hooks/queries/useStockReceiptQuery';
import { runBillImportPipeline } from '@/services/billReceiptPipeline';
import { findDuplicateReceipt, type DuplicateReceiptInfo } from '@/services/stockReceiptService';
import { useAuth } from '@/contexts/AuthContext';
import { formatVND } from '@/utils/format/currencyUtil';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Typography from '@/components/ui/Typography';
import BillImportEntryTab from '@/pages/StockReceipts/BillImportEntryTab';
import BillImportReceiptListTab from '@/pages/StockReceipts/BillImportReceiptListTab';
import ReceiptDetailModal from '@/pages/StockReceipts/ReceiptDetailModal';
import BillImportModal from '@/pages/StockReceipts/BillImportModal';
import BillImportSourceModal from '@/pages/StockReceipts/BillImportSourceModal';
import BillImportQueueModal from '@/pages/StockReceipts/BillImportQueueModal';
import { isAutoSavable, billDedupKey, type BillJob } from '@/pages/StockReceipts/billQueue';
import type { UiProgressStage } from '@/pages/StockReceipts/constants';
import { compressImageFile } from '@/utils/io/imageCompress';
import { formatImportedAt } from '@/utils/format/dateUtil';
import { normalizeSearchText, bestMaterialMatch } from '@/utils/format/stringUtil';
import type { ImportedMaterialSummary } from '@/types/billReceipt';

const EMPTY_CONTACT: SupplierContactInfo = {};

const EMPTY_LINE: BillLineItem = {
  name: '',
  quantity: null,
  unit: null,
  unitPrice: null,
  lineTotal: null,
};

/**
 * Tự khớp NVL sẵn có cho các dòng NVL: tên khớp ≥70% → đổi tên về NVL chuẩn (BE gộp theo
 * normalized_name, tránh tạo trùng) + điền đơn vị/đơn giá gần nhất nếu ô đang trống.
 */
const autoMatchMaterials = (
  s: StockReceiptStructured,
  materials: ImportedMaterialSummary[],
): StockReceiptStructured => {
  if (!materials.length || !s.lineItems?.length) return s;
  return {
    ...s,
    lineItems: s.lineItems.map((li) => {
      if ((li.itemType ?? 'material') !== 'material') return li;
      const m = bestMaterialMatch(li.name || '', materials, 0.7);
      if (!m) return li;
      return {
        ...li,
        name: m.item.name,
        unit: li.unit && li.unit.trim() ? li.unit : (m.item.canonicalUnit ?? li.unit),
        unitPrice:
          li.unitPrice == null || li.unitPrice === 0
            ? (m.item.lastUnitPrice ?? li.unitPrice)
            : li.unitPrice,
      };
    }),
  };
};

/**
 * Chuẩn hoá structured trước khi lưu: tự tính totalAmount (lineSum + tax − discount) nếu
 * chưa có, và productLineCount cho phiếu thủ công. Dùng chung cho lưu đơn + lưu hàng loạt.
 */
const buildStructuredForSave = (
  draft: StockReceiptStructured,
  isManual: boolean,
): StockReceiptStructured => {
  const hasExplicitTotal = typeof draft.totalAmount === 'number';
  const lineSum = (draft.lineItems || []).reduce(
    (s, l) => s + (typeof l.lineTotal === 'number' ? l.lineTotal : 0),
    0,
  );
  const taxV = typeof draft.tax === 'number' ? draft.tax : 0;
  const discountV = typeof draft.discount === 'number' ? draft.discount : 0;
  // Phí ship cũng vào tổng — đúng như công thức hiện trên form nhập tay.
  const shipV = typeof draft.shippingFee === 'number' ? draft.shippingFee : 0;
  const computed = lineSum + taxV + shipV - discountV;
  const validLineCount = (draft.lineItems || []).filter((l) => (l.name ?? '').trim() !== '').length;
  return {
    ...draft,
    // Phiếu THỦ CÔNG không có ô tổng nhập tay (form chỉ HIỆN tổng tự tính) nên luôn tính
    // lại từ các dòng. Trước đây giữ `totalAmount` cũ → sửa dòng xong tổng vẫn kẹt số cũ
    // (phiếu sữa tươi: dòng 70.000 mà tổng còn 70).
    // Phiếu OCR thì giữ tổng đọc từ bill (bill in sẵn tổng, có thể lệch tổng dòng).
    totalAmount: isManual ? computed : hasExplicitTotal ? draft.totalAmount : computed,
    productLineCount: isManual ? validLineCount : draft.productLineCount,
  };
};

/** Phiếu trống cho luồng nhập thủ công (không OCR) — 1 dòng hàng sẵn để gõ. */
const buildEmptyStructured = (): StockReceiptStructured => ({
  supplierName: null,
  supplierPhone: null,
  supplierAddress: null,
  invoiceNumber: null,
  storeOrBranch: null,
  receiptDate: null,
  receiptTime: null,
  lineItems: [{ ...EMPTY_LINE }],
  productLineCount: 0,
  subtotal: null,
  tax: null,
  shippingFee: null,
  discount: null,
  totalAmount: null,
  currency: 'VND',
  paymentMethod: null,
  notes: null,
});

/** Validation snapshot mặc định cho phiếu nhập thủ công (không qua OCR/gating). */
const MANUAL_VALIDATION = {
  isLikelyReceipt: true,
  confidence: 1,
  reasonVi: 'Nhập thủ công',
  heuristicScore: 1,
  heuristicNoteVi: 'manual',
} as const;

const StockReceiptsPage: React.FC = () => {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string | null>(null);
  const [uploadedImageMimeType, setUploadedImageMimeType] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const savingRef = useRef(false); // chặn double-submit đồng bộ (state async không kịp)
  const [ocrText, setOcrText] = useState('');
  const [draftStructured, setDraftStructured] = useState<StockReceiptStructured | null>(null);
  const [validation, setValidation] = useState<BillValidationResult | null>(null);
  const [progressStage, setProgressStage] = useState<UiProgressStage | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<'ocr' | 'manual'>('ocr');
  const [detailReceiptId, setDetailReceiptId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  // Đang SỬA phiếu nào (null = tạo mới). Khi lưu ở chế độ sửa: tạo bản mới rồi xoá bản cũ id này.
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [receiptSearch, setReceiptSearch] = useState('');

  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [supplierContact, setSupplierContact] = useState<SupplierContactInfo>(EMPTY_CONTACT);

  // Hàng đợi nhập bill HÀNG LOẠT.
  const [queue, setQueue] = useState<BillJob[]>([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [reviewingJobId, setReviewingJobId] = useState<string | null>(null);
  const filesRef = useRef<Map<string, File>>(new Map());
  const savedKeysRef = useRef<Set<string>>(new Set());
  const jobSeqRef = useRef(0);
  // Bill (single) đang up có thể đã có trong hệ thống.
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateReceiptInfo | null>(null);

  // Data qua React Query (epic #58 — P8). queryFn gọi thẳng stockReceiptService.
  // supplierRows vẫn cần cho EntryTab (supplierList) + SupplierPicker.
  const receiptsQuery = useStockReceiptSummaries();
  const suppliersQuery = useImportedSuppliers();
  const materialsQuery = useImportedMaterials();
  const detailQuery = useStockReceiptDetail(detailReceiptId);
  const { saveDraft, deleteReceipt } = useStockReceiptMutations();

  const receiptRows = receiptsQuery.receipts;
  const supplierRows = suppliersQuery.suppliers;
  const materialRows = materialsQuery.materials;
  const receiptDetail: SavedStockReceiptDetail | null = detailQuery.detail;
  const detailLoading = detailQuery.loading;

  const resetOutput = useCallback(() => {
    setOcrText('');
    setDraftStructured(null);
    setValidation(null);
    setUploadedImageBase64(null);
    setUploadedImageMimeType(null);
    setSelectedSupplierId(null);
    setSupplierContact(EMPTY_CONTACT);
    setDuplicateInfo(null);
  }, []);

  const resetAndClosePreview = useCallback(() => {
    resetOutput();
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [resetOutput]);

  const runPipelineForFile = useCallback(
    async (file: File) => {
      resetOutput();
      setEntryMode('ocr');
      const url = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setBusy(true);
      setProgressStage('prepare');
      try {
        const { base64: b64, mimeType: b64Mime } = await compressImageFile(file);
        setUploadedImageBase64(b64);
        setUploadedImageMimeType(b64Mime || null);
        const result = await runBillImportPipeline(b64, {
          onProgress: (stage) => setProgressStage(stage),
        });
        setOcrText(result.ocrText);
        // Tự khớp NCC ≥70% (kể cả tên hơi khác) → chọn NCC có sẵn thay vì tạo mới.
        const supMatch = bestMaterialMatch(result.structured.supplierName ?? '', supplierRows, 0.7);
        setDraftStructured(
          autoMatchMaterials(
            { ...result.structured, supplierName: supMatch ? supMatch.item.name : result.structured.supplierName },
            materialRows,
          ),
        );
        setValidation(result.validation);
        // NCC khớp sẵn → chọn luôn + đổ contact từ NCC cũ; else pre-fill từ SĐT/địa chỉ AI trích.
        if (supMatch) {
          setSelectedSupplierId(supMatch.item.id);
          setSupplierContact({
            phone: supMatch.item.phone ?? result.structured.supplierPhone ?? null,
            address: supMatch.item.address ?? result.structured.supplierAddress ?? null,
            contactPerson: supMatch.item.contactPerson ?? null,
            email: supMatch.item.email ?? null,
            taxCode: supMatch.item.taxCode ?? null,
            category: supMatch.item.category ?? null,
            channel: supMatch.item.channel,
            notes: supMatch.item.notes ?? null,
          });
        } else {
          setSupplierContact({
            phone: result.structured.supplierPhone ?? null,
            address: result.structured.supplierAddress ?? null,
          });
        }
        // Kiểm tra bill này đã có trong hệ thống chưa (theo NCC + ngày + tổng + OCR).
        try {
          const dup = await findDuplicateReceipt({
            structured: buildStructuredForSave(
              { ...result.structured, supplierName: supMatch ? supMatch.item.name : result.structured.supplierName },
              false,
            ),
            ocrText: result.ocrText,
            targetSupplierId: supMatch ? supMatch.item.id : null,
          });
          setDuplicateInfo(dup.duplicate ? dup.receipt : null);
        } catch {
          /* không chặn nếu kiểm trùng lỗi */
        }
        toast.success(t('billImport.done'));
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(msg);
      } finally {
        setBusy(false);
        setProgressStage(null);
      }
    },
    [resetOutput, t, materialRows, supplierRows],
  );

  const handleFileSelected = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast.error(t('billImport.invalidFile'));
        return;
      }
      setImportModalOpen(true);
      void runPipelineForFile(file);
    },
    [runPipelineForFile, t],
  );

  // Mở form nhập THỦ CÔNG: phiếu trống, KHÔNG chạy OCR.
  const handleStartManual = useCallback(() => {
    resetAndClosePreview();
    setEditingReceiptId(null); // nhập mới, không phải sửa
    setEntryMode('manual');
    setDraftStructured(buildEmptyStructured());
    setImportModalOpen(true);
  }, [resetAndClosePreview]);

  // Đính ảnh bill (giấy) để LƯU TRỮ ở mode manual — không chạy OCR pipeline.
  const handleManualImageSelected = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast.error(t('billImport.invalidFile'));
        return;
      }
      const url = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      try {
        const { base64: b64, mimeType: b64Mime } = await compressImageFile(file);
        setUploadedImageBase64(b64);
        setUploadedImageMimeType(b64Mime || null);
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : String(e));
      }
    },
    [t],
  );

  // Dán ảnh (Ctrl/⌘+V) khi form nhập phiếu đang mở: ảnh trong clipboard được đưa vào
  // đúng luồng theo mode — OCR thì chạy pipeline, thủ công thì đính kèm để lưu trữ.
  // Clipboard không có ảnh (vd dán text vào input) → bỏ qua, không chặn hành vi mặc định.
  useEffect(() => {
    if (!importModalOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageItem = Array.from(items).find(
        (it) => it.kind === 'file' && it.type.startsWith('image/'),
      );
      const file = imageItem?.getAsFile();
      if (!file) return;
      e.preventDefault();
      if (entryMode === 'manual') {
        void handleManualImageSelected(file);
        toast.success(t('billImport.pasteAttached'));
      } else if (!busy) {
        void runPipelineForFile(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [importModalOpen, entryMode, busy, handleManualImageSelected, runPipelineForFile, t]);

  // Chọn ảnh từ modal nguồn (dropzone / dán / tải / chụp) → đóng chooser, chạy OCR.
  const handleSourceImage = useCallback(
    (file: File) => {
      setSourceModalOpen(false);
      handleFileSelected(file);
    },
    [handleFileSelected],
  );

  // Nhập thủ công từ modal nguồn → đóng chooser, mở form trống.
  const handleSourceManual = useCallback(() => {
    setSourceModalOpen(false);
    handleStartManual();
  }, [handleStartManual]);

  const addDraftLine = useCallback(() => {
    setDraftStructured((prev) =>
      prev ? { ...prev, lineItems: [...prev.lineItems, { ...EMPTY_LINE }] } : prev,
    );
  }, []);

  const removeDraftLine = useCallback((idx: number) => {
    setDraftStructured((prev) =>
      prev ? { ...prev, lineItems: prev.lineItems.filter((_, i) => i !== idx) } : prev,
    );
  }, []);

  const handleSaveDraft = async () => {
    // Chặn double-submit đồng bộ (savingDraft là state async, click nhanh 2 lần
    // hoặc gọi lại khi request đầu chưa xong sẽ lọt → tạo phiếu trùng).
    if (savingRef.current) return;
    const isManual = entryMode === 'manual';
    if (!draftStructured) {
      toast.error(t('billImport.missingSaveData'));
      return;
    }
    if (!isManual && (!validation || !ocrText)) {
      toast.error(t('billImport.missingSaveData'));
      return;
    }
    if (isManual) {
      const hasSupplier = (draftStructured.supplierName ?? '').trim() !== '';
      const validLines = draftStructured.lineItems.filter(
        (l) => (l.name ?? '').trim() !== '',
      );
      if (!hasSupplier) {
        toast.error('Nhập tên nhà cung cấp trước khi lưu.');
        return;
      }
      if (validLines.length === 0) {
        toast.error('Thêm ít nhất 1 dòng hàng có tên.');
        return;
      }
    }
    savingRef.current = true;
    setSavingDraft(true);
    try {
      const structuredForSave = buildStructuredForSave(draftStructured, isManual);
      await saveDraft({
        structured: structuredForSave,
        validation: validation ?? MANUAL_VALIDATION,
        ocrText: isManual ? '' : ocrText,
        source: isManual ? 'manual' : 'ocr',
        receiptImageBase64: uploadedImageBase64,
        receiptImageMimeType: uploadedImageMimeType,
        createdByUid: currentUser?.uid ?? null,
        targetSupplierId: selectedSupplierId,
        supplierContact,
      });
      // Chế độ SỬA: đã tạo bản mới → xoá bản cũ (thay thế). Xoá lỗi → cảnh báo, không chặn.
      if (editingReceiptId) {
        try {
          await deleteReceipt(editingReceiptId);
        } catch (delErr) {
          console.error(delErr);
          toast.error('Đã lưu bản mới nhưng xoá phiếu cũ lỗi — kiểm tra lại danh sách phiếu.');
        }
        setEditingReceiptId(null);
        toast.success('Đã cập nhật phiếu nhập.');
      } else {
        toast.success(t('billImport.saved'));
      }
      // Nếu đang review 1 bill trong hàng đợi → đánh dấu đã lưu + nhớ khoá chống trùng lô.
      if (reviewingJobId) {
        const k = billDedupKey(draftStructured);
        if (k) savedKeysRef.current.add(k);
        patchJob(reviewingJobId, { status: 'saved' });
        setReviewingJobId(null);
      }
      setImportModalOpen(false);
      setEntryMode('ocr');
      resetAndClosePreview();
    } catch (error) {
      console.error(error);
      const rawMsg = error instanceof Error ? error.message : String(error);
      if (rawMsg.startsWith('DUPLICATE_BILL:')) {
        const existingId = rawMsg.split(':')[1];
        toast.error(
          `Bill này đã được nhập trước đó (id: ${existingId}). Mở danh sách phiếu để xem.`,
          { duration: 6000 },
        );
      } else if (rawMsg === 'TOO_MANY_LINES') {
        toast.error('Bill có quá nhiều dòng (>240). Chia làm nhiều lần nhập.');
      } else {
        toast.error(rawMsg);
      }
    } finally {
      savingRef.current = false;
      setSavingDraft(false);
    }
  };

  // ─────────────── Nhập bill HÀNG LOẠT (hàng đợi) ───────────────
  const patchJob = useCallback((id: string, patch: Partial<BillJob>) => {
    setQueue((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  /** Tự lưu 1 bill (bill tin cậy cao). Chống trùng trong lô + bắt DUPLICATE_BILL từ BE. */
  const saveJobToServer = useCallback(
    async (job: BillJob) => {
      const s = job.structured;
      if (!s) { patchJob(job.id, { status: 'error', error: 'Thiếu dữ liệu' }); return; }
      const key = billDedupKey(s);
      if (key && savedKeysRef.current.has(key)) { patchJob(job.id, { status: 'duplicate' }); return; }
      patchJob(job.id, { status: 'saving' });
      try {
        await saveDraft({
          structured: buildStructuredForSave(s, false),
          validation: job.validation ?? MANUAL_VALIDATION,
          ocrText: job.ocrText,
          source: 'ocr',
          receiptImageBase64: job.imageBase64,
          receiptImageMimeType: job.imageMimeType,
          createdByUid: currentUser?.uid ?? null,
          targetSupplierId: job.supplierId,
          supplierContact: job.supplierContact,
        });
        if (key) savedKeysRef.current.add(key);
        patchJob(job.id, { status: 'saved' });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.startsWith('DUPLICATE_BILL:')) patchJob(job.id, { status: 'duplicate', existingId: msg.split(':')[1] });
        else patchJob(job.id, { status: 'error', error: msg === 'TOO_MANY_LINES' ? 'Quá nhiều dòng (>240)' : msg });
      }
    },
    [saveDraft, currentUser, patchJob],
  );

  /** OCR 1 bill → auto-match NCC/NVL → tự lưu nếu tin cậy cao, else để review. */
  const processOneJob = useCallback(
    async (job: BillJob) => {
      const file = filesRef.current.get(job.id);
      if (!file) return;
      patchJob(job.id, { status: 'ocr', progressStage: 'prepare', error: undefined });
      try {
        const { base64: b64, mimeType: b64Mime } = await compressImageFile(file);
        const result = await runBillImportPipeline(b64, {
          onProgress: (stage) => patchJob(job.id, { progressStage: stage }),
        });
        const supMatch = bestMaterialMatch(result.structured.supplierName ?? '', supplierRows, 0.7);
        const structured = autoMatchMaterials(
          { ...result.structured, supplierName: supMatch ? supMatch.item.name : result.structured.supplierName },
          materialRows,
        );
        const supplierContactVal: SupplierContactInfo = supMatch
          ? {
              phone: supMatch.item.phone ?? result.structured.supplierPhone ?? null,
              address: supMatch.item.address ?? result.structured.supplierAddress ?? null,
              contactPerson: supMatch.item.contactPerson ?? null,
              email: supMatch.item.email ?? null,
              taxCode: supMatch.item.taxCode ?? null,
              category: supMatch.item.category ?? null,
              channel: supMatch.item.channel,
              notes: supMatch.item.notes ?? null,
            }
          : { phone: result.structured.supplierPhone ?? null, address: result.structured.supplierAddress ?? null };
        const base: Partial<BillJob> = {
          structured,
          validation: result.validation,
          ocrText: result.ocrText,
          imageBase64: b64,
          imageMimeType: b64Mime || null,
          supplierId: supMatch ? supMatch.item.id : null,
          supplierContact: supplierContactVal,
          confidence: result.validation.confidence ?? 0,
          progressStage: null,
        };
        // Đã có trong hệ thống? → đánh dấu trùng, KHÔNG tự lưu/không cần review.
        try {
          const dup = await findDuplicateReceipt({
            structured: buildStructuredForSave(structured, false),
            ocrText: result.ocrText,
            targetSupplierId: supMatch ? supMatch.item.id : null,
          });
          if (dup.duplicate) {
            patchJob(job.id, { ...base, status: 'duplicate', existingId: dup.receipt?.id });
            return;
          }
        } catch {
          /* không chặn nếu kiểm trùng lỗi */
        }
        if (isAutoSavable(structured, result.validation)) {
          patchJob(job.id, { ...base, status: 'saving' });
          await saveJobToServer({ ...job, ...base } as BillJob);
        } else {
          patchJob(job.id, { ...base, status: 'review' });
        }
      } catch (e) {
        patchJob(job.id, { status: 'error', progressStage: null, error: e instanceof Error ? e.message : String(e) });
      }
    },
    [supplierRows, materialRows, patchJob, saveJobToServer],
  );

  /** Chọn NHIỀU ảnh → tạo hàng đợi + xử lý song song (tối đa 3). */
  const handleImagesSelected = useCallback(
    (files: File[]) => {
      const imgs = files.filter((f) => f.type.startsWith('image/'));
      if (imgs.length === 0) { toast.error(t('billImport.invalidFile')); return; }
      setSourceModalOpen(false);
      savedKeysRef.current = new Set();
      const jobs: BillJob[] = imgs.map((f) => {
        const id = `job_${Date.now()}_${jobSeqRef.current++}`;
        filesRef.current.set(id, f);
        return {
          id, fileName: f.name || 'bill', previewUrl: URL.createObjectURL(f),
          status: 'pending', progressStage: null, structured: null, validation: null,
          ocrText: '', imageBase64: null, imageMimeType: f.type || null,
          supplierId: null, supplierContact: EMPTY_CONTACT, confidence: 0,
        };
      });
      setQueue(jobs);
      setQueueOpen(true);
      void (async () => {
        const CONC = 3;
        let idx = 0;
        const worker = async (): Promise<void> => {
          while (idx < jobs.length) {
            const j = jobs[idx++];
            await processOneJob(j);
          }
        };
        await Promise.all(Array.from({ length: Math.min(CONC, jobs.length) }, () => worker()));
      })();
    },
    [t, processOneJob],
  );

  /** Mở form review cho 1 bill trong hàng đợi (dùng lại form nhập 1 bill). */
  const reviewJob = useCallback((job: BillJob) => {
    const file = filesRef.current.get(job.id);
    const url = file ? URL.createObjectURL(file) : job.previewUrl; // URL riêng, revoke không ảnh hưởng thumbnail hàng đợi
    setReviewingJobId(job.id);
    setEntryMode('ocr');
    setEditingReceiptId(null);
    setDraftStructured(job.structured);
    setValidation(job.validation);
    setOcrText(job.ocrText);
    setUploadedImageBase64(job.imageBase64);
    setUploadedImageMimeType(job.imageMimeType);
    setPreviewUrl(url);
    setSelectedSupplierId(job.supplierId);
    setSupplierContact(job.supplierContact);
    setImportModalOpen(true);
  }, []);

  const retryJob = useCallback((job: BillJob) => { void processOneJob(job); }, [processOneJob]);

  /** Lưu TẤT CẢ bill đang ở trạng thái "cần xem" (áp toàn bộ, không sửa tay từng cái). */
  const saveAllReview = useCallback(async () => {
    const targets = queue.filter((j) => j.status === 'review');
    for (const j of targets) {
      // eslint-disable-next-line no-await-in-loop
      await saveJobToServer(j);
    }
  }, [queue, saveJobToServer]);

  /** Xem phiếu đã có trong hệ thống (khi bill trùng). */
  const viewExistingReceipt = useCallback(
    (job: BillJob) => {
      if (!job.existingId) return;
      setQueueOpen(false);
      setDetailReceiptId(job.existingId);
      setDetailOpen(true);
    },
    [],
  );

  const openReceiptDetail = useCallback((receiptId: string) => {
    setDetailReceiptId(receiptId);
    setDetailOpen(true);
  }, []);

  const closeReceiptDetail = useCallback(() => {
    setDetailOpen(false);
    setDetailReceiptId(null);
  }, []);

  // SỬA phiếu: nạp dữ liệu phiếu đang xem vào form nhập thủ công (prefill), đánh dấu
  // editingReceiptId. Khi Lưu → tạo bản mới rồi xoá bản cũ (xem handleSaveDraft).
  const handleEditReceipt = useCallback(() => {
    const d = receiptDetail;
    if (!d) return;
    const structured: StockReceiptStructured = {
      supplierName: d.supplierNameRaw ?? null,
      supplierPhone: null,
      supplierAddress: null,
      invoiceNumber: d.invoiceNumber ?? null,
      storeOrBranch: d.storeOrBranch ?? null,
      receiptDate: d.receiptDate ?? null,
      receiptTime: null,
      lineItems: (d.lineItems ?? []).map((l) => ({ ...l })),
      productLineCount: d.productLineCount,
      subtotal: d.subtotal,
      tax: d.tax,
      shippingFee: d.shippingFee,
      discount: d.discount,
      totalAmount: d.totalAmount,
      currency: d.currency || 'VND',
      paymentMethod: d.paymentMethod ?? null,
      notes: d.notes ?? null,
    };
    setEditingReceiptId(d.id);
    setDraftStructured(structured);
    setSelectedSupplierId(null); // create tự khớp NCC theo tên
    setSupplierContact(EMPTY_CONTACT);
    setValidation(null);
    setOcrText('');
    setUploadedImageBase64(null);
    setUploadedImageMimeType(null);
    setPreviewUrl(null);
    setEntryMode('manual');
    setDetailOpen(false);
    setImportModalOpen(true);
  }, [receiptDetail]);

  const updateDraftField = <K extends keyof StockReceiptStructured>(key: K, value: StockReceiptStructured[K]) => {
    setDraftStructured((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateDraftLine = (idx: number, patch: Partial<BillLineItem>) => {
    setDraftStructured((prev) => {
      if (!prev) return prev;
      const nextLines = [...prev.lineItems];
      const cur = nextLines[idx];
      if (!cur) return prev;
      nextLines[idx] = { ...cur, ...patch };
      return { ...prev, lineItems: nextLines };
    });
  };

  const handleSupplierSelect = useCallback(
    (next: { id: string | null; name: string; supplier?: ImportedSupplierSummary }) => {
      setSelectedSupplierId(next.id);
      if (next.supplier) {
        setSupplierContact({
          phone: next.supplier.phone ?? null,
          address: next.supplier.address ?? null,
          contactPerson: next.supplier.contactPerson ?? null,
          email: next.supplier.email ?? null,
          taxCode: next.supplier.taxCode ?? null,
          category: next.supplier.category ?? null,
          notes: next.supplier.notes ?? null,
        });
      }
    },
    [],
  );

  const handleSupplierContactChange = useCallback((patch: Partial<SupplierContactInfo>) => {
    setSupplierContact((prev) => ({ ...prev, ...patch }));
  }, []);

  const closeImportModal = useCallback(() => {
    setImportModalOpen(false);
    setEntryMode('ocr');
    setEditingReceiptId(null); // huỷ → không còn ở chế độ sửa
    setReviewingJobId(null); // huỷ review 1 bill hàng đợi → job vẫn ở trạng thái "cần xem"
    resetAndClosePreview();
  }, [resetAndClosePreview]);

  const filteredReceipts = receiptRows.filter((row) => {
    const q = normalizeSearchText(receiptSearch);
    if (!q) return true;
    const importedLabel = formatImportedAt(row.createdAt);
    // Tìm theo TIỀN: bỏ mọi ký tự không phải số → so khớp chuỗi số của total phiếu.
    // "26" khớp 26.000/260.000..., "26000" khớp đúng. Chỉ áp dụng khi query có ≥2 chữ số.
    const qDigits = receiptSearch.replace(/\D/g, '');
    const amountDigits = String(Math.round(row.totalAmount || 0));
    const amountMatch = qDigits.length >= 2 && amountDigits.includes(qDigits);
    return (
      amountMatch ||
      normalizeSearchText(row.supplierNameRaw).includes(q) ||
      normalizeSearchText(row.receiptDate).includes(q) ||
      normalizeSearchText(row.createdAt).includes(q) ||
      normalizeSearchText(importedLabel).includes(q) ||
      normalizeSearchText(row.id).includes(q) ||
      normalizeSearchText(row.invoiceNumber).includes(q)
    );
  });

  return (
    <Box layoutClassName="space-y-6 animate-fade-in">
      <BillImportReceiptListTab
        receiptSearch={receiptSearch}
        onReceiptSearchChange={setReceiptSearch}
        filteredReceipts={filteredReceipts}
        onRowClick={openReceiptDetail}
        onStartImport={() => setSourceModalOpen(true)}
      />

      <BillImportSourceModal
        open={sourceModalOpen}
        onClose={() => setSourceModalOpen(false)}
        onImageSelected={handleSourceImage}
        onImagesSelected={handleImagesSelected}
        onStartManual={handleSourceManual}
      />

      <BillImportQueueModal
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
        jobs={queue}
        onReview={reviewJob}
        onRetry={retryJob}
        onSaveAll={saveAllReview}
        onViewExisting={viewExistingReceipt}
      />

      <BillImportModal
        open={importModalOpen}
        onClose={closeImportModal}
        title={editingReceiptId ? 'Sửa phiếu nhập' : entryMode === 'manual' ? 'Nhập phiếu thủ công' : 'Nhập bill mới'}
      >
        {duplicateInfo && (
          <Box
            layoutClassName="mb-3 flex flex-wrap items-center justify-between gap-2 p-3"
            roundedClassName="rounded-xl"
            borderClassName="border border-amber-300 dark:border-amber-800/60"
            backgroundClassName="bg-amber-50 dark:bg-amber-900/20"
          >
            <Typography size="sm" textClassName="text-amber-800 dark:text-amber-200">
              ⚠️ Bill này có thể ĐÃ CÓ trong hệ thống
              {duplicateInfo.supplierName ? ` — ${duplicateInfo.supplierName}` : ''}
              {duplicateInfo.receiptDate ? ` · ${duplicateInfo.receiptDate}` : ''}
              {typeof duplicateInfo.totalAmount === 'number' ? ` · ${formatVND(duplicateInfo.totalAmount)}` : ''}
              {duplicateInfo.createdAt ? ` (nhập ${formatImportedAt(duplicateInfo.createdAt)})` : ''}.
            </Typography>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const id = duplicateInfo.id;
                setImportModalOpen(false);
                resetAndClosePreview();
                setDetailReceiptId(id);
                setDetailOpen(true);
              }}
            >
              Xem phiếu cũ
            </Button>
          </Box>
        )}
        <BillImportEntryTab
          isManual={entryMode === 'manual'}
          busy={busy}
          previewUrl={previewUrl}
          progressStage={progressStage}
          validation={validation}
          ocrText={ocrText}
          draftStructured={draftStructured}
          savingDraft={savingDraft}
          onSaveDraft={handleSaveDraft}
          updateDraftField={updateDraftField}
          updateDraftLine={updateDraftLine}
          onAddLine={addDraftLine}
          onRemoveLine={removeDraftLine}
          onManualImageSelected={handleManualImageSelected}
          supplierList={supplierRows}
          materialList={materialRows}
          selectedSupplierId={selectedSupplierId}
          supplierContact={supplierContact}
          onSupplierSelect={handleSupplierSelect}
          onSupplierContactChange={handleSupplierContactChange}
        />
      </BillImportModal>

      <ReceiptDetailModal
        open={detailOpen}
        detailLoading={detailLoading}
        receiptDetail={receiptDetail}
        onClose={closeReceiptDetail}
        onEdit={handleEditReceipt}
      />
    </Box>
  );
};

export default StockReceiptsPage;
