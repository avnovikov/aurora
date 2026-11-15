import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { GENERATED_DOODLES, REPLACED_DOODLE_IDS } from "../../src/data/generated/doodleMap";
import { WARMUP_STATION_BY_ID } from "../../src/data/warmupStations";
import { DOODLE_SPECS } from "../../src/doodles/specs";
import { validateSpec } from "../../src/doodles/validate";

describe("animated doodles", () => {
  it("pass the rig validator (bone lengths, anatomy, floor, frame, props)", () => {
    const failures = DOODLE_SPECS.map(validateSpec)
      .filter((report) => !report.ok)
      .map((report) => `${report.slug}: ${report.errors[0]}`);
    expect(failures).toEqual([]);
  });

  it("are generated for every spec (re-run npm run doodles)", () => {
    expect(Object.keys(GENERATED_DOODLES).sort()).toEqual(DOODLE_SPECS.map((spec) => spec.id).sort());
    for (const file of Object.values(GENERATED_DOODLES)) {
      expect(existsSync(new URL(`../../public${file}`, import.meta.url)), file).toBe(true);
    }
  });

  it("belong to Library exercises and show on them", () => {
    for (const spec of DOODLE_SPECS) {
      const exercise = EXERCISE_GRAPH[spec.id];
      expect(exercise, spec.id).toBeDefined();
      expect(exercise.doodlePath).toBeTruthy();
    }
    expect(EXERCISE_GRAPH.hf_44.doodlePath).toBe("/doodles/doodle-chin-up.svg");
  });

  it("keep hand-drawn doodles unless a spec explicitly replaces them", () => {
    expect(EXERCISE_GRAPH.pullup.doodlePath).toBe("/doodles/doodle-pullup.jpg");
    for (const id of REPLACED_DOODLE_IDS) {
      expect(EXERCISE_GRAPH[id]?.doodlePath, id).toBe(GENERATED_DOODLES[id]);
    }
    expect(REPLACED_DOODLE_IDS).toEqual(
      DOODLE_SPECS.filter((spec) => spec.replaces).map((spec) => spec.id),
    );
  });

  it("show replacement animations on warmup stations too", () => {
    for (const id of REPLACED_DOODLE_IDS) {
      const station = WARMUP_STATION_BY_ID[id];
      if (station) {
        expect(station.doodlePath, id).toBe(GENERATED_DOODLES[id]);
      }
    }
  });
});
