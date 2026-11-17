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

  it("never says hold over a rep station", () => {
    for (let i = 0; i < 10; i += 1) {
      const [event] = holdCueSchedule(30, () => i / 10, "reps");
      expect(event?.text).not.toMatch(/\bhold\b/i);
    }
  });

  it("can say keep the reps coming over a rep station, never over a hold", () => {
    const pick = (effort: "reps" | "hold") =>
      [0, 0.34, 0.67, 0.99].map((r) => holdCueSchedule(30, () => r, effort)[0]?.text ?? "");
    expect(pick("reps").some((text) => /reps coming/.test(text))).toBe(true);
    expect(pick("hold").some((text) => /reps/.test(text))).toBe(false);
  });

  it("can say hold over a hold station", () => {
    const texts = [0, 0.5, 0.99].map((r) => holdCueSchedule(30, () => r, "hold")[0]?.text);
    expect(texts.some((text) => /\bhold\b/i.test(text ?? ""))).toBe(true);
  });
});
