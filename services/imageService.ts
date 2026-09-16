import { apiClient } from '@/services/api/client';

/**
 * Upload image qua BE NestJS (RiceService Storage).
 * @param file - Image file to upload
 * @param path - Storage path (e.g., 'products/image.jpg')
 * @returns Public URL of the uploaded image
 */
export const uploadImage = async (file: File, path: string): Promise<string> => {
  const form = new FormData();
  form.append('file', file);
  form.append('path', path);
  const { data } = await apiClient.post('/images/upload', form);
  return data.url;
};

/**
 * Generate a unique path for product image
 * @param productId - Product ID (or 'new' for new products)
 * @param fileName - Original file name
 * @returns Storage path
 */
export const getProductImagePath = (productId: string, fileName: string): string => {
  const timestamp = Date.now();
  const extension = fileName.split('.').pop() || 'jpg';
  return `products/${productId || 'new'}_${timestamp}.${extension}`;
};
