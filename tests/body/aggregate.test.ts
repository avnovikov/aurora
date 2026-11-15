import { describe, expect, it } from "vitest";
import { aggregateMuscleLoad } from "../../src/body/aggregate";
import type { HistoryEntry } from "../../src/domain/program";

describe("aggregateMuscleLoad", () => {
  it("scores primary muscles from recent history", () => {
    const now = Date.parse("2026-11-14T08:00:00.000Z");
    const history: HistoryEntry[] = [
      {
        id: "1",
        completedAt: "2026-11-13T08:00:00.000Z",
        templateId: "tmpl_abs",
        templateName: "Abs / Core",
        evaluation: "on_target",
        setCount: 4,
        exerciseIds: ["hollow_hold"],
      },
    ];
    const loads = aggregateMuscleLoad(history, "week", now);
    expect(loads.abdominals).toBe(4);
  });
});
