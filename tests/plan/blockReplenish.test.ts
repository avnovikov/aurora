import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN_QUEUE } from "../../src/data/seed";
import type { SessionTemplate } from "../../src/domain/program";
import { addBlockToPlan, replenishBlockOnQueue } from "../../src/plan/blockActions";
import {
  generateBlock,
  generateContinuationDay,
  nextBlockLetter,
} from "../../src/plan/generateBlock";
import type { StepContext } from "../../src/plan/ladderSteps";
import { getPlanDay } from "../../src/plan/planDays";
import { loadPlanQueue, savePlanQueue } from "../../src/plan/queue";
import { advancePlanAfterSession } from "../../src/ui/planView";
import { useMemoryStorage } from "../helpers/storage";

const ctx = (over: Partial<StepContext> = {}): StepContext => ({
  memories: {},
  jointHistory: [],
  excluded: [],
  equipment: ["body", "bar"],
  ...over,
});

useMemoryStorage(() => ({ "aurora.poc.planQueue.v1": JSON.stringify(DEFAULT_PLAN_QUEUE) }));

describe("nextBlockLetter", () => {
  it("cycles working → easier → focus → working", () => {
    expect(nextBlockLetter("A")).toBe("B");
    expect(nextBlockLetter("B")).toBe("C");
    expect(nextBlockLetter("C")).toBe("A");
  });
});

describe("generateContinuationDay", () => {
  it("builds the next letter in the same block toward the same target", () => {
    const [dayA] = generateBlock({
      kind: "skill",
      target: "freestanding_hs",
      context: ctx(),
      count: 1,
      newId: () => "blk1",
    });
    const next = generateContinuationDay({
      finished: dayA!,
      context: ctx(),
      newId: () => "cont1",
    });
    expect(next).toBeDefined();
    expect(next!.block!.id).toBe(dayA!.block!.id);
    expect(next!.block!.letter).toBe("B");
    expect(next!.block!.emphasis).toBe("easier");
    expect(next!.kind).toBe("skill");
    expect(next!.targetExerciseIds).toEqual(["freestanding_hs"]);
    expect(next!.id).not.toBe(dayA!.id);
    expect(next!.slots.length).toBeGreaterThan(0);
  });

  it("returns undefined for seed days and non-block templates", () => {
    const seed = { id: "tmpl_legs", kind: undefined, block: undefined } as SessionTemplate;
    expect(generateContinuationDay({ finished: seed, context: ctx() })).toBeUndefined();
  });
});

describe("advancePlanAfterSession replenish", () => {
  it("appends the next block day at the end after finishing a generated day", () => {
    // count 1 so the finished day is alone at the head (spacing would park B later).
    const { days, queue } = addBlockToPlan({
      kind: "lower",
      context: ctx(),
      queue: { items: ["tmpl_bars"] },
      index: 0,
      count: 1,
      newId: () => "q",
    });
    savePlanQueue(queue);
    const finished = days[0]!;
    expect(finished.block!.letter).toBe("A");
    expect(queue.items).toEqual([finished.id, "tmpl_bars"]);

    advancePlanAfterSession();

    const items = loadPlanQueue().items;
    expect(items[0]).toBe("tmpl_bars");
    const appendedId = items[items.length - 1]!;
    expect(appendedId).not.toBe("tmpl_bars");
    const appended = getPlanDay(appendedId);
    expect(appended?.block?.id).toBe(finished.block!.id);
    expect(appended?.block?.letter).toBe("B");
    expect(appended?.block?.emphasis).toBe("easier");
    expect(appended?.kind).toBe("lower");
  });

  it("does not append an extra generated day after finishing a seed day", () => {
    savePlanQueue({ items: ["tmpl_legs", "tmpl_abs"] });
    advancePlanAfterSession();
    // Seed days with repeat re-append themselves; replenish must not add a generated day.
    const items = loadPlanQueue().items;
    expect(items[0]).toBe("tmpl_abs");
    expect(items.every((id) => !getPlanDay(id))).toBe(true);
  });

  it("replenishBlockOnQueue leaves the queue alone when continuation cannot be built", () => {
    const seedLike = {
      id: "tmpl_mobility",
      name: "Mobility",
      focus: "mobility",
      kind: "mobility",
      targetExerciseIds: [],
      warmupByLevel: { beginner: [], intermediate: [], advanced: [] },
      cooldownStationIds: [],
      slots: [],
      repeat: false,
    } as SessionTemplate;
    const queue = { items: ["tmpl_abs"] };
    expect(replenishBlockOnQueue({ finished: seedLike, queue, context: ctx() })).toEqual(queue);
  });
});
