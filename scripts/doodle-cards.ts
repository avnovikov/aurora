/**
 * Review cards for doodles: one PNG per exercise id with the Library's text
 * (name, summary, steps) and 8 frames sampled across the animation, so a
 * reviewer can check the drawing against the move frame by frame.
 *
 *   npm run doodles:cards -- <outDir> <exerciseId>...
 *
 * Needs local Google Chrome (Playwright's "chrome" channel).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { doodleFor } from "../src/data/doodles.ts";
import { DESCRIPTIONS } from "../src/data/generated/descriptions.ts";
import { GENERATED_DOODLES } from "../src/data/generated/doodleMap.ts";
import { LIBRARY_CATALOGUE } from "../src/data/libraryCatalogue.ts";
import { DOODLE_SPECS } from "../src/doodles/specs.ts";

/** Frames per card; DOODLE_CARD_FRAMES=24 shows fast moments such as a turn. */
const FRAMES = Number(process.env.DOODLE_CARD_FRAMES) || 8;
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");

interface CardItem {
  id: string;
  name: string;
  file: string;
  view: string;
  summary?: string;
  steps?: readonly string[];
}

function cardItems(ids: readonly string[]): CardItem[] {
  const library = new Map(LIBRARY_CATALOGUE.map((exercise) => [exercise.id, exercise]));
  const specs = new Map(DOODLE_SPECS.map((spec) => [spec.id, spec]));
  const items: CardItem[] = [];
  for (const id of ids) {
    const exercise = library.get(id);
    const spec = specs.get(id);
    const file = GENERATED_DOODLES[id] ?? doodleFor(id, exercise?.doodlePath);
    if (!file) {
      console.error(`${id}: no doodle`);
      continue;
    }
    const text = (DESCRIPTIONS as Record<string, { summary?: string; steps?: string[] } | undefined>)[id];
    items.push({ id, name: exercise?.name ?? spec?.title ?? id, file, view: spec?.views ? "side + front" : (spec?.view ?? "side"), summary: text?.summary, steps: text?.steps });
  }
  return items;
}

const escapeHtml = (value: unknown): string => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");

async function main(): Promise<void> {
  const [outDir, ...ids] = process.argv.slice(2);
  if (!outDir || ids.length === 0) {
    console.error("Usage: npm run doodles:cards -- <outDir> <exerciseId>...");
    process.exitCode = 1;
    return;
  }
  mkdirSync(outDir, { recursive: true });
  const items = cardItems(ids);
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(items, null, 2));
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  for (const item of items) {
    const isSvg = item.file.endsWith(".svg");
    const frames: string[] = [];
    if (isSvg) {
      const svg = readFileSync(path.join(publicDir, item.file), "utf8");
      await page.setContent(`<body style="margin:0;background:#fff"><div style="width:300px;height:300px">${svg}</div></body>`);
      await page.evaluate(() => {
        const svgEl = document.querySelector("svg")!;
        svgEl.setAttribute("width", "300");
        svgEl.setAttribute("height", "300");
        svgEl.pauseAnimations();
      });
      const duration = await page.evaluate(() =>
        Math.max(0, ...[...document.querySelectorAll("animate")].map((a) => (a as SVGAnimationElement).getSimpleDuration())),
      );
      for (let i = 0; i < FRAMES; i++) {
        await page.evaluate((t) => document.querySelector("svg")!.setCurrentTime(t), (duration * i) / FRAMES);
        frames.push((await page.locator("svg").first().screenshot()).toString("base64"));
      }
    } else {
      frames.push(readFileSync(path.join(publicDir, item.file)).toString("base64"));
    }
    const mime = isSvg ? "png" : "jpeg";
    const frameLabel = (i: number): string => (isSvg ? "t=" + i + "/" + FRAMES : "hand-drawn");
    const cells = frames
      .map(
        (b64, i) =>
          `<div><img src="data:image/${mime};base64,${b64}" style="width:300px;height:300px;object-fit:contain;border:1px solid #ccc"><div style="text-align:center;color:#888">${frameLabel(i)}</div></div>`,
      )
      .join("");
    await page.setContent(`<body style="margin:0;font:15px system-ui;background:#fff;width:1300px;padding:12px">
<h2 style="margin:0">${escapeHtml(item.name)} <small style="color:#888">${escapeHtml(item.id)} · ${escapeHtml(item.view)} view${item.view.includes("+") ? "s" : ""} · ${escapeHtml(item.file)}</small></h2>
<p style="margin:4px 0">${escapeHtml(item.summary)}</p><ol style="margin:4px 0">${(item.steps ?? []).map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
<div style="display:grid;grid-template-columns:repeat(4,300px);gap:8px">${cells}</div></body>`);
    await page.locator("body").screenshot({ path: path.join(outDir, `${item.id}.png`) });
  }
  await browser.close();
  console.log(`Rendered ${items.length} review cards to ${outDir}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
