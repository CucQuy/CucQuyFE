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
 * Upload video qua BE NestJS (cùng RiceService Storage với ảnh — BE không lọc mime).
 * Dùng cho video đăng TikTok: TikTok tự tải video về từ URL công khai này.
 * @param file - Video file
 * @param path - Storage path (vd 'tiktok-videos')
 * @returns Public URL của video đã upload
 */
export const uploadVideo = async (file: File, path: string): Promise<string> => {
  const ext = file.name.split('.').pop() || 'mp4';
  return uploadImage(file, `${path}/${Date.now()}.${ext}`);
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
