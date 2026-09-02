import { PRINT_AGENT_URL } from '@/config/printAgent';
import { apiClient } from '@/services/api/client';

/** Máy in nhiệt 58mm = 384 dot ngang (48 byte/dòng). */
const WIDTH_DOTS = 384;
const WIDTH_BYTES = WIDTH_DOTS / 8;

// ESC @ : khởi tạo. ⚠️ KHÔNG thêm ESC 7 (chỉnh đầu đốt) — máy SingPC Print-211 KHÔNG nuốt được
// ESC 7 trong luồng raster → in ra KÝ TỰ RÁC (đã test tách bạch 2026-08-14: raster có ESC 7 = rác,
// không ESC 7 = đẹp). Giảm mực để nhẹ dòng đốt làm bằng font nhỏ + ngưỡng đen thấp bên dưới.
const INIT = [0x1b, 0x40];
const CUT = [0x1d, 0x56, 0x01]; // GS V 1 : cắt giấy (partial)
const feed = (n: number) => [0x1b, 0x64, n & 0xff]; // ESC d n : nhả n dòng

/**
 * Đẩy raster ESC/POS (lệnh GS v 0, chia band 128 dòng) của 1 canvas (đen/trắng, rộng 384px)
 * TRỰC TIẾP vào mảng out. Ngưỡng: luminance < 160 → chấm đen; pixel trong suốt = trắng.
 * (Đẩy từng byte, KHÔNG spread mảng lớn → bill dài mấy cũng không tràn stack.)
 */
function appendRaster(out: number[], canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  const band = 128;
  for (let y0 = 0; y0 < h; y0 += band) {
    const rows = Math.min(band, h - y0);
    out.push(
      0x1d, 0x76, 0x30, 0x00,
      WIDTH_BYTES & 0xff, (WIDTH_BYTES >> 8) & 0xff,
      rows & 0xff, (rows >> 8) & 0xff,
    );
    for (let ry = 0; ry < rows; ry++) {
      const y = y0 + ry;
      for (let xb = 0; xb < WIDTH_BYTES; xb++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = xb * 8 + bit;
          if (x < w) {
            const i = (y * w + x) * 4;
            const alpha = data[i + 3];
            if (alpha >= 32) {
              const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              // Ngưỡng 130 (thấp hơn 160 cũ): chỉ lấy nét ĐẬM thật → in MẢNH hơn, ít chấm đen hơn
              // → nhẹ dòng đốt thêm ("nén nhẹ"). Vẫn giữ lõi chữ nên đọc tốt.
              if (lum < 130) byte |= 0x80 >> bit;
            }
          }
        }
        out.push(byte);
      }
    }
  }
}

/** Ghép nhiều canvas (bill, phiếu bếp) thành 1 luồng ESC/POS: init → raster+feed+cut từng tờ. */
export function buildEscpos(canvases: HTMLCanvasElement[]): Uint8Array {
  const out: number[] = [];
  const append = (arr: number[]) => {
    for (let i = 0; i < arr.length; i++) out.push(arr[i]);
  };
  append(INIT);
  canvases.forEach((c) => {
    appendRaster(out, c);
    append(feed(3));
    append(CUT);
  });
  return Uint8Array.from(out);
}

/** Encode Uint8Array → base64 (chia khúc, tránh tràn stack khi bill dài). */
function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/**
 * Gửi bytes ESC/POS ra máy in. 2 đường:
 * 1) Cầu nối LOCAL (máy đang cắm máy in, localhost:9110) — nhanh, không qua mạng.
 * 2) Nếu không có agent local (in từ điện thoại/máy khác) → RELAY qua BE:
 *    POST /print/job (base64) → BE đẩy socket.io tới agent máy in ở quán.
 * Throw nếu cả 2 đều không in được (để caller toast lỗi).
 */
export async function sendToPrintAgent(bytes: Uint8Array): Promise<void> {
  // 1) Thử cầu nối local trước (timeout ngắn: máy khác sẽ fail nhanh rồi relay).
  try {
    const res = await fetch(`${PRINT_AGENT_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: bytes,
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) return;
  } catch {
    /* không có agent local → relay qua BE bên dưới */
  }

  // 2) Relay qua BE (in từ thiết bị bất kỳ). apiClient bóc envelope → res.data = { printers }.
  const res = await apiClient.post('/print/job', { base64: bytesToBase64(bytes) });
  const printers = (res.data as { printers?: number } | null)?.printers ?? 0;
  if (printers < 1) {
    throw new Error('Máy in ở quán đang offline (không có agent kết nối). Kiểm tra máy quán.');
  }
}
