# Design: Adjust work move mid-session (Swap / Easier / Skip today / Never again)

**As** an athlete on a live work set, **I want** Swap, Easier, Skip today, and Never again in a toolbar above the hero, **so that** I can drop or replace a move without leaving the session or opening Plan.

## Decisions

| Topic | Choice |
|-------|--------|
| Screen | Live session **work** surface only (not warm-up, rest, cool-down, Library) |
| Placement | Toolbar strip under the chalk rail / clock, **above** Set eyebrow + move name |
| Substitute | **Swap** (picker) and **Easier** (one tap), same semantics as Plan |
| Plan sync | Easier / Swap / Never again **write the Plan day slot** (`programId` + `slotId`) |
| Not for me | Two actions: **Skip today** and **Never again** |
| Skip today | Drop this work item for the rest of the session; advance to the next exercise; **no** plan write; **no** substitute |
| Never again | `excludeFromDay` (global exclude + best substitute into the plan slot); rewrite the current live work item to that substitute when one exists; if none, behave like Skip today for the live session and still exclude |
| Approach | Reuse Plan `dayEdits` + patch the in-memory `PlannedSession.work[workIndex]`; light status line; Undo only for Never again (reuse `ExcludeUndo`) |

## UI

On the work stage (and only while showing a work set, not rest):

1. Toolbar above the hero: `Swap` · `Easier` · `Skip today` · `Never again` (quiet buttons, ≥44px tall).
2. **Easier** disabled with “No easier step” when `easierChoice` is undefined (same pattern as Plan).
3. **Swap** toggles an inline picker of `swapChoices` (same cap/order as Plan). Choosing a move applies immediately and closes the picker.
4. After any apply: a one-line status under the toolbar (`Easier: A → B`, `Swapped to X`, `Skipped for today`, `Excluded: Y. Now: Z.`). Never again replaces its status with an **Undo** control until the next adjust or exercise change.
5. Log set / Couldn't finish / Skip set stay in the bottom bar unchanged.

## Behaviour

### Shared preconditions

- Only when `phase === "work"` and `currentWork` exists.
- Athlete context from `loadAthleteState()`.
- Day exercise ids = other work items’ `exerciseId`s (exclude the current slot when filtering choices).
- Template id = `planned.programId`; slot id = current item’s `slotId`.

### Easier

1. `easierInDay({ templateId, slotId, exerciseId, state, dayExerciseIds })`.
2. Rebuild the live `PlannedWorkItem` for the new exercise (dose via the same rules as planning a slot: library standards + athlete memory/readiness already on the session — see Modules).
3. Reset set progress for this slot: `setIndex = 1`, clear sticky reps / work state for the old move.
4. Repaint; status `Easier: from → to`.

### Swap

1. Show choices from `swapChoices`.
2. On pick: `setDayExercise(templateId, slotId, pickId)`, then same live rewrite + set reset as Easier.
3. Status `Swapped to {name}`.

### Skip today

1. Do **not** call exclusions or plan edits.
2. Call the existing finish-exercise path with no rest-before-next (or the same rest policy as finishing early without a logged set — prefer advancing without inventing a completed set).
3. Status is fleeting (next screen may not show it); no Undo.

### Never again

1. `excludeFromDay(...)`.
2. If `substituteName` / substitute id exists: rewrite live work item to that substitute, reset sets, show status + Undo.
3. If no substitute: finish this exercise (same as Skip today) after excluding; status notes no substitute; Undo still restores exclusion + plan slot.
4. Undo calls `undoExclude`, restores the previous live work item snapshot if still on that slot index, else only restores plan/exclusion.

## Data flow

```
Toolbar tap
  → dayEdits / setDayExercise (except Skip today)
  → rewrite planned.work[workIndex] (except Skip today with no substitute)
  → reset setIndex / workState
  → persist session snapshot if the session already autosaves
  → paint + status (/ Undo token)
```

## Modules

- `src/ui/sessionChalk.ts` — toolbar + swap picker + status/Undo markup on the work surface.
- `src/ui/sessionControls.ts` — wire Swap / Easier / Skip today / Never again / Undo / swap pick.
- `src/ui/sessionView.ts` — handlers: athlete state, plan writes, live rewrite, finish-exercise for Skip today, hold Never-again undo token across paint.
- `src/ui/sessionWorkAdjust.ts` (new, small) — pure helpers: rebuild `PlannedWorkItem` after a move change; apply easier/swap/exclude against plan + return the next live item; snapshot for undo. Keeps Plan and chalk free of each other’s details.
- Reuse: `src/plan/dayEdits.ts`, `src/ui/athleteState.ts`, existing `onFinishExercise`.
- Tests: `tests/ui/sessionWorkAdjust.test.ts` (helpers) and control/wiring coverage for disabled Easier, Skip today leaves plan untouched, Never again excludes + substitutes, Undo restores.

## Edge cases

- Mid-set adjust: discard unlogged reps on screen; start the new move at set 1 with its planned dose.
- Last work item + Skip today / Never-again with no substitute → session done / cool-down offer (existing finish path).
- Swap list empty → Swap disabled or empty state “No substitute fits” (match Plan’s empty swap copy).
- Warm-up keeps its existing Not for me only; this toolbar is work-only.
- Persisted resume: after adjust, saved session must carry the rewritten work item so resume matches the screen.

## Out of scope

- Warm-up / cool-down Swap or Easier.
- Changing Skip set (bottom bar) behaviour.
- Asking “Just today / Keep on Plan” for Easier/Swap (always keep on Plan).
- Redesign of Plan page actions.

## Why this shape

Approach 1 (reuse Plan edits + patch live session) keeps one substitution/exclusion brain. The toolbar placement matches the chosen layout (C). Skip today vs Never again separates “not now” from “not ever” without a nested confirm when the labels are explicit.
