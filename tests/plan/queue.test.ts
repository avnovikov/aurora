import { describe, expect, it } from "vitest";
import { completeNext, peekUpcoming, skipNext } from "../../src/plan/queue";

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
});
