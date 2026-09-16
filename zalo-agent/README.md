# cucquy-zalo-agent (THIN) — nạp ảnh bill từ nhóm Zalo "Hoá đơn Tiệm"

Agent **mỏng** chạy trên máy có Zalo desktop đăng nhập nick là **thành viên nhóm "Hoá đơn Tiệm"**.
Chỉ cần **Node** + 2 gói npm bundle sẵn (chrome-remote-interface, socket.io-client) —
KHÔNG cần sqlcipher/convert ảnh trên máy này.

## Làm gì
Connect ra BE bằng `ZALO_AGENT_TOKEN` (giống agent máy in). Khi Admin bấm "Nạp từ Zalo":
BE emit `zalo:fetch-db` → agent:
1. Trích **cipherKey** SQLCipher từ app đang chạy qua CDP (webpack `drXQ` → `queryObjects` → `partition.cipherKey`).
2. Copy file `Core/Message/g<groupId>.db` → gửi `{ cipherKey, dbBase64 }` về BE (ACK).

BE tự giải mã (node:crypto + sql.js), bóc URL, tải, convert JXL→JPG (WASM), đưa vào pipeline OCR có sẵn.
→ Máy quán KHÔNG giữ lib nặng; mọi thứ ở BE.

## Cài (1 lần)
1. Mở Zalo kèm cổng debug + đăng nhập nick thành viên nhóm:
   ```bash
   open -a Zalo --args --remote-debugging-port=9222
   ```
2. Cài agent:
   ```bash
   ZALO_AGENT_TOKEN='<token khớp BE>' bash install.sh
   ```
   Tuỳ chọn env: `CUCQUY_API`, `ZALO_GROUP_ID` (mặc định 1949125421175210627 = Hoá đơn Tiệm,
   id Zalo thật — KHÁC id Abit 3653042130203225068), `ZALO_MACHINE_NAME`, `ZALO_CDP_PORT`.

## Env BE cần
- `ZALO_AGENT_TOKEN` — bí mật chia sẻ agent ↔ BE (giống `PRINT_AGENT_TOKEN`).

## Kiểm tra / gỡ
```bash
tail -f ~/.cucquy/zalo-agent/agent.log
launchctl bootout gui/$(id -u)/site.cucquy.zaloagent
```

## Ghi chú
- Chỉ ĐỌC (copy file DB + trích key). Không gửi/sửa gì trên Zalo.
- WAL chưa gộp → có thể thiếu vài tin mới nhất trong 1 lần; lần bấm sau bù. Dedup theo msgId ở FE/OCR.
