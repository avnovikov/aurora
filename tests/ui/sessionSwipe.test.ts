import { describe, expect, it } from "vitest";
import {
  backOnly,
  decideSwipeRelease,
  exitOffsetPx,
  forwardOnly,
  swipeAxis,
  SWIPE_MAX_SLOPE,
  SWIPE_RELEASE_ZONE_RATIO,
  withinSwipeAngle,
} from "../../src/ui/sessionSwipe";

describe("decideSwipeRelease", () => {
  const width = 300;
  const zone = width * SWIPE_RELEASE_ZONE_RATIO; // 60
  /** A left swipe from 80% of the width, let go at `releaseX`. */
  const left = (releaseX: number, deltaY = 0) =>
    decideSwipeRelease({ deltaX: releaseX - 240, deltaY, releaseX, width });

  it("commits a straight left swipe let go inside the left fifth", () => {
    expect(left(zone)).toEqual({ action: "commit", direction: "left" });
    expect(left(10)).toEqual({ action: "commit", direction: "left" });
  });

  it("snaps back when let go outside the left fifth, however far it went", () => {
    expect(left(zone + 1)).toEqual({ action: "cancel" });
    expect(left(width / 2)).toEqual({ action: "cancel" });
  });

  it("commits left-left-up and left-left-down (22.5 degrees)", () => {
    const dx = 240 - zone; // 180
    const rise = Math.round(dx * Math.tan(Math.PI / 8)); // 75
    expect(left(zone, -rise)).toEqual({ action: "commit", direction: "left" });
    expect(left(zone, rise)).toEqual({ action: "commit", direction: "left" });
  });

  it("snaps back up-left (45 degrees) and up-up-left (67.5 degrees)", () => {
    const dx = 240 - zone;
    expect(left(zone, -dx)).toEqual({ action: "cancel" });
    expect(left(zone, -Math.round(dx * Math.tan((3 * Math.PI) / 8)))).toEqual({
      action: "cancel",
    });
  });

  it("draws the angle line at slope 1:2", () => {
    expect(SWIPE_MAX_SLOPE).toBe(0.5);
    expect(left(zone, -90)).toEqual({ action: "commit", direction: "left" });
    expect(left(zone, -91)).toEqual({ action: "cancel" });
  });

  it("snaps back a short drag that starts inside the zone", () => {
    expect(decideSwipeRelease({ deltaX: -20, deltaY: 0, releaseX: 20, width })).toEqual({
      action: "cancel",
    });
  });

  it("mirrors for a right swipe: let go inside the right fifth", () => {
    expect(decideSwipeRelease({ deltaX: 200, deltaY: 0, releaseX: 250, width })).toEqual({
      action: "commit",
      direction: "right",
    });
    expect(decideSwipeRelease({ deltaX: 150, deltaY: 0, releaseX: 200, width })).toEqual({
      action: "cancel",
    });
  });

  it("rejects non-positive width", () => {
    expect(() =>
      decideSwipeRelease({ deltaX: 100, deltaY: 0, releaseX: 0, width: 0 }),
    ).toThrow(/positive/);
  });
});

describe("withinSwipeAngle", () => {
  it("allows a near-horizontal drag and rejects a diagonal one", () => {
    expect(withinSwipeAngle(-100, 40)).toBe(true);
    expect(withinSwipeAngle(-100, -100)).toBe(false);
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
