import { describe, expect, it } from "vitest";
import { cueSchedule } from "../../src/voice/restCue";

/**
 * Warm-up station gaps call startRest without timedNext, so the default
 * schedule must include 5→1 then go (same contract as a short voiced rest).
 */
describe("warmup station gap countdown", () => {
  it("schedules five through one then go for a short warm-up gap", () => {
    const events = cueSchedule(5, { random: () => 0 });

    expect(events.map((event) => event.atSecondsLeft)).toEqual([5, 4, 3, 2, 1, 0]);
    expect(events.filter((event) => event.kind === "count").map((event) => event.lineId)).toEqual([
      "five",
      "four",
      "three",
      "two",
      "one",
    ]);
    expect(events.at(-1)?.kind).toBe("go");
  });
});
