// Week bucketing across DST changes. TZ is set before any Date is built.
process.env.TZ = "Europe/London";

import { describe, expect, it } from "vitest";
import type { HistorySessionBlock } from "../../src/progress/historySessionBlocks";
import { buildHistoryWeeks, weekStart } from "../../src/progress/historyWeeks";

function block(id: string, at: Date): HistorySessionBlock {
  return {
    sessionId: id,
    templateName: "Upper body · B",
    completedAt: at.toISOString(),
    evaluation: "easy",
    legacy: false,
    legacyRows: [],
    exercises: [],
  };
}

describe("buildHistoryWeeks across DST (Europe/London)", () => {
  it("clocks going back (Sun 26 Oct 2025): Sunday night and Monday just after midnight split into two weeks", () => {
    const sunday = new Date(2025, 9, 26, 23, 30);
    const monday = new Date(2025, 9, 27, 0, 30);
    expect(weekStart(monday)).toEqual(new Date(2025, 9, 27));
    const model = buildHistoryWeeks({
      blocks: [block("sun", sunday), block("mon", monday)],
      now: new Date(2025, 9, 28, 12),
    });
    expect(model.weeks.map((week) => week.label)).toEqual(["w/c 27 Oct", "w/c 20 Oct"]);
    expect(model.weeks[0]!.current).toBe(true);
    const lastWeek = model.weeks[1]!;
    expect(lastWeek.days.map((day) => day.label)).toEqual([
      "M 20", "T 21", "W 22", "T 23", "F 24", "S 25", "S 26",
    ]);
    expect(lastWeek.days[6]!.sessionId).toBe("sun");
  });

  it("clocks going forward (Sun 30 Mar 2025): Monday 00:15 and Sunday 23:00 share one week", () => {
    const model = buildHistoryWeeks({
      blocks: [block("mon", new Date(2025, 2, 24, 0, 15)), block("sun", new Date(2025, 2, 30, 23, 0))],
      now: new Date(2025, 2, 31, 12),
    });
    expect(model.weeks).toHaveLength(1);
    expect(model.weeks[0]!.label).toBe("w/c 24 Mar");
    expect(model.weeks[0]!.current).toBe(false);
    expect(model.weeks[0]!.days.map((day) => day.sessionId)).toEqual([
      "mon", undefined, undefined, undefined, undefined, undefined, "sun",
    ]);
  });
});
