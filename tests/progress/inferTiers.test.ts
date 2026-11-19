import { describe, expect, it } from "vitest";
import type { ExerciseMemory } from "../../src/domain/types";
import { inferTiers } from "../../src/progress/inferTiers";
import { emptyMemory } from "../../src/session/history";
import { indexOf } from "../helpers/ladderIndex";

const NOW = new Date("2026-11-17T12:00:00Z");
const index = indexOf({ f: [["top", 4], ["top2", 4], ["next", 3], ["mid", 2], ["low", 1]] });
const declared = (id: string, tier: ExerciseMemory["declaredTier"]): ExerciseMemory => ({
  ...emptyMemory(id),
  declaredTier: tier,
  declaredAt: NOW.toISOString(),
});
const run = (memories: Record<string, ExerciseMemory>, extra = {}) =>
  inferTiers({ memories, now: NOW, index, ...extra });

describe("inferTiers", () => {
  it("one tested member infers nothing (k = 2)", () => {
    const out = run({ top: declared("top", "advanced") });
    expect(Object.values(out.memories).filter((m) => m.inferred)).toEqual([]);
  });

  it("two tested harder members infer one tier below, downward only", () => {
    const res = run({ top: declared("top", "advanced"), next: declared("next", "advanced") });
    const out = res.memories;
    expect(out.mid?.inferred?.tier).toBe("intermediate");
    expect(out.mid?.inferred?.from).toEqual(["next", "top"]);
    expect(res.inferredIds).toContain("mid");
    expect(out.low?.inferred).toBeUndefined();
    expect(out.top?.inferred).toBeUndefined();
    expect(out.next?.inferred).toBeUndefined();
  });

  it("needs a supporter within 1 rung", () => {
    const out = run({ top: declared("top", "elite"), top2: declared("top2", "elite") }).memories;
    expect(out.next?.inferred?.tier).toBe("advanced");
    expect(out.mid?.inferred).toBeUndefined();
  });

  it("a failure cap limits inference", () => {
    const capped: ExerciseMemory = {
      ...emptyMemory("mid"),
      failedCaps: [{ tier: "beginner", from: "low", at: NOW.toISOString() }],
    };
    const out = run({ top: declared("top", "elite"), next: declared("next", "elite"), mid: capped }).memories;
    expect(out.mid?.inferred?.tier).toBe("beginner");
  });

  it("an existing inferred tier rises one step only in a confirming family", () => {
    const start = {
      top: declared("top", "elite"),
      next: declared("next", "elite"),
      mid: {
        ...emptyMemory("mid"),
        inferred: { tier: "beginner" as const, from: ["next", "top"], at: NOW.toISOString() },
      },
    };
    expect(run(start).memories.mid?.inferred?.tier).toBe("beginner");
    expect(run(start, { confirmingFamilies: new Set(["f"]) }).memories.mid?.inferred?.tier).toBe("intermediate");
  });

  it("drops inference that lost support", () => {
    const orphan = {
      ...emptyMemory("mid"),
      inferred: { tier: "advanced" as const, from: ["x", "y"], at: NOW.toISOString() },
    };
    expect(run({ mid: orphan }).memories.mid?.inferred).toBeUndefined();
  });

  it("never infers on a tested move", () => {
    const out = run({
      top: declared("top", "elite"),
      next: declared("next", "elite"),
      mid: declared("mid", "beginner"),
    }).memories;
    expect(out.mid?.inferred).toBeUndefined();
    expect(out.mid?.skillTier).toBe("beginner");
  });

  it("the jump bound survives expiry (rule 9)", () => {
    const old = new Date(NOW.getTime() - 30 * 86_400_000).toISOString();
    const memories = {
      next: declared("next", "elite"),
      top: declared("top", "elite"),
      mid: { ...emptyMemory("mid"), inferred: { tier: "beginner" as const, from: ["next", "top"], at: old } },
    };
    expect(run(memories).memories.mid?.inferred?.tier).toBe("beginner");
    expect(run(memories, { confirmingFamilies: new Set(["f"]) }).memories.mid?.inferred?.tier).toBe("intermediate");
  });

  it("novice supporters (stepDown null) infer nothing (#116)", () => {
    const out = run({ top: declared("top", "novice"), next: declared("next", "novice") }).memories;
    expect(out.mid?.inferred).toBeUndefined();
    expect(out.low?.inferred).toBeUndefined();
  });

  it("same-rank peers do not infer each other (#116)", () => {
    const sameRank = indexOf({ f: [["a", 2], ["b", 2], ["c", 2]] });
    const out = inferTiers({
      memories: { a: declared("a", "advanced"), b: declared("b", "advanced") },
      now: NOW,
      index: sameRank,
    }).memories;
    expect(out.c?.inferred).toBeUndefined();
  });

  it("a weaker candidate lowers an existing inferred tier (#116)", () => {
    const start = {
      top: declared("top", "intermediate"),
      next: declared("next", "intermediate"),
      mid: {
        ...emptyMemory("mid"),
        inferred: { tier: "advanced" as const, from: ["next", "top"], at: NOW.toISOString() },
      },
    };
    expect(run(start).memories.mid?.inferred?.tier).toBe("beginner");
  });

  it("preserves inferred.at when the tier is unchanged (#116)", () => {
    const originalAt = "2026-11-10T12:00:00.000Z";
    const start = {
      top: declared("top", "advanced"),
      next: declared("next", "advanced"),
      mid: {
        ...emptyMemory("mid"),
        inferred: { tier: "intermediate" as const, from: ["next", "top"], at: originalAt },
      },
    };
    expect(run(start).memories.mid?.inferred?.at).toBe(originalAt);
  });
});
