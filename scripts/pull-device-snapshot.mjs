#!/usr/bin/env node
/**
 * Pull Aurora's localStorage (aurora.* keys) from the phone's WebView via adb + CDP.
 *
 * Usage: node scripts/pull-device-snapshot.mjs [filename]
 *   filename — optional basename only; always written under tests/fixtures/device/
 *   default — <date>-<model>.json
 *
 * Needs: USB debugging on, debuggable Aurora build installed. Launches the app if needed.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  auroraLocalStorageFromCdp,
  defaultFixtureName,
  resolveFixturePath,
} from "./lib/deviceSnapshotOut.mjs";

const PKG = "com.aurora.alvorada";
const PORT = 9333;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(scriptDir, "../tests/fixtures/device");

const adb = (...args) => execFileSync("adb", args, { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

let pid = adb("shell", "pidof", PKG).split(/\s+/)[0];
if (!pid) {
  adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1");
  for (let i = 0; i < 20 && !pid; i++) {
    await sleep(500);
    try {
      pid = adb("shell", "pidof", PKG).split(/\s+/)[0];
    } catch {
      // App may still be starting.
    }
  }
  await sleep(2000);
}
if (!pid) throw new Error(`${PKG} is not running`);

adb("forward", `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`);
try {
  const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = pages.find((p) => p.type === "page" && p.url.startsWith("https://localhost"));
  if (!page) throw new Error("Aurora WebView page not found");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  const expression = `JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('aurora.')).sort().map(k => { const v = localStorage.getItem(k); try { return [k, JSON.parse(v)]; } catch { return [k, v]; } })))`;
  const reply = await new Promise((res) => {
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id === 1) res(d);
    };
    ws.send(
      JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: { expression, returnByValue: true },
      }),
    );
  });
  ws.close();
  if (reply.error || reply.result.exceptionDetails) {
    throw new Error(JSON.stringify(reply.error ?? reply.result.exceptionDetails));
  }

  const capturedAt = new Date().toISOString();
  const device = adb("shell", "getprop", "ro.product.model");
  const versionName = adb("shell", "dumpsys", "package", PKG).match(/versionName=(\S+)/)?.[1];
  const localStorage = auroraLocalStorageFromCdp(JSON.parse(reply.result.result.value));
  const snapshot = {
    capturedAt,
    device,
    app: { package: PKG, versionName },
    localStorage,
  };

  mkdirSync(FIXTURE_DIR, { recursive: true });
  const out = resolveFixturePath(FIXTURE_DIR, process.argv[2], defaultFixtureName(capturedAt, device));
  // Intentional local USB fixture capture after path pin + aurora.* key validation.
  // codeql[js/http-to-file-access] Dev-only adb/CDP dump into tests/fixtures/device; not shipped.
  writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`wrote ${out}`);
  for (const [k, v] of Object.entries(localStorage)) {
    const n = Array.isArray(v)
      ? `${v.length} items`
      : v && typeof v === "object"
        ? `${Object.keys(v).length} keys`
        : JSON.stringify(v);
    console.log(`  ${k}: ${n}`);
  }
} finally {
  adb("forward", "--remove", `tcp:${PORT}`);
}
