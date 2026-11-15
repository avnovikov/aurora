# Log-set reps edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the work screen, edit this set’s reps (and optional load) inline; advancing saves those numbers; later sets of the same exercise default to the logged reps; weight does not stick.

**Architecture:** Keep logging in `setLog.ts` / `sessionControls.ts`. Add pure helpers for sticky work-state after a logged set and for editing load. Work chalk gains the same +/− pattern as rest, plus optional Add weight. `completeSet` stops resetting to plan dose.

**Tech Stack:** TypeScript, Vitest, existing session UI (chalk HTML + controls).

## Global Constraints

- No Confirm dialog; save on Log set / Failed / Skip advance.
- Default added load when enabling weight: **12 kg**.
- Weight resets to 0 on the next set; reps stick within the exercise.
- Skip keeps completedReps 0 and does not rewrite sticky from zero.

---

## File map

| File | Role |
|------|------|
| `src/session/setLog.ts` | `editAddedLoad`, `workStateAfterLoggedSet` |
| `src/ui/sessionControls.ts` | Wire work +/− / weight; sticky on complete |
| `src/ui/sessionChalk.ts` | Work UI for reps + weight |
| `src/style.css` | Minimal layout for work steppers / weight row |
| `tests/session/setLog.test.ts` | Pure helper tests |
| `tests/ui/sessionLogSetEdit.test.ts` | Chalk markup + complete sticky behaviour |

---

### Task 1: Pure setLog helpers (TDD)

- [x] Write failing tests for `editAddedLoad` (non-negative number; 12 default path tested via caller) and `workStateAfterLoggedSet` (sticky reps, `addedLoadKg: 0`).
- [x] Implement helpers in `setLog.ts`.
- [x] Run `npx vitest run tests/session/setLog.test.ts`.

### Task 2: completeSet sticky + work controls (TDD)

- [x] Add failing tests: after Log set with edited reps, next `workState` prescribed/override equals logged reps and load is 0; shell work HTML has `data-reps-minus` / `data-add-weight`.
- [x] Update `completeSet` to use `workStateAfterLoggedSet`.
- [x] Allow `adjustNextReps` on `work` and `rest`; wire weight buttons.
- [x] Update `workHtml` + CSS.
- [x] Run targeted vitest files, then `npm test` if fast enough.
