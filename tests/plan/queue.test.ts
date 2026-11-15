import { describe, expect, it } from "vitest";
import {
  appendQueueItem,
  completeNext,
  moveQueueItem,
  peekUpcoming,
  removeQueueItem,
  skipNext,
} from "../../src/plan/queue";

describe("plan queue", () => {
  it("peekUpcoming returns templates in order", () => {
    const upcoming = peekUpcoming(
      { items: ["tmpl_legs", "tmpl_abs", "tmpl_bars"] },
      2,
    );
    expect(upcoming.map((item) => item.id)).toEqual(["tmpl_legs", "tmpl_abs"]);
  });

  it("completeNext re-appends repeating templates", () => {
    const next = completeNext({ items: ["tmpl_legs", "tmpl_abs"] });
    expect(next.items[0]).toBe("tmpl_abs");
    expect(next.items.at(-1)).toBe("tmpl_legs");
  });

  it("skipNext rotates head to the tail", () => {
    const next = skipNext({ items: ["tmpl_legs", "tmpl_abs", "tmpl_bars"] });
    expect(next.items).toEqual(["tmpl_abs", "tmpl_bars", "tmpl_legs"]);
  });

  it("moveQueueItem rearranges by index", () => {
    const next = moveQueueItem(
      { items: ["tmpl_legs", "tmpl_abs", "tmpl_bars"] },
      2,
      0,
    );
    expect(next.items).toEqual(["tmpl_bars", "tmpl_legs", "tmpl_abs"]);
  });

  it("removeQueueItem deletes a slot and keeps at least one", () => {
    const next = removeQueueItem(
      { items: ["tmpl_legs", "tmpl_abs", "tmpl_bars"] },
      1,
    );
    expect(next.items).toEqual(["tmpl_legs", "tmpl_bars"]);
    expect(() => removeQueueItem({ items: ["tmpl_legs"] }, 0)).toThrow(
      "at least one session",
    );
  });

  it("appendQueueItem adds a known template without mutating input", () => {
    const queue = { items: ["tmpl_legs"] };
    const next = appendQueueItem(queue, "tmpl_abs");
    expect(next.items).toEqual(["tmpl_legs", "tmpl_abs"]);
    expect(queue.items).toEqual(["tmpl_legs"]);
    expect(() => appendQueueItem(queue, "tmpl_unknown")).toThrow("Unknown template");
  });
});
