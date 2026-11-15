import { describe, expect, it } from "vitest";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import { PLANNABLE_EXERCISES } from "../../src/data/exerciseGraph";
import { isWgerCandidate } from "../../src/data/wger/selection";
import type { WgerExerciseRecord } from "../../src/data/wger/types";
import type { JointHistoryEntry } from "../../src/domain/program";
import { detailHtml } from "../../src/library/libraryDetail";
import { assessExercise } from "../../src/safety/jointCare";
import { jointLoadsFor } from "../../src/safety/jointLoad";
import { prehabFor } from "../../src/safety/prehab";
import { ALL_EQUIPMENT } from "../../src/settings/profile";
import { exerciseNamed as find } from "../helpers/exercises";

const bandMoves = LIBRARY_CATALOGUE.filter((item) => item.requires?.includes("band"));
const wrist: JointHistoryEntry = { joint: "wrist", side: "right", kind: "other" };
const knee: JointHistoryEntry = { joint: "knee", side: "both", kind: "other" };

function record(name: string, equipment: string[]): WgerExerciseRecord {
  return {
    id: 1, name, description: "<p>Hold the band with both hands and pull.</p>", category: "Back",
    muscles: [], musclesSecondary: [], equipment, license: "CC-BY-SA-4.0", licenseAuthor: "x", images: [],
  };
}

describe("resistance bands", () => {
  it("is a selectable equipment option", () => {
    expect(ALL_EQUIPMENT).toContain("band");
  });

  it("imports only the curated band moves", () => {
    expect(bandMoves.map((item) => item.name).sort()).toEqual([
      "Band Terminal Knee extension",
      "Band pull-apart with external rotation",
      "Band pull-aparts",
      "Banded Clamshell",
      "Banded Scapular Retraction",
      "Seated Band Row",
    ]);
    expect(isWgerCandidate(record("Face pulls with yellow/green band", ["Resistance band"]))).toBe(false);
    expect(isWgerCandidate(record("Band pull-aparts", ["Resistance band"]))).toBe(true);
  });

  it("never auto-plans band moves or links them into progressions", () => {
    const ids = new Set(bandMoves.map((item) => item.id));
    expect(PLANNABLE_EXERCISES.some((item) => ids.has(item.id))).toBe(false);
    const linked = LIBRARY_CATALOGUE.filter(
      (item) => ids.has(item.easierId ?? "") || ids.has(item.harderId ?? ""),
    );
    expect(linked).toEqual([]);
  });

  it("hides band prehab unless the user has a band", () => {
    const withBand = prehabFor([knee], LIBRARY_CATALOGUE, ["body", "band"]).map((i) => i.name);
    const without = prehabFor([knee], LIBRARY_CATALOGUE, ["body"]).map((i) => i.name);
    expect(withBand).toContain("Band Terminal Knee extension");
    expect(without).not.toContain("Band Terminal Knee extension");
    expect(without).toContain("Copenhagen Adduction Exercise");
  });

  it("states the gear on the detail page", () => {
    expect(detailHtml(find("Band pull-aparts"), new Set())).toContain("Needs: band");
  });
});

describe("joint load map", () => {
  it("maps moves to the joints they stress", () => {
    expect(jointLoadsFor("Wall handstand hold").find((l) => l.joint === "wrist")?.level).toBe("high");
    expect(jointLoadsFor("Pistol squat").find((l) => l.joint === "knee")?.level).toBe("high");
    expect(jointLoadsFor("Plank hip dips").some((l) => l.joint === "shoulder")).toBe(false);
    expect(jointLoadsFor("Bodyweight squat")).toEqual([]);
  });

  it("keeps one entry per joint, highest level", () => {
    const loads = jointLoadsFor("Planche push-up");
    expect(loads.filter((l) => l.joint === "wrist")).toHaveLength(1);
    expect(loads.find((l) => l.joint === "wrist")?.level).toBe("high");
  });

  it("cautions (never avoids) a joint without avoid rules", () => {
    const hs = assessExercise("Wall handstand hold", [wrist]);
    expect(hs.avoid).toBe(false);
    expect(hs.cautions[0]).toMatch(/right wrist/);
    expect(assessExercise("Standard Push-Up", [wrist]).cautions).toEqual([]);
  });

  it("shows joint load on the detail page and marks the user's joint", () => {
    const html = detailHtml(find("Wall handstand hold"), new Set(), {}, {}, [wrist]);
    expect(html).toContain("Joint load");
    expect(html).toContain("(your joint)");
  });
});
