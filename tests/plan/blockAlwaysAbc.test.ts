import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN_QUEUE } from "../../src/data/seed";
import { addBlockToPlan, replenishBlockOnQueue } from "../../src/plan/blockActions";
import { generateBlock } from "../../src/plan/generateBlock";
import type { StepContext } from "../../src/plan/ladderSteps";
import { getPlanDay, savePlanDays } from "../../src/plan/planDays";
import { completeNext, loadPlanQueue, savePlanQueue } from "../../src/plan/queue";
import { findTemplate } from "../../src/plan/templates";
import { advancePlanAfterSession } from "../../src/ui/planView";
import { useMemoryStorage } from "../helpers/storage";

const ctx = (over: Partial<StepContext> = {}): StepContext => ({
  memories: {},
  jointHistory: [],
  excluded: [],
  equipment: ["body", "bar"],
  ...over,
});

function lettersOnQueue(queue: { items: string[] }, blockId: string): string[] {
  return queue.items
    .map((id) => findTemplate(id) ?? getPlanDay(id))
    .filter((day) => day?.block?.id === blockId)
    .map((day) => day!.block!.letter);
}

useMemoryStorage(() => ({ "aurora.poc.planQueue.v1": JSON.stringify(DEFAULT_PLAN_QUEUE) }));

describe("block queue always keeps A, B, and C (#287)", () => {
  it("after finishing A, replenish adds a new A when B and C are still queued", () => {
    const { days, queue } = addBlockToPlan({
      kind: "lower",
      context: ctx(),
      queue: { items: [] },
      index: 0,
      newId: () => "abc1",
    });
    expect(days.map((d) => d.block!.letter)).toEqual(["A", "B", "C"]);
    const blockId = days[0]!.block!.id;
    savePlanQueue(queue);

    advancePlanAfterSession();

    const next = loadPlanQueue();
    expect([...lettersOnQueue(next, blockId)].sort()).toEqual(["A", "B", "C"]);
    const appended = getPlanDay(next.items[next.items.length - 1]!);
    expect(appended?.block?.letter).toBe("A");
    expect(appended?.block?.id).toBe(blockId);
  });

  it("after finishing B, fills missing A and B instead of a second C", () => {
    const days = generateBlock({
      kind: "full",
      context: ctx(),
      newId: () => "full1",
    });
    const [, dayB, dayC] = days;
    savePlanDays(days);
    // A already finished earlier; only B and C remain.
    let queue = { items: [dayB!.id, dayC!.id] };

    queue = replenishBlockOnQueue({
      finished: dayB!,
      queue: completeNext(queue), // remove B → [C]
      context: ctx(),
      newId: () => "cont",
    });

    const letters = lettersOnQueue(queue, dayB!.block!.id);
    expect([...letters].sort()).toEqual(["A", "B", "C"]);
    expect(letters.filter((letter) => letter === "C")).toHaveLength(1);
  });
});
