#!/usr/bin/env node
// cucquy-zalo-agent (THIN) — chạy trên máy có Zalo desktop (thành viên nhóm "Hoá đơn Tiệm").
// Chỉ 2 việc khi BE hỏi: (1) trích cipherKey SQLCipher từ app qua CDP, (2) copy file DB nhóm.
// Gửi { cipherKey, dbBase64 } về BE — BE tự giải mã + OCR. KHÔNG cần sqlcipher/convert trên máy này.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { io } from 'socket.io-client';
import CDP from 'chrome-remote-interface';
import { listPages, isCdpUp } from './lib/cdp.mjs';

const CFG = {
  beUrl: process.env.CUCQUY_API || 'https://api.cucquy.site',
  token: process.env.ZALO_AGENT_TOKEN || '',
  groupId: process.env.ZALO_GROUP_ID || '1949125421175210627', // Hoá đơn Tiệm (id Zalo)
  machineId: process.env.ZALO_MACHINE_ID || os.hostname(),
  machineName: process.env.ZALO_MACHINE_NAME || os.hostname(),
  port: Number(process.env.ZALO_CDP_PORT) || 9222,
  zaloData:
    process.env.ZALO_DATA_DIR ||
    path.join(os.homedir(), 'Library/Application Support/ZaloData'),
  // Zalo hay bị mở lại KHÔNG kèm cổng debug (bấm Dock / tự chạy lúc đăng nhập) → CDP chết.
  // Mặc định tự đóng + mở lại Zalo kèm cổng; đặt ZALO_AUTO_RELAUNCH=0 để tắt.
  autoRelaunch: process.env.ZALO_AUTO_RELAUNCH !== '0',
};
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const run = promisify(execFile);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!CFG.token) {
  console.error('Thiếu ZALO_AGENT_TOKEN');
  process.exit(1);
}

// Đợi CDP lên, tối đa timeoutMs.
async function waitCdp(timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await isCdpUp(CFG.port)) return true;
    await sleep(1000);
  }
  return false;
}

// Đảm bảo Zalo đang chạy KÈM cổng gỡ lỗi. Nếu không: đóng rồi mở lại kèm cổng.
async function ensureCdp() {
  if (await isCdpUp(CFG.port)) return;
  const howto = `open -a Zalo --args --remote-debugging-port=${CFG.port}`;
  if (!CFG.autoRelaunch) {
    throw new Error(`Zalo chưa mở kèm cổng gỡ lỗi ${CFG.port}. Mở lại Zalo bằng: ${howto}`);
  }
  log(`CDP ${CFG.port} không phản hồi → mở lại Zalo kèm cổng gỡ lỗi`);
  await run('osascript', ['-e', 'tell application "Zalo" to quit']).catch(() => {});
  for (let i = 0; i < 10; i++) {
    const alive = await run('pgrep', ['-x', 'Zalo']).then(() => true, () => false);
    if (!alive) break;
    await sleep(1000);
  }
  await run('pkill', ['-x', 'Zalo']).catch(() => {});
  await sleep(1000);
  await run('open', ['-a', 'Zalo', '--args', `--remote-debugging-port=${CFG.port}`]);
  if (!(await waitCdp(45000))) {
    throw new Error(`Mở lại Zalo rồi nhưng cổng ${CFG.port} vẫn không lên. Thử mở tay: ${howto}`);
  }
  log('Zalo đã lên kèm cổng gỡ lỗi');
}

// Trích cipherKey SQLCipher từ app đang chạy: webpack drXQ.a = class DB;
// queryObjects lấy instance sống → instance.partition.cipherKey.
async function getCipherKey() {
  // Zalo 26.8+ bỏ 'already_login' khỏi URL cửa sổ chính → nhận diện theo pc-dist/index.html
  // (loại znotification/shared-worker). Sau khi mở lại, app cần vài giây mới nạp xong → thử lại 30s.
  let pages = [];
  for (let i = 0; i < 15 && pages.length === 0; i++) {
    pages = (await listPages(CFG.port).catch(() => [])).filter((x) =>
      /pc-dist\/index\.html/.test(x.url),
    );
    if (pages.length === 0) await sleep(2000);
  }
  if (pages.length === 0) throw new Error('Không thấy cửa sổ Zalo — đăng nhập nick trong nhóm "Hoá đơn Tiệm" chưa?');

  let lastErr = 'không rõ';
  for (const target of pages) {
    const c = await CDP({ target, port: CFG.port });
    try {
      await c.Runtime.enable();
      const proto = await c.Runtime.evaluate({
        expression: `(function(){var req=window.__wr;if(!req){var r;var id='k'+Date.now();window.webpackJsonp.push([[id],{[id]:function(m,e,rr){r=rr}},[[id]]]);window.__wr=r;req=window.__wr;}return req.c['drXQ'].exports.a.prototype;})()`,
      });
      if (!proto.result?.objectId) {
        lastErr = 'không lấy được class DB (drXQ) — Zalo đổi bản?';
        continue;
      }
      const qo = await c.Runtime.queryObjects({ prototypeObjectId: proto.result.objectId });
      const r = await c.Runtime.callFunctionOn({
        objectId: qo.objects.objectId,
        functionDeclaration: `function(){for(var i=0;i<this.length;i++){try{var p=this[i].partition;if(p&&p.cipherKey)return p.cipherKey;}catch(e){}}return '';}`,
        returnByValue: true,
      });
      if (r.result?.value) return r.result.value;
      lastErr = 'không tìm thấy cipherKey (app đã mở DB chưa?)';
    } catch (e) {
      lastErr = e.message;
    } finally {
      await c.close().catch(() => {});
    }
  }
  throw new Error(`Không trích được cipherKey: ${lastErr}`);
}

// Tìm file DB nhóm + đọc cả .db lẫn -wal (bill vừa đăng còn trong -wal, chưa checkpoint).
// Copy ra temp rồi đọc để không đụng bản app đang khoá.
function readGroupDb() {
  const root = path.join(CFG.zaloData, 'Database/_production');
  const uids = fs.existsSync(root) ? fs.readdirSync(root) : [];
  for (const uid of uids) {
    const src = path.join(root, uid, 'Core/Message', `g${CFG.groupId}.db`);
    if (fs.existsSync(src)) {
      const stamp = Date.now();
      const readCopy = (suffix) => {
        const s = src + suffix;
        if (!fs.existsSync(s)) return null;
        const tmp = path.join(os.tmpdir(), `zbill_${CFG.groupId}_${stamp}${suffix}`);
        fs.copyFileSync(s, tmp);
        const buf = fs.readFileSync(tmp);
        fs.unlinkSync(tmp);
        return buf;
      };
      const db = readCopy('');
      const wal = readCopy('-wal');
      return { db, wal };
    }
  }
  throw new Error(`Không thấy DB nhóm g${CFG.groupId}.db (nick này có trong nhóm không?)`);
}

const socket = io(CFG.beUrl, {
  path: '/api/socket.io',
  transports: ['websocket'],
  auth: {
    zaloAgentToken: CFG.token,
    machineId: CFG.machineId,
    machineName: CFG.machineName,
    groupId: CFG.groupId,
  },
  reconnection: true,
  reconnectionDelayMax: 15000,
});

socket.on('connect', () => log('BE connected', CFG.beUrl, 'as', CFG.machineName));
socket.on('disconnect', (r) => log('BE disconnected:', r));
socket.on('connect_error', (e) => log('connect_error:', e.message));

// BE hỏi: trả file DB nhóm + cipherKey. ACK callback.
socket.on('zalo:fetch-db', async (_payload, ack) => {
  try {
    await ensureCdp();
    const cipherKey = await getCipherKey();
    const { db, wal } = readGroupDb();
    log(
      `fetch-db: DB ${Math.round(db.length / 1024)}KB` +
        (wal ? ` + WAL ${Math.round(wal.length / 1024)}KB` : '') +
        `, key ${cipherKey.length} chars`,
    );
    ack?.({
      ok: true,
      groupId: CFG.groupId,
      cipherKey,
      dbBase64: db.toString('base64'),
      walBase64: wal ? wal.toString('base64') : '',
    });
  } catch (e) {
    log('fetch-db lỗi:', e.message);
    ack?.({ ok: false, groupId: CFG.groupId, cipherKey: '', dbBase64: '', walBase64: '', error: e.message });
  }
});

process.on('SIGINT', () => {
  socket.close();
  process.exit(0);
});
