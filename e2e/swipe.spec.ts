import { expect, test } from "@playwright/test";
import {
  currentMove,
  expectRestNextDoodlePainted,
  GAP_PREFIX,
  moveName,
  phaseLine,
  restNextLine,
  stage,
  startSession,
  swipe,
  swipeUntil,
  workSwipeSurface,
} from "./session";

test.beforeEach(async ({ page }) => {
  await startSession(page);
});

test.describe("warm-up swipe", () => {
  test("swiping left finishes the station early", async ({ page }) => {
    const first = await currentMove(page);
    await swipe(page, stage(page, "station"));
    // Either the gap rest before the next station, or the next station itself.
    await expect(page.getByRole("heading", { name: first })).toHaveCount(0);
  });

  test("the gap names the next station and a swipe starts it", async ({ page }) => {
    await swipeUntil(page, "rest");
    await expect(phaseLine(page)).toHaveText(new RegExp(`^${GAP_PREFIX}`));
    await expect(page.getByText("Next set reps")).toHaveCount(0);
    const next = ((await phaseLine(page).textContent()) ?? "").slice(GAP_PREFIX.length);
    await swipe(page, stage(page, "rest"));
    await expect(stage(page, "station")).toBeVisible();
    await expect(moveName(page)).toHaveText(next);
  });

  test("swiping right snaps back and keeps the station", async ({ page }) => {
    const first = await currentMove(page);
    await swipe(page, stage(page, "station"), { direction: "right" });
    await expect(stage(page, "station")).toBeVisible();
    await expect(moveName(page)).toHaveText(first);
  });

  test("letting go outside the left fifth snaps back", async ({ page }) => {
    const first = await currentMove(page);
    await swipe(page, stage(page, "station"), { releaseAt: 0.3 });
    await expect(moveName(page)).toHaveText(first);
  });

  test("a diagonal swipe (up and left at 45 degrees) snaps back", async ({ page }) => {
    const first = await currentMove(page);
    await swipe(page, stage(page, "station"), { slope: 1 });
    await expect(moveName(page)).toHaveText(first);
  });

  test("the whole warm-up can be swiped through to the first set", async ({ page }) => {
    await swipeUntil(page, "work");
    await expect(phaseLine(page)).toHaveText(/^Set 1 of \d+/);
  });
});

test.describe("work swipe", () => {
  test.beforeEach(async ({ page }) => {
    await swipeUntil(page, "work");
  });

  test("swiping a set logs it and starts the rest; swiping the rest starts the next set", async ({ page }) => {
    await swipe(page, workSwipeSurface(page));
    await expect(stage(page, "rest")).toBeVisible();
    await expect(phaseLine(page)).toHaveText(/^Rest$/);
    await expect(restNextLine(page)).toHaveText(/^next .* Set 2 of \d+/i);
    await expectRestNextDoodlePainted(page);
    await swipe(page, stage(page, "rest"));
    await expect(phaseLine(page)).toHaveText(/^Set 2 of \d+/);
  });

  test("a slow, drifting thumb swipe still counts while the timers tick", async ({ page }) => {
    // 90 moves × one frame ≈ 1.4 s of clock: the session clock ticks mid-drag.
    await swipe(page, workSwipeSurface(page), { steps: 90, drift: 40 });
    await expect(stage(page, "rest")).toBeVisible();
  });

  test("a swipe that starts on the doodle works", async ({ page }) => {
    await swipe(page, workSwipeSurface(page));
    await expect(stage(page, "rest")).toBeVisible();
  });
});
