import { expect, type Locator, type Page } from "@playwright/test";
import { SWIPE_BACK_MS, SWIPE_EXIT_MS } from "../src/ui/sessionSwipe";

/** Below this, a "visible" SVG is effectively collapsed (0×0 layout). */
const MIN_PAINTED_DOODLE_PX = 8;

const PROFILE_KEY = "aurora.poc.profile.v1";
/** Fake time between two touch moves: one 60 Hz frame. */
const FRAME_MS = 16;
/** Long enough for the exit or snap-back animation, plus a margin for the repaint. */
const SETTLE_MS = Math.max(SWIPE_EXIT_MS, SWIPE_BACK_MS) + 140;
/** More swipes than any warm-up has stations and gaps. */
const MAX_WARMUP_SWIPES = 40;
/** Station-gap next line starts with this, then the next station's name. */
export const GAP_PREFIX = "next ";

export interface StartSessionOptions {
  /** Plan block kind to add (`core` for abs holds). Default: first Add-days chip. */
  blockKind?: "upper" | "lower" | "core" | "full";
}

/**
 * Open the app with a fake clock (timers only move when a test says so),
 * add one training day, and start a session from Today. Lands on the
 * first warm-up station.
 */
export async function startSession(
  page: Page,
  options: StartSessionOptions = {},
): Promise<void> {
  await page.clock.install();
  await page.goto("/");
  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ setupDone: true, voiceMuted: true })),
    PROFILE_KEY,
  );
  await page.reload();
  await page.locator(".tab-bar").getByText("Plan").tap();
  // The add-day buttons sit in a closed menu; this test is about the session, not the menu.
  const addChip = options.blockKind
    ? page.locator(`[data-add-kind='${options.blockKind}']`)
    : page.locator("[data-add-kind]").first();
  await addChip.dispatchEvent("click");
  await page.locator(".tab-bar").getByText("Today").tap();
  await page.locator("[data-sleep-value='good']").tap();
  await page.locator("[data-start]").tap();
  await stage(page, "station").waitFor();
}

/** The current swipe stage of the given kind (station, rest or work), or any stage. */
export function stage(page: Page, kind?: "station" | "rest" | "work"): Locator {
  return page.locator(kind ? `[data-swipe-stage='${kind}']` : "[data-swipe-stage]");
}

/**
 * Work stage has a toolbar of buttons at the top; swiping the stage box can
 * land on those and never start the gesture. Prefer the doodle/hero frame.
 */
export function workSwipeSurface(page: Page): Locator {
  return page.locator("[data-swipe-stage='work'] .session-frame");
}

/** Phase eyebrow above the hero: "Warmup", "Rest", "Get ready", "Cool-down". */
export function phaseLine(page: Page): Locator {
  return page.locator(".session-phase");
}

/** Shared set line on warmup (multi-round) and work: "Set 2 of 4". */
export function setLine(page: Page): Locator {
  return page.locator(".session-set");
}

/** Rest next-move line (`next Name…`) above the countdown. */
export function restNextLine(page: Page): Locator {
  return page.locator(".rest-next-line");
}

/** Next-move doodle on the rest dose row (right of the seconds). */
export function restNextDoodle(page: Page): Locator {
  return page.locator(".session-dose--rest .rest-next-doodle .doodle");
}

/**
 * Assert the rest-next doodle has a real layout box.
 * ViewBox-only SVGs with `width: auto` and only `max-height` collapse to 0×0.
 */
export async function expectRestNextDoodlePainted(page: Page): Promise<void> {
  const box = await restNextDoodle(page).boundingBox();
  expect(box, "rest-next doodle must have a layout box").toBeTruthy();
  expect(box!.width, "rest-next doodle width").toBeGreaterThan(MIN_PAINTED_DOODLE_PX);
  expect(box!.height, "rest-next doodle height").toBeGreaterThan(MIN_PAINTED_DOODLE_PX);
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
  /** Climb the whole drag at this rise over run (1 = 45 degrees up); overrides `drift`. */
  slope?: number;
}

interface SwipePath {
  x0: number;
  x1: number;
  y: number;
  rise: number;
}

/** Start, release and vertical travel of a swipe across `box`. */
function swipePath(box: { x: number; y: number; width: number; height: number }, options: SwipeOptions): SwipePath {
  const { direction = "left", drift = 12 } = options;
  const releaseAt = options.releaseAt ?? (direction === "left" ? 0.1 : 0.9);
  const x0 = box.x + box.width * (direction === "left" ? 0.85 : 0.15);
  const x1 = box.x + box.width * releaseAt;
  const rise = options.slope === undefined ? drift : -options.slope * Math.abs(x1 - x0);
  return { x0, x1, y: box.y + Math.min(box.height / 2, 240), rise };
}

/**
 * A real touch swipe across the middle of `target` (CDP touch events, so the
 * browser makes the pointer events and applies touch-action), then lets the
 * exit or snap-back animation finish.
 */
export async function swipe(page: Page, target: Locator, options: SwipeOptions = {}): Promise<void> {
  const { steps = 12 } = options;
  const box = await target.boundingBox();
  if (!box) {
    throw new Error("swipe target is not on screen");
  }
  const { x0, x1, y, rise } = swipePath(box, options);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x0 + (x1 - x0) * t, y: y + rise * t }],
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

/** Ticking seconds on a work hold hero. */
export function workHoldLeft(page: Page): Locator {
  return page.locator("[data-work-hold-left]");
}

/** On-screen hold cue under the countdown (halfway / 5–1 / hold_done). */
export function workHoldCue(page: Page): Locator {
  return page.locator("[data-swipe-stage='work'] [data-hold-cue]");
}

const MAX_WORK_HOLDS_SWIPES = 24;

/**
 * From a warm-up station (or later), swipe forward until a work hold timer is on screen.
 */
export async function swipeUntilWorkHold(page: Page): Promise<number> {
  if (!(await stage(page, "work").count())) {
    await swipeUntil(page, "work");
  }
  for (let i = 0; i < MAX_WORK_HOLDS_SWIPES; i += 1) {
    if (await stage(page, "rest").count()) {
      await swipe(page, stage(page, "rest"));
      continue;
    }
    if (!(await stage(page, "work").count())) {
      break;
    }
    if (await workHoldLeft(page).count()) {
      const seconds = Number(await workHoldLeft(page).textContent());
      if (!Number.isFinite(seconds) || seconds <= 0) {
        throw new Error(`work hold left is not a positive number: ${seconds}`);
      }
      return seconds;
    }
    await swipe(page, workSwipeSurface(page));
  }
  throw new Error(`no work hold after ${MAX_WORK_HOLDS_SWIPES} work/rest swipes`);
}
