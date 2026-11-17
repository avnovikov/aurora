# Skill Level Inference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the family tier cascade with evidence-based level inference (#112). Levels record their source. Untested moves are inferred only from two tested family members, one tier below the evidence. The plan level becomes a dose default, never evidence.

**Architecture:** Each `ExerciseMemory` stores evidence fields: `declaredTier`, `loggedTier`, `inferred`, `failedCaps` (one per failing exercise), `planTier`. `skillTier` becomes a cached value derived from those fields, refreshed on load, so every existing reader keeps working. One pure function, `inferTiers`, computes all inferred levels from the family ladder index. Declare, set logging, session close and migration call it.

**Tech Stack:** TypeScript, Vitest (`npx vitest run`), `npx tsc --noEmit`, `npm run smell` (lint). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-17-skill-level-inference-design.md` (approved 2026-11-17).

## Global Constraints

- Tier order: `novice < beginner < intermediate < advanced < elite` (`SKILL_TIERS` in `src/domain/skillTier.ts`).
- Constants, copied verbatim from the spec: `MIN_SUPPORTERS = 2`, inferred tier = supporting tier − 1, distance 1 rung (2 rungs only with ≥ 2 agreeing supporters), `INFERRED_TTL_DAYS = 21`, `RETEST_AFTER_DAYS = 42`, cross-family suggestion at ≥ 1/3 of a pattern's families, minimum 2.
- Inference flows **downward only**: supporters must have a strictly higher family rank than the member.
- Tested results (declare, logged reps) are never bounded or lowered by inference.
- Every function that depends on time takes `now: Date`. Call sites pass `new Date()`. An ISO time in the future counts as `now`.
- Doses come only from Library rules. Nothing in this plan writes doses.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work in `.worktrees/112-skill-level-inference` (branch `docs/112-skill-level-inference`, rebased on `origin/poc`).

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/domain/types.ts` | modify | `ExerciseMemory` evidence fields, `InferredTier`, `FailedCap` |
| `src/domain/skillTier.ts` | modify | `minTier`, `stepDown` |
| `src/progress/levelEvidence.ts` | create | `testedTier`, `liveInferredTier`, `evidenceTier`, `needsRetest`, `refreshSkillTier`, constants |
| `src/progress/inferTiers.ts` | create | Rules 1–5, 2 (failure cap), 8 (expiry), 9 (jump bound) |
| `src/progress/cascadeFamilyTiers.ts` | delete | Replaced by `inferTiers` |
| `src/progress/suggestTiers.ts` | create | Rule 6: cross-family suggestions |
| `src/rules/skillDose.ts` | modify | `effectiveSkillTier` reads evidence fields |
| `src/session/history.ts` | modify | Declare, `recordBestReps`, `applySetLogToMemory` (rule 7), refresh on load, v2 key |
| `src/plan/levelDeclare.ts` | modify | Plan level writes `planTier` |
| `src/session/memoryMigration.ts` | create | Pure v1 → v2 migration |
| `src/session/ensureMemoryMigrated.ts` | create | Runs migration once at boot |
| `src/storage/storageKeys.ts` | modify | `MEMORY_V2_KEY`, `LEVELS_TO_CONFIRM_KEY` |
| `src/main.ts` | modify | Call `ensureMemoryMigrated()` |
| `src/library/levelSource.ts` | create | Text for a level's source and the retest flag |
| `src/library/libraryDetail.ts`, `src/ui/libraryView.ts` | modify | Show source, retest and suggestion; new hint |
| `src/ui/settingsPage.ts`, `src/ui/settingsView.ts` | modify | "Levels to confirm" notice |

---

### Task 1: Evidence fields and tier helpers

**Files:**
- Modify: `src/domain/types.ts` (the `ExerciseMemory` interface, ~line 113)
- Modify: `src/domain/skillTier.ts`
- Create: `src/progress/levelEvidence.ts`
- Test: `tests/progress/levelEvidence.test.ts`

**Interfaces:**
- Produces: `minTier(a,b)`, `stepDown(tier): SkillTier | null`, `testedTier(m)`, `liveInferredTier(m, now)`, `evidenceTier(m, now)`, `needsRetest(m, now)`, `refreshSkillTier(m, now): ExerciseMemory`, `INFERRED_TTL_DAYS`, `RETEST_AFTER_DAYS`, `ageInDays(iso, now)`.

- [ ] **Step 1: Write the failing test** at `tests/progress/levelEvidence.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { minTier, stepDown } from "../../src/domain/skillTier";
import {
  evidenceTier,
  liveInferredTier,
  needsRetest,
  refreshSkillTier,
  testedTier,
} from "../../src/progress/levelEvidence";
import { emptyMemory } from "../../src/session/history";

const NOW = new Date("2026-11-17T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe("tier helpers", () => {
  it("minTier and stepDown", () => {
    expect(minTier("advanced", "beginner")).toBe("beginner");
    expect(stepDown("advanced")).toBe("intermediate");
    expect(stepDown("novice")).toBeNull();
  });
});

describe("level evidence", () => {
  const base = emptyMemory("x");

  it("tested tier is the higher of declared and logged", () => {
    expect(testedTier(base)).toBeUndefined();
    expect(testedTier({ ...base, declaredTier: "beginner", loggedTier: "advanced" })).toBe("advanced");
  });

  it("inferred tiers expire after 21 days; a future time counts as now", () => {
    const live = { ...base, inferred: { tier: "intermediate" as const, from: ["a", "b"], at: daysAgo(20) } };
    const dead = { ...base, inferred: { tier: "intermediate" as const, from: ["a", "b"], at: daysAgo(22) } };
    const future = { ...base, inferred: { tier: "intermediate" as const, from: ["a", "b"], at: daysAgo(-5) } };
    expect(liveInferredTier(live, NOW)).toBe("intermediate");
    expect(liveInferredTier(dead, NOW)).toBeUndefined();
    expect(liveInferredTier(future, NOW)).toBe("intermediate");
  });

  it("evidence tier = max(tested, live inferred, plan default)", () => {
    expect(evidenceTier(base, NOW)).toBeUndefined();
    expect(evidenceTier({ ...base, planTier: "intermediate", loggedTier: "beginner" }, NOW)).toBe("intermediate");
    expect(refreshSkillTier({ ...base, declaredTier: "advanced" }, NOW).skillTier).toBe("advanced");
    expect(refreshSkillTier(base, NOW).skillTier).toBeUndefined();
  });

  it("flags a tested level for retest after 42 days without a session", () => {
    expect(needsRetest({ ...base, declaredTier: "advanced", declaredAt: daysAgo(43) }, NOW)).toBe(true);
    expect(needsRetest({ ...base, declaredTier: "advanced", declaredAt: daysAgo(43), lastSessionAt: daysAgo(3) }, NOW)).toBe(false);
    expect(needsRetest({ ...base, planTier: "advanced" }, NOW)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/progress/levelEvidence.test.ts`
Expected: FAIL with `Cannot find module '../../src/progress/levelEvidence'`.

- [ ] **Step 3: Implement**

In `src/domain/types.ts`, add these interfaces before `ExerciseMemory`, and add the new fields at the end of `ExerciseMemory` (keep every existing field):

```ts
/** A level inferred from harder tested family members (#112). */
export interface InferredTier {
  tier: SkillTier;
  /** Supporting exercise ids (tested, harder rungs). */
  from: string[];
  /** ISO time the tier was first inferred at this value. */
  at: string;
}

/** Ceiling on inference after a failed set on an easier rung (#112 rule 2). */
export interface FailedCap {
  tier: SkillTier;
  /** The exercise whose failed set set the cap. */
  from: string;
  at: string;
}
```

```ts
  /** ISO time of the athlete's last Library pick. */
  declaredAt?: string;
  /** Highest tier proven by logged reps against standards (tested). */
  loggedTier?: SkillTier;
  /** ISO time of the last logged set on this move. */
  lastSessionAt?: string;
  /** Derived by `inferTiers`; never set by hand. */
  inferred?: InferredTier;
  failedCaps?: FailedCap[];
  /** Dose default from the plan level; never evidence. */
  planTier?: SkillTier;
```

Change the doc comment on `skillTier` to: `/** Cached effective tier (derived by refreshSkillTier); never write directly. */`

Append to `src/domain/skillTier.ts`:

```ts
export function minTier(a: SkillTier, b: SkillTier): SkillTier {
  return tierRank(a) <= tierRank(b) ? a : b;
}

/** One tier lower, or null below novice. */
export function stepDown(tier: SkillTier): SkillTier | null {
  const index = tierRank(tier);
  return index === 0 ? null : SKILL_TIERS[index - 1];
}
```

Create `src/progress/levelEvidence.ts`:

```ts
import { maxTier } from "../domain/skillTier";
import type { ExerciseMemory, SkillTier } from "../domain/types";

/** Unconfirmed inferred levels lapse after this (#112 rule 8). */
export const INFERRED_TTL_DAYS = 21;
/** Tested levels are flagged for retest after this long without a session. */
export const RETEST_AFTER_DAYS = 42;

const DAY_MS = 86_400_000;

/** Whole or fractional days from `iso` to `now`; a future or bad time counts as now (0). */
export function ageInDays(iso: string, now: Date): number {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) {
    return 0;
  }
  return Math.max(0, (now.getTime() - at) / DAY_MS);
}

function maxOf(tiers: ReadonlyArray<SkillTier | undefined>): SkillTier | undefined {
  return tiers.reduce<SkillTier | undefined>(
    (best, tier) => (tier === undefined ? best : best === undefined ? tier : maxTier(best, tier)),
    undefined,
  );
}

/** The athlete's own evidence: Library pick or logged reps. */
export function testedTier(memory: ExerciseMemory): SkillTier | undefined {
  return maxOf([memory.declaredTier, memory.loggedTier]);
}

export function liveInferredTier(memory: ExerciseMemory, now: Date): SkillTier | undefined {
  const inferred = memory.inferred;
  if (!inferred || ageInDays(inferred.at, now) > INFERRED_TTL_DAYS) {
    return undefined;
  }
  return inferred.tier;
}

/** Effective tier from evidence: max(tested, live inferred, plan default). */
export function evidenceTier(memory: ExerciseMemory, now: Date): SkillTier | undefined {
  return maxOf([testedTier(memory), liveInferredTier(memory, now), memory.planTier]);
}

export function needsRetest(memory: ExerciseMemory, now: Date): boolean {
  if (!testedTier(memory)) {
    return false;
  }
  const times = [memory.lastSessionAt, memory.declaredAt].filter((t): t is string => t !== undefined);
  if (times.length === 0) {
    return false;
  }
  return Math.min(...times.map((t) => ageInDays(t, now))) > RETEST_AFTER_DAYS;
}

/** Recompute the cached `skillTier` from evidence. */
export function refreshSkillTier(memory: ExerciseMemory, now: Date): ExerciseMemory {
  const { skillTier: _old, ...rest } = memory;
  const tier = evidenceTier(rest, now);
  return tier === undefined ? rest : { ...rest, skillTier: tier };
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run tests/progress/levelEvidence.test.ts && npx tsc --noEmit`
Expected: PASS. tsc is clean.

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/domain/skillTier.ts src/progress/levelEvidence.ts tests/progress/levelEvidence.test.ts
git commit -m "feat(levels): evidence fields and tier helpers (#112)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `inferTiers`, the inference rules

**Files:**
- Create: `src/progress/inferTiers.ts`
- Test: `tests/progress/inferTiers.test.ts`

**Interfaces:**
- Consumes: `testedTier`, `liveInferredTier`, `refreshSkillTier` (Task 1); `buildFamilyLadderIndex`, `libraryFamilyLadderIndex`, `FamilyLadderIndex` (`src/progress/familyLadderIndex.ts`); `emptyMemory` (`src/session/history.ts`).
- Produces:
  ```ts
  export const MIN_SUPPORTERS = 2;
  export interface InferTiersInput {
    memories: Record<string, ExerciseMemory>;
    now: Date;
    index?: FamilyLadderIndex;
    /** Families with a confirming session just now: their inferred tiers may rise one step. */
    confirmingFamilies?: ReadonlySet<string>;
  }
  export interface InferTiersResult { memories: Record<string, ExerciseMemory>; inferredIds: string[] }
  export function inferTiers(input: InferTiersInput): InferTiersResult;
  ```

To avoid an import cycle (`history.ts` will import `inferTiers`), `inferTiers.ts` must **not** import from `history.ts`. Build blank memories with a local helper instead.

- [ ] **Step 1: Write the failing test** at `tests/progress/inferTiers.test.ts`

The ladder is built from real names that `placeOnLadder` ranks. Print the ranks first, so the test is grounded:

Run: `npx tsx -e 'import {buildFamilyLadderIndex} from "./src/progress/familyLadderIndex"; const i=buildFamilyLadderIndex([{id:"hf_108",name:"Dragon Flag"},{id:"ab_wheel",name:"Ab Wheel Rollout"},{id:"hollow_hold",name:"Hollow Hold"},{id:"dead_bug",name:"Dead Bug"},{id:"plank",name:"Plank"}]); console.log([...i.byId.values()].map(m=>m.id+":"+m.familyId+":"+m.rank).join(" "))'`

Expected (from the existing cascade test): one family; `hf_108` is the top rank; `ab_wheel` is one rank below; `hollow_hold`, `dead_bug` and `plank` are lower. If the printed ranks differ, change the ids in the assertions below to match the printed ranks. The test needs: TOP (highest rank), NEXT (one rung below TOP), LOW (at least two rungs below TOP).

```ts
import { describe, expect, it } from "vitest";
import type { ExerciseMemory } from "../../src/domain/types";
import { buildFamilyLadderIndex } from "../../src/progress/familyLadderIndex";
import { inferTiers } from "../../src/progress/inferTiers";
import { emptyMemory } from "../../src/session/history";

const NOW = new Date("2026-11-17T12:00:00Z");
const CATALOGUE = [
  { id: "hf_108", name: "Dragon Flag" },
  { id: "ab_wheel", name: "Ab Wheel Rollout" },
  { id: "hollow_hold", name: "Hollow Hold" },
  { id: "dead_bug", name: "Dead Bug" },
  { id: "plank", name: "Plank" },
];
const index = buildFamilyLadderIndex(CATALOGUE);
const rankOf = (id: string) => index.byId.get(id)!.rank;
const familyOf = (id: string) => index.byId.get(id)!.familyId;
const declared = (id: string, tier: ExerciseMemory["declaredTier"]): ExerciseMemory => ({
  ...emptyMemory(id),
  declaredTier: tier,
  declaredAt: NOW.toISOString(),
});
const run = (memories: Record<string, ExerciseMemory>, extra = {}) =>
  inferTiers({ memories, now: NOW, index, ...extra }).memories;

describe("inferTiers", () => {
  it("one tested member infers nothing (k = 2)", () => {
    const out = run({ hf_108: declared("hf_108", "advanced") });
    expect(Object.values(out).filter((m) => m.inferred)).toEqual([]);
  });

  it("two tested harder members infer one tier below, downward only", () => {
    const out = run({ hf_108: declared("hf_108", "advanced"), ab_wheel: declared("ab_wheel", "advanced") });
    const below = CATALOGUE.map((c) => c.id).filter((id) => rankOf(id) === rankOf("ab_wheel") - 1);
    expect(below.length).toBeGreaterThan(0);
    for (const id of below) {
      expect(out[id]?.inferred?.tier).toBe("intermediate");
      expect(out[id]?.inferred?.from.sort()).toEqual(["ab_wheel", "hf_108"]);
    }
    // never upward: the tested members keep only their own evidence
    expect(out.hf_108?.inferred).toBeUndefined();
    expect(out.ab_wheel?.inferred).toBeUndefined();
  });

  it("needs a supporter within 1 rung; nothing beyond 2 rungs", () => {
    const out = run({ hf_108: declared("hf_108", "elite"), ab_wheel: declared("ab_wheel", "elite") });
    for (const c of CATALOGUE) {
      const d = rankOf("ab_wheel") - rankOf(c.id);
      if (d >= 1 && rankOf("hf_108") - rankOf(c.id) > 2 && d > 2) {
        expect(out[c.id]?.inferred, c.id).toBeUndefined();
      }
    }
  });

  it("a failure cap limits inference on harder rungs", () => {
    const capped = {
      ...emptyMemory("hollow_hold"),
      failedCap: { tier: "beginner" as const, from: "plank", at: NOW.toISOString() },
    };
    const out = run({
      hf_108: declared("hf_108", "elite"),
      ab_wheel: declared("ab_wheel", "elite"),
      hollow_hold: capped,
    });
    if (rankOf("ab_wheel") - rankOf("hollow_hold") === 1) {
      expect(out.hollow_hold?.inferred?.tier).toBe("beginner");
    }
  });

  it("an existing inferred tier rises one step only in a confirming family", () => {
    const below = CATALOGUE.map((c) => c.id).find((id) => rankOf(id) === rankOf("ab_wheel") - 1)!;
    const start = {
      hf_108: declared("hf_108", "elite"),
      ab_wheel: declared("ab_wheel", "elite"),
      [below]: { ...emptyMemory(below), inferred: { tier: "beginner" as const, from: ["ab_wheel", "hf_108"], at: NOW.toISOString() } },
    };
    expect(run(start)[below]?.inferred?.tier).toBe("beginner");
    expect(run(start, { confirmingFamilies: new Set([familyOf(below)]) })[below]?.inferred?.tier).toBe("intermediate");
  });

  it("drops inference that lost support, and never infers on a tested move", () => {
    const below = CATALOGUE.map((c) => c.id).find((id) => rankOf(id) === rankOf("ab_wheel") - 1)!;
    const orphan = { ...emptyMemory(below), inferred: { tier: "advanced" as const, from: ["x", "y"], at: NOW.toISOString() } };
    expect(run({ [below]: orphan })[below]?.inferred).toBeUndefined();
    const tested = { ...declared(below, "beginner") };
    const out = run({ hf_108: declared("hf_108", "elite"), ab_wheel: declared("ab_wheel", "elite"), [below]: tested });
    expect(out[below]?.inferred).toBeUndefined();
    expect(out[below]?.skillTier).toBe("beginner");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/progress/inferTiers.test.ts`
Expected: FAIL with `Cannot find module '../../src/progress/inferTiers'`.

- [ ] **Step 3: Implement** `src/progress/inferTiers.ts`

```ts
import { minTier, nextSkillTier, SKILL_TIERS, stepDown, tierIndex } from "../domain/skillTier";
import type { ExerciseMemory, SkillTier } from "../domain/types";
import {
  type FamilyLadderIndex,
  type FamilyLadderMember,
  libraryFamilyLadderIndex,
} from "./familyLadderIndex";
import { liveInferredTier, refreshSkillTier, testedTier } from "./levelEvidence";

/** Tested family members needed before an untested one is inferred (#112 rule 3). */
export const MIN_SUPPORTERS = 2;
/** Support counts within this many rungs; at least one supporter must be 1 rung away. */
const MAX_DISTANCE = 2;

export interface InferTiersInput {
  memories: Record<string, ExerciseMemory>;
  now: Date;
  index?: FamilyLadderIndex;
  /** Families with a confirming session just now: their inferred tiers may rise one step. */
  confirmingFamilies?: ReadonlySet<string>;
}

export interface InferTiersResult {
  memories: Record<string, ExerciseMemory>;
  /** Members whose inferred tier is set after this pass. */
  inferredIds: string[];
}

interface Candidate {
  tier: SkillTier;
  from: string[];
}

function blank(exerciseId: string): ExerciseMemory {
  return { exerciseId, sessionsAtStandard: 0, sessionsBelowFloor: 0, lastAddedLoadKg: 0, weakLinkSessionsRemaining: 0 };
}

/** Highest T with ≥ MIN_SUPPORTERS harder tested members at ≥ T, one of them 1 rung away; result is T − 1. */
function candidateFor(
  member: FamilyLadderMember,
  family: readonly FamilyLadderMember[],
  memories: Record<string, ExerciseMemory>,
): Candidate | null {
  const supporters = family
    .filter((other) => other.rank > member.rank && other.rank - member.rank <= MAX_DISTANCE)
    .map((other) => ({ id: other.id, distance: other.rank - member.rank, tier: memories[other.id] && testedTier(memories[other.id]!) }))
    .filter((s): s is { id: string; distance: number; tier: SkillTier } => s.tier !== undefined);
  for (let i = SKILL_TIERS.length - 1; i >= 0; i -= 1) {
    const atOrAbove = supporters.filter((s) => tierIndex(s.tier) >= i);
    if (atOrAbove.length >= MIN_SUPPORTERS && atOrAbove.some((s) => s.distance === 1)) {
      const tier = stepDown(SKILL_TIERS[i]!);
      return tier ? { tier, from: atOrAbove.map((s) => s.id).sort() } : null;
    }
  }
  return null;
}

function bounded(candidate: Candidate, current: ExerciseMemory | undefined, confirming: boolean, now: Date): SkillTier {
  let tier = candidate.tier;
  if (current?.failedCap) {
    tier = minTier(tier, current.failedCap.tier);
  }
  const previous = current ? liveInferredTier(current, now) : undefined;
  if (previous && tierIndex(tier) > tierIndex(previous)) {
    tier = confirming ? (nextSkillTier(previous) ?? previous) : previous;
  }
  return tier;
}

export function inferTiers(input: InferTiersInput): InferTiersResult {
  const index = input.index ?? libraryFamilyLadderIndex();
  const next = { ...input.memories };
  const inferredIds: string[] = [];
  const nowIso = input.now.toISOString();
  for (const [familyId, family] of index.byFamily) {
    for (const member of family) {
      const current = next[member.id];
      if (current && testedTier(current)) {
        // Tested evidence wins: drop any inference and refresh the cached tier.
        const { inferred: _drop, ...rest } = current;
        next[member.id] = refreshSkillTier(rest, input.now);
        continue;
      }
      const candidate = candidateFor(member, family, next);
      if (!candidate) {
        if (current?.inferred) {
          const { inferred: _drop, ...rest } = current;
          next[member.id] = refreshSkillTier(rest, input.now);
        }
        continue;
      }
      const tier = bounded(candidate, current, input.confirmingFamilies?.has(familyId) === true, input.now);
      const keepAt = current?.inferred && current.inferred.tier === tier ? current.inferred.at : nowIso;
      next[member.id] = refreshSkillTier(
        { ...(current ?? blank(member.id)), inferred: { tier, from: candidate.from, at: keepAt } },
        input.now,
      );
      inferredIds.push(member.id);
    }
  }
  return { memories: next, inferredIds };
}
```

Note: candidates are computed from `next` while it is being updated. That's safe, because supporters must be *tested*, and inference never writes tested fields.

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run tests/progress/inferTiers.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progress/inferTiers.ts tests/progress/inferTiers.test.ts
git commit -m "feat(levels): inferTiers — downward, k=2, tier-1, 1–2 rungs, caps, jump bound (#112)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Library declare uses inference; cascade removed

**Files:**
- Modify: `src/session/history.ts` (`declareSkillTier`, `DeclareSkillTierResult`, `loadMemories`)
- Modify: `src/rules/skillDose.ts` (`effectiveSkillTier`)
- Modify: `src/ui/libraryView.ts:128-133, 222-228`
- Delete: `src/progress/cascadeFamilyTiers.ts`, `tests/progress/cascadeFamilyTiers.test.ts`
- Test: `tests/session/skillMemory.test.ts`, `tests/progress/inferTiers.test.ts` (no change)

**Interfaces:**
- Produces: `declareSkillTier(memories, exerciseId, tier, now = new Date(), index?): { memories; inferredCount: number }`. `effectiveSkillTier(memory, exercise, now = new Date())`.

- [ ] **Step 1: Write the failing test.** Append to `tests/session/skillMemory.test.ts`:

```ts
import { buildFamilyLadderIndex } from "../../src/progress/familyLadderIndex";

describe("declare (#112)", () => {
  const NOW = new Date("2026-11-17T12:00:00Z");
  const index = buildFamilyLadderIndex([
    { id: "hf_108", name: "Dragon Flag" },
    { id: "ab_wheel", name: "Ab Wheel Rollout" },
    { id: "hollow_hold", name: "Hollow Hold" },
    { id: "dead_bug", name: "Dead Bug" },
    { id: "plank", name: "Plank" },
  ]);

  it("records the pick with a time and does not promote the family from one pick", () => {
    const { memories, inferredCount } = declareSkillTier({}, "hf_108", "advanced", NOW, index);
    expect(memories.hf_108).toMatchObject({ declaredTier: "advanced", declaredAt: NOW.toISOString(), skillTier: "advanced" });
    expect(inferredCount).toBe(0);
    expect(memories.plank).toBeUndefined();
  });

  it("a second pick in the family infers easier moves one tier below", () => {
    const first = declareSkillTier({}, "hf_108", "advanced", NOW, index).memories;
    const { inferredCount } = declareSkillTier(first, "ab_wheel", "advanced", NOW, index);
    expect(inferredCount).toBeGreaterThan(0);
  });
});
```

In the same file, change the first existing test's call to `declareSkillTier({}, "pullup", "intermediate")`. It is unchanged and must still pass.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/session/skillMemory.test.ts`
Expected: FAIL. `inferredCount` is undefined and `declaredAt` is missing.

- [ ] **Step 3: Implement**

In `src/session/history.ts`, replace the `cascadeFamilyTiers` import with:

```ts
import type { FamilyLadderIndex } from "../progress/familyLadderIndex";
import { inferTiers } from "../progress/inferTiers";
import { refreshSkillTier } from "../progress/levelEvidence";
```

Replace `DeclareSkillTierResult` and `declareSkillTier` with:

```ts
export interface DeclareSkillTierResult {
  memories: Record<string, ExerciseMemory>;
  /** Related family moves that now carry an inferred tier. */
  inferredCount: number;
}

/** Manual tier pick from Library (tested evidence), then re-run inference (#112). */
export function declareSkillTier(
  memories: Record<string, ExerciseMemory>,
  exerciseId: string,
  tier: SkillTier,
  now: Date = new Date(),
  index?: FamilyLadderIndex,
): DeclareSkillTierResult {
  const current = memories[exerciseId] ?? emptyMemory(exerciseId);
  const withPick = {
    ...memories,
    [exerciseId]: refreshSkillTier({ ...current, declaredTier: tier, declaredAt: now.toISOString() }, now),
  };
  const result = inferTiers({ memories: withPick, now, index });
  return {
    memories: result.memories,
    inferredCount: result.inferredIds.filter((id) => id !== exerciseId).length,
  };
}
```

Change `loadMemories` so cached tiers are always current (expiry):

```ts
export function loadMemories(now: Date = new Date()): Record<string, ExerciseMemory> {
  const raw = readJson(memoryStore, {} as Record<string, ExerciseMemory>);
  return Object.fromEntries(
    Object.entries(raw).map(([id, memory]) => [id, refreshSkillTier(memory, now)]),
  );
}
```

Remove the now-unused `maxTier` import if tsc flags it.

In `src/rules/skillDose.ts`, replace `effectiveSkillTier` (and add the import `import { evidenceTier } from "../progress/levelEvidence";`):

```ts
/**
 * Effective skill tier from evidence (#112): tested, live inferred and plan
 * default, plus best reps against standards for memories not yet migrated.
 */
export function effectiveSkillTier(
  memory: ExerciseMemory,
  exercise: Exercise,
  now: Date = new Date(),
): SkillTier {
  let tier: SkillTier = evidenceTier(memory, now) ?? DEFAULT_TIER;
  const standards = standardsFor(exercise);
  if (standards && memory.bestReps !== undefined) {
    tier = maxTier(tier, inferTierFromBest(memory.bestReps, standards));
  }
  return tier;
}
```

In `src/ui/libraryView.ts`, change the declare handler and the hint:

```ts
          const result = declareSkillTier(loadMemories(), id, tier);
          saveMemories(result.memories);
          cascadeHint = cascadeHintFor(result.inferredCount);
```

```ts
function cascadeHintFor(inferredCount: number): string | null {
  if (inferredCount === 0) {
    return null;
  }
  const moves = inferredCount === 1 ? "move" : "moves";
  return `${inferredCount} related ${moves} now inferred from your levels.`;
}
```

Delete the old cascade:

```bash
git rm src/progress/cascadeFamilyTiers.ts tests/progress/cascadeFamilyTiers.test.ts
grep -rn "cascadeFamilyTiers\|cascadedCount\|Updated .* related" src tests
```

Expected: the grep finds nothing. Fix any remaining hit, such as a library UI test asserting the old hint text, by changing it to the new text.

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass. A test that asserted cascade-raised tiers (e.g. in `tests/ui/library*.test.ts`) must be rewritten to the new rule (one pick infers nothing) — note each one in the commit body.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat(levels): Library declare records evidence and re-runs inference; drop family cascade (#112)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Logged sets and session close (rule 7 confirmation, rule 2 failure cap)

**Files:**
- Modify: `src/session/history.ts` (`recordBestReps`, `applySetLogToMemory`, `ApplySetLogOptions`)
- Test: `tests/session/applySetLogToMemory.test.ts`, `tests/session/skillMemory.test.ts`

**Interfaces:**
- Consumes: `inferTiers`, `liveInferredTier`, `evidenceTier`, `refreshSkillTier`; `libraryFamilyLadderIndex`.
- Produces: `ApplySetLogOptions { lightDay?: boolean; now?: Date; index?: FamilyLadderIndex }`. `recordBestReps(memories, id, reps, exercise?, now = new Date())`.

- [ ] **Step 1: Write the failing tests.** Append to `tests/session/applySetLogToMemory.test.ts`:

```ts
import { buildFamilyLadderIndex } from "../../src/progress/familyLadderIndex";

describe("inferred tiers at session close (#112 rule 7, rule 2)", () => {
  const NOW = new Date("2026-11-17T12:00:00Z");
  const index = buildFamilyLadderIndex([
    { id: "hf_108", name: "Dragon Flag" },
    { id: "ab_wheel", name: "Ab Wheel Rollout" },
    { id: "hollow_hold", name: "Hollow Hold" },
  ]);
  const inferred = (id: string) => ({
    ...emptyMemory(id),
    inferred: { tier: "intermediate" as const, from: ["ab_wheel", "hf_108"], at: NOW.toISOString() },
  });
  const set = (exerciseId: string, completedReps: number, stopReason: "completed" | "muscular_failure") => ({
    id: `${exerciseId}-1`, slotId: "s", exerciseId, setIndex: 1, prescribedReps: 10,
    completedReps, addedLoadKg: 0, stopReason, loggedAt: NOW.toISOString(),
  });

  it("a clean session confirms an inferred tier as logged", () => {
    const out = applySetLogToMemory({ hollow_hold: inferred("hollow_hold") }, { entries: [set("hollow_hold", 10, "completed")] }, { now: NOW, index });
    expect(out.hollow_hold).toMatchObject({ loggedTier: "intermediate", lastSessionAt: NOW.toISOString() });
    expect(out.hollow_hold?.inferred).toBeUndefined();
  });

  it("a failed set removes the inferred tier and caps harder rungs", () => {
    const out = applySetLogToMemory({ hollow_hold: inferred("hollow_hold") }, { entries: [set("hollow_hold", 6, "muscular_failure")] }, { now: NOW, index });
    expect(out.hollow_hold?.inferred).toBeUndefined();
    expect(out.ab_wheel?.failedCap).toMatchObject({ tier: "intermediate", from: "hollow_hold" });
  });
});
```

If the existing file builds log entries with a helper, use that helper instead of `set`. If `WorkoutLog` has fields beyond `entries`, include them as the file's other tests do.

Append to `tests/session/skillMemory.test.ts`:

```ts
it("logged reps write loggedTier and lastSessionAt (#112)", () => {
  const now = new Date("2026-11-17T12:00:00Z");
  const next = recordBestReps({}, "pullup", 12, SEED_GRAPH.pullup, now);
  expect(next.pullup).toMatchObject({ bestReps: 12, loggedTier: "intermediate", skillTier: "intermediate", lastSessionAt: now.toISOString() });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/session/applySetLogToMemory.test.ts tests/session/skillMemory.test.ts`
Expected: FAIL. `loggedTier` and `failedCap` are undefined.

- [ ] **Step 3: Implement** in `src/session/history.ts`

Add imports: `import { libraryFamilyLadderIndex } from "../progress/familyLadderIndex";`, `import { evidenceTier, liveInferredTier } from "../progress/levelEvidence";` and `minTier` from `../domain/skillTier`. Merge these into the existing import lines.

Replace `recordBestReps`:

```ts
/** After a logged set: raise bestReps; standards turn it into a tested loggedTier. */
export function recordBestReps(
  memories: Record<string, ExerciseMemory>,
  exerciseId: string,
  completedReps: number,
  exercise: Exercise | undefined = EXERCISE_GRAPH[exerciseId],
  now: Date = new Date(),
): Record<string, ExerciseMemory> {
  if (completedReps <= 0) {
    return memories;
  }
  const current = memories[exerciseId] ?? emptyMemory(exerciseId);
  const bestReps = Math.max(current.bestReps ?? 0, completedReps);
  const standards = exercise?.standards;
  const fromBest = standards ? inferTierFromBest(bestReps, standards) : undefined;
  const loggedTier = fromBest && current.loggedTier ? maxTier(current.loggedTier, fromBest) : (fromBest ?? current.loggedTier);
  return {
    ...memories,
    [exerciseId]: refreshSkillTier({ ...current, bestReps, loggedTier, lastSessionAt: now.toISOString() }, now),
  };
}
```

Add `inferTierFromBest` to the `../domain/skillTier` import. `effectiveSkillTier` is no longer used here, so remove that import if tsc says it's unused.

Extend the options and add the rule-7 and rule-2 step to `applySetLogToMemory`. Keep the existing counter logic exactly as it is. After the `for` loop, before `return next`, insert the call. The finished function:

```ts
export interface ApplySetLogOptions {
  /** Light-day (and deload) misses do not count toward stall. */
  lightDay?: boolean;
  now?: Date;
  index?: FamilyLadderIndex;
}

export function applySetLogToMemory(
  memories: Record<string, ExerciseMemory>,
  log: WorkoutLog,
  options: ApplySetLogOptions = {},
): Record<string, ExerciseMemory> {
  const byExercise = groupEntriesByExercise(log.entries);
  if (byExercise.size === 0) {
    return memories;
  }
  const lightDay = options.lightDay === true;
  const now = options.now ?? new Date();
  const next = { ...memories };
  const outcomes = new Map<string, Exclude<ExerciseSessionOutcome, "untouched">>();
  for (const [exerciseId, entries] of byExercise) {
    const outcome = outcomeForExercise(entries);
    if (outcome === "untouched") {
      continue;
    }
    outcomes.set(exerciseId, outcome);
    const current = next[exerciseId] ?? emptyMemory(exerciseId);
    next[exerciseId] = memoryAfterSessionOutcome(current, outcome, lightDay);
  }
  return applyLevelEvidence(next, outcomes, lightDay, now, options.index ?? libraryFamilyLadderIndex());
}

/** #112 rule 7 (confirm / remove inferred), rule 2 (failure caps harder rungs), then re-infer. */
function applyLevelEvidence(
  memories: Record<string, ExerciseMemory>,
  outcomes: ReadonlyMap<string, Exclude<ExerciseSessionOutcome, "untouched">>,
  lightDay: boolean,
  now: Date,
  index: FamilyLadderIndex,
): Record<string, ExerciseMemory> {
  const next = { ...memories };
  const nowIso = now.toISOString();
  const confirmingFamilies = new Set<string>();
  for (const [exerciseId, outcome] of outcomes) {
    const current = next[exerciseId]!;
    const inferred = liveInferredTier(current, now);
    const { inferred: _drop, ...withoutInferred } = current;
    const placement = index.byId.get(exerciseId);
    if (outcome === "at_standard") {
      const loggedTier = inferred ? (current.loggedTier ? maxTier(current.loggedTier, inferred) : inferred) : current.loggedTier;
      next[exerciseId] = { ...withoutInferred, loggedTier, lastSessionAt: nowIso };
      if (placement) {
        confirmingFamilies.add(placement.familyId);
      }
      for (const [id, memory] of Object.entries(next)) {
        if (memory.failedCap?.from === exerciseId) {
          const { failedCap: _cleared, ...rest } = memory;
          next[id] = rest;
        }
      }
    } else if (outcome === "below_floor" && !lightDay) {
      const failedAt = evidenceTier(current, now) ?? "beginner";
      next[exerciseId] = { ...withoutInferred, lastSessionAt: nowIso };
      for (const member of placement ? (index.byFamily.get(placement.familyId) ?? []) : []) {
        if (member.rank <= placement!.rank) {
          continue;
        }
        const target = next[member.id] ?? emptyMemory(member.id);
        const tier = target.failedCap ? minTier(target.failedCap.tier, failedAt) : failedAt;
        next[member.id] = { ...target, failedCap: { tier, from: exerciseId, at: nowIso } };
      }
    } else {
      next[exerciseId] = { ...current, lastSessionAt: nowIso };
    }
  }
  return inferTiers({ memories: next, now, index, confirmingFamilies }).memories;
}
```

Pass `now` from the UI as well. In `src/ui/sessionEvaluation.ts`, the call already passes `{ lightDay: planned.lightDay }`, and the default `now` covers it, so no change is needed.

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, including the existing `applySetLogToMemory` counter tests.

- [ ] **Step 5: Commit**

```bash
git add src/session/history.ts tests/session
git commit -m "feat(levels): first session confirms or removes inferred tiers; failures cap harder rungs (#112)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The plan level is a dose default (rule 10)

**Files:**
- Modify: `src/plan/levelDeclare.ts`
- Test: `tests/plan/levelDeclare.test.ts` (find the existing test with `grep -rln "declareLevelForDays\|memoryAtLevel" tests`; add to it, or create it)

**Interfaces:**
- Produces: `memoryAtLevel(...)` and `declareLevelForDays(...)` keep their signatures. They write `planTier` instead of `declaredTier`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { declareLevelForDays, levelForMove, memoryAtLevel } from "../../src/plan/levelDeclare";

describe("plan level is a dose default (#112 rule 10)", () => {
  const pullup = EXERCISE_GRAPH.pullup!;

  it("memoryAtLevel sets planTier, never declaredTier", () => {
    const m = memoryAtLevel(undefined, pullup, "intermediate");
    expect(m.declaredTier).toBeUndefined();
    expect(m.planTier).toBe(levelForMove(pullup, "intermediate"));
  });

  it("declareLevelForDays writes planTier only and infers nothing", () => {
    const day = { id: "d", slots: [{ id: "s1", exerciseId: "pullup" }, { id: "s2", exerciseId: "hanging_knee_raise" }] } as never;
    const out = declareLevelForDays({}, [day], "intermediate");
    for (const memory of Object.values(out)) {
      expect(memory.declaredTier).toBeUndefined();
      expect(memory.inferred).toBeUndefined();
    }
    expect(out.pullup?.planTier).toBe(levelForMove(pullup, "intermediate"));
  });
});
```

If `SessionTemplate` needs more fields for the cast, copy a day shape from an existing plan test.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/plan/levelDeclare.test.ts`
Expected: FAIL. `declaredTier` is set.

- [ ] **Step 3: Implement** in `src/plan/levelDeclare.ts`

Replace the `declareSkillTier` import with `import { emptyMemory } from "../session/history";` and add `import { refreshSkillTier } from "../progress/levelEvidence";`. Replace `memoryAtLevel` and `declareLevelForDays`:

```ts
/** The memory the planner sees for this move with the plan level as a dose default. */
export function memoryAtLevel(
  memory: ExerciseMemory | undefined,
  exercise: SeedExercise,
  planLevel: SkillTier | undefined,
): ExerciseMemory {
  const current = memory ?? emptyMemory(exercise.id);
  if (!planLevel) {
    return current;
  }
  const level = levelForMove(exercise, planLevel);
  if (!isBelow(current, exercise, level)) {
    return current;
  }
  return refreshSkillTier({ ...current, planTier: level }, new Date());
}

/**
 * Write the plan level as `planTier` on every working move of the generated
 * days (#112 rule 10): a dose default, never evidence, never inferred from.
 */
export function declareLevelForDays(
  memories: Record<string, ExerciseMemory>,
  days: readonly SessionTemplate[],
  planLevel: SkillTier,
): Record<string, ExerciseMemory> {
  const next = { ...memories };
  for (const slot of days.flatMap((day) => day.slots)) {
    const exercise = EXERCISE_GRAPH[slot.exerciseId];
    if (!exercise || slot.pinned) {
      continue;
    }
    next[exercise.id] = memoryAtLevel(next[exercise.id], exercise, planLevel);
  }
  return next;
}
```

Remove the `maxTier` import if it's unused. Update the file's top comment ("A plan level is a declared level…") to: "A plan level is a dose default (#112): a floor for planned moves, never evidence."

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass. Existing tests that asserted `declaredTier` after generating a block must now assert `planTier`. List each one in the commit body.

- [ ] **Step 5: Commit**

```bash
git add src/plan/levelDeclare.ts tests
git commit -m "feat(levels): plan level writes planTier, a dose default only (#112)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Migrate memory v1 to v2

**Files:**
- Create: `src/session/memoryMigration.ts`, `src/session/ensureMemoryMigrated.ts`
- Modify: `src/storage/storageKeys.ts`, `src/session/history.ts` (memory store key), `src/main.ts`
- Test: `tests/session/memoryMigration.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface MemoryMigrationContext {
    now: Date;
    /** The plan's level for each move (levelForMove(exercise, planLevel)); empty when the plan level is "auto". */
    planLevelFor: (exerciseId: string) => SkillTier | undefined;
    standardsOf: (exerciseId: string) => ExerciseStandards | null;
  }
  export function migrateMemoriesV1(v1: Record<string, ExerciseMemory>, ctx: MemoryMigrationContext): { memories: Record<string, ExerciseMemory>; levelsToConfirm: string[] };
  export function ensureMemoryMigrated(now?: Date): void;
  export function loadLevelsToConfirm(): string[];
  export function clearLevelsToConfirm(): void;
  ```

**Deviation from the spec (to update in the spec in this task):** a `declaredTier` is ambiguous whenever it equals `planLevelFor(id)`, not only for moves in the *current* plan days. Completed days are pruned, so the narrower rule misses moves such as today's Sliding Leg Curl and Hip Thrust. Ambiguous levels move to `planTier`, so dosing is unchanged, and they are listed to confirm.

- [ ] **Step 1: Write the failing test** at `tests/session/memoryMigration.test.ts`

```ts
import { describe, expect, it } from "vitest";
import type { ExerciseMemory } from "../../src/domain/types";
import { migrateMemoriesV1 } from "../../src/session/memoryMigration";
import { emptyMemory } from "../../src/session/history";

const NOW = new Date("2026-11-17T12:00:00Z");
const ctx = {
  now: NOW,
  planLevelFor: (id: string) => (id === "hf_84" ? ("intermediate" as const) : undefined),
  standardsOf: (id: string) => (id === "calf_raise" ? { novice: 5, beginner: 10, intermediate: 20, advanced: 35, elite: 50 } : null),
};

describe("migrateMemoriesV1 (#112)", () => {
  it("keeps real picks, moves plan-level writes to planTier, derives loggedTier, drops cascaded tiers", () => {
    const v1: Record<string, ExerciseMemory> = {
      bulgarian_split: { ...emptyMemory("bulgarian_split"), declaredTier: "advanced", skillTier: "advanced" },
      hf_84: { ...emptyMemory("hf_84"), declaredTier: "intermediate", skillTier: "intermediate" },
      calf_raise: { ...emptyMemory("calf_raise"), bestReps: 60, skillTier: "elite" },
      step_up: { ...emptyMemory("step_up"), skillTier: "elite" },
    };
    const { memories, levelsToConfirm } = migrateMemoriesV1(v1, ctx);
    expect(memories.bulgarian_split).toMatchObject({ declaredTier: "advanced", declaredAt: NOW.toISOString(), skillTier: "advanced" });
    expect(memories.hf_84).toMatchObject({ planTier: "intermediate", skillTier: "intermediate" });
    expect(memories.hf_84?.declaredTier).toBeUndefined();
    expect(memories.calf_raise).toMatchObject({ loggedTier: "elite", skillTier: "elite" });
    expect(memories.step_up?.skillTier).not.toBe("elite");
    expect(levelsToConfirm).toEqual(["hf_84"]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/session/memoryMigration.test.ts`
Expected: FAIL. The module is not found.

- [ ] **Step 3: Implement**

`src/storage/storageKeys.ts`: add the two keys and list both in `STORAGE_KEYS`. Keep `MEMORY_KEY` (v1) there, since it stays readable for one release.

```ts
export const MEMORY_V2_KEY = "aurora.poc.memory.v2";
export const LEVELS_TO_CONFIRM_KEY = "aurora.poc.levelsToConfirm.v1";
```

`src/session/history.ts`: change `const memoryStore = createKeyValueStore(MEMORY_KEY);` to use `MEMORY_V2_KEY` (update the import).

`src/session/memoryMigration.ts`:

```ts
import { inferTierFromBest } from "../domain/skillTier";
import type { ExerciseMemory, ExerciseStandards, SkillTier } from "../domain/types";
import { inferTiers } from "../progress/inferTiers";
import { refreshSkillTier } from "../progress/levelEvidence";

export interface MemoryMigrationContext {
  now: Date;
  planLevelFor: (exerciseId: string) => SkillTier | undefined;
  standardsOf: (exerciseId: string) => ExerciseStandards | null;
}

/** v1 → v2 (#112): give every level its source, then re-infer from scratch. */
export function migrateMemoriesV1(
  v1: Record<string, ExerciseMemory>,
  ctx: MemoryMigrationContext,
): { memories: Record<string, ExerciseMemory>; levelsToConfirm: string[] } {
  const nowIso = ctx.now.toISOString();
  const levelsToConfirm: string[] = [];
  const memories: Record<string, ExerciseMemory> = {};
  for (const [id, old] of Object.entries(v1)) {
    const { skillTier: _cascaded, inferred: _i, ...rest } = old;
    const next: ExerciseMemory = { ...rest };
    if (next.declaredTier && next.declaredTier === ctx.planLevelFor(id)) {
      next.planTier = next.declaredTier;
      delete next.declaredTier;
      levelsToConfirm.push(id);
    } else if (next.declaredTier) {
      next.declaredAt = nowIso;
    }
    const standards = ctx.standardsOf(id);
    if (standards && next.bestReps !== undefined) {
      next.loggedTier = inferTierFromBest(next.bestReps, standards);
    }
    memories[id] = refreshSkillTier(next, ctx.now);
  }
  return { memories: inferTiers({ memories, now: ctx.now }).memories, levelsToConfirm: levelsToConfirm.sort() };
}
```

`src/session/ensureMemoryMigrated.ts`:

```ts
import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { levelForMove } from "../plan/levelDeclare";
import { loadPlanLevel } from "../plan/planLevel";
import { createKeyValueStore } from "../storage/keyValueStore";
import { LEVELS_TO_CONFIRM_KEY, MEMORY_KEY, MEMORY_V2_KEY } from "../storage/storageKeys";
import { migrateMemoriesV1 } from "./memoryMigration";

const v1Store = createKeyValueStore(MEMORY_KEY);
const v2Store = createKeyValueStore(MEMORY_V2_KEY);
const confirmStore = createKeyValueStore(LEVELS_TO_CONFIRM_KEY);

/** Run once at boot: build memory v2 from v1 if v2 does not exist yet. */
export function ensureMemoryMigrated(now: Date = new Date()): void {
  if (v2Store.read()) {
    return;
  }
  const raw = v1Store.read();
  if (!raw) {
    return;
  }
  const planLevel = loadPlanLevel();
  const { memories, levelsToConfirm } = migrateMemoriesV1(JSON.parse(raw), {
    now,
    planLevelFor: (id) => {
      const exercise = EXERCISE_GRAPH[id];
      return exercise && planLevel !== "auto" ? levelForMove(exercise, planLevel) : undefined;
    },
    standardsOf: (id) => EXERCISE_GRAPH[id]?.standards ?? null,
  });
  v2Store.write(JSON.stringify(memories));
  confirmStore.write(JSON.stringify(levelsToConfirm));
}

export function loadLevelsToConfirm(): string[] {
  try {
    const raw = confirmStore.read();
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function clearLevelsToConfirm(): void {
  confirmStore.write("[]");
}
```

`src/main.ts`: import `ensureMemoryMigrated` from `./session/ensureMemoryMigrated` and call it on the line after `migratePlaintextToSecureStorage();`, with the comment `// Memory v1 → v2 (#112) before anything reads memory.`

Spec: in `docs/superpowers/specs/2026-11-17-skill-level-inference-design.md`, under Migration, replace "Moves in the generated plan days whose `declaredTier` equals `levelForMove(exercise, planLevel)`" with "Any move whose `declaredTier` equals `levelForMove(exercise, planLevel)` (completed plan days are pruned, so the current days alone would miss them)".

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run && npx tsc --noEmit && npm run smell`
Expected: all pass. A test that seeds memory under `aurora.poc.memory.v1` and then reads through `loadMemories` must now seed `aurora.poc.memory.v2`. Find them with `grep -rn "memory.v1" tests`.

- [ ] **Step 5: Commit**

```bash
git add -A src tests docs
git commit -m "feat(levels): migrate memory v1 → v2 with level sources and levels to confirm (#112)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Library shows a level's source, a retest flag and suggestions (rule 6)

**Files:**
- Create: `src/library/levelSource.ts`, `src/progress/suggestTiers.ts`
- Modify: `src/library/libraryDetail.ts` (`DetailMemoryView` ~line 41, level block ~line 286), `src/ui/libraryView.ts` (memory view ~line 160; declare wiring)
- Test: `tests/library/levelSource.test.ts`, `tests/progress/suggestTiers.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/library/levelSource.ts
  export interface LevelSourceView { label: string | null; retest: boolean }
  export function describeLevelSource(memory: ExerciseMemory, now: Date, nameOf: (id: string) => string): LevelSourceView;
  // src/progress/suggestTiers.ts
  export interface TierSuggestion { tier: SkillTier; testedFamilies: number; totalFamilies: number }
  export function suggestTiers(input: { memories: Record<string, ExerciseMemory>; index?: FamilyLadderIndex; patternOf: (exerciseId: string) => string | undefined }): Map<string, TierSuggestion>;
  ```
  `DetailMemoryView` gains `source?: LevelSourceView; suggestion?: TierSuggestion`.

- [ ] **Step 1: Write the failing tests**

`tests/library/levelSource.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { describeLevelSource } from "../../src/library/levelSource";
import { emptyMemory } from "../../src/session/history";

const NOW = new Date("2026-11-17T12:00:00Z");
const name = (id: string) => ({ a: "Bulgarian split squat", b: "Split squat" })[id] ?? id;
const base = emptyMemory("x");

describe("describeLevelSource", () => {
  it("names the source of the level", () => {
    expect(describeLevelSource({ ...base, declaredTier: "advanced", declaredAt: NOW.toISOString() }, NOW, name).label).toBe("Your pick");
    expect(describeLevelSource({ ...base, loggedTier: "advanced", lastSessionAt: NOW.toISOString() }, NOW, name).label).toBe("Logged sets");
    expect(describeLevelSource({ ...base, inferred: { tier: "intermediate", from: ["a", "b"], at: NOW.toISOString() } }, NOW, name).label)
      .toBe("Inferred from Bulgarian split squat + Split squat");
    expect(describeLevelSource({ ...base, planTier: "intermediate" }, NOW, name).label).toBe("Plan default");
    expect(describeLevelSource(base, NOW, name).label).toBeNull();
  });

  it("flags a stale tested level for retest", () => {
    const old = new Date(NOW.getTime() - 50 * 86_400_000).toISOString();
    expect(describeLevelSource({ ...base, declaredTier: "advanced", declaredAt: old }, NOW, name).retest).toBe(true);
  });
});
```

`tests/progress/suggestTiers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { FamilyLadderIndex, FamilyLadderMember } from "../../src/progress/familyLadderIndex";
import { suggestTiers } from "../../src/progress/suggestTiers";
import { emptyMemory } from "../../src/session/history";

function indexOf(families: Record<string, string[]>): FamilyLadderIndex {
  const byId = new Map<string, FamilyLadderMember>();
  const byFamily = new Map<string, FamilyLadderMember[]>();
  for (const [familyId, ids] of Object.entries(families)) {
    const members = ids.map((id, rank) => ({ id, name: id, familyId, rank }));
    byFamily.set(familyId, members);
    for (const m of members) byId.set(m.id, m);
  }
  return { byId, byFamily };
}

describe("suggestTiers (#112 rule 6)", () => {
  const index = indexOf({ f1: ["a1", "a2"], f2: ["b1", "b2"], f3: ["c1", "c2"], f4: ["d1", "d2"], f5: ["e1", "e2"], f6: ["g1", "g2"] });
  const patternOf = () => "squat";
  const declared = (id: string) => ({ ...emptyMemory(id), declaredTier: "advanced" as const });

  it("one tested family suggests nothing", () => {
    expect(suggestTiers({ memories: { a2: declared("a2") }, index, patternOf }).size).toBe(0);
  });

  it("≥ 1/3 of families (min 2) tested suggests tier − 1 for untested families only", () => {
    const out = suggestTiers({ memories: { a2: declared("a2"), b2: declared("b2") }, index, patternOf });
    expect(out.get("c1")).toEqual({ tier: "intermediate", testedFamilies: 2, totalFamilies: 6 });
    expect(out.has("a1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run tests/library/levelSource.test.ts tests/progress/suggestTiers.test.ts`
Expected: FAIL. The modules are not found.

- [ ] **Step 3: Implement**

`src/library/levelSource.ts`:

```ts
import { tierIndex } from "../domain/skillTier";
import type { ExerciseMemory } from "../domain/types";
import { evidenceTier, liveInferredTier, needsRetest } from "../progress/levelEvidence";

export interface LevelSourceView {
  label: string | null;
  retest: boolean;
}

/** Where the effective level comes from, highest evidence first (#112). */
export function describeLevelSource(
  memory: ExerciseMemory,
  now: Date,
  nameOf: (id: string) => string,
): LevelSourceView {
  const effective = evidenceTier(memory, now);
  const retest = needsRetest(memory, now);
  if (!effective) {
    return { label: null, retest };
  }
  const at = (tier: ExerciseMemory["declaredTier"]) => tier !== undefined && tierIndex(tier) === tierIndex(effective);
  if (at(memory.declaredTier)) {
    return { label: "Your pick", retest };
  }
  if (at(memory.loggedTier)) {
    return { label: "Logged sets", retest };
  }
  if (at(liveInferredTier(memory, now)) && memory.inferred) {
    return { label: `Inferred from ${memory.inferred.from.map(nameOf).join(" + ")}`, retest };
  }
  return { label: "Plan default", retest };
}
```

`src/progress/suggestTiers.ts`:

```ts
import { SKILL_TIERS, stepDown, tierIndex } from "../domain/skillTier";
import type { ExerciseMemory, SkillTier } from "../domain/types";
import { type FamilyLadderIndex, libraryFamilyLadderIndex } from "./familyLadderIndex";
import { testedTier } from "./levelEvidence";

/** Share of a pattern's families that must be tested (#112 rule 6); judgement. */
const FAMILY_SHARE = 1 / 3;
const MIN_FAMILIES = 2;

export interface TierSuggestion {
  tier: SkillTier;
  testedFamilies: number;
  totalFamilies: number;
}

/** Read-only suggestions for untested families; never written to memory. */
export function suggestTiers(input: {
  memories: Record<string, ExerciseMemory>;
  index?: FamilyLadderIndex;
  patternOf: (exerciseId: string) => string | undefined;
}): Map<string, TierSuggestion> {
  const index = input.index ?? libraryFamilyLadderIndex();
  const byPattern = new Map<string, string[]>();
  for (const [familyId, members] of index.byFamily) {
    const pattern = members.map((m) => input.patternOf(m.id)).find((p) => p !== undefined);
    if (pattern) {
      byPattern.set(pattern, [...(byPattern.get(pattern) ?? []), familyId]);
    }
  }
  const out = new Map<string, TierSuggestion>();
  for (const familyIds of byPattern.values()) {
    const best = new Map<string, number>();
    for (const familyId of familyIds) {
      const tiers = (index.byFamily.get(familyId) ?? [])
        .map((m) => input.memories[m.id] && testedTier(input.memories[m.id]!))
        .filter((t): t is SkillTier => t !== undefined)
        .map(tierIndex);
      if (tiers.length > 0) {
        best.set(familyId, Math.max(...tiers));
      }
    }
    const needed = Math.max(MIN_FAMILIES, Math.ceil(familyIds.length * FAMILY_SHARE));
    for (let i = SKILL_TIERS.length - 1; i >= 0; i -= 1) {
      const tested = [...best.values()].filter((b) => b >= i).length;
      const tier = stepDown(SKILL_TIERS[i]!);
      if (tested < needed || !tier) {
        continue;
      }
      for (const familyId of familyIds.filter((f) => !best.has(f))) {
        for (const member of index.byFamily.get(familyId) ?? []) {
          out.set(member.id, { tier, testedFamilies: tested, totalFamilies: familyIds.length });
        }
      }
      break;
    }
  }
  return out;
}
```

`src/library/libraryDetail.ts`: extend the view type and render. Add `import type { LevelSourceView } from "./levelSource";` and `import type { TierSuggestion } from "../progress/suggestTiers";`. Then:

```ts
export interface DetailMemoryView {
  skillTier?: SkillTier;
  declaredTier?: SkillTier;
  bestReps?: number;
  source?: LevelSourceView;
  suggestion?: TierSuggestion;
}
```

In the level block, right after `${levelHint}`, add:

```ts
      ${memory.source?.label ? `<p class="hint" data-level-source>Level from: ${escapeHtml(memory.source.label)}</p>` : ""}
      ${memory.source?.retest ? `<p class="hint" data-level-retest>No sessions on this for 6+ weeks — retest before trusting this level.</p>` : ""}
      ${memory.suggestion ? `<p class="hint" data-level-suggestion>Suggested: ${SKILL_TIER_LABELS[memory.suggestion.tier]} (${memory.suggestion.testedFamilies} of ${memory.suggestion.totalFamilies} related families tested) <button type="button" class="link" data-accept-suggestion="${memory.suggestion.tier}">Set</button></p>` : ""}
```

Wire the button in the same place the detail wires `[data-skill-tier]` (search `data-skill-tier` in `libraryDetail.ts`). Add:

```ts
  root.querySelector<HTMLButtonElement>("[data-accept-suggestion]")?.addEventListener("click", (event) => {
    const tier = (event.currentTarget as HTMLButtonElement).dataset.acceptSuggestion as SkillTier;
    actions.onDeclareTier?.(exercise.id, tier);
  });
```

Use the same variable names (`root`, `actions`, `exercise`) that the surrounding wiring code uses.

`src/ui/libraryView.ts`: in the memory view passed to `mountLibraryDetail` (~line 160), add the two fields. Add these imports: `describeLevelSource` from `../library/levelSource`, `suggestTiers` from `../progress/suggestTiers`, and `EXERCISE_GRAPH` if it isn't already imported.

```ts
      memory: {
        skillTier: memory.skillTier,
        declaredTier: memory.declaredTier,
        bestReps: memory.bestReps,
        source: describeLevelSource(memory, new Date(), (id) => EXERCISE_GRAPH[id]?.name ?? id),
        suggestion: memory.declaredTier || memory.loggedTier
          ? undefined
          : suggestTiers({ memories: loadMemories(), patternOf: (id) => EXERCISE_GRAPH[id]?.pattern }).get(exerciseId),
      },
```

Add a DOM test next to the existing library detail tests (find them with `grep -rln "mountLibraryDetail" tests`). It mounts with `memory.source = { label: "Your pick", retest: true }` and `memory.suggestion = { tier: "intermediate", testedFamilies: 2, totalFamilies: 6 }`. It asserts that `[data-level-source]`, `[data-level-retest]` and `[data-level-suggestion]` render, and that clicking `[data-accept-suggestion]` calls `onDeclareTier(exercise.id, "intermediate")`.

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run && npx tsc --noEmit && npm run smell`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat(levels): Library shows level source, retest flag and cross-family suggestions (#112)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Settings "Levels to confirm"

**Files:**
- Modify: `src/ui/settingsPage.ts` (`SettingsPageModel`, `settingsPageHtml`), `src/ui/settingsView.ts` (~line 213, where the page is rendered)
- Test: `tests/ui/settingsAndReview.test.ts`

**Interfaces:**
- Consumes: `loadLevelsToConfirm`, `clearLevelsToConfirm` (Task 6).
- Produces: `SettingsPageModel.levelsToConfirm?: { id: string; name: string }[]`.

- [ ] **Step 1: Write the failing test.** Add it to `tests/ui/settingsAndReview.test.ts`. Use the file's existing model or factory helper to build `model`:

```ts
it("lists levels to confirm once after migration (#112)", () => {
  const html = settingsPageHtml({ ...model, levelsToConfirm: [{ id: "hf_84", name: "Sliding Leg Curl" }] });
  expect(html).toContain("data-levels-to-confirm");
  expect(html).toContain("Sliding Leg Curl");
  expect(html).toContain("data-levels-confirm-done");
  expect(settingsPageHtml({ ...model, levelsToConfirm: [] })).not.toContain("data-levels-to-confirm");
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/ui/settingsAndReview.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/ui/settingsPage.ts`: add `levelsToConfirm?: { id: string; name: string }[];` to `SettingsPageModel`. Add:

```ts
function levelsToConfirmHtml(items: readonly { id: string; name: string }[] | undefined): string {
  if (!items || items.length === 0) {
    return "";
  }
  const names = items.map((item) => `<li>${escapeHtml(item.name)}</li>`).join("");
  return `
    <section class="card" data-levels-to-confirm>
      <p class="eyebrow">Levels to confirm</p>
      <p class="hint">These levels may have come from your plan level, not from you. They now count as plan defaults. Set your real level on each in the Library.</p>
      <ul>${names}</ul>
      <button type="button" class="link" data-levels-confirm-done>Done</button>
    </section>`;
}
```

Insert `${levelsToConfirmHtml(model.levelsToConfirm)}` in `settingsPageHtml` directly after `${tabBarHtml(model.tab)}`. If `escapeHtml` isn't imported in this file, import it from wherever `libraryDetail.ts` imports it.

`src/ui/settingsView.ts`: in the `settingsPageHtml({...})` call at ~line 213, pass:

```ts
        levelsToConfirm: loadLevelsToConfirm().map((id) => ({ id, name: EXERCISE_GRAPH[id]?.name ?? id })),
```

After the `root.innerHTML = …` assignment, wire the button:

```ts
      root.querySelector("[data-levels-confirm-done]")?.addEventListener("click", () => {
        clearLevelsToConfirm();
        root.querySelector("[data-levels-to-confirm]")?.remove();
      });
```

Add the imports for `loadLevelsToConfirm`, `clearLevelsToConfirm` (from `../session/ensureMemoryMigrated`) and `EXERCISE_GRAPH`.

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run && npx tsc --noEmit && npm run smell`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/settingsPage.ts src/ui/settingsView.ts tests/ui/settingsAndReview.test.ts
git commit -m "feat(levels): Settings lists migrated levels to confirm (#112)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Acceptance on the real device snapshot

Needs PR #109 (the device fixture) merged into `poc`. Check with `git fetch origin && git ls-tree origin/poc tests/fixtures/device/`. If the fixture isn't there, stop and report it rather than copying the fixture in.

**Files:**
- Test: `tests/fixtures/levelInference.device.test.ts`

- [ ] **Step 1: Write the test.** It migrates the real snapshot and checks the spec's acceptance criteria.

```ts
import { describe, expect, it } from "vitest";
import { EXERCISE_GRAPH } from "../../src/data/exerciseGraph";
import { levelForMove } from "../../src/plan/levelDeclare";
import { migrateMemoriesV1 } from "../../src/session/memoryMigration";
import { loadDeviceSnapshot } from "../helpers/deviceSnapshot";

const NOW = new Date("2026-11-17T13:00:00Z");

describe("level inference on the 2026-11-17 Pixel 10 snapshot (#112)", () => {
  const snap = loadDeviceSnapshot("2026-11-17-pixel10");
  const v1 = snap.localStorage["aurora.poc.memory.v1"] as never;
  const { memories, levelsToConfirm } = migrateMemoriesV1(v1, {
    now: NOW,
    planLevelFor: (id) => (EXERCISE_GRAPH[id] ? levelForMove(EXERCISE_GRAPH[id]!, "intermediate") : undefined),
    standardsOf: (id) => EXERCISE_GRAPH[id]?.standards ?? null,
  });

  it("nothing is elite unless picked or logged", () => {
    const elite = Object.values(memories).filter((m) => m.skillTier === "elite");
    for (const m of elite) {
      expect(m.declaredTier === "elite" || m.loggedTier === "elite", m.exerciseId).toBe(true);
    }
    expect(memories.calf_raise?.skillTier).toBe("elite");
  });

  it("the Bulgarian split squat pick alone does not make the lunge family elite", () => {
    for (const id of ["step_up", "reverse_lunge", "wger_2557"]) {
      expect(memories[id]?.skillTier ?? "beginner", id).not.toBe("elite");
    }
  });

  it("plan-level writes are listed to confirm", () => {
    expect(levelsToConfirm).toEqual(expect.arrayContaining(["hf_84", "hf_87"]));
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/fixtures/levelInference.device.test.ts`
Expected: PASS. If an assertion fails, the failure is a real finding about the rules or the migration. Report it and don't weaken the test.

- [ ] **Step 3: Commit, push, open the PR**

```bash
git add tests/fixtures/levelInference.device.test.ts
git commit -m "test(levels): acceptance on the real device snapshot (#112)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
gh pr edit 113 --title "feat: evidence-based skill level inference (#112)" --body "$(printf 'Closes #112\n\nSpec + plan + implementation. See docs/superpowers/specs/2026-11-17-skill-level-inference-design.md and docs/superpowers/plans/2026-11-17-skill-level-inference.md.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)')"
```

Don't merge.
