/**
 * React Query hooks cho domain Stock Receipt / Bill Import (epic #58 — P8).
 *
 * - queryFn/mutationFn GỌI THẲNG service hiện có (stockReceiptService) — KHÔNG viết lại HTTP.
 * - Query `enabled: !!currentUser` để tránh gọi API 401 ở màn login.
 * - Mutation (saveDraft / updateSupplier / merge*) invalidate key liên quan
 *   (suppliers / materials / summaries) để list tự refresh.
 * - KHÔNG nuốt lỗi: caller (component) bắt error → toast.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useAuth } from '@/contexts/AuthContext';
import { qk } from '@/hooks/queryKeys';
import {
  fetchImportedMaterials,
  fetchImportedSuppliers,
  fetchMaterialPriceOptions,
  fetchStockReceiptDetail,
  fetchStockReceiptSummaries,
  deleteStockReceipt,
  saveStockReceiptDraft,
  updateMaterial,
  updateSupplier,
  type MaterialPriceOption,
} from '@/services/stockReceiptService';

// ==================== QUERIES ====================

export interface UseImportedSuppliersResult {
  suppliers: ImportedSupplierSummary[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useImportedSuppliers = (): UseImportedSuppliersResult => {
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: qk.stockReceipt.suppliers,
    queryFn: fetchImportedSuppliers,
    enabled: !!currentUser,
  });
  return {
    suppliers: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
  };
};

export interface UseImportedMaterialsResult {
  materials: ImportedMaterialSummary[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useImportedMaterials = (): UseImportedMaterialsResult => {
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: qk.stockReceipt.materials,
    queryFn: fetchImportedMaterials,
    enabled: !!currentUser,
  });
  return {
    materials: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
  };
};

export interface UseMaterialPriceOptionsResult {
  options: MaterialPriceOption[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useMaterialPriceOptions = (enabled = true): UseMaterialPriceOptionsResult => {
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: qk.stockReceipt.materialPriceOptions,
    queryFn: fetchMaterialPriceOptions,
    enabled: !!currentUser && enabled,
  });
  return {
    options: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
  };
};

export interface UseStockReceiptSummariesResult {
  receipts: SavedStockReceiptSummary[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useStockReceiptSummaries = (): UseStockReceiptSummariesResult => {
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: qk.stockReceipt.summaries,
    queryFn: fetchStockReceiptSummaries,
    enabled: !!currentUser,
  });
  return {
    receipts: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
  };
};

export interface UseStockReceiptDetailResult {
  detail: SavedStockReceiptDetail | null;
  loading: boolean;
  error: Error | null;
}

export const useStockReceiptDetail = (
  receiptId: string | null | undefined,
): UseStockReceiptDetailResult => {
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: qk.stockReceipt.detail(receiptId ?? ''),
    queryFn: () => fetchStockReceiptDetail(receiptId as string),
    enabled: !!receiptId && !!currentUser,
  });
  return {
    detail: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
  };
};

// ==================== MUTATIONS ====================

export interface SaveStockReceiptDraftArgs {
  structured: StockReceiptStructured;
  validation: StockReceiptValidationSnapshot;
  ocrText: string;
  receiptImageBase64?: string | null;
  receiptImageMimeType?: string | null;
  createdByUid?: string | null;
  targetSupplierId?: string | null;
  supplierContact?: SupplierContactInfo | null;
  source?: StockReceiptSource;
}

export interface UpdateSupplierArgs {
  id: string;
  patch: Partial<SupplierContactInfo> & { name?: string };
}

export interface UpdateMaterialArgs {
  id: string;
  patch: { name?: string; canonicalUnit?: string };
}

export interface UseStockReceiptMutationsResult {
  saveDraft: (args: SaveStockReceiptDraftArgs) => Promise<string>;
  updateSupplierInfo: (args: UpdateSupplierArgs) => Promise<void>;
  updateMaterialInfo: (args: UpdateMaterialArgs) => Promise<void>;
  deleteReceipt: (receiptId: string) => Promise<{ ok: boolean; reason?: string }>;
}

export const useStockReceiptMutations = (): UseStockReceiptMutationsResult => {
  const queryClient = useQueryClient();

  const invalidateMasters = () => {
    queryClient.invalidateQueries({ queryKey: qk.stockReceipt.suppliers });
    queryClient.invalidateQueries({ queryKey: qk.stockReceipt.materials });
    queryClient.invalidateQueries({ queryKey: qk.stockReceipt.materialPriceOptions });
  };

  const saveDraftMutation = useMutation({
    mutationFn: (args: SaveStockReceiptDraftArgs) => saveStockReceiptDraft(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.stockReceipt.summaries });
      invalidateMasters();
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: ({ id, patch }: UpdateSupplierArgs) => updateSupplier(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.stockReceipt.suppliers });
    },
  });

  const updateMaterialMutation = useMutation({
    mutationFn: ({ id, patch }: UpdateMaterialArgs) => updateMaterial(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.stockReceipt.materials });
      queryClient.invalidateQueries({ queryKey: qk.stockReceipt.materialPriceOptions });
    },
  });

  const deleteReceiptMutation = useMutation({
    mutationFn: (receiptId: string) => deleteStockReceipt(receiptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.stockReceipt.summaries });
      invalidateMasters();
    },
  });

  return {
    saveDraft: (args) => saveDraftMutation.mutateAsync(args),
    updateSupplierInfo: (args) => updateSupplierMutation.mutateAsync(args),
    updateMaterialInfo: (args) => updateMaterialMutation.mutateAsync(args),
    deleteReceipt: (receiptId) => deleteReceiptMutation.mutateAsync(receiptId),
  };
};
