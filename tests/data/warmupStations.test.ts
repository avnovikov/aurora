import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { SESSION_TEMPLATES } from "../../src/data/seed";
import {
  requireWarmupStation,
  STATION_PHASES,
  stationsFor,
  WARMUP_STATION_BY_ID,
  WARMUP_STATIONS,
} from "../../src/data/warmupStations";
import { buildCooldownView, buildWarmupView, warmupViewSeconds } from "../../src/rules/warmupPlan";

const SEED_STATION_IDS = [
  "pulse_raiser_march",
  "hip_circles",
  "ankle_rocks",
  "wrist_load",
  "scap_pushup",
  "glute_bridge",
];

function template(id: string) {
  const found = SESSION_TEMPLATES.find((item) => item.id === id);
  if (!found) {
    throw new Error(`missing template ${id}`);
  }
  return found;
}

describe("warmupStations", () => {
  it("lists stations with positive holds, cues and a source citation", () => {
    expect(WARMUP_STATIONS.length).toBeGreaterThan(0);
    for (const station of WARMUP_STATIONS) {
      expect(station.holdSeconds, station.id).toBeGreaterThan(0);
      expect(station.cues.length, station.id).toBeGreaterThan(0);
      expect(station.source.length, station.id).toBeGreaterThan(0);
      expect(WARMUP_STATION_BY_ID[station.id]).toBe(station);
    }
  });

  it("references Library exercises and takes their names", () => {
    for (const station of WARMUP_STATIONS) {
      const exercise = EXERCISE_GRAPH[station.exerciseId];
      expect(exercise, station.id).toBeDefined();
      expect(station.name).toBe(exercise?.name);
    }
  });

  it("keeps the seed station ids and their hand-written cues", () => {
    for (const id of SEED_STATION_IDS) {
      expect(() => requireWarmupStation(id)).not.toThrow();
    }
    expect(requireWarmupStation("ankle_rocks").cues).toContain(
      "Heel stays down as long as possible",
    );
  });

  it("covers every template warm-up and cool-down entry", () => {
    for (const item of SESSION_TEMPLATES) {
      for (const id of [...item.warmupStationIds, ...item.cooldownStationIds]) {
        expect(() => requireWarmupStation(id), `${item.id}: ${id}`).not.toThrow();
      }
    }
  });

  it("starts every warm-up with the shared Raise and keeps RAMP order", () => {
    for (const item of SESSION_TEMPLATES) {
      expect(item.warmupStationIds.slice(0, 2), item.id).toEqual([
        "pulse_raiser_march",
        "ntc_jumping_jacks",
      ]);
      const ranks = item.warmupStationIds.map((id) =>
        STATION_PHASES.indexOf(requireWarmupStation(id).phase),
      );
      expect(ranks, item.id).toEqual([...ranks].sort((a, b) => a - b));
      expect(ranks.every((rank) => rank < STATION_PHASES.indexOf("cooldown")), item.id).toBe(
        true,
      );
    }
  });

  it("keeps every warm-up between 7 and 10 minutes", () => {
    for (const item of SESSION_TEMPLATES) {
      const steps = buildWarmupView(stationsFor(item.warmupStationIds, item.warmupHoldSeconds));
      const seconds = warmupViewSeconds(steps);
      expect(seconds, item.id).toBeGreaterThanOrEqual(7 * 60);
      expect(seconds, item.id).toBeLessThanOrEqual(10 * 60);
    }
  });

  it("keeps every cool-down to stretches of 30–60 s, at most 5 minutes", () => {
    for (const item of SESSION_TEMPLATES) {
      const stations = stationsFor(item.cooldownStationIds);
      for (const station of stations) {
        expect(station.phase, station.id).toBe("cooldown");
        expect(station.holdSeconds, station.id).toBeGreaterThanOrEqual(30);
        expect(station.holdSeconds, station.id).toBeLessThanOrEqual(60);
      }
      expect(warmupViewSeconds(buildCooldownView(stations)), item.id).toBeLessThanOrEqual(5 * 60);
    }
  });

  it("gives Mobility no cool-down (the session is the stretching)", () => {
    expect(template("tmpl_mobility").cooldownStationIds).toEqual([]);
  });

  it("puts bar stations only in the Bars template", () => {
    for (const item of SESSION_TEMPLATES) {
      if (item.id === "tmpl_bars") {
        continue;
      }
      for (const station of stationsFor(item.warmupStationIds)) {
        expect(EXERCISE_GRAPH[station.exerciseId]?.requires ?? [], `${item.id}: ${station.id}`).not.toContain(
          "bar",
        );
      }
    }
  });

  it("applies per-template hold overrides", () => {
    const full = template("tmpl_full");
    const [ankle] = stationsFor(["ankle_rocks"], full.warmupHoldSeconds);
    expect(ankle?.holdSeconds).toBe(45);
    expect(requireWarmupStation("ankle_rocks").holdSeconds).toBe(60);
  });

  it("matches the design's Skill warm-up and cool-down lists", () => {
    const skill = template("tmpl_skill_hs");
    expect(skill.warmupStationIds).toEqual([
      "pulse_raiser_march",
      "ntc_jumping_jacks",
      "hf_167",
      "wger_2680",
      "hf_152",
      "fedb_childs_pose",
      "scap_pushup",
      "hollow_hold",
      "wall_handstand",
    ]);
    expect(skill.cooldownStationIds).toEqual([
      "wger_2686",
      "fedb_kneeling_forearm_stretch",
      "fedb_childs_pose_cooldown",
      "ntc_thread_the_needle",
    ]);
  });
});
