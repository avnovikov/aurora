import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadPlanQueue,
  peekNextTemplate,
  peekUpcomingWithOverride,
  savePlanQueue,
} from "../../src/plan/queue";
import {
  clearScheduleOverride,
  loadScheduleOverride,
  resetScheduleOverrideForTests,
  saveScheduleOverride,
} from "../../src/plan/scheduleOverride";
import { advancePlanAfterSession } from "../../src/ui/planView";

const QUEUE = { items: ["tmpl_legs", "tmpl_abs", "tmpl_bars"] };

describe("schedule override storage", () => {
  beforeEach(() => {
    resetScheduleOverrideForTests();
  });

  it("is null by default", () => {
    expect(loadScheduleOverride()).toBeNull();
  });

  it("round-trips a saved override", () => {
    saveScheduleOverride({ templateId: "tmpl_bars" });
    expect(loadScheduleOverride()).toEqual({ templateId: "tmpl_bars" });
  });

  it("clears back to null", () => {
    saveScheduleOverride({ templateId: "tmpl_bars" });
    clearScheduleOverride();
    expect(loadScheduleOverride()).toBeNull();
  });

  it("refuses to save an unknown template", () => {
    expect(() => saveScheduleOverride({ templateId: "tmpl_nope" })).toThrow(
      "Unknown template for schedule override",
    );
    expect(loadScheduleOverride()).toBeNull();
  });
});

describe("peek with override", () => {
  it("uses the queue head when no override is set", () => {
    expect(peekNextTemplate(QUEUE, null).id).toBe("tmpl_legs");
    expect(peekNextTemplate(QUEUE).id).toBe("tmpl_legs");
  });

  it("uses the override instead of the queue head without mutating the queue", () => {
    const before = structuredClone(QUEUE);
    expect(peekNextTemplate(QUEUE, { templateId: "tmpl_bars" }).id).toBe("tmpl_bars");
    expect(QUEUE).toEqual(before);
  });

  it("rejects an override pointing at an unknown template", () => {
    expect(() => peekNextTemplate(QUEUE, { templateId: "tmpl_nope" })).toThrow(
      "Unknown template in schedule override",
    );
  });

  it("forecast puts the override first, then the untouched queue head", () => {
    const upcoming = peekUpcomingWithOverride(QUEUE, 3, { templateId: "tmpl_bars" });
    expect(upcoming.map((item) => item.id)).toEqual([
      "tmpl_bars",
      "tmpl_legs",
      "tmpl_abs",
    ]);
  });

  it("forecast equals the plain queue when no override is set", () => {
    const upcoming = peekUpcomingWithOverride(QUEUE, 2, null);
    expect(upcoming.map((item) => item.id)).toEqual(["tmpl_legs", "tmpl_abs"]);
  });

  it("forecast of one with override is just the override", () => {
    const upcoming = peekUpcomingWithOverride(QUEUE, 1, { templateId: "tmpl_bars" });
    expect(upcoming.map((item) => item.id)).toEqual(["tmpl_bars"]);
  });
});

describe("session completion with override", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears the override and advances the queue", () => {
    savePlanQueue(QUEUE);
    saveScheduleOverride({ templateId: "tmpl_bars" });

    advancePlanAfterSession();

    expect(loadScheduleOverride()).toBeNull();
    expect(loadPlanQueue().items[0]).toBe("tmpl_abs");
  });

  it("does not touch the queue while the override is merely set", () => {
    savePlanQueue(QUEUE);
    saveScheduleOverride({ templateId: "tmpl_bars" });

    expect(loadPlanQueue().items).toEqual(QUEUE.items);
  });
});
