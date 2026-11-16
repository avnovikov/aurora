import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WarmupStep } from "../../src/rules/warmupPlan";
import { startStationHold } from "../../src/ui/sessionWarmup";
import type { ViewState } from "../../src/ui/sessionTypes";

const speakExactLine = vi.fn(async () => undefined);

vi.mock("../../src/voice/coachVoice", () => ({
  speakExactLine: (...args: unknown[]) => speakExactLine(...args),
}));

function step(holdSeconds: number): WarmupStep {
  return {
    stationId: "test_hold",
    name: "Test hold",
    region: "core",
    holdSeconds,
    gapSecondsAfter: 0,
    cues: [],
    source: "",
  };
}

function blankState(): ViewState {
  return {
    phase: "warmup",
    warmupIndex: 0,
    workIndex: 0,
    setIndex: 1,
    cooldownIndex: 0,
    restLeft: 0,
    workState: null,
    log: { entries: [] },
    bpm: null,
    pulse: { connected: false, lastValidAtMs: null, lastShoutAtMs: null },
    pulseStatus: null,
    startedAtMs: Date.now(),
    plannedTotalSeconds: 0,
  };
}

/** Minimal DOM stand-in — vitest here has no document. */
function fakeRoot(): {
  root: HTMLElement;
  left: { textContent: string };
  cue: { textContent: string };
} {
  const left = { textContent: "" };
  const cue = { textContent: "" };
  const root = {
    querySelector(selector: string) {
      if (selector === "[data-warmup-left]") {
        return left;
      }
      if (selector === "[data-hold-cue]") {
        return cue;
      }
      return null;
    },
  } as unknown as HTMLElement;
  return { root, left, cue };
}

describe("startStationHold halfway cue", () => {
  beforeEach(() => {
    vi.stubGlobal("window", globalThis);
    vi.useFakeTimers();
    speakExactLine.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows and speaks the halfway line once, then advances", () => {
    const { root, left, cue } = fakeRoot();
    const onAdvance = vi.fn();
    const handle = startStationHold(root, step(6), blankState(), "warmup", {
      onRestGap: vi.fn(),
      onAdvance,
      onPaint: vi.fn(),
    });

    expect(left.textContent).toBe("6");

    vi.advanceTimersByTime(3000);
    expect(left.textContent).toBe("3");
    expect(cue.textContent).toMatch(/halfway|half/i);
    expect(speakExactLine).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3000);
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(speakExactLine).toHaveBeenCalledTimes(1);

    handle?.clear();
  });

  it("leaves the halfway cue to Change side on a per-side station", () => {
    const { root, cue } = fakeRoot();
    const onSideSwitch = vi.fn();
    const handle = startStationHold(root, { ...step(12), perSide: true }, blankState(), "warmup", {
      onRestGap: vi.fn(),
      onAdvance: vi.fn(),
      onPaint: vi.fn(),
      onSideSwitch,
    });
    vi.advanceTimersByTime(30_000);
    expect(onSideSwitch).toHaveBeenCalledTimes(1);
    expect(speakExactLine).not.toHaveBeenCalled();
    expect(cue.textContent).toBe("");
    handle?.clear();
  });

  it("clears the interval through the returned handle", () => {
    const { root } = fakeRoot();
    const onAdvance = vi.fn();
    const handle = startStationHold(root, step(12), blankState(), "warmup", {
      onRestGap: vi.fn(),
      onAdvance,
      onPaint: vi.fn(),
    });
    handle?.clear();
    vi.advanceTimersByTime(12_000);
    expect(onAdvance).not.toHaveBeenCalled();
    expect(speakExactLine).not.toHaveBeenCalled();
  });
});
