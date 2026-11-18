# Plan block replenish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After finishing a generated block day, append the next working/easier/focus day (same `block.id` / target) at plan end in `advancePlanAfterSession`.

**Architecture:** Extend `generateBlock` with a continuation-day builder; hook `advancePlanAfterSession` to peek the finished day, advance the queue, then save+append one new day when eligible.

**Tech Stack:** TypeScript, Vitest, existing plan queue / planDays storage.

## Global Constraints

- Same post-session path as queue advance (after memories are already saved by the caller).
- Append at plan end only; skip seed / joint care / mobility; skip append if generation fails.
- Unique day id; stable `block.id`.

---

### Task 1: Continuation day generator (TDD)

**Files:**
- Create: `tests/plan/blockReplenish.test.ts`
- Modify: `src/plan/generateBlock.ts`
- Modify: `src/plan/blockActions.ts` (optional thin `appendContinuationDay`)

- [x] Write failing tests for `nextBlockLetter` and `generateContinuationDay` (letter cycle, same block.id/target, unique id, skip non-block).
- [x] Implement minimal generator API.
- [x] Tests pass.

### Task 2: Hook `advancePlanAfterSession` (TDD)

**Files:**
- Modify: `src/ui/planView.ts`
- Modify: `tests/plan/blockReplenish.test.ts` (or scheduleOverride tests)

- [x] Write failing tests: finish A → B at end; finish seed → no append; generation failure → advance still works.
- [x] Implement hook (peek finished id before `completeToday`).
- [x] Tests pass.

### Task 3: Spec + verify

- [x] Copy/link design spec; run focused + related plan tests.
