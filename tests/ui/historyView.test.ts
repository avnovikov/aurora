// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoryEntry, SessionEvaluation } from "../../src/domain/program";
import { appendHistory, emptyMemory, saveMemories } from "../../src/session/history";
import { renderHistoryView } from "../../src/ui/historyView";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

const NOW = new Date(2025, 10, 20, 12, 0);

function local(d: number, h = 9, min = 0): string {
  return new Date(2025, 10, d, h, min).toISOString();
}

function seed(
  completedAt: string,
  evaluation: SessionEvaluation,
  reps: number[],
  extra: Partial<Omit<HistoryEntry, "id">> = {},
): void {
  appendHistory({
    completedAt,
    templateId: "t",
    templateName: "Upper body · B",
    evaluation,
    setCount: reps.length,
    exerciseIds: ["pullup"],
    sets: reps.map((completedReps, i) => ({
      exerciseId: "pullup",
      setIndex: i + 1,
      prescribedReps: 6,
      completedReps,
      loggedAt: completedAt,
      stopReason: "completed",
    })),
    ...extra,
  });
}

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = `<div id="app"></div>`;
  root = document.querySelector<HTMLElement>("#app")!;
});

const cards = () => [...root.querySelectorAll<HTMLDetailsElement>("details.history-card")];

describe("History view (#228)", () => {
  it("shows the empty sentence and no key or weeks when nothing is logged", () => {
    renderHistoryView(root, { now: NOW });
    expect(root.querySelector("h1")?.textContent).toBe("History");
    expect(root.querySelector("[data-history-lede]")?.textContent).toBe(
      "History is empty until the first finished session.",
    );
    expect(root.querySelector(".effort-key")).toBeNull();
    expect(root.querySelector(".history-week")).toBeNull();
  });

  it("renders the lede, key, current-week flag and only the newest card open", () => {
    seed(local(12), "wiped", [5]);
    seed(local(18), "easy", [6]);
    seed(local(19, 18, 10), "on_target", [7, 6]);
    renderHistoryView(root, { now: NOW });
    expect(root.querySelector("[data-history-lede]")?.textContent).toBe("3 sessions in 2 weeks");
    expect(root.querySelector(".effort-key")?.textContent).toContain("On target");
    const weeks = [...root.querySelectorAll<HTMLElement>(".history-week")];
    expect(weeks.map((w) => w.hasAttribute("data-current"))).toEqual([true, false]);
    expect(weeks[0]!.querySelector(".history-wk-label")?.textContent).toBe("w/c 17 Nov · this week");
    expect(weeks[1]!.querySelector(".history-wk-count")?.textContent).toBe("1session");
    expect(cards().map((c) => c.open)).toEqual([true, false, false]);
    expect(cards()[0]!.querySelector(".s-when")?.textContent).toBe("Wed 19 Nov · 18:10");
    expect(root.textContent).not.toContain("Some rows are session summaries");
    expect(root.querySelector("[data-pulse-series]")).toBeNull();
  });

  it("a day bar opens its session card", () => {
    seed(local(12), "wiped", [5]);
    seed(local(19), "easy", [6]);
    renderHistoryView(root, { now: NOW });
    const older = cards()[1]!;
    expect(older.open).toBe(false);
    const bar = root.querySelector<HTMLButtonElement>(`[data-open-session="${older.dataset.sessionId}"]`)!;
    expect(bar.getAttribute("aria-label")).toBe("Wed 12 Nov: Wiped");
    bar.click();
    expect(older.open).toBe(true);
  });

  it("an exercise row calls onOpenExercise", () => {
    seed(local(19), "easy", [6]);
    const onOpenExercise = vi.fn();
    renderHistoryView(root, { now: NOW, onOpenExercise });
    root.querySelector<HTMLButtonElement>('[data-open-exercise="pullup"]')!.click();
    expect(onOpenExercise).toHaveBeenCalledWith("pullup");
  });

  it("shows bpm and PB, 'new PB' only when beating earlier stored sets, nothing extra on a first session", () => {
    saveMemories({ pullup: { ...emptyMemory("pullup"), bestReps: 9 } });
    seed(local(18), "easy", [6]);
    seed(local(19), "easy", [9, 8], {
      pulse: { series: [{ t: 1, bpm: 130 }], byExercise: [{ exerciseId: "pullup", averageBpm: 134, sampleCount: 3 }] },
    });
    renderHistoryView(root, { now: NOW, onOpenExercise: () => {} });
    const [newest, first] = cards();
    expect(newest!.querySelector(".s-what")?.textContent).toBe("Upper body · B · strap worn");
    expect(newest!.querySelector(".history-ex-row .r")?.textContent).toBe("9 / 8");
    expect(newest!.querySelector(".history-ex-row .m")?.textContent).toBe("avg 134 bpm · new PB");
    expect(first!.querySelector(".history-ex-row .m")?.textContent).toBe("PB 9");
    expect(first!.querySelector("[data-new-pb]")).toBeNull();
  });

  it("legacy sessions show the set count and names without reps or PB", () => {
    saveMemories({ pullup: { ...emptyMemory("pullup"), bestReps: 9 } });
    appendHistory({
      completedAt: local(17),
      templateId: "day_a",
      templateName: "Lower body · A",
      evaluation: "difficult",
      setCount: 15,
      exerciseIds: ["pullup"],
    });
    renderHistoryView(root, { now: NOW, onOpenExercise: () => {} });
    const card = cards()[0]!;
    expect(card.querySelector(".s-what")?.textContent).toBe("Lower body · A · 15 sets logged");
    expect(card.querySelector(".history-ex-row .r")?.textContent).toBe("");
    expect(card.querySelector(".history-ex-row .m")).toBeNull();
    expect(card.querySelector("[data-open-exercise]")).not.toBeNull();
  });

  it("keeps the filter chip", () => {
    seed(local(19), "easy", [6]);
    const onClearFilter = vi.fn();
    renderHistoryView(root, {
      now: NOW,
      filter: { kind: "exercise", exerciseId: "pullup" },
      onClearFilter,
    });
    const chip = root.querySelector<HTMLButtonElement>("[data-clear-filter]")!;
    expect(chip.textContent).toContain("Exercise ·");
    chip.click();
    expect(onClearFilter).toHaveBeenCalled();
  });

  it("a filtered view keeps PB and 'new PB' from the exercise's full history", () => {
    seed(local(12), "easy", [10]);
    seed(local(18), "easy", [8]);
    seed(local(19), "easy", [11]);
    renderHistoryView(root, { now: NOW, filter: { kind: "exercise", exerciseId: "pullup" } });
    const metas = cards().map((card) => card.querySelector(".history-ex-row .m")?.textContent);
    expect(metas).toEqual(["new PB", "PB 11", "PB 11"]);
  });

  it("a day bar opens its card again after a re-render", () => {
    seed(local(12), "wiped", [5]);
    seed(local(19), "easy", [6]);
    renderHistoryView(root, { now: NOW });
    renderHistoryView(root, { now: NOW });
    const older = cards()[1]!;
    root.querySelector<HTMLButtonElement>(`[data-open-session="${older.dataset.sessionId}"]`)!.click();
    expect(older.open).toBe(true);
  });
});
