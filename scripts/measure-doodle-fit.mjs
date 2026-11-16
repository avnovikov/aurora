/**
 * Measures how each animated doodle (public/doodles/*.svg) sits in its
 * viewBox: renders them in headless Chrome, steps every SMIL animation through
 * its loop, and unions the painted extent of every shape (getBBox plus half
 * its stroke width; the zoom inset counts as its clip circle). Prints the
 * margins left between that extent and the viewBox edges, and exits 1 when a
 * doodle is clipped or visibly off-centre.
 *
 *   node scripts/measure-doodle-fit.mjs            # audit all doodles
 *   node scripts/measure-doodle-fit.mjs --json     # raw measurements
 *
 * The viewBox itself comes from src/doodles/renderSvg.ts (`npm run doodles`);
 * this script only checks the result. Needs Google Chrome (CHROME_PATH to
 * override the macOS default) and a free DevTools port (CDP_PORT, default 9417).
 */
import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const doodleDir = path.join(repoRoot, "public/doodles");
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = Number(process.env.CDP_PORT ?? 9417);
/** Animation samples per loop. */
const SAMPLES = 60;
/** Largest |left − right| or |top − bottom| margin gap, as a share of the viewBox side. */
const MAX_IMBALANCE = 0.04;

/** Runs in the page: painted extent of one inline <svg> over its whole loop. */
function measureInPage(samples) {
  const clipped = (el) => el.closest("[clip-path]") !== null;
  const paintedBox = (el) => {
    const box = el.getBBox();
    const half = el.tagName === "text" ? 0 : parseFloat(getComputedStyle(el).strokeWidth) / 2;
    return [box.x - half, box.y - half, box.x + box.width + half, box.y + box.height + half];
  };
  const union = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
  const duration = (svg) => Math.max(...[...svg.querySelectorAll("animate")].map((a) => a.getSimpleDuration()), 0);

  return [...document.querySelectorAll("svg")].map((svg) => {
    const shapes = [...svg.querySelectorAll("polyline, line, circle, ellipse, rect, text")].filter(
      (el) => !clipped(el) && el.parentElement !== svg && el.closest("clipPath") === null,
    );
    const dur = duration(svg);
    svg.pauseAnimations();
    let extent = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < samples; i++) {
      svg.setCurrentTime((dur * i) / samples);
      extent = shapes.map(paintedBox).reduce(union, extent);
    }
    const view = svg.viewBox.baseVal;
    return { file: svg.dataset.file, view: [view.x, view.y, view.width, view.height], extent };
  });
}

function margins({ view, extent }) {
  const [x, y, w, h] = view;
  return { left: extent[0] - x, top: extent[1] - y, right: x + w - extent[2], bottom: y + h - extent[3], w, h };
}

function verdict(m) {
  if (Math.min(m.left, m.right, m.top, m.bottom) < 0) return "CLIPPED";
  const off = Math.abs(m.left - m.right) / m.w > MAX_IMBALANCE || Math.abs(m.top - m.bottom) / m.h > MAX_IMBALANCE;
  return off ? "OFF-CENTRE" : "ok";
}

async function writeSheet(dir) {
  const files = (await readdir(doodleDir)).filter((f) => f.endsWith(".svg")).sort();
  const svgs = await Promise.all(
    files.map(async (f) => (await readFile(path.join(doodleDir, f), "utf8")).replace("<svg ", `<svg data-file="${f}" `)),
  );
  const page = path.join(dir, "sheet.html");
  await writeFile(page, `<!doctype html><body>${svgs.join("\n")}</body>`);
  return page;
}

async function devtoolsSocket() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = targets.find((t) => t.type === "page");
      if (page) return new WebSocket(page.webSocketDebuggerUrl);
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Chrome did not open port ${port}`);
}

/** Minimal CDP client: send(method, params) → result. */
async function connect() {
  const socket = await devtoolsSocket();
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let nextId = 1;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  return { send, close: () => socket.close() };
}

async function measureAll(pageFile) {
  const cdp = await connect();
  try {
    await cdp.send("Page.enable");
    await cdp.send("Page.navigate", { url: pathToFileURL(pageFile).href });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
      expression: `(${measureInPage})(${SAMPLES})`,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  } finally {
    cdp.close();
  }
}

function report(results) {
  const fmt = (n) => n.toFixed(1).padStart(7);
  let failures = 0;
  for (const r of results) {
    const m = margins(r);
    const status = verdict(m);
    if (status !== "ok") failures++;
    console.log(`${status.padEnd(10)} L${fmt(m.left)} R${fmt(m.right)} T${fmt(m.top)} B${fmt(m.bottom)}  ${r.file}`);
  }
  console.log(`${results.length} doodles, ${failures} clipped or off-centre`);
  return failures;
}

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), "doodle-fit-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`,
    "--allow-file-access-from-files",
    "about:blank",
  ]);
  try {
    const results = await measureAll(await writeSheet(dir));
    if (process.argv.includes("--json")) console.log(JSON.stringify(results, null, 2));
    else process.exitCode = report(results) > 0 ? 1 : 0;
  } finally {
    const exited = new Promise((resolve) => chrome.once("exit", resolve));
    chrome.kill();
    await exited;
    await rm(dir, { recursive: true, force: true, maxRetries: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
