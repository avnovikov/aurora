# Cousin swap: kettlebell as dumbbell Implementation Plan

> **For agentic workers:** TDD. Branch from `origin/dev`; PR to `dev`; worktree isolation.

**Goal:** When checking twin gear for Add-weight cousin swap, treat owned `kettlebell` as satisfying `dumbbell` requirements. Library/plan/Body gear unchanged.

**Architecture:** Local equipment expansion inside `athleteOwnsGearFor` in `sessionLoadCousin.ts` only — do not change global `missingGear`.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-21-cousin-swap-kettlebell-as-dumbbell-design.md`

## File map

| File | Role |
|------|------|
| `src/ui/sessionLoadCousin.ts` | Expand equipment for twin ownership check |
| `tests/ui/sessionLoadCousin.test.ts` | KB-only swap + body-only no-swap |

---

### Task 1: Failing test then alias

**Files:** `tests/ui/sessionLoadCousin.test.ts`, `src/ui/sessionLoadCousin.ts`

- [x] **Step 1:** Add test: KB-only athlete on `bodyweight_squat` (or `hip_hinge`) swaps to twin
- [x] **Step 2:** Run test — expect fail (no swap)
- [x] **Step 3:** In `athleteOwnsGearFor`, if equipment has kettlebell and not dumbbell, pass `[...equipment, "dumbbell"]` to `missingGear`
- [x] **Step 4:** Run `sessionLoadCousin` tests — all green
- [x] **Step 5:** Clean Code: name the helper expressively (`equipmentForCousinTwin`); keep SRP; no global gear change
