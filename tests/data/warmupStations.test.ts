import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { SESSION_TEMPLATES } from "../../src/data/seed";
import type { SessionTemplate, WarmupLevel } from "../../src/domain/program";
import type { Difficulty } from "../../src/domain/types";
import {
  RAMP_CUE,
  RAMP_HOLD_CUE,
  requireWarmupStation,
  STATION_PHASES,
  stationsFor,
  WARMUP_STATION_BY_ID,
  WARMUP_STATIONS,
} from "../../src/data/warmupStations";
import { WARMUP_LEVELS } from "../../src/rules/warmupLevel";
import { buildCooldownView, buildWarmupView, warmupViewSeconds } from "../../src/rules/warmupPlan";

const DIFFICULTY_ORDER: readonly Difficulty[] = ["beginner", "intermediate", "advanced", "elite"];

function allWarmupIds(item: SessionTemplate): string[] {
  return WARMUP_LEVELS.flatMap((level) => [...item.warmupByLevel[level]]);
}

const KAVADLO_FIVE = [
  "hf_167",
  "ntc_reach_and_touch",
  "ntc_downdog_updog_switch",
  "hollow_hold",
  "ntc_high_plank",
];

const SEED_STATION_IDS = [
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

  it("shows the Library doodle on every station whose exercise has one", () => {
    for (const station of WARMUP_STATIONS) {
      const doodle = EXERCISE_GRAPH[station.exerciseId]?.doodlePath;
      if (doodle) {
        expect(station.doodlePath, station.id).toBe(doodle);
      }
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

  it("covers every template warm-up (every level) and cool-down entry", () => {
    for (const item of SESSION_TEMPLATES) {
      for (const id of [...allWarmupIds(item), ...item.cooldownStationIds]) {
        expect(() => requireWarmupStation(id), `${item.id}: ${id}`).not.toThrow();
      }
    }
  });

  it("gives every template a list per level, each starting with toy soldiers in RAMP order", () => {
    for (const item of SESSION_TEMPLATES) {
      for (const level of WARMUP_LEVELS) {
        const ids = item.warmupByLevel[level];
        expect(ids[0], `${item.id} ${level}`).toBe("ntc_toy_soldiers");
        const ranks = ids.map((id) => STATION_PHASES.indexOf(requireWarmupStation(id).phase));
        expect(ranks, `${item.id} ${level}`).toEqual([...ranks].sort((a, b) => a - b));
        expect(ranks.every((rank) => rank < STATION_PHASES.indexOf("cooldown")), item.id).toBe(true);
      }
    }
  });

  it("ends every strength warm-up on a ramp; Mobility has one list and no ramp", () => {
    for (const item of SESSION_TEMPLATES) {
      for (const level of WARMUP_LEVELS) {
        const phases = stationsFor(item.warmupByLevel[level]).map((station) => station.phase);
        if (item.id === "tmpl_mobility") {
          expect(phases, level).not.toContain("potentiate");
          expect(item.warmupByLevel[level], level).toEqual(item.warmupByLevel.beginner);
        } else {
          expect(phases.at(-1), `${item.id} ${level}`).toBe("potentiate");
        }
      }
    }
  });

  it("drops Kavadlo's five from every warm-up but keeps the moves in the Library", () => {
    for (const item of SESSION_TEMPLATES) {
      for (const id of KAVADLO_FIVE) {
        expect(allWarmupIds(item), `${item.id}: ${id}`).not.toContain(id);
        expect(EXERCISE_GRAPH[id], id).toBeDefined();
      }
    }
  });

  it("never uses jumping jacks or marching as a warm-up station", () => {
    for (const item of SESSION_TEMPLATES) {
      expect(allWarmupIds(item), item.id).not.toContain("ntc_jumping_jacks");
      expect(allWarmupIds(item), item.id).not.toContain("pulse_raiser_march");
    }
    expect(EXERCISE_GRAPH.ntc_jumping_jacks).toBeDefined();
    expect(EXERCISE_GRAPH.pulse_raiser_march).toBeDefined();
  });

  it("keeps every ramp (potentiate) station easy and submaximal", () => {
    const ramps = WARMUP_STATIONS.filter((station) => station.phase === "potentiate");
    expect(ramps.length).toBeGreaterThan(0);
    for (const station of ramps) {
      const easy = station.cues.filter((cue) => cue === RAMP_CUE || cue === RAMP_HOLD_CUE);
      expect(easy, station.id).toHaveLength(1);
    }
    expect(requireWarmupStation("wger_1948").cues).toContain(
      "High box — stop well short of a full pistol",
    );
    expect(requireWarmupStation("ntc_chest_to_wall_handstand").cues).toContain(RAMP_HOLD_CUE);
    expect(requireWarmupStation("pullup_ramp").cues).toContain(RAMP_CUE);
  });

  it("never puts a target, or the first work move's max hold, in any level", () => {
    for (const item of SESSION_TEMPLATES) {
      for (const level of WARMUP_LEVELS) {
        const exerciseIds = stationsFor(item.warmupByLevel[level]).map((station) => station.exerciseId);
        for (const target of item.targetExerciseIds) {
          expect(exerciseIds, `${item.id} ${level}: ${target}`).not.toContain(target);
        }
      }
    }
    const skill = template("tmpl_skill_hs");
    expect(skill.slots[0]?.exerciseId).toBe("wall_handstand");
    expect(stationsFor(allWarmupIds(skill)).map((station) => station.exerciseId)).not.toContain(
      "wall_handstand",
    );
  });

  it("keeps each level's ramp at or below that level's difficulty", () => {
    for (const item of SESSION_TEMPLATES) {
      for (const level of WARMUP_LEVELS) {
        const ramp = stationsFor(item.warmupByLevel[level]).filter(
          (station) => station.phase === "potentiate",
        );
        for (const station of ramp) {
          expect(
            DIFFICULTY_ORDER.indexOf(station.difficulty),
            `${item.id} ${level}: ${station.id} is ${station.difficulty}`,
          ).toBeLessThanOrEqual(DIFFICULTY_ORDER.indexOf(level));
        }
      }
    }
  });

  it("lowers a Library level only on ramp stations whose dose is easier", () => {
    for (const station of WARMUP_STATIONS) {
      const library = EXERCISE_GRAPH[station.exerciseId]?.difficulty;
      const libraryIndex = Math.max(0, DIFFICULTY_ORDER.indexOf(library as Difficulty));
      const stationIndex = DIFFICULTY_ORDER.indexOf(station.difficulty);
      expect(stationIndex, station.id).toBeLessThanOrEqual(libraryIndex);
      if (stationIndex < libraryIndex) {
        expect(station.phase, station.id).toBe("potentiate");
      }
    }
  });

  it("keeps every level's warm-up between 7 and 10 minutes", () => {
    for (const item of SESSION_TEMPLATES) {
      for (const level of WARMUP_LEVELS) {
        const steps = buildWarmupView(stationsFor(item.warmupByLevel[level], item.warmupHoldSeconds));
        const seconds = warmupViewSeconds(steps);
        expect(seconds, `${item.id} ${level}`).toBeGreaterThanOrEqual(7 * 60);
        expect(seconds, `${item.id} ${level}`).toBeLessThanOrEqual(10 * 60);
      }
    }
  });

  it("puts bar stations only in the Bars template", () => {
    for (const item of SESSION_TEMPLATES) {
      if (item.id === "tmpl_bars") {
        continue;
      }
      for (const station of stationsFor(allWarmupIds(item))) {
        expect(EXERCISE_GRAPH[station.exerciseId]?.requires ?? [], `${item.id}: ${station.id}`).not.toContain(
          "bar",
        );
      }
    }
  });

  it("applies per-template hold overrides", () => {
    const [rocks] = stationsFor(["wger_2680"], { wger_2680: 45 });
    expect(rocks?.holdSeconds).toBe(45);
    expect(requireWarmupStation("wger_2680").holdSeconds).toBe(60);
  });

  it("matches the v3 lists per session and level", () => {
    const after = (id: string, level: WarmupLevel) => template(id).warmupByLevel[level].slice(1);
    expect(after("tmpl_legs", "beginner")).toEqual([
      "ankle_rocks",
      "ntc_single_leg_balance",
      "glute_bridge",
      "bodyweight_squat",
      "wger_2557",
    ]);
    expect(after("tmpl_legs", "intermediate")).toEqual([
      "ankle_rocks",
      "ntc_single_leg_balance",
      "fedb_single_leg_glute_bridge",
      "fedb_bodyweight_walking_lunge",
      "fedb_split_squats",
      "wger_1948",
    ]);
    expect(after("tmpl_legs", "advanced")).toEqual([
      "ankle_rocks",
      "wger_2667",
      "fedb_single_leg_glute_bridge",
      "fedb_bodyweight_walking_lunge",
      "wger_1948",
      "ntc_assisted_pistol",
    ]);
    expect(after("tmpl_skill_hs", "beginner")).toEqual([
      "wger_2680",
      "ntc_push_up_plus",
      "ntc_prone_ytw",
      "hf_99",
      "wger_2691",
      "ntc_wall_walk_up_45",
    ]);
    expect(after("tmpl_skill_hs", "advanced").slice(-2)).toEqual([
      "ntc_wall_walk_up",
      "ntc_chest_to_wall_handstand",
    ]);
    expect(after("tmpl_bars", "beginner").slice(-2)).toEqual(["pullup_dead_hang", "wger_2748"]);
    expect(after("tmpl_bars", "intermediate").slice(0, 2)).toEqual(["hf_155", "wger_1711"]);
    expect(after("tmpl_bars", "advanced").at(-1)).toBe("pullup_ramp_sets");
    expect(after("tmpl_abs", "beginner").at(-1)).toBe("hollow_hold_tuck");
    expect(after("tmpl_abs", "advanced").at(-1)).toBe("hollow_hold_ramp");
    expect(after("tmpl_full", "intermediate").slice(-2)).toEqual(["bodyweight_squat", "push_up_ramp"]);
    expect(after("tmpl_mobility", "beginner")).toEqual([
      "ntc_leg_swings",
      "hf_169",
      "ankle_rocks",
      "hf_154",
    ]);
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

  it("matches the design's Skill cool-down list", () => {
    const skill = template("tmpl_skill_hs");
    expect(skill.cooldownStationIds).toEqual([
      "wger_2686",
      "fedb_kneeling_forearm_stretch",
      "fedb_childs_pose_cooldown",
      "ntc_thread_the_needle",
    ]);
  });
});

describe("per-side stations", () => {
  it("never pause alternating or two-sided-at-once moves", () => {
    // Bird dog, walking lunge, toy soldiers, cat-cow, 90/90 switch, cobra, child's pose, forearm stretch.
    const both = ["hf_116", "fedb_bodyweight_walking_lunge", "ntc_toy_soldiers", "hf_154", "hf_158", "hf_165", "fedb_childs_pose_cooldown", "fedb_kneeling_forearm_stretch"];
    for (const id of both) {
      expect(WARMUP_STATION_BY_ID[id]?.perSide, id).toBe(false);
    }
  });

  it("tell the user how to split the time between sides", () => {
    const perSide = Object.values(WARMUP_STATION_BY_ID).filter(
      (station) => station.perSide || station.prescription?.scope === "perSide",
    );
    expect(perSide.length).toBeGreaterThan(15);
    for (const station of perSide) {
      expect(station.cues.join(" "), station.id).toMatch(/per (side|leg)|each side|one side|change leg/i);
    }
  });
});
