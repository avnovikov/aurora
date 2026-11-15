import { describe, expect, it } from "vitest";
import { SESSION_TEMPLATES } from "../../src/data/seed";
import {
  requireWarmupStation,
  WARMUP_STATION_BY_ID,
  WARMUP_STATIONS,
} from "../../src/data/warmupStations";

describe("warmupStations", () => {
  it("lists dedicated stations with positive hold timings", () => {
    expect(WARMUP_STATIONS.length).toBeGreaterThan(0);
    for (const station of WARMUP_STATIONS) {
      expect(station.holdSeconds).toBeGreaterThan(0);
      expect(station.cues.length).toBeGreaterThan(0);
      expect(WARMUP_STATION_BY_ID[station.id]).toBe(station);
    }
  });

  it("covers every template warmupStationIds entry", () => {
    for (const template of SESSION_TEMPLATES) {
      for (const id of template.warmupStationIds) {
        expect(() => requireWarmupStation(id)).not.toThrow();
      }
    }
  });
});
