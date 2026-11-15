import { describe, expect, it } from "vitest";
import {
  holdCueSchedule,
  MIN_HOLD_SECONDS_FOR_HALFWAY,
} from "../../src/voice/holdCue";

describe("holdCueSchedule", () => {
  it("skips holds shorter than the minimum", () => {
    expect(holdCueSchedule(MIN_HOLD_SECONDS_FOR_HALFWAY - 1, () => 0)).toEqual([]);
  });

  it("schedules one halfway cue at the minimum hold length", () => {
    const events = holdCueSchedule(MIN_HOLD_SECONDS_FOR_HALFWAY, () => 0);
    expect(events).toHaveLength(1);
    expect(events[0]?.atSecondsLeft).toBe(3);
    expect(events[0]?.lineId).toBe("halfway");
    expect(events[0]?.assetKey).toBe("halfway");
    expect(events[0]?.text).toMatch(/halfway|half/i);
  });

  it("schedules one halfway cue at ceil(half) remaining", () => {
    const events = holdCueSchedule(12, () => 0);
    expect(events).toHaveLength(1);
    expect(events[0]?.atSecondsLeft).toBe(6);
  });

  it("rounds odd holds up for the mid second", () => {
    expect(holdCueSchedule(11, () => 0)[0]?.atSecondsLeft).toBe(6);
  });

  it("rejects fractional and negative hold seconds", () => {
    expect(() => holdCueSchedule(6.5)).toThrow("non-negative integer");
    expect(() => holdCueSchedule(-1)).toThrow("non-negative integer");
  });
});
