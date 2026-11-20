import { describe, expect, it } from "vitest";
import type { SessionEvaluation } from "../../src/domain/program";
import type { HistorySessionBlock } from "../../src/progress/historySessionBlocks";
import { buildHistoryWeeks, weekStart } from "../../src/progress/historyWeeks";

/** ISO string for a local wall-clock time, so tests hold in any time zone. */
function local(y: number, m: number, d: number, h = 9, min = 0): string {
  return new Date(y, m - 1, d, h, min).toISOString();
}

function block(
  id: string,
  completedAt: string,
  evaluation: SessionEvaluation,
  exercises: Record<string, number[]> = { pullup: [6, 6] },
  templateName = "Upper body · B",
): HistorySessionBlock {
  return {
    sessionId: id,
    templateName,
    completedAt,
    evaluation,
    legacy: false,
    legacyRows: [],
    exercises: Object.entries(exercises).map(([exerciseId, reps]) => ({
      exerciseId,
      exerciseName: exerciseId,
      completedRepsBySet: reps,
    })),
  };
}

function legacy(id: string, completedAt: string, setCount: number): HistorySessionBlock {
  return {
    sessionId: id,
    templateName: "Lower body · A",
    completedAt,
    evaluation: "difficult",
    legacy: true,
    exercises: [],
    legacyRows: ["squat", "lunge"].map((exerciseId) => ({
      key: `${id}:legacy:${exerciseId}`,
      kind: "legacy_session" as const,
      exerciseId,
      exerciseName: exerciseId,
      setIndex: 0,
      completedReps: 0,
      prescribedReps: 0,
      when: completedAt,
      sessionId: id,
      stopReason: "completed",
      sessionSetCount: setCount,
    })),
  };
}

const NOW = new Date(2025, 10, 20, 12, 0); // Thu 20 Nov 2025 (the mock's calendar)

describe("buildHistoryWeeks: weeks", () => {
  it("splits a Sunday night and the next Monday morning into two Monday-start weeks, newest first", () => {
    const model = buildHistoryWeeks({
      blocks: [
        block("sun", local(2025, 11, 16, 23, 30), "easy"),
        block("mon", local(2025, 11, 17, 0, 15), "wiped"),
      ],
      now: NOW,
    });
    expect(model.weeks.map((w) => w.label)).toEqual(["w/c 17 Nov", "w/c 10 Nov"]);
    expect(model.weeks[0]!.sessions.map((s) => s.sessionId)).toEqual(["mon"]);
    expect(model.weeks[1]!.sessions.map((s) => s.sessionId)).toEqual(["sun"]);
    expect(model.weeks[0]!.days[0]).toMatchObject({ label: "M 17", level: 4, sessionId: "mon" });
    expect(model.weeks[1]!.days[6]).toMatchObject({ label: "S 16", level: 1, sessionId: "sun" });
    expect(model.weeks[0]!.days.map((d) => d.label)).toEqual([
      "M 17", "T 18", "W 19", "T 20", "F 21", "S 22", "S 23",
    ]);
  });

  it("weekStart is Monday 00:00 local, Sunday belongs to the week before", () => {
    expect(weekStart(new Date(2025, 10, 23, 22)).getTime()).toBe(new Date(2025, 10, 17).getTime());
    expect(weekStart(new Date(2025, 10, 17, 0, 0)).getTime()).toBe(new Date(2025, 10, 17).getTime());
  });

  it("flags only the week containing now as current, and counts sessions", () => {
    const model = buildHistoryWeeks({
      blocks: [
        block("a", local(2025, 11, 19, 18, 10), "on_target"),
        block("b", local(2025, 11, 18), "easy"),
        block("c", local(2025, 11, 12), "wiped"),
      ],
      now: NOW,
    });
    expect(model.sessionCount).toBe(3);
    expect(model.weeks.map((w) => [w.current, w.count])).toEqual([
      [true, 2],
      [false, 1],
    ]);
    const later = buildHistoryWeeks({ blocks: [block("a", local(2025, 11, 19), "easy")], now: new Date(2025, 10, 24) });
    expect(later.weeks[0]!.current).toBe(false);
  });
});

describe("buildHistoryWeeks: effort", () => {
  it("maps easy 1, on target 2, difficult 3, wiped 4; rest days are 0", () => {
    const model = buildHistoryWeeks({
      blocks: [
        block("e", local(2025, 11, 17), "easy"),
        block("o", local(2025, 11, 18), "on_target"),
        block("d", local(2025, 11, 19), "difficult"),
        block("w", local(2025, 11, 20), "wiped"),
      ],
      now: NOW,
    });
    expect(model.weeks[0]!.days.map((d) => d.level)).toEqual([1, 2, 3, 4, 0, 0, 0]);
    expect(model.weeks[0]!.days[4]!.sessionId).toBeUndefined();
  });

  it("two sessions on one day show the hardest level and open the newest session", () => {
    const model = buildHistoryWeeks({
      blocks: [
        block("morning-wiped", local(2025, 11, 18, 7), "wiped"),
        block("evening-easy", local(2025, 11, 18, 19), "easy"),
      ],
      now: NOW,
    });
    expect(model.weeks[0]!.days[1]).toMatchObject({
      level: 4,
      effortLabel: "Wiped",
      sessionId: "evening-easy",
    });
    expect(model.weeks[0]!.count).toBe(2);
  });
});

describe("buildHistoryWeeks: cards and personal bests", () => {
  it("formats the title in local time and marks strap wear", () => {
    const withPulse = {
      ...block("a", local(2025, 11, 19, 18, 10), "on_target"),
      pulse: { series: [{ t: 1, bpm: 130 }], byExercise: [] },
    };
    const card = buildHistoryWeeks({ blocks: [withPulse], now: NOW }).weeks[0]!.sessions[0]!;
    expect(card).toMatchObject({
      title: "Wed 19 Nov · 18:10",
      templateName: "Upper body · B",
      effortLabel: "On target",
      strapWorn: true,
    });
  });

  it("shows the stored personal best and omits it when there is none", () => {
    const card = buildHistoryWeeks({
      blocks: [block("a", local(2025, 11, 19), "easy", { pullup: [6], row: [9] })],
      personalBests: { pullup: 15 },
      now: NOW,
    }).weeks[0]!.sessions[0]!;
    expect(card.exercises[0]).toMatchObject({ exerciseId: "pullup", personalBest: 15 });
    expect(card.exercises[1]).toMatchObject({ exerciseId: "row", personalBest: 9 }); // from history
  });

  it("PB is the higher of memory and stored history sets", () => {
    const model = buildHistoryWeeks({
      blocks: [
        block("new", local(2025, 11, 19), "easy", { pullup: [20, 20, 20], row: [8] }),
        block("old", local(2025, 11, 14), "easy", { row: [12] }),
      ],
      personalBests: { pullup: 10 }, // memory lags behind history; row has no memory
      now: NOW,
    });
    const [newest, old] = model.weeks.flatMap((w) => w.sessions);
    expect(newest!.exercises.map((e) => e.personalBest)).toEqual([20, 12]);
    expect(old!.exercises[0]!.personalBest).toBe(12);
  });

  it("memory wins when it is higher, and no PB without either source", () => {
    const card = buildHistoryWeeks({
      blocks: [legacy("leg", local(2025, 11, 17), 4), block("a", local(2025, 11, 19), "easy", { pullup: [6] })],
      personalBests: { pullup: 15 },
      now: NOW,
    }).weeks[0]!.sessions;
    expect(card[0]!.exercises[0]!.personalBest).toBe(15);
    expect(card[1]!.exercises.every((e) => e.personalBest === undefined)).toBe(true);
  });

  it("claims a new PB only when the top set beats every earlier stored set", () => {
    const model = buildHistoryWeeks({
      blocks: [
        block("new", local(2025, 11, 19), "easy", { pullup: [8, 7], row: [9] }),
        block("mid", local(2025, 11, 14), "easy", { pullup: [7, 6], row: [10] }),
        block("old", local(2025, 11, 10), "easy", { pullup: [5] }, "Lower body · A"),
      ],
      personalBests: { pullup: 8, row: 10 },
      now: NOW,
    });
    const [newest, mid, old] = model.weeks.flatMap((w) => w.sessions);
    expect(newest!.exercises[0]).toMatchObject({ exerciseId: "pullup", newPersonalBest: true });
    expect(newest!.exercises[1]!.newPersonalBest).toBeUndefined(); // 9 does not beat 10
    expect(mid!.exercises[0]!.newPersonalBest).toBe(true); // 7 beats 5, any template
    expect(old!.exercises[0]!.newPersonalBest).toBeUndefined(); // first-ever session
  });

  it("ties are not a new PB, and later sessions are not counted as earlier", () => {
    const model = buildHistoryWeeks({
      blocks: [
        block("later", local(2025, 11, 19), "easy", { pullup: [12] }),
        block("tie", local(2025, 11, 18), "easy", { pullup: [6] }),
        block("first", local(2025, 11, 17), "easy", { pullup: [6] }),
      ],
      now: NOW,
    });
    const tie = model.weeks[0]!.sessions.find((s) => s.sessionId === "tie")!;
    expect(tie.exercises[0]!.newPersonalBest).toBeUndefined();
  });

  it("legacy sessions give a set count, names only, and no reps or PB marks", () => {
    const model = buildHistoryWeeks({
      blocks: [
        block("new", local(2025, 11, 19), "easy", { squat: [10] }),
        legacy("leg", local(2025, 11, 17), 15),
      ],
      personalBests: { squat: 12 },
      now: NOW,
    });
    const card = model.weeks[0]!.sessions.find((s) => s.sessionId === "leg")!;
    expect(card.legacy).toBe(true);
    expect(card.setsLogged).toBe(15);
    expect(card.exercises).toEqual([
      { exerciseId: "squat", name: "squat" },
      { exerciseId: "lunge", name: "lunge" },
    ]);
    // A legacy session has no stored reps, so it cannot back a "new PB".
    const fresh = model.weeks[0]!.sessions.find((s) => s.sessionId === "new")!;
    expect(fresh.exercises[0]!.newPersonalBest).toBeUndefined();
  });

  it("is empty with no blocks", () => {
    expect(buildHistoryWeeks({ blocks: [], now: NOW })).toEqual({ sessionCount: 0, weeks: [] });
  });
});
