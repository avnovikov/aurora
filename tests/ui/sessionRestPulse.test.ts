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

function countSpokenById(lineId: string): number {
  return speakExactLine.mock.calls.filter((call) => {
    const line = call[0] as { id?: string };
    return line.id === lineId;
  }).length;
}

function restRoot(): {
  root: HTMLElement;
  left: { textContent: string };
  cue: {
    textContent: string;
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
    hasAttribute(name: string): boolean;
  };
} {
  const left = { textContent: "" };
  const attrs = new Map<string, string>();
  const cue = {
    textContent: "",
    getAttribute(name: string) {
      return attrs.has(name) ? attrs.get(name)! : null;
    },
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    removeAttribute(name: string) {
      attrs.delete(name);
    },
    hasAttribute(name: string) {
      return attrs.has(name);
    },
  };
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

  it("asks on the first second above Get ready when the pulse is already easy", () => {
    const { root, cue } = restRoot();
    const handle = startRestTimer(
      root,
      restState(GET_READY_AT_SECONDS_LEFT + 2),
      true,
      vi.fn(),
      { readZone: () => "easy" },
    );

    advanceSeconds(1);
    expect(cue.textContent).toBe(REST_GO_ON.text);
    expect(countSpoken(REST_GO_ON.text)).toBe(1);
    expect(cue.hasAttribute("data-rest-cue-latch")).toBe(true);

    handle.clear();
  });

  it("asks once when the pulse drops to easy, and does not ask again", () => {
    const { root, cue } = restRoot();
    let zone: HeartRateZone | null = "work";
    const handle = startRestTimer(root, restState(20), true, vi.fn(), {
      readZone: () => zone,
    });

    advanceSeconds(1);
    expect(countSpoken(REST_GO_ON.text)).toBe(0);

    zone = "easy";
    advanceSeconds(1);
    expect(cue.textContent).toBe(REST_GO_ON.text);
    expect(countSpoken(REST_GO_ON.text)).toBe(1);
    expect(cue.hasAttribute("data-rest-cue-latch")).toBe(true);

    zone = "work";
    advanceSeconds(1);
    zone = "easy";
    advanceSeconds(5);
    expect(countSpoken(REST_GO_ON.text)).toBe(1);
    expect(cue.textContent).toBe(REST_GO_ON.text);

    handle.clear();
  });

  it("does not offer go-on when the pulse is only steady", () => {
    const { root, cue } = restRoot();
    const handle = startRestTimer(root, restState(20), true, vi.fn(), {
      readZone: () => "steady",
    });

    advanceSeconds(5);
    expect(countSpoken(REST_GO_ON.text)).toBe(0);
    expect(cue.textContent).not.toBe(REST_GO_ON.text);
    expect(cue.hasAttribute("data-rest-cue-latch")).toBe(false);

    handle.clear();
  });

  it("shows the go-on cue without speaking when voice is off", () => {
    const { root, cue } = restRoot();
    const handle = startRestTimer(root, restState(20), false, vi.fn(), {
      readZone: () => "easy",
    });

    advanceSeconds(1);
    expect(cue.textContent).toBe(REST_GO_ON.text);
    expect(speakExactLine).not.toHaveBeenCalled();
    expect(cue.hasAttribute("data-rest-cue-latch")).toBe(true);

    handle.clear();
  });

  it("keeps the cue latch after go-on when Get ready is voice-only", () => {
    const { root, cue } = restRoot();
    const handle = startRestTimer(
      root,
      restState(GET_READY_AT_SECONDS_LEFT + 2),
      true,
      vi.fn(),
      { readZone: () => "easy" },
    );

    advanceSeconds(1);
    expect(cue.textContent).toBe(REST_GO_ON.text);
    expect(cue.hasAttribute("data-rest-cue-latch")).toBe(true);

    advanceSeconds(1);
    // Schedule lines (Get ready) no longer paint; go-on held text + latch remain.
    expect(cue.textContent).toBe(REST_GO_ON.text);
    expect(cue.hasAttribute("data-rest-cue-latch")).toBe(true);

    handle.clear();
  });

  it("speaks get ready / 5→1 / go with an empty cue when pulse offers no go-on", () => {
    const { root, cue } = restRoot();
    const onDone = vi.fn();
    // Start at 11 so the first tick lands on get_ready (10); no easy zone → no go-on paint.
    const handle = startRestTimer(
      root,
      restState(GET_READY_AT_SECONDS_LEFT + 1),
      true,
      onDone,
      { readZone: () => null },
    );

    expect(cue.textContent).toBe("");

    advanceSeconds(1);
    expect(cue.textContent).toBe("");
    expect(countSpokenById("get_ready")).toBe(1);

    advanceSeconds(5);
    expect(cue.textContent).toBe("");
    expect(countSpokenById("five")).toBe(1);

    for (const id of ["four", "three", "two", "one"] as const) {
      advanceSeconds(1);
      expect(cue.textContent).toBe("");
      expect(countSpokenById(id)).toBe(1);
    }

    advanceSeconds(1);
    expect(countSpokenById("go")).toBe(1);
    expect(onDone).toHaveBeenCalledTimes(1);

    handle.clear();
  });

  it("still paints go-on and +30 held cues on the rest cue line", () => {
    const goOn = restRoot();
    const goOnHandle = startRestTimer(
      goOn.root,
      restState(GET_READY_AT_SECONDS_LEFT + 2),
      true,
      vi.fn(),
      { readZone: () => "easy" },
    );
    advanceSeconds(1);
    expect(goOn.cue.textContent).toBe(REST_GO_ON.text);
    goOnHandle.clear();

    const extend = restRoot();
    const extendHandle = startRestTimer(
      extend.root,
      restState(1),
      true,
      vi.fn(),
      { readZone: () => "work" },
    );
    advanceSeconds(1);
    expect(extend.cue.textContent).toBe(REST_EXTEND.text);
    extendHandle.clear();
  });

  it("clears the cue latch on finish", () => {
    const { root, cue } = restRoot();
    const handle = startRestTimer(root, restState(20), true, vi.fn(), {
      readZone: () => "easy",
    });

    advanceSeconds(1);
    expect(cue.hasAttribute("data-rest-cue-latch")).toBe(true);
    handle.finish();
    expect(cue.hasAttribute("data-rest-cue-latch")).toBe(false);

    handle.clear();
  });

  it("clears the cue latch on clear", () => {
    const { root, cue } = restRoot();
    const handle = startRestTimer(root, restState(20), true, vi.fn(), {
      readZone: () => "easy",
    });

    advanceSeconds(1);
    expect(cue.hasAttribute("data-rest-cue-latch")).toBe(true);
    handle.clear();
    expect(cue.hasAttribute("data-rest-cue-latch")).toBe(false);
  });

  it("stays quiet when the pulse only settles inside Get ready", () => {
    const { root, cue } = restRoot();
    const onDone = vi.fn();
    const handle = startRestTimer(
      root,
      restState(GET_READY_AT_SECONDS_LEFT + 1),
      true,
      onDone,
      { readZone: () => "easy" },
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

  describe("go cue at zero", () => {
    function startRest(options: {
      restLeft: number;
      withVoice: boolean;
      timedNext?: boolean;
      readZone?: () => HeartRateZone | null;
    }) {
      const { root } = restRoot();
      const onDone = vi.fn();
      const handle = startRestTimer(
        root,
        restState(options.restLeft),
        options.withVoice,
        onDone,
        {
          timedNext: options.timedNext,
          readZone: options.readZone ?? (() => null),
        },
      );
      return { handle, onDone };
    }

    it("speaks go when rest reaches zero", () => {
      const { handle, onDone } = startRest({
        restLeft: 1,
        withVoice: true,
      });

      advanceSeconds(1);
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(countSpokenById("go")).toBe(1);

      handle.clear();
    });

    it("speaks go when a short timed-next rest reaches zero", () => {
      const { handle, onDone } = startRest({
        restLeft: 2,
        withVoice: true,
        timedNext: true,
      });

      advanceSeconds(2);
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(countSpokenById("go")).toBe(1);

      handle.clear();
    });

    it("stays silent at zero when voice is off", () => {
      const { handle, onDone } = startRest({
        restLeft: 2,
        withVoice: false,
        timedNext: true,
      });

      advanceSeconds(2);
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(speakExactLine).not.toHaveBeenCalled();

      handle.clear();
    });

    it("does not speak go when the athlete finishes rest early", () => {
      const { handle, onDone } = startRest({
        restLeft: 10,
        withVoice: true,
        timedNext: true,
      });

      advanceSeconds(1);
      handle.finish();
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(countSpokenById("go")).toBe(0);

      handle.clear();
    });

    it("does not speak go when a hot expiry extends the rest", () => {
      const { handle, onDone } = startRest({
        restLeft: 1,
        withVoice: true,
        readZone: () => "work",
      });

      advanceSeconds(1);
      expect(onDone).not.toHaveBeenCalled();
      expect(countSpokenById("go")).toBe(0);
      expect(countSpoken(REST_EXTEND.text)).toBe(1);

      handle.clear();
    });
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
