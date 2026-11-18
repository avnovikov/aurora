#!/usr/bin/env node
// Pull Aurora's localStorage (aurora.* keys) from the phone's WebView via adb + Chrome DevTools Protocol.
// Usage: node scripts/pull-device-snapshot.mjs [outfile]   (default: tests/fixtures/device/<date>-<model>.json)
// Needs: USB debugging on, debuggable Aurora build installed. Launches the app if it is not running.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = 'com.aurora.alvorada';
const PORT = 9333;
const adb = (...a) => execFileSync('adb', a, { encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pid = adb('shell', 'pidof', PKG).split(/\s+/)[0];
if (!pid) {
  adb('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1');
  for (let i = 0; i < 20 && !pid; i++) { await sleep(500); try { pid = adb('shell', 'pidof', PKG).split(/\s+/)[0]; } catch {} }
  await sleep(2000);
}
if (!pid) throw new Error(`${PKG} is not running`);

adb('forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`);
try {
  const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = pages.find((p) => p.type === 'page' && p.url.startsWith('https://localhost'));
  if (!page) throw new Error('Aurora WebView page not found');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const expression = `JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('aurora.')).sort().map(k => { const v = localStorage.getItem(k); try { return [k, JSON.parse(v)]; } catch { return [k, v]; } })))`;
  const reply = await new Promise((res) => {
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 1) res(d); };
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  });
  ws.close();
  if (reply.error || reply.result.exceptionDetails) throw new Error(JSON.stringify(reply.error ?? reply.result.exceptionDetails));

  const data = JSON.parse(reply.result.result.value);
  const snapshot = {
    capturedAt: new Date().toISOString(),
    device: adb('shell', 'getprop', 'ro.product.model'),
    app: { package: PKG, versionName: adb('shell', 'dumpsys', 'package', PKG).match(/versionName=(\S+)/)?.[1] },
    localStorage: data,
  };
  const model = snapshot.device.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const out = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../tests/fixtures/device', `${snapshot.capturedAt.slice(0, 10)}-${model}.json`);
  writeFileSync(out, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`wrote ${out}`);
  for (const [k, v] of Object.entries(data)) {
    const n = Array.isArray(v) ? `${v.length} items` : v && typeof v === 'object' ? `${Object.keys(v).length} keys` : JSON.stringify(v);
    console.log(`  ${k}: ${n}`);
  }
} finally {
  adb('forward', '--remove', `tcp:${PORT}`);
}
