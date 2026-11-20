// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { missingGear } from "../../src/safety/gear";
import { appendHistory } from "../../src/session/history";
import { loadProfile, saveProfile } from "../../src/settings/profile";
import { bootApp } from "../../src/ui/app";
import { renderBodyView } from "../../src/ui/bodyView";
import { useMemoryStorage } from "../helpers/storage";

useMemoryStorage();

const NOW = Date.parse("2026-11-20T08:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

let root: HTMLElement;

/** Push and squat work, no pulling: Push v Pull is the most uneven pair. */
function seedPushOnly(daysAgo = 2): void {
  appendHistory({
    completedAt: new Date(NOW - daysAgo * DAY_MS).toISOString(),
    templateId: "t",
    templateName: "Push day",
    evaluation: "on_target",
    setCount: 6,
    exerciseIds: ["scap_pushup", "bodyweight_squat", "hip_hinge"],
  });
}

beforeEach(() => {
  saveProfile({ ...loadProfile(), setupDone: true });
  document.body.innerHTML = `<div id="app"></div>`;
  root = document.querySelector<HTMLElement>("#app")!;
});

const words = () => [...root.querySelectorAll(".bb-word")].map((el) => el.textContent);

describe("Body tab: balance view (#234)", () => {
  it("leads with a balance headline and a caricature", () => {
    seedPushOnly();
    renderBodyView(root, { nowMs: NOW });
    expect(root.querySelector(".bb-verdict")?.textContent).toContain("Pushing has no pulling to match.");
    expect(root.querySelector(".bb-sub")?.textContent).toMatch(/had none in this window\.$/);
    const cari = root.querySelector(".bb-cari");
    expect(cari?.querySelector("svg[role='img'][aria-label]")).not.toBeNull();
    // Reduced motion: a still group sits beside the animated one (CSS picks).
    expect(cari?.querySelector('g[class$="-m"] animate')).not.toBeNull();
    expect(cari?.querySelector('g[class$="-s"] animate')).toBeNull();
    expect(cari?.querySelector('g[class$="-s"]')).not.toBeNull();
  });

  it("shows five balance rows, Abs v Lower back last, with no comment lines", () => {
    seedPushOnly();
    renderBodyView(root, { nowMs: NOW });
    const rows = [...root.querySelectorAll(".bb-row")];
    expect(rows.map((row) => row.querySelector(".bb-lab")?.textContent)).toEqual([
      "Push v Pull", "Upper v Lower", "Front v Back", "Squat v Hinge", "Abs v Lower back",
    ]);
    for (const row of rows) {
      expect([...row.children].map((child) => child.className)).toEqual(["bb-top", "bb-bar"]);
    }
    expect(words()[0]).toBe("No pulling");
  });

  it("puts the accent on exactly one takeaway word", () => {
    seedPushOnly();
    renderBodyView(root, { nowMs: NOW });
    const hot = root.querySelectorAll("[data-hot]");
    expect(hot).toHaveLength(1);
    expect(hot[0]?.textContent).toBe("No pulling");
  });

  it("draws the figure with no text, dashed Not trained regions and Front/Back captions", () => {
    seedPushOnly();
    renderBodyView(root, { nowMs: NOW });
    const hero = root.querySelector(".bb-hero")!;
    expect(hero.querySelector("text")).toBeNull();
    expect(hero.querySelectorAll('polygon[data-area="lats"][data-l="n"]').length).toBeGreaterThan(0);
    expect(hero.querySelector('mask[id$="-inside"]')).not.toBeNull();
    expect([...root.querySelectorAll(".bb-caps span")].map((el) => el.textContent)).toEqual(["Front", "Back"]);
    expect(root.querySelector(".bb-lines")?.textContent).toContain("Not trained:");
    expect(root.querySelectorAll(".bb-key li")).toHaveLength(4);
  });

  it("gives each figure its own SVG ids", () => {
    seedPushOnly();
    const other = document.createElement("div");
    document.body.append(other);
    renderBodyView(root, { nowMs: NOW });
    renderBodyView(other, { nowMs: NOW });
    const ids = [...document.querySelectorAll(".bb-hero [id]")].map((el) => el.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(ids.length);
    for (const hero of document.querySelectorAll(".bb-hero")) {
      const maskId = hero.querySelector("mask")!.id;
      expect(hero.querySelector("g[mask]")?.getAttribute("mask")).toBe(`url(#${maskId})`);
    }
  });

  it("shows Library names in sentence case", () => {
    seedPushOnly();
    renderBodyView(root, { nowMs: NOW });
    for (const name of root.querySelectorAll(".bb-nm")) {
      const words = name.textContent!.split(/[\s-]+/).slice(1);
      expect(words.filter((word) => /^[A-Z][a-z]/.test(word) && word !== "Superman")).toEqual([]);
    }
  });

  it("removes the old list, tagline, raw scores and mode buttons", () => {
    seedPushOnly();
    renderBodyView(root, { nowMs: NOW });
    expect(root.querySelector(".body-bars, .body-row, .tagline, [data-body-mode]")).toBeNull();
    expect(root.textContent).not.toContain("mate");
    expect(root.textContent).not.toContain("Muscle load");
  });

  it("switches window with the five-cell control", () => {
    seedPushOnly(60);
    renderBodyView(root, { nowMs: NOW });
    const cells = [...root.querySelectorAll<HTMLButtonElement>("[data-body-window]")];
    expect(cells.map((cell) => cell.textContent)).toEqual(["Overall", "Month", "3 months", "Half year", "Year"]);
    expect(root.querySelector('[aria-current="true"]')?.textContent).toBe("Overall");
    const figure = root.querySelector(".bb-hero");

    root.querySelector<HTMLButtonElement>('[data-body-window="month"]')!.click();
    expect(root.querySelector('.bb-win [aria-current="true"]')?.textContent).toBe("Month");
    expect(root.querySelector("main")?.dataset.state).toBe("no_sessions");
    expect(root.querySelector(".bb-verdict")?.textContent).toBe("No sessions in the last 30 days");
    expect(words().every((word) => word === "No data in this window")).toBe(true);
    // The same figure is kept so its regions animate to the new levels.
    expect(root.querySelector(".bb-hero")).toBe(figure);
    expect(root.querySelector(".bb-try-btn")?.textContent).toBe("Try 3 months");

    root.querySelector<HTMLButtonElement>(".bb-try-btn")!.click();
    expect(root.querySelector('.bb-win [aria-current="true"]')?.textContent).toBe("3 months");
    expect(root.querySelector("main")?.dataset.state).toBe("ready");
  });

  it("suggests doable Library moves and opens one on tap", () => {
    seedPushOnly();
    const onOpenExercise = vi.fn();
    renderBodyView(root, { nowMs: NOW, onOpenExercise });
    const rows = [...root.querySelectorAll<HTMLButtonElement>(".bb-add [data-open-exercise]")];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(3);
    const equipment = loadProfile().equipment;
    for (const row of rows) {
      const exercise = EXERCISE_GRAPH[row.dataset.openExercise!];
      expect(exercise).toBeDefined();
      expect(missingGear(exercise!, equipment)).toEqual([]);
      expect(exercise!.pattern).toMatch(/pull/);
    }
    expect(root.querySelector(".bb-foot")?.textContent).toBe("Your plan is not changed.");
    rows[0]!.click();
    expect(onOpenExercise).toHaveBeenCalledWith(rows[0]!.dataset.openExercise, "overall");
  });

  it("shows the empty state before the first finished session", () => {
    renderBodyView(root, { nowMs: NOW });
    const main = root.querySelector("main")!;
    expect(main.dataset.state).toBe("empty");
    expect(root.querySelector(".bb-empty")?.textContent).toBe("Body fills in after your first finished session.");
    expect(root.querySelector(".bb-bal, .bb-add, .bb-lines")).toBeNull();
    expect(root.querySelector(".bb-cari")?.getAttribute("data-caricature")).toBe("untrained");
    expect(root.querySelectorAll(".bb-hero polygon").length).toBeGreaterThan(0);
  });
});

describe("Body → exercise → Back (#219, #234)", () => {
  it("opens the exercise page and Back returns to Body on the same window", () => {
    seedPushOnly();
    bootApp(root);
    root.querySelector<HTMLElement>('[data-tab="body"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-body-window="year"]')!.click();
    const move = root.querySelector<HTMLButtonElement>(".bb-add [data-open-exercise]")!;
    move.click();
    expect(root.querySelector<HTMLElement>("[data-tab].active")?.dataset.tab).toBe("library");
    expect(root.querySelector("[data-lib-back]")?.textContent?.trim()).toBe("← Back to Body");
    root.querySelector<HTMLElement>("[data-lib-back]")!.click();
    expect(root.querySelector<HTMLElement>("[data-tab].active")?.dataset.tab).toBe("body");
    expect(root.querySelector('.bb-win [aria-current="true"]')?.textContent).toBe("Year");
  });
});
