import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyBundledImport, applyCalisteniappImport } from "../../src/import/applyImport";
import type { CalisteniappSession } from "../../src/import/calisteniapp";
import { loadHistory, loadMemories } from "../../src/session/history";
import { HISTORY_KEY } from "../../src/storage/storageKeys";
import { useMemoryStorage } from "../helpers/storage";

const NOW = new Date("2026-11-22T12:00:00Z");
const session = (date: string): CalisteniappSession => ({
  title: "Phase 3 - Session A - Bigger legs",
  date_estimated: date,
  summary: { Effort: "Easy" },
  exercises: [
    { name: "Calf raises", target: "4 sets · 20 reps", sets: [{ set: 1, result: "20 reps", weight: null, effort: null }] },
  ],
});

describe("applying a Calisteniapp import (#291)", () => {
  useMemoryStorage();

  it("adds history and levels once, then only new sessions", () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([{ id: "hist_1", completedAt: "2026-11-21T09:00:00.000Z", templateId: "day_a", templateName: "A", evaluation: "easy", setCount: 0, exerciseIds: [] }]),
    );
    expect(applyCalisteniappImport([session("2026-11-10")], NOW)).toMatchObject({ added: 1, sets: 1 });
    expect(loadHistory().map((h) => h.templateName)).toEqual(["A", "Phase 3 - Session A - Bigger legs"]);
    expect(loadMemories(NOW).calf_raise!.bestReps).toBe(20);

    expect(applyCalisteniappImport([session("2026-11-10")], NOW).added).toBe(0);
    expect(applyCalisteniappImport([session("2026-11-10"), session("2026-11-03")], NOW).added).toBe(1);
    expect(loadHistory()).toHaveLength(3);
  });

  // A local one-off build bundles the athlete's file; CI and clean checkouts do not.
  it.skipIf(existsSync("src/data/private/calisteniapp-history.json"))("does nothing when the build bundles no file", () => {
    expect(applyBundledImport(NOW)).toBeNull();
  });
});
