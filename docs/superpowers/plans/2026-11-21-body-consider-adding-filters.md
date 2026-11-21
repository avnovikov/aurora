# Body Consider adding filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten Body **Consider adding** so suggestions require owned gear, drop high catalogue joint load on declared joints, and match By pattern median difficulty.

**Architecture:** Filter-in-place inside `suggestMoves` (`src/body/balance.ts`). Pass `jointHistory` from the profile through `buildBalanceModel`. Reuse `missingGear`, `jointLoadsFor`, and `buildLevelProfile`.

**Tech Stack:** TypeScript, Vitest, existing Body balance model (#234).

**Spec:** `docs/superpowers/specs/2026-11-21-body-consider-adding-filters-design.md`  
**Issue:** #256

## Global Constraints

- Exact difficulty match only (no “tier or easier”).
- High joint load on declared joints only; moderate kept; empty history → no joint drops.
- No UI/copy changes beyond which rows appear.
- Branch from `origin/dev`; PR to `dev`.

---

### Task 1: Failing tests for joint + level filters

**Files:**
- Modify: `tests/body/balance.test.ts` (Consider adding describe)
- Spec: `docs/superpowers/specs/2026-11-21-body-consider-adding-filters-design.md`

- [ ] **Step 1: Add failing cases** under `describe("Consider adding")`:

```ts
it("drops high catalogue load on a declared joint; keeps moderate and undeclared", () => {
  const graph: Record<string, SeedExercise> = {
    safe_row: move("safe_row", "horizontal_pull", ["lats"], { name: "Towel row", difficulty: "intermediate" }),
    high_elbow: move("high_elbow", "horizontal_pull", ["lats"], { name: "One-arm row", difficulty: "intermediate" }),
    mod_pull: move("mod_pull", "horizontal_pull", ["lats"], {
      name: "Pull-up", difficulty: "intermediate",
    }),
  };
  const levels = allLevels("moderate", { lats: "none" });
  const base = { pairs: pairs({ push_pull: [5, 0] }), levels, graph, equipment: [] as EquipmentId[] };
  expect(suggestMoves({ ...base, jointHistory: [{ joint: "elbow", side: "both", kind: "other" }] })
    .map((m) => m.exerciseId)).toEqual(["safe_row", "mod_pull"]);
  expect(suggestMoves({ ...base, jointHistory: [{ joint: "knee", side: "both", kind: "other" }] })
    .map((m) => m.exerciseId)).toContain("high_elbow");
});

it("keeps only difficulty matching By pattern median (missing→intermediate, novice→beginner)", () => {
  // graph with standards + memories driving horizontal_pull median; candidates at beginner/intermediate/advanced
});
```

Use real `jointLoadsFor` name matches (`One-arm` → elbow high; `Pull-up` → shoulder/elbow moderate). For level: memories with `bestReps` + `standards` on a trained pull so `buildLevelProfile` yields a median; assert wrong difficulties are absent.

- [ ] **Step 2: Run** `npx vitest run tests/body/balance.test.ts` — new cases fail.

- [ ] **Step 3: Commit** tests if desired mid-flight; otherwise fold into Task 2 commit.

---

### Task 2: Wire filters in `suggestMoves` + Body view

**Files:**
- Modify: `src/body/balance.ts`
- Modify: `src/ui/bodyView.ts`

- [ ] **Step 1: Extend inputs**

```ts
// MoveInput + BalanceInput
jointHistory?: readonly JointHistoryEntry[];
```

- [ ] **Step 2: In `suggestMoves`**, after building candidates:

```ts
const declared = new Set((input.jointHistory ?? []).map((e) => e.joint));
const tierByPattern = new Map(
  buildLevelProfile({ graph, memories: input.memories ?? {} }).rows.map((r) => [r.pattern, r.tier]),
);

function targetDifficulty(pattern: Pattern): SkillTier {
  const tier = tierByPattern.get(pattern);
  if (!tier) return "intermediate";
  return tier === "novice" ? "beginner" : tier;
}

function blockedByJoint(name: string): boolean {
  return jointLoadsFor(name).some((load) => load.level === "high" && declared.has(load.joint));
}

// filter:
!excluded.has(exercise.id)
&& missingGear(exercise, equipment).length === 0
&& !blockedByJoint(exercise.name)
&& (exercise.difficulty ?? "intermediate") === targetDifficulty(exercise.pattern)
```

- [ ] **Step 3: `bodyView.ts`** — `const profile = loadProfile()`; pass `equipment: profile.equipment`, `jointHistory: profile.jointHistory`.

- [ ] **Step 4: Run** `npx vitest run tests/body/balance.test.ts` — all pass.

- [ ] **Step 5: Commit**

```bash
git add src/body/balance.ts src/ui/bodyView.ts tests/body/balance.test.ts \
  docs/superpowers/specs/2026-11-21-body-consider-adding-filters-design.md \
  docs/superpowers/plans/2026-11-21-body-consider-adding-filters.md
git commit -m "$(cat <<'EOF'
feat(body): filter Consider adding by gear, high joints, By pattern level

Closes #256
EOF
)"
```
