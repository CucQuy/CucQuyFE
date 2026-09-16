import { apiClient } from '@/services/api/client';
import type { StockReceiptStructured } from '@/types/billReceipt';

/** Bill TEXT (nhập tay) đã được AI phân tích thành cấu trúc phiếu nhập. */
export interface ZaloTextBill {
  msgId: string;
  ts: number;
  dName: string;
  text: string;
  structured: StockReceiptStructured;
}

/** 1 ảnh bill agent trả về (base64 thuần, không prefix data:). */
export interface ZaloBillImage {
  msgId: string;
  ts: number;
  mime: string;
  base64: string;
}

export interface ZaloBillsFetchResult {
  ok: boolean;
  groupId: string;
  images: ZaloBillImage[];
  textBills: ZaloTextBill[];
  /** Số bill ảnh khớp mốc trước khi cắt 30 (để báo "còn N ảnh nữa"). */
  total: number;
  error?: string;
}

/** Mốc 00:00 hôm nay (local) tính bằng ms — dùng cho tuỳ chọn "hôm nay". */
export function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** base64 thuần → File ảnh (để đưa vào hàng đợi nhập bill hàng loạt có sẵn). */
function base64ToFile(b64: string, name: string, mime = 'image/jpeg'): File {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

/**
 * Lấy ảnh bill mới từ nhóm Zalo "Hoá đơn Tiệm" qua agent (BE relay).
 * Trả về File[] để feed thẳng vào modal nhập bill hàng loạt (onImagesSelected).
 */
export async function fetchZaloBills(opts?: {
  machineId?: string;
  /** ms; chỉ lấy bill có sendDttm >= sinceTs. 0/thiếu = tất cả. */
  sinceTs?: number;
}): Promise<{ files: File[]; textBills: ZaloTextBill[]; result: ZaloBillsFetchResult }> {
  const res = await apiClient.post('/zalo-bills/fetch', {
    machineId: opts?.machineId,
    sinceTs: opts?.sinceTs ?? 0,
  });
  const result = res.data as ZaloBillsFetchResult;
  const files = (result.images ?? []).map((img) =>
    base64ToFile(img.base64, `zalo-${img.msgId}.jpg`, img.mime || 'image/jpeg'),
  );
  return { files, textBills: result.textBills ?? [], result };
}

/** Danh sách máy (agent) đang online. */
export async function listZaloAgents(): Promise<
  { machineId: string; machineName: string; groupId: string }[]
> {
  const res = await apiClient.get('/zalo-bills/agents');
  return (res.data as { agents: { machineId: string; machineName: string; groupId: string }[] })
    .agents ?? [];
}
