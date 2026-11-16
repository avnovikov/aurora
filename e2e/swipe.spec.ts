import { expect, test } from "@playwright/test";
import { moveName, phaseLine, stage, startSession, swipe, swipeThroughWarmup } from "./session";

test.beforeEach(async ({ page }) => {
  await startSession(page);
});

test.describe("warm-up swipe", () => {
  test("swiping left finishes the station early", async ({ page }) => {
    const first = await moveName(page).textContent();
    await swipe(page, stage(page, "station"));
    // Either the gap rest before the next station, or the next station itself.
    await expect(page.getByRole("heading", { name: first ?? "" })).toHaveCount(0);
  });

  test("the gap names the next station and a swipe starts it", async ({ page }) => {
    for (let i = 0; i < 10 && !(await stage(page, "rest").count()); i += 1) {
      await swipe(page, stage(page, "station"));
    }
    await expect(phaseLine(page)).toHaveText(/^Rest · next /);
    await expect(page.getByText("Next set reps")).toHaveCount(0);
    const next = (await phaseLine(page).textContent())!.replace(/^Rest · next /, "");
    await swipe(page, stage(page, "rest"));
    await expect(stage(page, "station")).toBeVisible();
    await expect(moveName(page)).toHaveText(next);
  });

  test("swiping right snaps back and keeps the station", async ({ page }) => {
    const first = await moveName(page).textContent();
    await swipe(page, stage(page, "station"), { direction: "right" });
    await expect(stage(page, "station")).toBeVisible();
    await expect(moveName(page)).toHaveText(first ?? "");
  });

  test("the whole warm-up can be swiped through to the first set", async ({ page }) => {
    await swipeThroughWarmup(page);
    await expect(phaseLine(page)).toHaveText(/^Set 1 of \d+/);
  });
});

test.describe("work swipe", () => {
  test.beforeEach(async ({ page }) => {
    await swipeThroughWarmup(page);
  });

  test("swiping a set logs it and starts the rest; swiping the rest starts the next set", async ({ page }) => {
    await swipe(page, stage(page, "work"));
    await expect(stage(page, "rest")).toBeVisible();
    await expect(phaseLine(page)).toHaveText(/^Rest · next .* Set 2 of \d+/);
    await swipe(page, stage(page, "rest"));
    await expect(phaseLine(page)).toHaveText(/^Set 2 of \d+/);
  });

  test("a slow, drifting thumb swipe still counts while the timers tick", async ({ page }) => {
    // 90 moves × 16 ms ≈ 1.4 s of clock: the session clock ticks mid-drag.
    await swipe(page, stage(page, "work"), { steps: 90, drift: 40 });
    await expect(stage(page, "rest")).toBeVisible();
  });

  test("a swipe that starts on the doodle works", async ({ page }) => {
    await swipe(page, page.locator("[data-swipe-stage='work'] .session-frame"));
    await expect(stage(page, "rest")).toBeVisible();
  });
});
