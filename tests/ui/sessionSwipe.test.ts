import { describe, expect, it } from "vitest";
import {
  backOnly,
  decideSwipeRelease,
  exitOffsetPx,
  forwardOnly,
  swipeAxis,
  SWIPE_MAX_SLOPE,
  SWIPE_RELEASE_ZONE_RATIO,
} from "../../src/ui/sessionSwipe";

describe("decideSwipeRelease", () => {
  const width = 300;
  const zone = width * SWIPE_RELEASE_ZONE_RATIO; // 60
  const startAt = width * 0.8;
  /** A horizontal swipe from 80% of the width, let go at `releaseX`. */
  const left = (releaseX: number) =>
    decideSwipeRelease({ deltaX: releaseX - startAt, releaseX, width });
  /** A horizontal swipe from 20% of the width, let go at `releaseX`. */
  const right = (releaseX: number) =>
    decideSwipeRelease({ deltaX: releaseX - width * 0.2, releaseX, width });

  it("commits a left swipe let go inside the left fifth", () => {
    expect(left(zone)).toEqual({ action: "commit", direction: "left" });
    expect(left(10)).toEqual({ action: "commit", direction: "left" });
  });

  it("snaps back when let go outside the left fifth, however far it went", () => {
    expect(left(zone + 1)).toEqual({ action: "cancel" });
    expect(left(width / 2)).toEqual({ action: "cancel" });
  });

  it("snaps back a short drag that starts inside the zone", () => {
    expect(decideSwipeRelease({ deltaX: -20, releaseX: 20, width })).toEqual({
      action: "cancel",
    });
  });

  it("mirrors for a right swipe: let go inside the right fifth", () => {
    expect(right(width - zone)).toEqual({ action: "commit", direction: "right" });
    expect(right(width - zone - 1)).toEqual({ action: "cancel" });
  });

  it("rejects non-positive width", () => {
    expect(() => decideSwipeRelease({ deltaX: 100, releaseX: 0, width: 0 })).toThrow(
      /positive/,
    );
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
  const run = 180;
  const rise = (radians: number) => Math.round(run * Math.tan(radians));

  it("stays pending while the pointer has barely moved", () => {
    expect(swipeAxis(4, 3)).toBe("pending");
  });

  it("is horizontal along the line and one notch either side (left-left-up/down, 22.5 degrees)", () => {
    expect(swipeAxis(-run, 0)).toBe("horizontal");
    expect(swipeAxis(-run, -rise(Math.PI / 8))).toBe("horizontal");
    expect(swipeAxis(-run, rise(Math.PI / 8))).toBe("horizontal");
  });

  it("is vertical from up-left (45 degrees) and steeper (up-up-left, 67.5 degrees)", () => {
    expect(swipeAxis(-run, -run)).toBe("vertical");
    expect(swipeAxis(-run, -rise((3 * Math.PI) / 8))).toBe("vertical");
  });

  it("draws the line at SWIPE_MAX_SLOPE", () => {
    expect(swipeAxis(-run, run * SWIPE_MAX_SLOPE)).toBe("horizontal");
    expect(swipeAxis(-run, run * SWIPE_MAX_SLOPE + 1)).toBe("vertical");
  });
});
