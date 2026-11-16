import type { Locator, Page } from "@playwright/test";

const PROFILE_KEY = "aurora.poc.profile.v1";

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

/** The current swipe stage of the given kind: station, rest or work. */
export function stage(page: Page, kind: "station" | "rest" | "work"): Locator {
  return page.locator(`[data-swipe-stage='${kind}']`);
}

/** The eyebrow above the hero: "Warmup", "Rest · next …", "Set 2 of 4". */
export function phaseLine(page: Page): Locator {
  return page.locator(".session-phase");
}

export function moveName(page: Page): Locator {
  return page.locator(".session-move");
}

interface SwipeOptions {
  direction?: "left" | "right";
  /** Touch moves in the drag; each one is 16 ms of fake time. */
  steps?: number;
  /** Vertical drift of a real thumb, in px. */
  drift?: number;
}

/**
 * A real touch swipe across the middle of `target` (CDP touch events, so the
 * browser makes the pointer events and applies touch-action), then lets the
 * exit or snap-back animation finish.
 */
export async function swipe(page: Page, target: Locator, options: SwipeOptions = {}): Promise<void> {
  const { direction = "left", steps = 12, drift = 12 } = options;
  const box = await target.boundingBox();
  if (!box) {
    throw new Error("swipe target is not on screen");
  }
  const y = box.y + Math.min(box.height / 2, 240);
  const [from, to] = direction === "left" ? [0.8, 0.2] : [0.2, 0.8];
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
    await page.clock.runFor(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.clock.runFor(500);
  await cdp.detach();
}

/** Swipe through warm-up stations and their gaps until the first work set shows. */
export async function swipeThroughWarmup(page: Page): Promise<void> {
  for (let i = 0; i < 40; i += 1) {
    if (await stage(page, "work").count()) {
      return;
    }
    await swipe(page, page.locator("[data-swipe-stage]"));
  }
  throw new Error("still no work set after 40 swipes");
}
