/**
 * Retakes the README and tutorial screenshots (docs/help/screenshots/*.png)
 * from invented sample data, so they can be regenerated after any UI change.
 *
 *   node scripts/help-screenshots.mjs
 *
 * Starts Vite on a free port above 5350, opens the app in a phone-sized
 * browser (390x844 CSS px, device scale 2), seeds localStorage from
 * scripts/fixtures/help-sample.json, walks first-run setup and every tab,
 * writes the PNGs and stops Vite. The clock is pinned to the fixture's `now`
 * and the time zone to Europe/London, so weeks and "this week" never drift.
 *
 * The fixture is synthetic: no device snapshot values, no joint history.
 * Uses the installed Google Chrome; set HELP_SHOTS_CHANNEL=chromium to use
 * Playwright's own Chromium (`npx playwright install chromium`).
 */
/* global console, fetch, localStorage, process, setTimeout, window */
import { spawn } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(repoRoot, "scripts/fixtures/help-sample.json");
const outDir = path.join(repoRoot, "docs/help/screenshots");
const FIRST_PORT = 5351;
const VITE_START_MS = 30_000;
/** Lets doodles, fonts and the Body figure settle before a shot. */
const SETTLE_MS = 600;

/** First free TCP port from `start` upwards. */
async function freePort(start) {
  for (let port = start; port < start + 100; port += 1) {
    const free = await new Promise((resolve) => {
      const probe = createServer();
      probe.once("error", () => resolve(false));
      probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
    });
    if (free) {
      return port;
    }
  }
  throw new Error(`no free port from ${start}`);
}

/** Runs Vite on `port` and resolves once it answers. */
async function startVite(port) {
  const viteBin = path.join(repoRoot, "node_modules/vite/bin/vite.js");
  const vite = spawn(process.execPath, [viteBin, "--port", String(port), "--strictPort"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "inherit"],
  });
  const deadline = Date.now() + VITE_START_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://localhost:${port}/`);
      if (response.ok) {
        return vite;
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  vite.kill();
  throw new Error(`vite did not start on port ${port}`);
}

async function launchBrowser() {
  const channel = process.env.HELP_SHOTS_CHANNEL ?? "chrome";
  return chromium.launch(channel === "chromium" ? {} : { channel });
}

/** Seeds every fixture key (values are stored as JSON strings, as the app writes them). */
async function seed(page, storage) {
  await page.evaluate((entries) => {
    localStorage.clear();
    for (const [key, value] of entries) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }, Object.entries(storage));
  await page.reload();
}

async function shot(page, name) {
  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log(`wrote docs/help/screenshots/${name}.png`);
}

async function tab(page, label) {
  await page.locator(".tab-bar").getByRole("button", { name: label, exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Scrolls the page so `locator` sits near the top of the viewport. */
async function scrollToTop(page, locator, margin = 24) {
  const box = await locator.first().boundingBox();
  if (!box) {
    throw new Error("scroll target is not on screen");
  }
  await page.evaluate((y) => window.scrollBy(0, y), box.y - margin);
}

/** First run: Your setup, then What to train first → Upper body. */
async function firstRun(page) {
  await page.locator("[data-setup-continue]").click();
  await shot(page, "01b-settings-area");
  await page.locator("[data-area='upper']").click();
  await page.locator("[data-start]").click();
  await page.locator(".tab-bar").waitFor();
}

async function settingsLibraryPlan(page) {
  await tab(page, "Settings");
  await shot(page, "01-settings");
  await tab(page, "Library");
  await shot(page, "02-library");
  await page.getByRole("button", { name: /Glute bridge/ }).first().click();
  await shot(page, "02b-library-exercise");
  await tab(page, "Plan");
  await shot(page, "03-plan");
  await tab(page, "Today");
  await shot(page, "04-today");
}

async function feedbackTabs(page) {
  await tab(page, "Progress");
  await shot(page, "06-progress");
  await tab(page, "History");
  await shot(page, "07-history");
  // An exercise row opens the exercise page; the phone's Back returns to History.
  await page.locator("details[open] [data-open-exercise]").nth(1).click();
  await shot(page, "07c-history-exercise");
  await page.goBack();
  await page.locator(".history-week").first().waitFor();
  // The oldest week: summary-only sessions from before set-level logging.
  await scrollToTop(page, page.locator(".history-week").last());
  await page.locator(".history-week").last().locator("details").first().evaluate((card) => {
    card.open = true;
  });
  await shot(page, "07b-history-week");
  await tab(page, "Body");
  await shot(page, "08-body");
  await scrollToTop(page, page.locator(".bb-bal"));
  await shot(page, "08b-body-balance");
}

/** Last, because a started session replaces the tabs until it ends. */
async function session(page) {
  await tab(page, "Today");
  await page.locator("[data-sleep-value='good']").click();
  await page.locator("[data-start]").click();
  await page.locator("[data-swipe-stage='station']").waitFor();
  await shot(page, "05-session");
}

async function main() {
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  await mkdir(outDir, { recursive: true });
  const port = await freePort(FIRST_PORT);
  const vite = await startVite(port);
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: "en-GB",
      timezoneId: "Europe/London",
      colorScheme: "dark",
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date(fixture.now));
    await page.goto(`http://localhost:${port}/`);
    await seed(page, fixture.localStorage);
    await firstRun(page);
    await settingsLibraryPlan(page);
    await feedbackTabs(page);
    await session(page);
  } finally {
    await browser.close();
    vite.kill();
  }
}

await main();
