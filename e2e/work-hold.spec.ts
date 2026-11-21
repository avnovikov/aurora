import { expect, test } from "@playwright/test";
import {
  stage,
  startSession,
  swipeUntilWorkHold,
  workHoldCue,
  workHoldLeft,
} from "./session";

test.beforeEach(async ({ page }) => {
  await startSession(page, { blockKind: "core" });
});

test.describe("work hold auto timer", () => {
  test("starts on its own with ticking seconds and the hold hint", async ({ page }) => {
    const start = await swipeUntilWorkHold(page);
    await expect(workHoldLeft(page)).toHaveText(String(start));
    await expect(page.getByText(/Timer runs the hold/)).toBeVisible();

    await page.clock.runFor(2000);
    await expect(workHoldLeft(page)).toHaveText(String(start - 2));
  });

  test("shows halfway when the hold is long enough, then 5–1 on the way down", async ({
    page,
  }) => {
    const start = await swipeUntilWorkHold(page);
    expect(start).toBeGreaterThanOrEqual(6);

    // With countdown, halfway only paints when mid > 5 (hold ≥ 11).
    if (start >= 11) {
      const halfwayAt = Math.ceil(start / 2);
      await page.clock.runFor((start - halfwayAt) * 1000);
      await expect(workHoldLeft(page)).toHaveText(String(halfwayAt));
      await expect(workHoldCue(page)).toHaveText(/halfway|half/i);

      await page.clock.runFor((halfwayAt - 5) * 1000);
    } else {
      await page.clock.runFor((start - Math.min(5, start)) * 1000);
    }

    const countFrom = Math.min(5, start);
    for (let n = countFrom; n >= 1; n -= 1) {
      await expect(workHoldLeft(page)).toHaveText(String(n));
      await expect(workHoldCue(page)).toHaveText(new RegExp(`^${wordFor(n)}$`, "i"));
      await page.clock.runFor(1000);
    }
  });

  test("auto-completes when the clock hits zero", async ({ page }) => {
    const start = await swipeUntilWorkHold(page);
    await page.clock.runFor(start * 1000 + 500);
    await expect(workHoldLeft(page)).toHaveCount(0);
    // Rest between sets, next work set, or cool-down / done — anything but this hold.
    await expect(
      stage(page, "rest").or(stage(page, "work")).or(stage(page, "station")),
    ).toBeVisible();
  });
});

function wordFor(n: number): string {
  const words: Record<number, string> = {
    5: "Five",
    4: "Four",
    3: "Three",
    2: "Two",
    1: "One",
  };
  const word = words[n];
  if (!word) {
    throw new Error(`no count word for ${n}`);
  }
  return word;
}
