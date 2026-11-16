import { doodleFor } from "../../src/data/doodles";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { GENERATED_DOODLES, REPLACED_DOODLE_IDS } from "../../src/data/generated/doodleMap";
import { WARMUP_STATION_BY_ID } from "../../src/data/warmupStations";
import { FOCUS_BY_ID } from "../../src/doodles/focus";
import { figurePoints, renderDoodleSvg } from "../../src/doodles/renderSvg";
import { sampleTimeline } from "../../src/doodles/rig";
import { DOODLE_SPECS } from "../../src/doodles/specs";
import { validateSpec } from "../../src/doodles/validate";

const NUMBER = /-?\d+(?:\.\d+)?/g;
/** Coordinates print to 0.1, and floating point differs a little between platforms. */
const COORD_TOLERANCE = 0.11;

/** Same markup, with every number within COORD_TOLERANCE of its counterpart. */
function sameDrawing(saved: string, fresh: string): boolean {
  const a = saved.match(NUMBER) ?? [];
  const b = fresh.match(NUMBER) ?? [];
  return (
    saved.replace(NUMBER, "#") === fresh.replace(NUMBER, "#") &&
    a.length === b.length &&
    a.every((value, i) => Math.abs(Number(value) - Number(b[i])) <= COORD_TOLERANCE)
  );
}

describe("animated doodles", () => {
  it("pass the rig validator (bone lengths, anatomy, floor, frame, props)", () => {
    const failures = DOODLE_SPECS.map(validateSpec)
      .filter((report) => !report.ok)
      .map((report) => `${report.slug}: ${report.errors[0]}`);
    expect(failures).toEqual([]);
  });

  it("are generated for every spec (re-run npm run doodles)", () => {
    expect(Object.keys(GENERATED_DOODLES).sort()).toEqual(DOODLE_SPECS.map((spec) => spec.id).sort());
    for (const spec of DOODLE_SPECS) {
      const file = new URL(`../../public${GENERATED_DOODLES[spec.id]}`, import.meta.url);
      expect(existsSync(file) && sameDrawing(readFileSync(file, "utf8"), renderDoodleSvg(spec)), spec.slug).toBe(true);
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
    expect(doodleFor("no_spec_move", "/doodles/hand-drawn.jpg")).toBe("/doodles/hand-drawn.jpg");
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

describe("doodle focus (highlight and zoom inset)", () => {
  const specIds = new Set(DOODLE_SPECS.map((spec) => spec.id));
  const jointNames = new Set(
    figurePoints(sampleTimeline(DOODLE_SPECS[0]).poses[0]).map((point) => point.name),
  );

  it("only targets existing doodles and real joint names", () => {
    for (const [id, focus] of Object.entries(FOCUS_BY_ID)) {
      expect(specIds.has(id), id).toBe(true);
      for (const joint of focus.joints) expect(jointNames.has(joint), `${id}: ${joint}`).toBe(true);
      expect(focus.highlight.length, id).toBeGreaterThan(0);
      if (focus.zoom) expect(focus.joints.length, `${id} needs joints to centre the inset`).toBeGreaterThan(0);
    }
  });

  it("draws a uniquely clipped inset only where a zoom is asked for", () => {
    const zoomed = Object.keys(FOCUS_BY_ID).filter((id) => FOCUS_BY_ID[id].zoom);
    for (const spec of DOODLE_SPECS) {
      const svg = renderDoodleSvg(spec);
      const hasInset = svg.includes(`clip-path="url(#focus-${spec.slug})"`);
      expect(hasInset, spec.slug).toBe(zoomed.includes(spec.id));
    }
  });
});
