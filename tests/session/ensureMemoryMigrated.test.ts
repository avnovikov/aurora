import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { effectiveSkillTier } from "../../src/rules/skillDose";
import { emptyMemory, loadMemories } from "../../src/session/history";
import { ensureMemoryMigrated, loadLevelsToConfirm } from "../../src/session/ensureMemoryMigrated";
import { LEVELS_TO_CONFIRM_KEY, MEMORY_KEY, MEMORY_V2_KEY, PLAN_LEVEL_KEY } from "../../src/storage/storageKeys";
import { useMemoryStorage } from "../helpers/storage";

const NOW = new Date("2026-11-17T12:00:00Z");
const v1With = (id: string, patch: object) => JSON.stringify({ [id]: { ...emptyMemory(id), ...patch } });

describe("ensureMemoryMigrated (#112)", () => {
  useMemoryStorage();
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it("does nothing when v2 already exists, even if v1 differs", () => {
    const v2 = JSON.stringify({ hf_84: emptyMemory("hf_84") });
    localStorage.setItem(MEMORY_V2_KEY, v2);
    localStorage.setItem(MEMORY_KEY, v1With("bulgarian_split", { declaredTier: "advanced" }));
    ensureMemoryMigrated(NOW);
    expect(localStorage.getItem(MEMORY_V2_KEY)).toBe(v2);
    expect(localStorage.getItem(LEVELS_TO_CONFIRM_KEY)).toBeNull();
  });

  it("writes nothing when there is no v1 and no v2", () => {
    ensureMemoryMigrated(NOW);
    expect(localStorage.getItem(MEMORY_V2_KEY)).toBeNull();
    expect(localStorage.getItem(LEVELS_TO_CONFIRM_KEY)).toBeNull();
  });

  it("does not throw or write v2 on corrupt JSON, and leaves v1 in place", () => {
    localStorage.setItem(MEMORY_KEY, "{not json");
    expect(() => ensureMemoryMigrated(NOW)).not.toThrow();
    expect(localStorage.getItem(MEMORY_V2_KEY)).toBeNull();
    expect(localStorage.getItem(MEMORY_KEY)).toBe("{not json");
    expect(warn).toHaveBeenCalledWith("Aurora: memory v1 unreadable; migration skipped");
  });

  it.each(["null", "[1]", '"x"', "42"])("does not throw or write v2 on non-object v1 %s", (raw) => {
    localStorage.setItem(MEMORY_KEY, raw);
    expect(() => ensureMemoryMigrated(NOW)).not.toThrow();
    expect(localStorage.getItem(MEMORY_V2_KEY)).toBeNull();
    expect(localStorage.getItem(MEMORY_KEY)).toBe(raw);
  });

  it("keeps a declaredTier a declaredTier when the plan level is auto", () => {
    localStorage.setItem(PLAN_LEVEL_KEY, "auto");
    localStorage.setItem(MEMORY_KEY, v1With("hf_84", { declaredTier: "intermediate", skillTier: "intermediate" }));
    ensureMemoryMigrated(NOW);
    const memory = loadMemories(NOW).hf_84;
    expect(memory?.declaredTier).toBe("intermediate");
    expect(memory?.planTier).toBeUndefined();
    expect(loadLevelsToConfirm()).toEqual([]);
  });

  it("migrates once and is idempotent on a second run", () => {
    localStorage.setItem(MEMORY_KEY, v1With("bulgarian_split", { declaredTier: "advanced", skillTier: "advanced" }));
    ensureMemoryMigrated(NOW);
    const v2 = localStorage.getItem(MEMORY_V2_KEY);
    const confirm = localStorage.getItem(LEVELS_TO_CONFIRM_KEY);
    expect(v2).not.toBeNull();
    expect(loadMemories(NOW).bulgarian_split?.declaredTier).toBe("advanced");
    ensureMemoryMigrated(NOW);
    expect(localStorage.getItem(MEMORY_V2_KEY)).toBe(v2);
    expect(localStorage.getItem(LEVELS_TO_CONFIRM_KEY)).toBe(confirm);
  });

  it("survives rows it cannot migrate: warns, still writes v2, migrates the good row", () => {
    localStorage.setItem(
      MEMORY_KEY,
      JSON.stringify({
        calf_raise: { ...emptyMemory("calf_raise"), bestReps: 60 },
        hf_71: { ...emptyMemory("hf_71"), bestReps: -1 },
        hf_87: { ...emptyMemory("hf_87"), declaredTier: "legendary", loggedTier: "beginner" },
      }),
    );
    expect(() => ensureMemoryMigrated(NOW)).not.toThrow();
    expect(localStorage.getItem(MEMORY_V2_KEY)).not.toBeNull();
    expect(warn).toHaveBeenCalled();
    let memories: ReturnType<typeof loadMemories> = {};
    expect(() => {
      memories = loadMemories(NOW);
    }).not.toThrow();
    expect(memories.calf_raise?.skillTier).toBe("elite");
    expect(memories.hf_71).toBeDefined();
    expect(memories.hf_87).toBeDefined();
  });

  it.each(["{}", "null", '"x"', "42"])("loadLevelsToConfirm returns [] for non-array %s", (raw) => {
    localStorage.setItem(LEVELS_TO_CONFIRM_KEY, raw);
    expect(loadLevelsToConfirm()).toEqual([]);
  });

  it("loadLevelsToConfirm keeps only strings", () => {
    localStorage.setItem(LEVELS_TO_CONFIRM_KEY, JSON.stringify(["hf_84", 3, null]));
    expect(loadLevelsToConfirm()).toEqual(["hf_84"]);
  });

  it("a passed-through bad row cannot crash tier lookup later", () => {
    localStorage.setItem(MEMORY_KEY, v1With("hf_71", { bestReps: -1 }));
    ensureMemoryMigrated(NOW);
    const memory = loadMemories(NOW).hf_71!;
    expect(memory).not.toHaveProperty("bestReps");
    expect(() => effectiveSkillTier(memory, EXERCISE_GRAPH.hf_71!, NOW)).not.toThrow();
  });

  it("does not throw and leaves v2 absent when the v2 write fails", () => {
    localStorage.setItem(MEMORY_KEY, v1With("hf_84", { declaredTier: "intermediate" }));
    const realSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key: string, value: string) => {
      if (key === MEMORY_V2_KEY) {
        throw new Error("quota");
      }
      realSet(key, value);
    };
    expect(() => ensureMemoryMigrated(NOW)).not.toThrow();
    expect(warn).toHaveBeenCalledWith("Aurora: memory migration failed; v1 left untouched", expect.any(Error));
    expect(localStorage.getItem(MEMORY_V2_KEY)).toBeNull();
  });
});
