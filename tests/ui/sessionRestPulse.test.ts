/** @vitest-environment happy-dom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startRestTimer } from "../../src/ui/sessionRest";
import type { ViewState } from "../../src/ui/sessionTypes";
import type { HeartRateZone } from "../../src/pulse/hrZones";
import { REST_EXTEND, REST_GO_ON } from "../../src/voice/lines";

const speakExactLine = vi.fn(async () => undefined);

vi.mock("../../src/voice/coachVoice", () => ({
  speakExactLine: (...args: unknown[]) => speakExactLine(...args),
}));

function spokenTexts(): string[] {
  return speakExactLine.mock.calls.map((call) => {
    const line = call[0] as { text?: string };
    return line.text ?? "";
  });
}

function restRoot(): {
  root: HTMLElement;
  left: { textContent: string };
  cue: { textContent: string };
} {
  const left = { textContent: "" };
  const cue = { textContent: "" };
  const root = {
    querySelector(selector: string) {
      if (selector === "[data-rest-left]") {
        return left;
      }
      if (selector === "[data-rest-cue]") {
        return cue;
      }
      return null;
    },
  } as unknown as HTMLElement;
  return { root, left, cue };
}

function restState(restLeft: number): ViewState {
  return { restLeft } as ViewState;
}

describe("rest pulse", () => {
  beforeEach(() => {
    vi.stubGlobal("window", globalThis);
    vi.useFakeTimers();
    speakExactLine.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("asks once when the pulse drops to steady with more than 10 seconds left", () => {
    const { root, cue } = restRoot();
    let zone: HeartRateZone | null = "work";
    const handle = startRestTimer(root, restState(20), true, vi.fn(), {
      readZone: () => zone,
    });

    vi.advanceTimersByTime(1000);
    expect(spokenTexts()).not.toContain(REST_GO_ON.text);

    zone = "steady";
    vi.advanceTimersByTime(1000);
    expect(cue.textContent).toBe(REST_GO_ON.text);
    expect(spokenTexts().filter((text) => text === REST_GO_ON.text)).toEqual([
      REST_GO_ON.text,
    ]);

    zone = "work";
    vi.advanceTimersByTime(1000);
    zone = "steady";
    vi.advanceTimersByTime(5000);
    expect(spokenTexts().filter((text) => text === REST_GO_ON.text)).toHaveLength(1);
    expect(cue.textContent).toBe(REST_GO_ON.text);

    handle.clear();
  });

  it("stays quiet when the pulse only settles inside the last 10 seconds", () => {
    const { root, cue } = restRoot();
    const onDone = vi.fn();
    const handle = startRestTimer(root, restState(11), true, onDone, {
      readZone: () => "steady",
    });

    vi.advanceTimersByTime(11_000);
    expect(spokenTexts()).not.toContain(REST_GO_ON.text);
    expect(cue.textContent).not.toBe(REST_GO_ON.text);
    expect(onDone).toHaveBeenCalledTimes(1);

    handle.clear();
  });

  it("adds 30 seconds at expiry while the pulse stays above steady, then stops once it settles", () => {
    const { root, left, cue } = restRoot();
    let zone: HeartRateZone | null = "work";
    const onDone = vi.fn();
    const handle = startRestTimer(root, restState(1), true, onDone, {
      readZone: () => zone,
    });

    vi.advanceTimersByTime(1000);
    expect(onDone).not.toHaveBeenCalled();
    expect(left.textContent).toBe("30");
    expect(cue.textContent).toBe(REST_EXTEND.text);
    expect(spokenTexts().filter((text) => text === REST_EXTEND.text)).toEqual([
      REST_EXTEND.text,
    ]);

    vi.advanceTimersByTime(30_000);
    expect(onDone).not.toHaveBeenCalled();
    expect(left.textContent).toBe("30");
    expect(spokenTexts().filter((text) => text === REST_EXTEND.text)).toHaveLength(2);

    zone = "steady";
    vi.advanceTimersByTime(30_000);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(spokenTexts().filter((text) => text === REST_EXTEND.text)).toHaveLength(2);

    handle.clear();
  });

  it("ends on the clock when there is no pulse", () => {
    const { root } = restRoot();
    const onDone = vi.fn();
    const state = restState(1);
    const handle = startRestTimer(root, state, true, onDone, {
      readZone: () => null,
    });

    vi.advanceTimersByTime(1000);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(state.restLeft).toBe(0);
    expect(spokenTexts()).not.toContain(REST_EXTEND.text);
    expect(spokenTexts()).not.toContain(REST_GO_ON.text);

    handle.clear();
  });

  it("still ends immediately on finish while an extension is running", () => {
    const { root } = restRoot();
    const onDone = vi.fn();
    const handle = startRestTimer(root, restState(1), true, onDone, {
      readZone: () => "hard",
    });

    vi.advanceTimersByTime(1000);
    handle.finish();
    vi.advanceTimersByTime(30_000);
    expect(onDone).toHaveBeenCalledTimes(1);

    handle.clear();
  });
});
