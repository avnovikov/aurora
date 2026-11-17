import type { Locator, Page } from "@playwright/test";
import { SWIPE_BACK_MS, SWIPE_EXIT_MS } from "../src/ui/sessionSwipe";

const PROFILE_KEY = "aurora.poc.profile.v1";
/** Fake time between two touch moves: one 60 Hz frame. */
const FRAME_MS = 16;
/** Long enough for the exit or snap-back animation, plus a margin for the repaint. */
const SETTLE_MS = Math.max(SWIPE_EXIT_MS, SWIPE_BACK_MS) + 140;
/** More swipes than any warm-up has stations and gaps. */
const MAX_WARMUP_SWIPES = 40;
/** The gap rest's eyebrow starts with this, then the next station's name. */
export const GAP_PREFIX = "Rest · next ";

/**
 * Open the app with a fake clock (timers only move when a test says so),
 * add one training day, and start a session from Today. Lands on the
 * first warm-up station.
 */
export async function startSession(page: Page): Promise<void> {
  await page.clock.install();
  await page.goto("/");
  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ setupDone: true, voiceMuted: true })),
    PROFILE_KEY,
  );
  await page.reload();
  await page.locator(".tab-bar").getByText("Plan").tap();
  // The add-day buttons sit in a closed menu; this test is about the session, not the menu.
  await page.locator("[data-add-kind]").first().dispatchEvent("click");
  await page.locator(".tab-bar").getByText("Today").tap();
  await page.locator("[data-sleep-value='good']").tap();
  await page.locator("[data-start]").tap();
  await stage(page, "station").waitFor();
}

/** The current swipe stage of the given kind (station, rest or work), or any stage. */
export function stage(page: Page, kind?: "station" | "rest" | "work"): Locator {
  return page.locator(kind ? `[data-swipe-stage='${kind}']` : "[data-swipe-stage]");
}

/** The eyebrow above the hero: "Warmup", "Rest · next …", "Set 2 of 4". */
export function phaseLine(page: Page): Locator {
  return page.locator(".session-phase");
}

export function moveName(page: Page): Locator {
  return page.locator(".session-move");
}

/** The move on screen now, as text. */
export async function currentMove(page: Page): Promise<string> {
  return (await moveName(page).textContent()) ?? "";
}

interface SwipeOptions {
  direction?: "left" | "right";
  /** Touch moves in the drag; each one is FRAME_MS of fake time. */
  steps?: number;
  /** Vertical drift of a real thumb, in px. */
  drift?: number;
  /** Where the finger lifts, as a share of the target width from its left edge. */
  releaseAt?: number;
}

/**
 * A real touch swipe across the middle of `target` (CDP touch events, so the
 * browser makes the pointer events and applies touch-action), then lets the
 * exit or snap-back animation finish.
 */
export async function swipe(page: Page, target: Locator, options: SwipeOptions = {}): Promise<void> {
  const { direction = "left", steps = 12, drift = 12 } = options;
  const releaseAt = options.releaseAt ?? (direction === "left" ? 0.1 : 0.9);
  const box = await target.boundingBox();
  if (!box) {
    throw new Error("swipe target is not on screen");
  }
  const y = box.y + Math.min(box.height / 2, 240);
  const [from, to] = direction === "left" ? [0.85, releaseAt] : [0.15, releaseAt];
  const x0 = box.x + box.width * from;
  const x1 = box.x + box.width * to;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x0 + (x1 - x0) * t, y: y + drift * t }],
    });
    await page.clock.runFor(FRAME_MS);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.clock.runFor(SETTLE_MS);
  await cdp.detach();
}

/**
 * Swipe forward from the start of the session until a stage of `kind` shows:
 * "rest" stops at the first gap between warm-up stations, "work" at the first set.
 */
export async function swipeUntil(page: Page, kind: "rest" | "work"): Promise<void> {
  for (let i = 0; i < MAX_WARMUP_SWIPES; i += 1) {
    if (await stage(page, kind).count()) {
      return;
    }
    await swipe(page, stage(page));
  }
  throw new Error(`no ${kind} stage after ${MAX_WARMUP_SWIPES} swipes`);
}
