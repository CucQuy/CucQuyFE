/**
 * Service nhập kho — đã migrate sang BE NestJS (module stock-receipts).
 * Mọi I/O đi qua `apiClient`; giữ nguyên signature mọi hàm export để các
 * caller (StockReceipt pages, OrderForm…) không phải đổi.
 *
 * `computeAmountCheck` là hàm THUẦN → giữ nguyên tại FE (không gọi API).
 */

import { apiClient } from '@/services/api/client';
import type {
  ImportedMaterialSummary,
  ImportedSupplierSummary,
  SavedStockReceiptDetail,
  SavedStockReceiptSummary,
  StockReceiptSource,
  StockReceiptStructured,
  StockReceiptValidationSnapshot,
  SupplierContactInfo,
} from '@/types/billReceipt';

const BASE = '/stock-receipts';

/** Hàm thuần (không gọi API) — giữ nguyên tại FE. */
export function computeAmountCheck(structured: StockReceiptStructured): {
  sumLines: number;
  totalAmount: number | null;
  deltaPct: number;
  warn: boolean;
} {
  const sumLines = (structured.lineItems || []).reduce((s, l) => {
    const lt = typeof l.lineTotal === 'number' ? l.lineTotal : 0;
    return s + lt;
  }, 0);
  const totalAmount = typeof structured.totalAmount === 'number' ? structured.totalAmount : null;
  // Kỳ vọng theo bill = dòng hàng + thuế + phí ship − giảm giá (khớp totalAmount).
  const tax = typeof structured.tax === 'number' ? structured.tax : 0;
  const shipping = typeof structured.shippingFee === 'number' ? structured.shippingFee : 0;
  const discount = typeof structured.discount === 'number' ? structured.discount : 0;
  const expected = sumLines + tax + shipping - discount;
  const deltaPct =
    totalAmount && totalAmount > 0 ? Math.abs(expected - totalAmount) / totalAmount : 0;
  return { sumLines, totalAmount, deltaPct, warn: deltaPct > 0.02 };
}

/**
 * Lưu phiếu nhập (transaction tạo receipt + lines + upsert supplier/materials).
 * → BE: POST /stock-receipts (createdByUid lấy từ token, không cần gửi).
 * Trả về id phiếu vừa tạo. BE ném DUPLICATE_BILL:<id> / TOO_MANY_LINES khi cần.
 */
export async function saveStockReceiptDraft(input: {
  structured: StockReceiptStructured;
  validation: StockReceiptValidationSnapshot;
  ocrText: string;
  receiptImageBase64?: string | null;
  receiptImageMimeType?: string | null;
  createdByUid?: string | null;
  targetSupplierId?: string | null;
  supplierContact?: SupplierContactInfo | null;
  /** Mặc định 'ocr' (BE coi thiếu = 'ocr'). 'manual' → BE bỏ chống trùng DUPLICATE_BILL. */
  source?: StockReceiptSource;
}): Promise<string> {
  const { createdByUid: _ignore, ...payload } = input;
  const res = await apiClient.post<{ id: string }>(BASE, payload);
  return res.data.id;
}

/** Cập nhật thông tin NCC → PATCH /stock-receipts/suppliers/:id. */
/** Xoá 1 phiếu nhập (BE cascade lines + tài sản/chi phí liên kết + recompute tổng). */
export async function deleteStockReceipt(
  receiptId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const res = await apiClient.delete<{ ok: boolean; reason?: string }>(`${BASE}/${receiptId}`);
  return res.data;
}

export async function updateSupplier(
  id: string,
  patch: Partial<SupplierContactInfo> & { name?: string },
): Promise<void> {
  await apiClient.patch(`${BASE}/suppliers/${id}`, patch);
}

/** Ghim / bỏ ghim NCC (hay gọi ship → lên đầu danh bạ) → PATCH /stock-receipts/suppliers/:id. */
export async function setSupplierPinned(id: string, pinned: boolean): Promise<void> {
  await apiClient.patch(`${BASE}/suppliers/${id}`, { pinned });
}

/** Tạo NCC thủ công (không qua phiếu nhập) → POST /stock-receipts/suppliers. */
export async function createSupplier(input: {
  name: string;
  phone?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  taxCode?: string | null;
  category?: string | null;
  channel?: string | null;
  notes?: string | null;
}): Promise<string> {
  const res = await apiClient.post<{ id: string }>(`${BASE}/suppliers`, input);
  return typeof res.data?.id === 'string' ? res.data.id : '';
}

/** Danh sách NCC đã nhập → GET /stock-receipts/suppliers. */
export async function fetchImportedSuppliers(): Promise<ImportedSupplierSummary[]> {
  const res = await apiClient.get<ImportedSupplierSummary[]>(`${BASE}/suppliers`);
  return res.data;
}

/** Danh sách nguyên liệu đã nhập → GET /stock-receipts/materials. */
export async function fetchImportedMaterials(): Promise<ImportedMaterialSummary[]> {
  const res = await apiClient.get<ImportedMaterialSummary[]>(`${BASE}/materials`);
  return res.data;
}


export interface MaterialPriceOption {
  id: string;
  name: string;
  unitPrice: number;
}

/**
 * Danh sách nguyên liệu kèm đơn giá nhập trung bình, dùng cho dropdown
 * "Trang trí thêm" khi tạo/sửa đơn → GET /stock-receipts/material-options.
 */
export async function fetchMaterialPriceOptions(): Promise<MaterialPriceOption[]> {
  const res = await apiClient.get<MaterialPriceOption[]>(`${BASE}/material-options`);
  return res.data;
}

/** Danh sách phiếu nhập (summary) → GET /stock-receipts. */
export async function fetchStockReceiptSummaries(): Promise<SavedStockReceiptSummary[]> {
  const res = await apiClient.get<SavedStockReceiptSummary[]>(`${BASE}`);
  return res.data;
}

/** Chi tiết 1 phiếu nhập → GET /stock-receipts/:id. */
export async function fetchStockReceiptDetail(
  receiptId: string,
): Promise<SavedStockReceiptDetail | null> {
  const res = await apiClient.get<SavedStockReceiptDetail | null>(`${BASE}/${receiptId}`);
  return res.data ?? null;
}

/** Sửa tên / đơn vị chuẩn của 1 NVL → PATCH /stock-receipts/materials/:id. */
export async function updateMaterial(
  id: string,
  patch: { name?: string; canonicalUnit?: string },
): Promise<void> {
  await apiClient.patch(`${BASE}/materials/${id}`, patch);
}

/**
 * Tạo NVL thủ công (không qua phiếu nhập) → POST /stock-receipts/materials.
 * Idempotent theo tên (BE trả id NVL cũ nếu đã tồn tại). Trả id.
 */
export async function createMaterial(input: {
  name: string;
  unit?: string | null;
  lastUnitPrice?: number | null;
  quantity?: number | null;
  lastSupplierId?: string | null;
  lastSupplierName?: string | null;
  lastReceiptDate?: string | null;
}): Promise<string> {
  const res = await apiClient.post<{ id: string }>(`${BASE}/materials`, input);
  return typeof res.data?.id === 'string' ? res.data.id : '';
}

// ==================== ĐỐI SOÁT (tiền ra ↔ phiếu nhập) ====================

/** 1 phiếu nhập + field đối soát — đối soát tiền ra ↔ phiếu nhập (tab Tiền ra). */
export interface ReconcileReceiptItem {
  receiptId: string;
  supplierName?: string | null;
  totalAmount?: number | null;
  receiptDate?: string | null;
  invoiceNumber?: string | null;
  transactionId?: string | null;
  reconciled: boolean;
}

/** Danh sách phiếu nhập cho đối soát — GET /stock-receipts/for-reconcile. */
export async function fetchReceiptsForReconcile(): Promise<ReconcileReceiptItem[]> {
  const res = await apiClient.get<ReconcileReceiptItem[]>(`${BASE}/for-reconcile`);
  return res.data ?? [];
}

/** Gắn 1 giao dịch tiền ra cho 1 phiếu nhập — POST /stock-receipts/:id/reconcile. */
export async function reconcileReceipt(receiptId: string, transactionId: string): Promise<void> {
  await apiClient.post(`${BASE}/${receiptId}/reconcile`, { transactionId });
}

/** Gỡ đối soát phiếu nhập — POST /stock-receipts/:id/unreconcile. */
export async function unreconcileReceipt(receiptId: string): Promise<void> {
  await apiClient.post(`${BASE}/${receiptId}/unreconcile`);
}

// -------- Auto-suggest khớp phiếu nhập ↔ tiền ra --------
const numOr0 = (v: unknown): number => (typeof v === 'number' ? v : 0);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** 1 cặp gợi ý khớp (tiền ra ↔ phiếu nhập). */
export interface ReceiptReconcileMatch {
  transactionId: string;
  receiptId: string;
  amount: number;
  transactionDate: string | null;
  receiptDate: string | null;
  dateGap: number | null; // số ngày lệch (null nếu thiếu ngày)
  txCand: number; // số phiếu cùng số tiền GD này khớp
  receiptCand: number; // số GD cùng số tiền phiếu này khớp
  gateway: string | null;
  supplier: string | null;
  invoiceNumber: string | null;
  description: string | null;
}

export interface ReceiptReconcilePreview {
  matched: ReceiptReconcileMatch[];
  uniqueCount: number; // số cặp 1-1 (an toàn tự chọn)
  ambiguousCount: number; // số cặp có nhiều ứng viên
  totalUnlinkedTx: number;
  totalUnlinkedReceipt: number;
}

/** 1 GD tiền ra chưa gắn phiếu (khớp tay). */
export interface UnlinkedOutTxn {
  id: string;
  amount: number;
  transactionDate: string | null;
  gateway: string | null;
  content: string | null;
}

function toMatch(r: any): ReceiptReconcileMatch {
  return {
    transactionId: strOrNull(r?.transactionId) ?? '',
    receiptId: strOrNull(r?.receiptId) ?? '',
    amount: numOr0(r?.amount),
    transactionDate: strOrNull(r?.transactionDate),
    receiptDate: strOrNull(r?.receiptDate),
    dateGap: typeof r?.dateGap === 'number' ? r.dateGap : null,
    txCand: numOr0(r?.txCand),
    receiptCand: numOr0(r?.receiptCand),
    gateway: strOrNull(r?.gateway),
    supplier: strOrNull(r?.supplier),
    invoiceNumber: strOrNull(r?.invoiceNumber),
    description: strOrNull(r?.description),
  };
}

/**
 * Gợi ý cặp khớp theo SỐ TIỀN bằng nhau — POST /stock-receipts/reconcile/preview.
 * windowDays=0 (mặc định): chỉ khớp số tiền, không giới hạn ngày (ngày chỉ để sắp + hiển thị).
 */
export async function stockReceiptReconcilePreview(
  windowDays = 0,
): Promise<ReceiptReconcilePreview> {
  const res = await apiClient.post<any>(`${BASE}/reconcile/preview`, { windowDays });
  const d = res.data ?? {};
  return {
    matched: Array.isArray(d.matched) ? d.matched.map(toMatch) : [],
    uniqueCount: numOr0(d.uniqueCount),
    ambiguousCount: numOr0(d.ambiguousCount),
    totalUnlinkedTx: numOr0(d.totalUnlinkedTx),
    totalUnlinkedReceipt: numOr0(d.totalUnlinkedReceipt),
  };
}

/** Áp danh sách cặp đã chọn — POST /stock-receipts/reconcile/apply. */
export async function stockReceiptReconcileApply(
  pairs: { receiptId: string; transactionId: string }[],
): Promise<{ applied: number; skipped: number }> {
  const res = await apiClient.post<any>(`${BASE}/reconcile/apply`, { pairs });
  return { applied: numOr0(res.data?.applied), skipped: numOr0(res.data?.skipped) };
}

/** Phiếu đã có trong hệ thống (kết quả kiểm trùng). */
export interface DuplicateReceiptInfo {
  id: string;
  supplierName: string | null;
  receiptDate: string | null;
  totalAmount: number | null;
  createdAt: string | null;
}

const toIsoLoose = (v: unknown): string | null => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const a = v as { toDate?: () => Date };
    try { if (typeof a.toDate === 'function') return a.toDate().toISOString(); } catch { /* ignore */ }
  }
  return null;
};

/** Kiểm tra bill đang up đã có trong hệ thống chưa — POST /stock-receipts/find-duplicate. */
export async function findDuplicateReceipt(input: {
  structured: unknown;
  ocrText: string;
  targetSupplierId?: string | null;
}): Promise<{ duplicate: boolean; receipt: DuplicateReceiptInfo | null }> {
  const res = await apiClient.post<any>(`${BASE}/find-duplicate`, input);
  const d = res.data ?? {};
  const r = d.receipt;
  return {
    duplicate: Boolean(d.duplicate),
    receipt: r
      ? {
          id: strOrNull(r.id) ?? '',
          supplierName: strOrNull(r.supplierName),
          receiptDate: strOrNull(r.receiptDate),
          totalAmount: typeof r.totalAmount === 'number' ? r.totalAmount : null,
          createdAt: toIsoLoose(r.createdAt),
        }
      : null,
  };
}

/** GD tiền ra chưa gắn phiếu — GET /stock-receipts/unlinked-out-txns. */
export async function fetchUnlinkedOutTxns(): Promise<UnlinkedOutTxn[]> {
  const res = await apiClient.get<any[]>(`${BASE}/unlinked-out-txns`);
  return Array.isArray(res.data)
    ? res.data.map((r) => ({
        id: strOrNull(r?.id) ?? '',
        amount: numOr0(r?.amount),
        transactionDate: strOrNull(r?.transactionDate),
        gateway: strOrNull(r?.gateway),
        content: strOrNull(r?.content),
      }))
    : [];
}

// ===== Đối soát NHIỀU giao dịch / bill (allocation) =====
export interface ReceiptAllocation {
  id: string;
  transactionId: string;
  amount: number;
  txAmount: number | null;
  transactionDate: string | null;
  gateway: string | null;
  content: string | null;
}
export interface ReceiptAllocSummary {
  total: number | null;
  paid: number;
  remaining: number;
  reconciled: boolean;
  /** Đã đánh dấu "khớp dù lệch" (paid không nhất thiết >= total). */
  forced: boolean;
  allocations: ReceiptAllocation[];
}
export interface AvailableOutTxn {
  id: string;
  amount: number;
  remaining: number;
  transactionDate: string | null;
  gateway: string | null;
  content: string | null;
}

function toAllocSummary(r: any): ReceiptAllocSummary {
  return {
    total: typeof r?.total === 'number' ? r.total : null,
    paid: numOr0(r?.paid),
    remaining: numOr0(r?.remaining),
    reconciled: r?.reconciled === true,
    forced: r?.forced === true,
    allocations: Array.isArray(r?.allocations)
      ? r.allocations.map((a: any) => ({
          id: strOrNull(a?.id) ?? '',
          transactionId: strOrNull(a?.transactionId) ?? '',
          amount: numOr0(a?.amount),
          txAmount: typeof a?.txAmount === 'number' ? a.txAmount : null,
          transactionDate: strOrNull(a?.transactionDate),
          gateway: strOrNull(a?.gateway),
          content: strOrNull(a?.content),
        }))
      : [],
  };
}

/** Tổng hợp phân bổ của 1 bill — GET /stock-receipts/:id/allocations. */
export async function fetchReceiptAllocations(receiptId: string): Promise<ReceiptAllocSummary> {
  const res = await apiClient.get<any>(`${BASE}/${receiptId}/allocations`);
  return toAllocSummary(res.data);
}

/** GD tiền ra còn lại để gắn — GET /stock-receipts/:id/available-txns. */
export async function fetchAvailableOutTxns(receiptId: string): Promise<AvailableOutTxn[]> {
  const res = await apiClient.get<any[]>(`${BASE}/${receiptId}/available-txns`);
  return Array.isArray(res.data)
    ? res.data.map((r) => ({
        id: strOrNull(r?.id) ?? '',
        amount: numOr0(r?.amount),
        remaining: numOr0(r?.remaining),
        transactionDate: strOrNull(r?.transactionDate),
        gateway: strOrNull(r?.gateway),
        content: strOrNull(r?.content),
      }))
    : [];
}

/** Gắn thêm 1 GD (amount rỗng → tự tính) — POST /stock-receipts/:id/allocations. */
export async function addReceiptAllocation(
  receiptId: string,
  transactionId: string,
  amount?: number | null,
): Promise<ReceiptAllocSummary> {
  const res = await apiClient.post<any>(`${BASE}/${receiptId}/allocations`, { transactionId, amount: amount ?? null });
  return toAllocSummary(res.data);
}

/** Xoá 1 phân bổ — DELETE /stock-receipts/allocations/:allocId. */
export async function removeReceiptAllocation(allocId: string): Promise<ReceiptAllocSummary> {
  const res = await apiClient.delete<any>(`${BASE}/allocations/${allocId}`);
  return toAllocSummary(res.data);
}

/**
 * Đánh dấu / bỏ đánh dấu bill "đã khớp dù lệch" — POST /stock-receipts/:id/allocations/force.
 * forced=true: chốt đã khớp dù tổng GD đã gắn chưa đủ (hoặc vượt) total — phần lệch chỉ cảnh báo.
 */
export async function setReceiptAllocForce(
  receiptId: string,
  forced: boolean,
): Promise<ReceiptAllocSummary> {
  const res = await apiClient.post<any>(`${BASE}/${receiptId}/allocations/force`, { forced });
  return toAllocSummary(res.data);
}
