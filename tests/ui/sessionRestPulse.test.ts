/** @vitest-environment happy-dom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REST_ADD_SECONDS } from "../../src/ui/restPulse";
import { startRestTimer } from "../../src/ui/sessionRest";
import type { ViewState } from "../../src/ui/sessionTypes";
import type { HeartRateZone } from "../../src/pulse/hrZones";
import { REST_EXTEND, REST_GO_ON } from "../../src/voice/lines";
import { GET_READY_AT_SECONDS_LEFT } from "../../src/voice/restCue";

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

function countSpoken(text: string): number {
  return spokenTexts().filter((spoken) => spoken === text).length;
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

/** Only `restLeft` is read and written by the timer. */
function restState(restLeft: number): ViewState {
  return { restLeft } as ViewState;
}

function advanceSeconds(seconds: number): void {
  vi.advanceTimersByTime(seconds * 1000);
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

  it("asks on the first second above Get ready when the pulse is already steady", () => {
    const { root, cue } = restRoot();
    const handle = startRestTimer(
      root,
      restState(GET_READY_AT_SECONDS_LEFT + 2),
      true,
      vi.fn(),
      { readZone: () => "steady" },
    );

    advanceSeconds(1);
    expect(cue.textContent).toBe(REST_GO_ON.text);
    expect(countSpoken(REST_GO_ON.text)).toBe(1);

    handle.clear();
  });

  it("asks once when the pulse drops to steady, and does not ask again", () => {
    const { root, cue } = restRoot();
    let zone: HeartRateZone | null = "work";
    const handle = startRestTimer(root, restState(20), true, vi.fn(), {
      readZone: () => zone,
    });

    advanceSeconds(1);
    expect(countSpoken(REST_GO_ON.text)).toBe(0);

    zone = "steady";
    advanceSeconds(1);
    expect(cue.textContent).toBe(REST_GO_ON.text);
    expect(countSpoken(REST_GO_ON.text)).toBe(1);

    zone = "work";
    advanceSeconds(1);
    zone = "steady";
    advanceSeconds(5);
    expect(countSpoken(REST_GO_ON.text)).toBe(1);
    expect(cue.textContent).toBe(REST_GO_ON.text);

    handle.clear();
  });

  it("shows the go-on cue without speaking when voice is off", () => {
    const { root, cue } = restRoot();
    const handle = startRestTimer(root, restState(20), false, vi.fn(), {
      readZone: () => "steady",
    });

    advanceSeconds(1);
    expect(cue.textContent).toBe(REST_GO_ON.text);
    expect(speakExactLine).not.toHaveBeenCalled();

    handle.clear();
  });

  it("stays quiet when the pulse only settles inside Get ready", () => {
    const { root, cue } = restRoot();
    const onDone = vi.fn();
    const handle = startRestTimer(
      root,
      restState(GET_READY_AT_SECONDS_LEFT + 1),
      true,
      onDone,
      { readZone: () => "steady" },
    );

    advanceSeconds(GET_READY_AT_SECONDS_LEFT + 1);
    expect(countSpoken(REST_GO_ON.text)).toBe(0);
    expect(cue.textContent).not.toBe(REST_GO_ON.text);
    expect(onDone).toHaveBeenCalledTimes(1);

    handle.clear();
  });

  it("adds rest again on a second hot expiry, then ends once the pulse settles", () => {
    const { root, left, cue } = restRoot();
    let zone: HeartRateZone | null = "work";
    const onDone = vi.fn();
    const handle = startRestTimer(root, restState(1), true, onDone, {
      readZone: () => zone,
    });

    advanceSeconds(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(left.textContent).toBe(String(REST_ADD_SECONDS));
    expect(cue.textContent).toBe(REST_EXTEND.text);
    expect(countSpoken(REST_EXTEND.text)).toBe(1);

    advanceSeconds(REST_ADD_SECONDS);
    expect(onDone).not.toHaveBeenCalled();
    expect(left.textContent).toBe(String(REST_ADD_SECONDS));
    expect(countSpoken(REST_EXTEND.text)).toBe(2);

    zone = "steady";
    advanceSeconds(REST_ADD_SECONDS);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(countSpoken(REST_EXTEND.text)).toBe(2);

    handle.clear();
  });

  it("extends without speaking when voice is off", () => {
    const { root, left, cue } = restRoot();
    const onDone = vi.fn();
    const handle = startRestTimer(root, restState(1), false, onDone, {
      readZone: () => "work",
    });

    advanceSeconds(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(left.textContent).toBe(String(REST_ADD_SECONDS));
    expect(cue.textContent).toBe(REST_EXTEND.text);
    expect(speakExactLine).not.toHaveBeenCalled();

    handle.clear();
  });

  it("ends on the clock when there is no pulse", () => {
    const { root } = restRoot();
    const onDone = vi.fn();
    const state = restState(1);
    const handle = startRestTimer(root, state, true, onDone, {
      readZone: () => null,
    });

    advanceSeconds(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(state.restLeft).toBe(0);
    expect(countSpoken(REST_EXTEND.text)).toBe(0);
    expect(countSpoken(REST_GO_ON.text)).toBe(0);

    handle.clear();
  });

  it("ends immediately on finish while an extension is running", () => {
    const { root } = restRoot();
    const onDone = vi.fn();
    const state = restState(1);
    const handle = startRestTimer(root, state, true, onDone, {
      readZone: () => "hard",
    });

    advanceSeconds(1);
    expect(state.restLeft).toBe(REST_ADD_SECONDS);
    handle.finish();
    expect(state.restLeft).toBe(0);
    advanceSeconds(REST_ADD_SECONDS);
    expect(onDone).toHaveBeenCalledTimes(1);

    handle.clear();
  });

  it("calls onDone only once when finish is repeated", () => {
    const { root } = restRoot();
    const onDone = vi.fn();
    const handle = startRestTimer(root, restState(20), true, onDone, {
      readZone: () => null,
    });

    handle.finish();
    handle.finish();
    expect(onDone).toHaveBeenCalledTimes(1);

    handle.clear();
  });

  it("stops the interval when clear is called", () => {
    const { root } = restRoot();
    const onDone = vi.fn();
    const handle = startRestTimer(root, restState(30), true, onDone, {
      readZone: () => null,
    });

    handle.clear();
    advanceSeconds(60);
    expect(onDone).not.toHaveBeenCalled();
  });
});
