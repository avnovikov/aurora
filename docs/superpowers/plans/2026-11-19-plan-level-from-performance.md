# Plan level from logged performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-raise the plan level one tier when ≥80% of working slots in the next 3 plan-queue days are logged at the current level’s boundary or already at the next tier, show why on Plan, and keep lowering manual (#115).

**Architecture:** A pure `planLevelGate` scores the queue window from memories; `planLevel` applies a one-step raise and a dismissible notice; session close and Plan open call the apply helper. `planTier` stays a dose default and never satisfies the gate.

**Tech Stack:** TypeScript, Vitest, existing plan queue / memory stores.

## Global Constraints

- British English (`en-GB`) UI copy
- Evidence for raise = logged only (not declared / inferred / planTier)
- Unlogged working slots with standards = fail (in the denominator)
- At most one tier up per evaluation
- PRs target `mvp`; branch `feature/115-plan-level-from-performance`

---

### Task 1: Pure gate

**Files:**
- Create: `src/progress/planLevelGate.ts`
- Test: `tests/progress/planLevelGate.test.ts`

**Interfaces:**
- Produces: `evaluatePlanLevelGate({ days, memories, currentTier, exercises }) → { passed, total, shouldRaise, nextTier }`
- Threshold: `meetsRaiseThreshold` via 4/5 (80%) integer compare
- Pass: `bestReps >= standards[current]` OR logged/best at/above `nextSkillTier(current)`

- [ ] **Step 1: Write failing tests** for <3 days, 79%/80%, unlogged fail, boundary/next pass, elite no raise, declared/planTier ignored
- [ ] **Step 2: Run tests — expect FAIL** (`npm test -- tests/progress/planLevelGate.test.ts`)
- [ ] **Step 3: Implement `planLevelGate.ts`**
- [ ] **Step 4: Run tests — expect PASS**
- [ ] **Step 5: Commit** `feat(levels): plan level raise gate from logged performance (#115)`

### Task 2: Persist raise + notice

**Files:**
- Modify: `src/plan/planLevel.ts`
- Test: `tests/plan/planLevelRaise.test.ts`

**Interfaces:**
- Produces: `applyPlanLevelRaiseIfReady(...) → { raised: boolean; from?: SkillTier; to?: SkillTier }`
- Produces: `loadPlanLevelRaiseNotice() / clearPlanLevelRaiseNotice()`
- When current is `auto`, resolve evaluation tier via caller-supplied `effectiveTier`; on raise write concrete `nextTier`

- [ ] **Step 1: Failing tests** for one-step raise, notice set/clear, elite no-op, auto → concrete
- [ ] **Step 2: Implement apply + notice store**
- [ ] **Step 3: Tests PASS; commit** `feat(levels): apply plan level raise and Plan notice (#115)`

### Task 3: Wire session close + Plan open + UI

**Files:**
- Modify: `src/ui/sessionControls.ts` or session finish path that advances the queue
- Modify: `src/ui/planModel.ts`, `src/ui/planView.ts`, `src/ui/planPage.ts`
- Test: focused UI/integration test if an existing pattern fits; otherwise cover apply helper thoroughly in Task 2

- [ ] **Step 1: Call apply after session memory update / when building Plan model**
- [ ] **Step 2: Show notice in Plan status; dismiss clears notice**
- [ ] **Step 3: Update plan-level note copy if it still implies plan stamps Library levels incorrectly
- [ ] **Step 4: Commit** `feat(plan): show plan level raise from last 3 days (#115)`

### Task 4: Verify

- [ ] **Step 1:** `npm test -- tests/progress/planLevelGate.test.ts tests/plan/planLevelRaise.test.ts`
- [ ] **Step 2:** Run any touched UI tests
- [ ] **Step 3:** Spec self-check against `docs/superpowers/specs/2026-11-19-plan-level-from-performance-design.md`
