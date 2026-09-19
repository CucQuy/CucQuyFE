import { apiClient } from '@/services/api/client';

/** Thông tin gửi cho AI để viết mô tả — chỉ những gì form đang có. */
export interface ProductDescriptionInput {
  name: string;
  /** Nhãn loại tiếng Việt: Bánh / Nước / Combo. */
  typeLabel: string;
  flavors?: string[];
  sizes?: string[];
  /** Mô tả đang gõ dở — AI viết lại cho mượt thay vì bịa mới. */
  current?: string;
}

/**
 * Gợi ý mô tả bán hàng cho 1 sản phẩm → BE: POST /ai/product-description.
 * AI chạy vài giây nên để timeout riêng 60s. Trả chuỗi rỗng nếu AI không viết được gì.
 */
export async function suggestProductDescription(
  input: ProductDescriptionInput,
): Promise<string> {
  const res = await apiClient.post<unknown>('/ai/product-description', input, {
    timeout: 60000,
  });
  const d = (res.data ?? {}) as Record<string, unknown>;
  return typeof d.description === 'string' ? d.description.trim() : '';
}
