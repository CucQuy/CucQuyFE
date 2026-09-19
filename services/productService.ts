import { apiClient } from '@/services/api/client';
import { ComboItem, Product, ProductCombo, ProductVersion } from '@/types';

export const fetchProducts = async (): Promise<Product[]> => {
  return (await apiClient.get('/products')).data as Product[];
};

export const addProduct = async (productData: Omit<Product, 'id'>): Promise<void> => {
  await apiClient.post('/products', productData);
};

export const updateProduct = async (id: string, productData: Partial<Product>): Promise<void> => {
  await apiClient.patch(`/products/${id}`, productData);
};

/**
 * Xoá giá cost của sản phẩm — đưa sản phẩm ra khỏi danh sách "đã có hoa hồng".
 */
export const removeProductCostPrice = async (id: string): Promise<void> => {
  await apiClient.delete(`/products/${id}/cost-price`);
};

export const deleteProduct = async (id: string): Promise<void> => {
  await apiClient.delete(`/products/${id}`);
};

export const fetchProductVersions = async (productId: string): Promise<ProductVersion[]> => {
  return (await apiClient.get(`/products/${productId}/versions`)).data as ProductVersion[];
};

/** Thành phần combo của 1 sản phẩm (null nếu SP không tồn tại). */
export const fetchProductCombo = async (productId: string): Promise<ProductCombo | null> => {
  return (await apiClient.get(`/products/${productId}/combo`)).data as ProductCombo | null;
};

/** Ghi đè thành phần combo — mảng rỗng = gỡ combo. */
export const saveProductCombo = async (
  productId: string,
  items: ComboItem[],
): Promise<ProductCombo> => {
  return (await apiClient.put(`/products/${productId}/combo`, { items })).data as ProductCombo;
};
