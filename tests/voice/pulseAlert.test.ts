import { describe, expect, it } from "vitest";
import {
  shouldShoutPulseLost,
  type PulseWatchState,
} from "../../src/voice/pulseAlert";

function pulseState(overrides: Partial<PulseWatchState> = {}): PulseWatchState {
  return {
    connected: true,
    lastValidAtMs: 1000,
    lastShoutAtMs: null,
    ...overrides,
  };
}

describe("shouldShoutPulseLost", () => {
  it("does not shout when the watch is disconnected or has no valid pulse", () => {
    expect(shouldShoutPulseLost(pulseState({ connected: false }), 10_000)).toBe(
      false,
    );
    expect(
      shouldShoutPulseLost(pulseState({ lastValidAtMs: null }), 10_000),
    ).toBe(false);
  });

  it("waits five seconds of silence before the first shout", () => {
    const state = pulseState({ lastValidAtMs: 10_000 });

    expect(shouldShoutPulseLost(state, 14_999)).toBe(false);
    expect(shouldShoutPulseLost(state, 15_000)).toBe(true);
  });

  it("repeats the shout only after fifteen seconds since the last one", () => {
    const state = pulseState({
      lastValidAtMs: 10_000,
      lastShoutAtMs: 20_000,
    });

    expect(shouldShoutPulseLost(state, 34_999)).toBe(false);
    expect(shouldShoutPulseLost(state, 35_000)).toBe(true);
  });
});