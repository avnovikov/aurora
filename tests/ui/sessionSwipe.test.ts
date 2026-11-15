import { describe, expect, it } from "vitest";
import {
  decideSwipeRelease,
  exitOffsetPx,
  SWIPE_COMMIT_RATIO,
  SWIPE_FLICK_PX_PER_MS,
} from "../../src/ui/sessionSwipe";

describe("decideSwipeRelease", () => {
  const width = 300;
  const threshold = width * SWIPE_COMMIT_RATIO;

  it("cancels a short slow drag", () => {
    expect(
      decideSwipeRelease({
        deltaX: threshold - 1,
        velocityPxPerMs: 0,
        width,
      }),
    ).toEqual({ action: "cancel" });
  });

  it("commits left when dragged past a third of the width", () => {
    expect(
      decideSwipeRelease({
        deltaX: -threshold,
        velocityPxPerMs: 0,
        width,
      }),
    ).toEqual({ action: "commit", direction: "left" });
  });

  it("commits right when dragged past a third of the width", () => {
    expect(
      decideSwipeRelease({
        deltaX: threshold,
        velocityPxPerMs: 0,
        width,
      }),
    ).toEqual({ action: "commit", direction: "right" });
  });

  it("commits from a left flick even short of the distance", () => {
    expect(
      decideSwipeRelease({
        deltaX: -20,
        velocityPxPerMs: -SWIPE_FLICK_PX_PER_MS,
        width,
      }),
    ).toEqual({ action: "commit", direction: "left" });
  });

  it("commits from a right flick even short of the distance", () => {
    expect(
      decideSwipeRelease({
        deltaX: 20,
        velocityPxPerMs: SWIPE_FLICK_PX_PER_MS,
        width,
      }),
    ).toEqual({ action: "commit", direction: "right" });
  });

  it("rejects non-positive width", () => {
    expect(() =>
      decideSwipeRelease({ deltaX: 100, velocityPxPerMs: 0, width: 0 }),
    ).toThrow(/positive/);
  });

  describe("commitDirections: right", () => {
    it("cancels a left drag past the threshold", () => {
      expect(
        decideSwipeRelease({
          deltaX: -threshold,
          velocityPxPerMs: 0,
          width,
          commitDirections: "right",
        }),
      ).toEqual({ action: "cancel" });
    });

    it("cancels a left flick", () => {
      expect(
        decideSwipeRelease({
          deltaX: -20,
          velocityPxPerMs: -SWIPE_FLICK_PX_PER_MS,
          width,
          commitDirections: "right",
        }),
      ).toEqual({ action: "cancel" });
    });

    it("still commits a right drag past the threshold", () => {
      expect(
        decideSwipeRelease({
          deltaX: threshold,
          velocityPxPerMs: 0,
          width,
          commitDirections: "right",
        }),
      ).toEqual({ action: "commit", direction: "right" });
    });
  });
});

describe("exitOffsetPx", () => {
  it("sends the stage fully off-screen in the swipe direction", () => {
    expect(exitOffsetPx(300, "left")).toBe(-(300 + 24));
    expect(exitOffsetPx(300, "right")).toBe(300 + 24);
  });
});
