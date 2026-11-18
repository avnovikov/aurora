# Progress profile + History Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Progress with profile / weak-links / readiness cards and add a History tab with set-level logs and Progress drill-in filters.

**Architecture:** Pure models under `src/progress/` for profile, weak-links, readiness; extend `HistoryEntry` with set payloads; `progressView` + new `historyView`; shell gains `history` tab; app wires drill-in → filtered History.

**Tech Stack:** TypeScript, Vite, Vitest, existing key-value storage.

**Spec:** `docs/superpowers/specs/2026-11-17-progress-profile-history-design.md`

---

### Task 1: Persist set logs on history append

**Files:**
- Modify: `src/domain/program.ts` (`HistoryEntry`)
- Modify: `src/session/history.ts` / evaluation append path in `src/ui/app.ts`
- Test: `tests/session/historySets.test.ts`

**Steps:** Extend `HistoryEntry` with optional `sets`; when finishing a session, store `log.entries`; load/normalize safely for legacy rows; tests for round-trip and legacy.

### Task 2: Within-tier % + pattern profile model

**Files:**
- Create: `src/progress/withinTierProgress.ts`
- Create: `src/progress/levelProfile.ts`
- Test: `tests/progress/withinTierProgress.test.ts`, `tests/progress/levelProfile.test.ts`

**Steps:** Implement definitions from spec; aggregate by pattern; TDD.

### Task 3: Weak-link ranking model

**Files:**
- Create: `src/progress/weakLinkBoard.ts`
- Test: `tests/progress/weakLinkBoard.test.ts`

### Task 4: Current readiness model

**Files:**
- Create: `src/progress/currentReadiness.ts` (may wrap/adapt `planProgress`)
- Test: `tests/progress/currentReadiness.test.ts`

### Task 5: History list + filter helpers

**Files:**
- Create: `src/progress/historyFeed.ts` (flatten sets → feed rows; filter by pattern / exercise)
- Test: `tests/progress/historyFeed.test.ts`

### Task 6: History tab UI + shell

**Files:**
- Modify: `src/ui/shell.ts`
- Create: `src/ui/historyView.ts`
- Modify: `src/ui/app.ts`
- Modify: `src/style.css`
- Test: light UI test if project pattern exists, else model coverage + manual

### Task 7: Progress view rewrite + drill-in

**Files:**
- Modify: `src/ui/progressView.ts`
- Modify: `src/ui/app.ts` (onJumpHistory filter)
- Modify: `src/style.css`
- Update: `tests/progress/planProgress.test.ts` only if still used; add progress view tests as needed

### Task 8: Verify

Run focused Vitest + `tsc` / smell if available; fix failures.
