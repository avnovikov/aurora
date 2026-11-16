import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WarmupStep } from "../../src/rules/warmupPlan";
import { sideSwitchAt, startStationHold } from "../../src/ui/sessionWarmup";
import type { ViewState } from "../../src/ui/sessionTypes";

function step(partial: Partial<WarmupStep>): WarmupStep {
  return {
    stationId: "s",
    exerciseId: "s",
    name: "Station",
    region: "legs",
    holdSeconds: 10,
    gapSecondsAfter: 0,
    cues: [],
    ...partial,
  };
}

interface FakeNode {
  textContent: string;
  hidden: boolean;
  querySelector: (selector: string) => FakeNode | null;
}

function node(children: Record<string, FakeNode> = {}): FakeNode {
  return { textContent: "", hidden: true, querySelector: (selector) => children[selector] ?? null };
}

/** Minimal stand-in for the station screen: countdown and the change-side banner. */
function rootWithBanner(): HTMLElement {
  const banner = node({ "[data-side-switch-left]": node() });
  const root = node({ "[data-warmup-left]": node(), "[data-side-switch]": banner });
  return root as unknown as HTMLElement;
}

describe("startStationHold side switch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("switches only per-side stations, halfway", () => {
    expect(sideSwitchAt(step({ perSide: true, holdSeconds: 60 }))).toBe(30);
    expect(sideSwitchAt(step({ holdSeconds: 60 }))).toBeNull();
  });

  it("pauses the hold 5 s halfway and says change side once", () => {
    const root = rootWithBanner();
    const onAdvance = vi.fn();
    const onSideSwitch = vi.fn();
    const state = { phase: "warmup", restLeft: 0 } as ViewState;
    startStationHold(root, step({ perSide: true }), state, "warmup", {
      onAdvance,
      onPaint: vi.fn(),
      onRestGap: vi.fn(),
      onSideSwitch,
    });
    const banner = root.querySelector("[data-side-switch]") as HTMLElement;
    vi.advanceTimersByTime(5000);
    expect(onSideSwitch).toHaveBeenCalledTimes(1);
    expect(banner.hidden).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(banner.hidden).toBe(true);
    expect(root.querySelector("[data-warmup-left]")?.textContent).toBe("5");
    expect(onAdvance).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(onSideSwitch).toHaveBeenCalledTimes(1);
  });

  it("runs a one-sided station straight through", () => {
    const onAdvance = vi.fn();
    const onSideSwitch = vi.fn();
    startStationHold(rootWithBanner(), step({}), { phase: "warmup" } as ViewState, "warmup", {
      onAdvance,
      onPaint: vi.fn(),
      onRestGap: vi.fn(),
      onSideSwitch,
    });
    vi.advanceTimersByTime(10000);
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(onSideSwitch).not.toHaveBeenCalled();
  });
});
