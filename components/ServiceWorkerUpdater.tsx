import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Đăng ký + tự cập nhật service worker của PWA.
 *
 * ĐẶT Ở GỐC APP, không đặt trong Layout: Layout chỉ render khi đã đăng nhập, nên trước
 * đây user đang ở màn /login không có gì thúc SW kiểm tra bản mới → kẹt vĩnh viễn ở
 * bundle cũ. Đúng lúc đổi luồng đăng nhập thì điều đó thành khoá cửa: bản cũ không
 * đăng nhập được, mà cũng không bao giờ tự lên bản mới.
 *
 * Cấu hình `registerType: 'autoUpdate'` + `skipWaiting` (vite.config.ts) → bản mới tải
 * xong là chiếm quyền ngay, không phải đóng hết tab.
 */
const SW_POLL_MS = 60_000;

const ServiceWorkerUpdater: React.FC = () => {
  useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      if (!r) return;
      // Poll định kỳ để bắt bản deploy mới mà không cần user reload thủ công.
      setInterval(() => { void r.update(); }, SW_POLL_MS);
    },
  });
  return null;
};

export default ServiceWorkerUpdater;
