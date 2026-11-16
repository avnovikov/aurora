import { describe, expect, it } from "vitest";
import {
  backOnly,
  decideSwipeRelease,
  exitOffsetPx,
  forwardOnly,
  swipeAxis,
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
});

describe("exitOffsetPx", () => {
  it("sends the stage fully off-screen in the swipe direction", () => {
    expect(exitOffsetPx(300, "left")).toBe(-(300 + 24));
    expect(exitOffsetPx(300, "right")).toBe(300 + 24);
  });
});

describe("forwardOnly", () => {
  it("keeps a right-to-left commit", () => {
    expect(forwardOnly({ action: "commit", direction: "left" })).toEqual({
      action: "commit",
      direction: "left",
    });
  });

  it("snaps back a left-to-right swipe", () => {
    expect(forwardOnly({ action: "commit", direction: "right" })).toEqual({ action: "cancel" });
  });

  it("leaves a cancel alone", () => {
    expect(forwardOnly({ action: "cancel" })).toEqual({ action: "cancel" });
  });
});

describe("backOnly", () => {
  it("keeps a left-to-right commit (back)", () => {
    expect(backOnly({ action: "commit", direction: "right" })).toEqual({
      action: "commit",
      direction: "right",
    });
  });

  it("snaps back a right-to-left swipe", () => {
    expect(backOnly({ action: "commit", direction: "left" })).toEqual({ action: "cancel" });
  });

  it("leaves a cancel alone", () => {
    expect(backOnly({ action: "cancel" })).toEqual({ action: "cancel" });
  });
});

describe("swipeAxis", () => {
  it("stays pending while the pointer has barely moved", () => {
    expect(swipeAxis(4, 3)).toBe("pending");
  });

  it("locks horizontal when sideways motion dominates", () => {
    expect(swipeAxis(20, 5)).toBe("horizontal");
  });

  it("stays pending on an equal travel until one axis leads", () => {
    expect(swipeAxis(12, 12)).toBe("pending");
  });

  it("locks vertical when scrolling dominates", () => {
    expect(swipeAxis(5, 20)).toBe("vertical");
  });
});
