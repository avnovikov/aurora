// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { appendHistory, emptyMemory, saveMemories } from "../../src/session/history";
import { loadProfile, saveProfile } from "../../src/settings/profile";
import { bootApp } from "../../src/ui/app";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

let root: HTMLElement;

function seedSession(): void {
  saveProfile({ ...loadProfile(), setupDone: true });
  saveMemories({
    pullup: { ...emptyMemory("pullup"), bestReps: 6, sessionsAtStandard: 1, skillTier: "beginner" },
  });
  appendHistory({
    completedAt: "2026-11-19T18:10:00.000Z",
    templateId: "t",
    templateName: "Upper body · B",
    evaluation: "on_target",
    setCount: 2,
    exerciseIds: ["pullup"],
    sets: [1, 2].map((setIndex) => ({
      exerciseId: "pullup",
      setIndex,
      prescribedReps: 6,
      completedReps: 6,
      loggedAt: "2026-11-19T18:00:00.000Z",
      stopReason: "completed" as const,
      averageBpm: 134,
    })),
  });
}

function click(selector: string): void {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) {
    throw new Error(`Nothing matches ${selector}`);
  }
  el.click();
}

const activeTab = () => root.querySelector<HTMLElement>("[data-tab].active")?.dataset.tab;
const backLabel = () => root.querySelector("[data-lib-back]")?.textContent?.trim();
const phoneBack = (state: unknown = null) =>
  window.dispatchEvent(Object.assign(new Event("popstate"), { state }));

beforeEach(() => {
  seedSession();
  document.body.innerHTML = `<div id="app"></div>`;
  root = document.querySelector<HTMLElement>("#app")!;
  bootApp(root);
});

describe("History rows (#219)", () => {
  it("show the average heart rate in bpm and no developer subtitle", () => {
    click('[data-tab="history"]');
    expect(root.textContent).toContain("6 / 6 · avg 134 bpm");
    expect(root.textContent).not.toContain("exercises rolled up");
  });
});

describe("drill-down Back (#219)", () => {
  it("History → exercise → Back returns to History, and the button says so", () => {
    click('[data-tab="history"]');
    click('[data-open-exercise="pullup"]');
    expect(activeTab()).toBe("library");
    expect(backLabel()).toBe("← Back to History");
    click("[data-lib-back]");
    expect(activeTab()).toBe("history");
    expect(root.querySelector("[data-open-exercise]")).not.toBeNull();
  });

  it("the phone's Back (popstate) also returns from the exercise to History", () => {
    click('[data-tab="history"]');
    click('[data-open-exercise="pullup"]');
    phoneBack();
    expect(activeTab()).toBe("history");
  });

  it("Progress → History → exercise → Back → Back returns to Progress, keeping the filter", () => {
    click('[data-tab="progress"]');
    const rows = [...root.querySelectorAll<HTMLElement>("[data-history-kind]")];
    const pullupRow = rows.find(
      (row) =>
        row.dataset.historyExercise === "pullup" ||
        (row.dataset.historyIds ?? "").split(",").includes("pullup"),
    );
    expect(pullupRow, rows.map((r) => r.outerHTML).join("\n")).toBeDefined();
    pullupRow!.click();
    expect(activeTab()).toBe("history");
    const chip = root.querySelector("[data-clear-filter]")?.textContent;
    expect(chip).toBeTruthy();
    click("[data-open-exercise]");
    expect(backLabel()).toBe("← Back to History");
    click("[data-lib-back]");
    expect(activeTab()).toBe("history");
    expect(root.querySelector("[data-clear-filter]")?.textContent).toBe(chip);
    phoneBack();
    expect(activeTab()).toBe("progress");
  });

  it("Library list → exercise → Back returns to the list", () => {
    click('[data-tab="library"]');
    const first = root.querySelector<HTMLElement>("[data-exercise-id]");
    expect(first).not.toBeNull();
    first!.click();
    expect(backLabel()).toBe("← Back to list");
    click("[data-lib-back]");
    expect(root.querySelector("[data-lib-back]")).toBeNull();
    expect(activeTab()).toBe("library");
  });

  it("a progression link from an exercise goes Back to that exercise, then to History", () => {
    click('[data-tab="history"]');
    click('[data-open-exercise="pullup"]');
    const title = root.querySelector("h1")?.textContent;
    click("[data-chain-id]");
    expect(root.querySelector("h1")?.textContent).not.toBe(title);
    expect(backLabel()).toBe(`← Back to ${title}`);
    click("[data-lib-back]");
    expect(root.querySelector("h1")?.textContent).toBe(title);
    expect(backLabel()).toBe("← Back to History");
  });

  it("a bottom-bar tab tap clears the drill-down history", () => {
    click('[data-tab="history"]');
    click('[data-open-exercise="pullup"]');
    click('[data-tab="library"]');
    expect(root.querySelector("[data-lib-back]")).toBeNull();
    phoneBack({ auroraNavDepth: 0 });
    expect(activeTab()).toBe("library");
  });
});
