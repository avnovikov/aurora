import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN_QUEUE } from "../../src/data/seed";
import {
  completeNext,
  loadPlanQueue,
  removeQueueItem,
  savePlanQueue,
} from "../../src/plan/queue";
import { loadProfile, saveProfile } from "../../src/settings/profile";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

const KEY = "aurora.poc.planQueue.v1";

describe("empty plan queue", () => {
  it("keeps an explicit empty queue instead of reseeding the default", () => {
    savePlanQueue({ items: [] });
    expect(loadPlanQueue().items).toEqual([]);
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify({ items: [] }));
  });

  it("still seeds the default when setup is done and no queue was ever saved", () => {
    saveProfile({ ...loadProfile(), setupDone: true });
    expect(loadPlanQueue().items).toEqual(DEFAULT_PLAN_QUEUE.items);
  });

  it("starts empty when setup is not done and no queue was saved", () => {
    expect(loadProfile().setupDone).toBe(false);
    expect(loadPlanQueue().items).toEqual([]);
  });

  it("leaves the queue empty after completing the last non-repeating day", () => {
    savePlanQueue({ items: ["tmpl_mobility"] });
    expect(completeNext(loadPlanQueue()).items).toEqual([]);
  });

  it("allows removing the last day", () => {
    savePlanQueue({ items: ["tmpl_mobility"] });
    expect(removeQueueItem(loadPlanQueue(), 0).items).toEqual([]);
  });
});
