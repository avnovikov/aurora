import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startWorkHold } from "../../src/ui/sessionWorkHold";
import type { ViewState } from "../../src/ui/sessionTypes";

const speakExactLine = vi.fn(async () => undefined);

vi.mock("../../src/voice/coachVoice", () => ({
  speakExactLine: (...args: unknown[]) => speakExactLine(...args),
}));

function blankState(): ViewState {
  return {
    phase: "work",
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

function fakeRoot(): {
  root: HTMLElement;
  left: { textContent: string };
  cue: { textContent: string };
} {
  const left = { textContent: "" };
  const cue = { textContent: "" };
  const root = {
    querySelector(selector: string) {
      if (selector === "[data-work-hold-left]") {
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

describe("startWorkHold", () => {
  beforeEach(() => {
    vi.stubGlobal("window", globalThis);
    vi.useFakeTimers();
    speakExactLine.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("counts down, speaks end cues, and completes once", () => {
    const { root, left } = fakeRoot();
    const onComplete = vi.fn();
    const state = blankState();
    startWorkHold(root, state, 6, { onComplete });

    expect(left.textContent).toBe("6");
    expect(state.holdLeft).toBe(6);

    vi.advanceTimersByTime(6000);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(speakExactLine.mock.calls.some((call) => call[0]?.id === "five")).toBe(true);
    expect(speakExactLine.mock.calls.some((call) => call[0]?.id === "hold_done")).toBe(
      true,
    );
    expect(state.holdLeft).toBe(0);
  });

  it("clear stops the clock without completing", () => {
    const { root } = fakeRoot();
    const onComplete = vi.fn();
    const handle = startWorkHold(root, blankState(), 12, { onComplete });
    handle.clear();
    vi.advanceTimersByTime(12_000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(speakExactLine).not.toHaveBeenCalled();
  });
});
