import { describe, expect, it } from "vitest";
import {
  PULSE_LOST_REPEAT_MS,
  PULSE_LOST_SHOUT_MS,
  PULSE_LOST_UI_MS,
  shouldShowPulseLost,
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

const LAST_VALID_AT = 10_000;

describe("shouldShowPulseLost", () => {
  it("does not mark lost when disconnected or never read", () => {
    expect(shouldShowPulseLost(pulseState({ connected: false }), 10_000)).toBe(
      false,
    );
    expect(
      shouldShowPulseLost(pulseState({ lastValidAtMs: null }), 10_000),
    ).toBe(false);
  });

  it("waits five seconds of silence before coral lost styling", () => {
    const state = pulseState({ lastValidAtMs: LAST_VALID_AT });

    expect(shouldShowPulseLost(state, LAST_VALID_AT + PULSE_LOST_UI_MS - 1)).toBe(
      false,
    );
    expect(shouldShowPulseLost(state, LAST_VALID_AT + PULSE_LOST_UI_MS)).toBe(
      true,
    );
  });
});

describe("shouldShoutPulseLost", () => {
  it("does not shout when the watch is disconnected or has no valid pulse", () => {
    expect(shouldShoutPulseLost(pulseState({ connected: false }), 10_000)).toBe(
      false,
    );
    expect(
      shouldShoutPulseLost(pulseState({ lastValidAtMs: null }), 10_000),
    ).toBe(false);
  });

  it("waits fifteen seconds of silence before the first shout", () => {
    const state = pulseState({ lastValidAtMs: LAST_VALID_AT });

    expect(
      shouldShoutPulseLost(state, LAST_VALID_AT + PULSE_LOST_SHOUT_MS - 1),
    ).toBe(false);
    expect(shouldShoutPulseLost(state, LAST_VALID_AT + PULSE_LOST_SHOUT_MS)).toBe(
      true,
    );
  });

  it("keeps coral available before the voice fires", () => {
    const state = pulseState({ lastValidAtMs: LAST_VALID_AT });
    const midGap = LAST_VALID_AT + PULSE_LOST_UI_MS + 3_000;

    expect(shouldShowPulseLost(state, midGap)).toBe(true);
    expect(shouldShoutPulseLost(state, midGap)).toBe(false);
  });

  it("repeats the shout only after fifteen seconds since the last one", () => {
    const lastShoutAtMs = LAST_VALID_AT + PULSE_LOST_SHOUT_MS + 5_000;
    const state = pulseState({
      lastValidAtMs: LAST_VALID_AT,
      lastShoutAtMs,
    });

    expect(shouldShoutPulseLost(state, lastShoutAtMs + PULSE_LOST_REPEAT_MS - 1)).toBe(
      false,
    );
    expect(shouldShoutPulseLost(state, lastShoutAtMs + PULSE_LOST_REPEAT_MS)).toBe(
      true,
    );
  });
});
