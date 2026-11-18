import { describe, expect, it } from "vitest";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";

const byId = Object.fromEntries(LIBRARY_CATALOGUE.map((e) => [e.id, e]));

const ARCHER_IDS = [
  "hf_6",
  "hf_50",
  "hf_75",
  "ntc_incline_archer_push_up",
  "ntc_archer_push_up_hold",
  "ntc_archer_inverted_row",
  "ntc_archer_dip",
  "ntc_archer_straight_bar_dip",
] as const;

const AUSTRALIAN_IDS = [
  "ntc_bent_knee_australian_pull_up",
  "ntc_australian_chin_up",
  "hf_39", // Inverted Row — standard Australian pull-up under another name
  "ntc_australian_pull_up_hold",
  "ntc_feet_elevated_australian_pull_up",
  "ntc_archer_inverted_row", // Archer Australian Pull-Up
  "hf_42", // One-Arm Inverted Row
] as const;

describe("archer progression variants (#166)", () => {
  it("ships the existing and new archer family entries", () => {
    for (const id of ARCHER_IDS) {
      expect(byId[id], id).toBeDefined();
      expect(byId[id]!.name.toLowerCase()).toMatch(/archer/);
    }
  });

  it("links incline archer into the push progression toward floor archer", () => {
    expect(byId.ntc_incline_archer_push_up!.harderId).toBe("hf_6");
    expect(byId.ntc_incline_archer_push_up!.easierId).toBe("fedb_incline_push_up");
    expect(byId.ntc_staggered_push_up!.harderId).toBe("ntc_incline_archer_push_up");
  });

  it("names the archer row as an Archer Australian Pull-Up on the row path", () => {
    expect(byId.ntc_archer_inverted_row!.name).toBe("Archer Australian Pull-Up");
    expect(byId.ntc_archer_inverted_row!.easierId).toBe("ntc_feet_elevated_australian_pull_up");
    expect(byId.ntc_archer_inverted_row!.harderId).toBe("hf_42");
    expect(byId.ntc_archer_inverted_row!.pattern).toBe("vertical_pull");
  });

  it("links archer dips from parallel-bar dip toward straight-bar archer", () => {
    expect(byId.ntc_archer_dip!.easierId).toBe("hf_25");
    expect(byId.ntc_archer_dip!.harderId).toBe("ntc_archer_straight_bar_dip");
    expect(byId.ntc_archer_straight_bar_dip!.easierId).toBe("hf_27");
    expect(byId.ntc_archer_dip!.requires).toEqual(["parallettes"]);
    expect(byId.ntc_archer_straight_bar_dip!.requires).toEqual(["bar"]);
    expect(byId.ntc_archer_inverted_row!.requires).toEqual(["bar"]);
  });

  it("keeps floor archer push work bodyweight-only", () => {
    expect(byId.ntc_incline_archer_push_up!.requires).toBeUndefined();
    expect(byId.ntc_archer_push_up_hold!.requires).toBeUndefined();
    expect(byId.ntc_archer_push_up_hold!.effort).toBe("hold");
  });
});

describe("Australian / inverted-row progression (#166)", () => {
  it("ships a searchable Australian path beside Inverted Row", () => {
    for (const id of AUSTRALIAN_IDS) {
      expect(byId[id], id).toBeDefined();
    }
    expect(byId.hf_39!.name).toBe("Inverted Row");
    expect(byId.ntc_australian_chin_up!.name).toBe("Australian Chin-Up");
    expect(byId.ntc_feet_elevated_australian_pull_up!.name).toBe(
      "Feet-Elevated Australian Pull-Up",
    );
  });

  it("orders bent-knee → inverted row → elevated → archer → one-arm", () => {
    expect(byId.ntc_bent_knee_australian_pull_up!.harderId).toBe("hf_39");
    expect(byId.ntc_feet_elevated_australian_pull_up!.easierId).toBe("hf_39");
    expect(byId.ntc_feet_elevated_australian_pull_up!.harderId).toBe(
      "ntc_archer_inverted_row",
    );
    expect(byId.ntc_australian_pull_up_hold!.effort).toBe("hold");
  });

  it("keeps Australians on the pull pattern with Inverted Row", () => {
    for (const id of [
      "ntc_bent_knee_australian_pull_up",
      "ntc_australian_chin_up",
      "ntc_feet_elevated_australian_pull_up",
      "ntc_australian_pull_up_hold",
      "ntc_archer_inverted_row",
      "hf_39",
      "hf_42",
    ] as const) {
      expect(byId[id]!.pattern, id).toBe("vertical_pull");
      expect(byId[id]!.regions, id).toContain("pull");
    }
  });

  it("uses bar (or rings/suspension) for Australian row variants", () => {
    for (const id of [
      "ntc_bent_knee_australian_pull_up",
      "ntc_australian_chin_up",
      "ntc_feet_elevated_australian_pull_up",
      "ntc_australian_pull_up_hold",
    ] as const) {
      expect(byId[id]!.requires, id).toEqual(["bar"]);
      expect(byId[id]!.orRequires, id).toEqual([["rings"], ["suspension"]]);
    }
  });
});
