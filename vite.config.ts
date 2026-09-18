import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const siteUrl = (
    env.VITE_SITE_URL ||
    "https://admin.cucquy.site"
  ).replace(/\/$/, "");
  // Nhãn phiên bản build (hiện ở cuối sidebar). Ưu tiên BUILD_ID truyền vào; mặc định = giờ build (GMT+7).
  const buildId =
    process.env.BUILD_ID ||
    new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 16) + " +07";

  return {
    server: {
      port: 3009,
      host: "0.0.0.0",
    },
    plugins: [
      react(),
      {
        name: "inject-site-url-meta",
        transformIndexHtml(html) {
          return html.replaceAll("__SITE_URL__", siteUrl);
        },
      },
      VitePWA({
        // 'autoUpdate' + skipWaiting: bản mới vừa tải xong là chiếm quyền luôn.
        // TRƯỚC ĐÂY là 'prompt' nhưng nút "tải bản mới" đã bị gỡ → SW mới nằm chờ
        // vô thời hạn, user kẹt ở bundle cũ. Nguy hiểm nhất là màn /login: nó không
        // render Layout (nơi đặt useRegisterSW) nên không có gì thúc SW cập nhật →
        // user đăng xuất bị khoá ở bản cũ, không đăng nhập lại được sau khi đổi luồng auth.
        registerType: "autoUpdate",
        // Chỉ hook đăng ký SW (tránh double-register với script inject sẵn).
        injectRegister: null,
        includeAssets: [
          "icon-v4.svg",
          "icon-v4.png",
          "og-image.jpg",
          "banner.jpg",
        ],
        manifest: {
          name: "Tiệm bánh Cúc Quy",
          short_name: "CucQuy",
          description:
            "Hệ thống quản lý đơn hàng thông minh cho Tiệm bánh Cúc Quy",
          theme_color: "#4abab9",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait-primary",
          start_url: "/",
          icons: [
            {
              src: "./icon-v4.svg",
              sizes: "any",
              type: "image/svg+xml",
            },
            {
              src: "./icon-v4.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
        workbox: {
          // Bản mới kích hoạt ngay + chiếm luôn tab đang mở, thay vì đợi đóng hết tab.
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallbackDenylist: [
            /\.[a-zA-Z0-9]+$/,
            /^\/api\//,
          ],
          // KHÔNG precache face-api (~1.3MB) + model khuôn mặt — chỉ super_admin dùng lúc
          // đăng ký mặt; để nạp theo yêu cầu, tránh bắt mọi user tải dư khi cài PWA.
          globIgnores: ['**/face-api*.js', 'models/face/**'],
        },
        devOptions: {
          // Tắt PWA Service Worker trong dev — SW cache có thể intercept request
          // mới và trả về stale HTML, làm Vite import-analysis fail. Prod vẫn build PWA.
          enabled: false,
          type: "module",
        },
      }),
    ],
    define: {
      // Secret (VISION/GEMINI/ZALO...) — auth qua SSO RiceService.
      __BUILD_ID__: JSON.stringify(buildId),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    build: {
      // Tách vendor nặng thành chunk riêng → cache lâu + bundle chính nhẹ.
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            charts: ["recharts"],
            xlsx: ["xlsx-js-style"],
          },
        },
      },
      chunkSizeWarningLimit: 1200,
    },
  };
});
