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
    exerciseId: "test_hold",
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
    holdLeft: 0,
    sideSwitchLeft: 0,
    workState: null,
    log: { entries: [] },
    bpm: null,
    pulse: { connected: false, lastValidAtMs: null, lastShoutAtMs: null },
    pulseStatus: null,
    startedAtMs: Date.now(),
    plannedTotalSeconds: 0,
    addWeightKg: 0,
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

  it("on a long warmup hold, speaks halfway then 5→1 and hold_done", () => {
    const { root, left, cue } = fakeRoot();
    const onAdvance = vi.fn();
    const handle = startStationHold(root, step(12), blankState(), "warmup", {
      onRestGap: vi.fn(),
      onAdvance,
      onPaint: vi.fn(),
    });

    expect(left.textContent).toBe("12");

    vi.advanceTimersByTime(6000);
    expect(left.textContent).toBe("6");
    expect(cue.textContent).toMatch(/halfway|half/i);
    expect(speakExactLine).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000); // 5
    expect(speakExactLine.mock.calls.at(-1)?.[0]).toMatchObject({ id: "five" });
    vi.advanceTimersByTime(1000); // 4
    expect(speakExactLine.mock.calls.at(-1)?.[0]).toMatchObject({ id: "four" });
    vi.advanceTimersByTime(1000); // 3
    expect(speakExactLine.mock.calls.at(-1)?.[0]).toMatchObject({ id: "three" });
    vi.advanceTimersByTime(1000); // 2
    expect(speakExactLine.mock.calls.at(-1)?.[0]).toMatchObject({ id: "two" });
    vi.advanceTimersByTime(1000); // 1
    expect(speakExactLine.mock.calls.at(-1)?.[0]).toMatchObject({ id: "one" });
    vi.advanceTimersByTime(1000); // 0 hold_done
    expect(speakExactLine.mock.calls.at(-1)?.[0]).toMatchObject({ id: "hold_done" });
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(speakExactLine).toHaveBeenCalledTimes(7);

    handle?.clear();
  });

  it("on a short warmup hold, speaks 5→1 and hold_done without halfway", () => {
    const { root, cue } = fakeRoot();
    const onAdvance = vi.fn();
    startStationHold(root, step(6), blankState(), "warmup", {
      onRestGap: vi.fn(),
      onAdvance,
      onPaint: vi.fn(),
    });

    vi.advanceTimersByTime(6000);
    expect(onAdvance).toHaveBeenCalledTimes(1);
    const ids = speakExactLine.mock.calls.map((call) => call[0]?.id);
    expect(ids).toEqual(["five", "four", "three", "two", "one", "hold_done"]);
    expect(cue.textContent).not.toMatch(/halfway|half/i);
  });

  it("keeps cool-down holds silent at the end (halfway only when long enough)", () => {
    const { root } = fakeRoot();
    const onAdvance = vi.fn();
    startStationHold(root, step(6), blankState(), "cooldown", {
      onRestGap: vi.fn(),
      onAdvance,
      onPaint: vi.fn(),
    });

    vi.advanceTimersByTime(3000);
    expect(speakExactLine).toHaveBeenCalledTimes(1);
    expect(speakExactLine.mock.calls[0]?.[0]).toMatchObject({
      id: expect.stringMatching(/halfway/),
    });

    vi.advanceTimersByTime(3000);
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(speakExactLine).toHaveBeenCalledTimes(1);
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
