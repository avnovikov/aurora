# Library dose fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pre-parsed Library/warmup prescriptions expand into timed steps; work dosing stays on tier standards clamped to prescription min/max; doodles prefetch at warmup start.

**Architecture:** Add `ExercisePrescription` in domain; warm-up stations carry an optional hold prescription; `buildWarmupView` expands segments; `applySkillDose` clamps to prescription; `doodleMarkup` exposes prefetch + theme invalidation.

**Tech Stack:** TypeScript, Vitest, existing warmup/session/doodle modules.

## Global Constraints

- Warm-up dose from prescription when present — no planner override outside the band.
- Work dose from tier standards, clamped to prescription min/max when present.
- Effort explicit: hold vs reps.
- Do not commit unless the user asks.
- TDD: failing test first for each behaviour.

---

### Task 1: Prescription type + expand helper

**Files:**
- Create: `src/domain/prescription.ts`
- Create: `tests/domain/prescription.test.ts`

**Produces:** `ExercisePrescription`, `expandHoldPrescription(p) => { seconds, side?: "left"|"right" }[]`

- [x] Failing tests for `2×20 perSide` → 4×20 with L,R,L,R; `3×25 total` → 3×25; invalid rounds throw
- [x] Implement helper
- [x] Tests pass

### Task 2: Expand in `buildWarmupView`

**Files:**
- Modify: `src/data/warmupStations.ts` (optional `prescription` on station/spec)
- Modify: `src/rules/warmupPlan.ts`
- Modify: `tests/rules/warmupPlan.test.ts`

**Produces:** Steps expanded from station.prescription; expanded per-side steps have `perSide: false`

- [x] Failing test: station with prescription 2×20 perSide yields 4 steps
- [x] Implement
- [x] Tests pass

### Task 3: Author mismatched warmup prescriptions

**Files:**
- Modify: `src/data/warmupStations.ts` (`hf_100`, `hf_99`, child poses, hollow/pike multi-holds)
- Modify: `tests/data/warmupStations.test.ts` as needed

- [x] Set prescriptions; align cues; drop misleading single-timer assumptions
- [x] Tests pass

### Task 4: Work clamp to prescription

**Files:**
- Modify: `src/domain/types.ts` (optional `prescription` on Exercise)
- Modify: `src/rules/skillDose.ts`
- Create/modify: `tests/rules/skillDose.test.ts`

- [x] Failing test: working reps clamped to amountMin/Max
- [x] Implement clamp
- [x] Tests pass

### Task 5: Doodle prefetch on warmup start

**Files:**
- Modify: `src/doodles/doodleMarkup.ts`
- Modify: `src/ui/sessionView.ts` (or warmup entry)
- Test: `tests/doodles/` or UI test if pattern exists

- [x] `prefetchDoodles` + `clearDoodleCache`
- [x] Call at warmup/cooldown start
- [x] Clear on theme change if hook exists (CSS vars — clear exported for tests)
- [x] Tests pass

### Task 6: Verify

- [x] `npm test` for touched suites
- [x] Spot-check `hf_100` expansion in warmup plan test
