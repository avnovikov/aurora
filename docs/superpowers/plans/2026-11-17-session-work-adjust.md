# Session Work Adjust Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the live work set screen, add a top toolbar (Swap · Easier · Skip today · Never again) that adjusts the current move, writing Plan for Swap/Easier/Never again and advancing only for Skip today.

**Architecture:** Pure helpers in `sessionWorkAdjust.ts` reuse `dayEdits` / `setDayExercise` and rebuild the live `PlannedWorkItem`. Chalk renders the toolbar; controls + sessionView wire taps, status, and Never-again Undo.

**Tech Stack:** TypeScript, Vitest, existing session/plan UI patterns (`btn-quiet`, `data-*` hooks).

## Global Constraints

- Work phase only; warm-up keeps its existing Not for me.
- Toolbar above the hero (layout C).
- Easier / Swap / Never again update the Plan day slot (`planned.programId` + `slotId`).
- Skip today: advance to next exercise; no plan write; no substitute.
- Undo only for Never again (`ExcludeUndo`).

---

### Task 1: Pure adjust helpers + tests

**Files:**
- Create: `src/ui/sessionWorkAdjust.ts`
- Create: `tests/ui/sessionWorkAdjust.test.ts`

**Interfaces:**
- Produces:
  - `dayExerciseIds(planned, workIndex): string[]`
  - `replaceWorkMove(item, exerciseId, readiness, deloadActive): PlannedWorkItem`
  - `applyEasierWork(...)`, `applySwapWork(...)`, `applyNeverAgainWork(...)` returning `{ planned, item?, status, undo?, finishExercise: boolean }`
  - `applySkipToday(): { finishExercise: true; status: string }`

- [ ] **Step 1: Write failing tests** for replaceWorkMove (new exercise id/name), applyEasierWork (plan slot changes), applySkipToday (finishExercise true, no exclude), applyNeverAgainWork (excluded + substitute or finish).

- [ ] **Step 2: Implement `sessionWorkAdjust.ts`** using `easierChoice` / `easierInDay` / `swapChoices` / `setDayExercise` / `excludeFromDay` / `resolveSlot` (pinned) / `requireExercise`.

- [ ] **Step 3: Run** `npx vitest run tests/ui/sessionWorkAdjust.test.ts` — expect PASS.

- [ ] **Step 4: Commit** `feat: session work adjust helpers`

---

### Task 2: Toolbar markup + styles

**Files:**
- Modify: `src/ui/sessionChalk.ts` (`workHtml` / `surfaceHtml`)
- Modify: `src/styles/session.css`
- Modify: `src/ui/sessionTypes.ts` (optional adjust UI fields on a small type passed into chalk, or keep adjust UI only in sessionView and pass a view model into shellHtml)
- Test: extend `tests/ui/sessionLogSetEdit.test.ts` or add `tests/ui/sessionWorkAdjustMarkup.test.ts`

**Interfaces:**
- Consumes: adjust view model `{ easierAvailable, swapOpen, swapOptions, status?, undoLabel? }`
- Produces: `data-work-swap`, `data-work-easier`, `data-work-skip-today`, `data-work-never`, `data-work-swap-pick`, `data-work-undo` hooks above the hero

- [ ] **Step 1: Failing markup test** — work HTML contains the four toolbar hooks; rest/warmup do not.

- [ ] **Step 2: Render toolbar** in work stage above `heroHtml`; disabled Easier when unavailable; swap picker when open; status/Undo row.

- [ ] **Step 3: CSS** for `.session-work-adjust` strip (flex wrap, quiet buttons, ≥44px).

- [ ] **Step 4: Commit** `feat: work adjust toolbar markup`

---

### Task 3: Wire controls + sessionView

**Files:**
- Modify: `src/ui/sessionControls.ts` — new handlers + click wiring
- Modify: `src/ui/sessionView.ts` — hold adjust UI state, call helpers, `finishExercise`, persist, paint
- Test: `tests/ui/sessionWorkAdjustControls.test.ts`

**Interfaces:**
- Extends `SessionControlHandlers` with `onWorkSwap`, `onWorkEasier`, `onWorkSkipToday`, `onWorkNever`, `onWorkSwapPick(id)`, `onWorkUndo`

- [ ] **Step 1: Failing control test** — Skip today calls `onFinishExercise`; Easier disabled click no-op; Never again calls exclude path.

- [ ] **Step 2: Wire** in `sessionControls` + implement handlers in `sessionView` (loadAthleteState, mutate `options.planned.work[workIndex]`, reset setIndex/workState, persist).

- [ ] **Step 3: Run** relevant vitest files — expect PASS.

- [ ] **Step 4: Commit** `feat: wire mid-session swap easier skip exclude`

---

### Task 4: Verification

- [ ] **Step 1:** `npx vitest run tests/ui/sessionWorkAdjust.test.ts tests/ui/sessionWorkAdjustMarkup.test.ts tests/ui/sessionWorkAdjustControls.test.ts tests/ui/sessionLogSetEdit.test.ts`

- [ ] **Step 2:** Manual smoke — start Today session, on first work set: Easier (plan updates), Swap pick, Skip today on another day, Never again + Undo.

---

## Spec coverage

| Spec requirement | Task |
|------------------|------|
| Toolbar above hero | 2 |
| Swap + Easier + plan write | 1, 3 |
| Skip today advance only | 1, 3 |
| Never again + Undo | 1, 3 |
| Work-only | 2 |
| Rebuild live item / reset sets | 1, 3 |
