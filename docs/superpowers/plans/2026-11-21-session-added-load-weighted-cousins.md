# Sticky added load + weighted cousins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep added load across sets of the same exercise; on Add weight, swap curated unweighted moves to their Dumbbell/weighted twin (Plan write) and restore on zero.

**Architecture:** Fix sticky `addedLoadKg` in set log / sync; import map-target wger rows; apply `weightedId` links; session controls reuse `replaceWorkMove` + `setDayExercise` with `loadSwapFromId`.

**Tech Stack:** TypeScript, Vitest, existing wger import + equipment audit.

**Issue:** #251 · **Spec:** `docs/superpowers/specs/2026-11-21-session-added-load-sticky-weighted-cousins-design.md`

## Global Constraints

- Branch from `origin/dev`; PR to `dev`; worktree isolation
- Twin swap only when athlete owns gear the twin needs (`dumbbell` and/or `kettlebell` via `orRequires`)
- v1 import: curated map targets only
- No commits unless user asks (session preference)

---

### Task 1: Sticky added load across sets

**Files:**
- Modify: `src/session/setLog.ts`
- Modify: `src/ui/sessionState.ts` (`syncWorkState`)
- Test: `tests/session/setLog.test.ts`, `tests/ui/sessionLogSetEdit.test.ts`

- [ ] **Step 1:** Update tests to expect `addedLoadKg` preserved in `workStateAfterLoggedSet`
- [ ] **Step 2:** Implement preserve; ensure `syncWorkState` keeps load when same slot+exercise+set, clears when exercise/slot changes
- [ ] **Step 3:** Run focused tests

### Task 2: Curated map + wger allow + reimport

**Files:**
- Create: `src/data/weightedCousins.ts`
- Modify: `src/data/wger/selection.ts`
- Regenerate: `src/data/generated/wgerCatalogue.ts`
- Append: `data/curated/equipment-audit.tsv` + `npm run equipment:compile`

- [ ] **Step 1:** Define unweighted id → wger display name map + target name set
- [ ] **Step 2:** Allow map-target names in `isWgerCandidate` (Dumbbell / empty eq for Weighted Step-ups / bodyweight-tagged Weighted push-ups)
- [ ] **Step 3:** Run `npx tsx scripts/import-wger.ts`
- [ ] **Step 4:** Add equipment audit rows (`dumbbell`; Weighted Step-ups `orRequires` kettlebell)
- [ ] **Step 5:** Compile equipment; fix any enrich failures

### Task 3: Apply `weightedId` on catalogue

**Files:**
- Modify: `src/domain/types.ts`, `src/data/seed.ts` (optional field)
- Modify: `src/data/enrich/enrichCatalogue.ts` or apply in `weightedCousins.ts` from libraryCatalogue
- Test: `tests/data/weightedCousins.test.ts`

- [ ] **Step 1:** Add `weightedId?: string` to Exercise
- [ ] **Step 2:** After enrich, set weightedId from map (resolve twin by name → id)
- [ ] **Step 3:** Tests for all curated pairs including four glute links

### Task 4: Session Add-weight swap / restore

**Files:**
- Modify: `src/session/setLog.ts` (`loadSwapFromId`)
- Modify: `src/ui/sessionControls.ts`
- Possibly: `src/ui/sessionView.ts` / athlete equipment load
- Test: `tests/ui/sessionWeightedCousin.test.ts`

- [ ] **Step 1:** Failing tests for swap+Plan+restore
- [ ] **Step 2:** Wire adjustAddedLoad / adjustAddedLoadBy
- [ ] **Step 3:** Pass tests

### Task 5: Verify

- [ ] Run Vitest for touched files
- [ ] Confirm acceptance criteria from issue #251
