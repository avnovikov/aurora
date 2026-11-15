import { describe, expect, it } from "vitest";
import { SEED_GRAPH, SESSION_TEMPLATES } from "../../src/data/seed";
import type { ExerciseMemory } from "../../src/domain/types";
import {
  buildChainIds,
  buildChainMap,
  buildChainNodes,
  hasTrainingSignal,
  inferChainStatus,
  KEY_CHAIN_ROOT_IDS,
  listChainRootIds,
  pickCurrentId,
} from "../../src/progress/chainMap";

function memory(overrides: Partial<ExerciseMemory> = {}): ExerciseMemory {
  return {
    exerciseId: "bulgarian_split",
    sessionsAtStandard: 0,
    sessionsBelowFloor: 0,
    lastAddedLoadKg: 0,
    weakLinkSessionsRemaining: 0,
    ...overrides,
  };
}

describe("buildChainIds", () => {
  it("returns the full squat chain from any member", () => {
    const expected = ["bodyweight_squat", "bulgarian_split", "pistol_squat"];
    expect(buildChainIds("bodyweight_squat", SEED_GRAPH)).toEqual(expected);
    expect(buildChainIds("pistol_squat", SEED_GRAPH)).toEqual(expected);
  });

  it("walks the handstand chain from pike to freestanding", () => {
    expect(buildChainIds("wall_handstand", SEED_GRAPH)).toEqual([
      "elevated_pike",
      "wall_handstand",
      "freestanding_hs",
    ]);
  });

  it("returns an empty chain for unknown exercises", () => {
    expect(buildChainIds("not_real", SEED_GRAPH)).toEqual([]);
  });

  it("stops on a cycle instead of looping", () => {
    const graph = {
      a: { ...SEED_GRAPH.hip_hinge, id: "a", easierId: "b", harderId: "b" },
      b: { ...SEED_GRAPH.hip_hinge, id: "b", easierId: "a", harderId: "a" },
    };
    expect([...buildChainIds("a", graph)].sort()).toEqual(["a", "b"]);
  });
});

describe("listChainRootIds", () => {
  it("dedupes chains that share a root", () => {
    const rootIds = listChainRootIds(
      SESSION_TEMPLATES,
      KEY_CHAIN_ROOT_IDS,
      SEED_GRAPH,
    );
    expect(new Set(rootIds).size).toBe(rootIds.length);
    expect(rootIds).toEqual(
      expect.arrayContaining([
        "bodyweight_squat",
        "hip_hinge",
        "elevated_pike",
        "pullup_dead_hang",
        "dead_bug",
      ]),
    );
  });
});

describe("buildChainNodes", () => {
  it("marks easier, current and harder neighbours", () => {
    const ids = buildChainIds("pistol_squat", SEED_GRAPH);
    const nodes = buildChainNodes(ids, "bulgarian_split", SEED_GRAPH);
    expect(nodes.map((node) => node.position)).toEqual([
      "easier",
      "current",
      "harder",
    ]);
  });

  it("rejects a current exercise that is off the chain", () => {
    const ids = buildChainIds("pistol_squat", SEED_GRAPH);
    expect(() => buildChainNodes(ids, "hip_hinge", SEED_GRAPH)).toThrow(
      /not on chain/,
    );
  });
});

describe("pickCurrentId", () => {
  const chainIds = buildChainIds("pistol_squat", SEED_GRAPH);

  it("starts at the first plan exercise on the chain", () => {
    expect(pickCurrentId(chainIds, ["hip_hinge", "bulgarian_split"], {})).toBe(
      "bulgarian_split",
    );
  });

  it("falls back to the root when no plan exercise is on the chain", () => {
    expect(pickCurrentId(chainIds, ["hip_hinge"], {})).toBe("bodyweight_squat");
  });

  it("moves past the plan start when a harder node is trained", () => {
    const memories = {
      pistol_squat: memory({ exerciseId: "pistol_squat", bestReps: 1 }),
    };
    expect(pickCurrentId(chainIds, ["bodyweight_squat"], memories)).toBe(
      "pistol_squat",
    );
  });
});

describe("hasTrainingSignal", () => {
  it("is false for missing and untouched memory", () => {
    expect(hasTrainingSignal(undefined)).toBe(false);
    expect(hasTrainingSignal(memory())).toBe(false);
  });

  it("is true once reps or sessions are recorded", () => {
    expect(hasTrainingSignal(memory({ bestReps: 5 }))).toBe(true);
    expect(hasTrainingSignal(memory({ sessionsBelowFloor: 1 }))).toBe(true);
  });
});

describe("inferChainStatus", () => {
  const squat = SEED_GRAPH.bodyweight_squat;

  it("reports no history without memory", () => {
    expect(inferChainStatus(squat, undefined, SEED_GRAPH).kind).toBe(
      "no_history",
    );
  });

  it("reports a stall after two sessions below floor and names the regression", () => {
    const status = inferChainStatus(
      SEED_GRAPH.bulgarian_split,
      memory({ sessionsBelowFloor: 2 }),
      SEED_GRAPH,
    );
    expect(status.kind).toBe("stall");
    expect(status.reason).toContain("Bodyweight squat");
  });

  it("does not stall after a single bad session", () => {
    const status = inferChainStatus(
      squat,
      memory({ sessionsBelowFloor: 1 }),
      SEED_GRAPH,
    );
    expect(status.kind).toBe("hold");
  });

  it("reports advance when standard has been met twice", () => {
    const status = inferChainStatus(
      squat,
      memory({ sessionsAtStandard: 2 }),
      SEED_GRAPH,
    );
    expect(status.kind).toBe("advance");
    expect(status.reason).toContain("Bulgarian split squat");
  });

  it("appends a light-day note from the last resolve", () => {
    const status = inferChainStatus(
      squat,
      memory({ sessionsAtStandard: 1 }),
      SEED_GRAPH,
      { ruleIds: ["light_day", "hold"] },
    );
    expect(status.reason).toContain("light day");
  });
});

describe("buildChainMap", () => {
  it("assembles label, nodes and status for the squat chain", () => {
    const chain = buildChainMap(
      "bodyweight_squat",
      ["bodyweight_squat"],
      {},
      SEED_GRAPH,
      () => undefined,
    );
    expect(chain.label).toBe("Squat");
    expect(chain.currentId).toBe("bodyweight_squat");
    expect(chain.nodes).toHaveLength(3);
    expect(chain.status.kind).toBe("no_history");
  });
});
