// Tien ich CDP: liet ke target page cua Zalo, lay key phien qua webpack module z0WU.
import CDP from 'chrome-remote-interface';

export const DEFAULT_PORT = Number(process.env.ZALO_CDP_PORT) || 9222;

// Bieu thuc chay trong page de doc getSecretKey() (webpack 4, module 'z0WU').
const KEY_EXPR = `(function(){try{
  if(!window.webpackJsonp) return JSON.stringify({err:'no webpackJsonp'});
  if(!window.__zreq){var r;var id='zk'+Date.now();
    window.webpackJsonp.push([[id],{[id]:function(m,e,rr){r=rr}},[[id]]]);window.__zreq=r;}
  var req=window.__zreq;
  var m=req.c['z0WU']&&req.c['z0WU'].exports; var d=m&&(m.default||m);
  if(!d||typeof d.getSecretKey!=='function') return JSON.stringify({err:'no getSecretKey'});
  return JSON.stringify({secretKey:d.getSecretKey()});
}catch(e){return JSON.stringify({err:e.message})}})()`;

export async function listPages(port = DEFAULT_PORT) {
  const targets = await CDP.List({ port });
  return targets.filter((t) => t.type === 'page' || t.type === 'webview');
}

export async function fetchSecretKey(port = DEFAULT_PORT) {
  let pages;
  try { pages = await listPages(port); } catch { return null; }
  for (const t of pages) {
    let c;
    try {
      c = await CDP({ target: t, port });
      await c.Runtime.enable();
      const r = await c.Runtime.evaluate({ expression: KEY_EXPR, returnByValue: true });
      const o = JSON.parse(r.result.value);
      if (o.secretKey) return Buffer.from(o.secretKey, 'base64');
    } catch {} finally { if (c) try { await c.close(); } catch {} }
  }
  return null;
}

// CDP co song khong (Zalo mo kem --remote-debugging-port chua).
export async function isCdpUp(port = DEFAULT_PORT) {
  try {
    await CDP.List({ port });
    return true;
  } catch {
    return false;
  }
}
