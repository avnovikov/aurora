import { describe, expect, it } from "vitest";
import { heartRateZone } from "../../src/pulse/hrZones";

/** Resting 60, max 180: reserve 120, so each 10% band is 12 bpm. */
const bounds = { restingBpm: 60, maxBpm: 180 };

describe("heartRateZone", () => {
  it("places a reading in one of five Karvonen bands", () => {
    expect(heartRateZone(131, bounds)).toBe("easy");
    expect(heartRateZone(132, bounds)).toBe("steady");
    expect(heartRateZone(143, bounds)).toBe("steady");
    expect(heartRateZone(144, bounds)).toBe("work");
    expect(heartRateZone(155, bounds)).toBe("work");
    expect(heartRateZone(156, bounds)).toBe("hard");
    expect(heartRateZone(167, bounds)).toBe("hard");
    expect(heartRateZone(168, bounds)).toBe("max");
  });

  it("keeps a pulse below resting in easy and a pulse above max in max", () => {
    expect(heartRateZone(40, bounds)).toBe("easy");
    expect(heartRateZone(200, bounds)).toBe("max");
  });

  it("rejects a reading or bounds that cannot form bands", () => {
    expect(() => heartRateZone(Number.NaN, bounds)).toThrow(/bpm/);
    expect(() => heartRateZone(120, { restingBpm: 180, maxBpm: 60 })).toThrow(/max/);
  });
});
