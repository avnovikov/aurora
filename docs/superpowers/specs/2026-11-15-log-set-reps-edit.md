# Story: edit this set’s reps on Log set; next sets keep that default

**As** an athlete mid-session, **I want** to adjust the reps (and optionally add load) for the set I’m finishing without a confirm dialog, **so that** the log matches what I did and the next sets of this exercise start from that same rep count.

## Acceptance

- On the **work** screen, reps are editable with +/− before advancing. The starting value is the sticky/preset for this exercise (plan dose on the first set; after that, the reps last saved by advancing).
- **Add weight** is optional and off by default each set. Turning it on reveals a load field prefilled at **12 kg** for that set only. Clearing / leaving weight off logs `addedLoadKg: 0`.
- There is **no Confirm** step. Advancing saves whatever is on screen:
  - **Log set** → logs those reps (+ weight if added), then rest.
  - **Failed** → same numbers, `stopReason: muscular_failure`.
  - **Skip** → completed reps `0` (existing behaviour); sticky reps unchanged.
  - Rest **timer done** / return to work uses the sticky next-reps (no separate confirm).
- After a completed or failed set, **next sets of the same exercise** default to the reps just logged (sticky). Weight does **not** stick — the next set opens reps-only again.
- Sticky reps reset when the exercise finishes (swipe / last set / skip) and the next planned move starts from its own plan dose.
- Rest-screen +/− for “next set reps” stays as a fine-tune during rest; it edits the same sticky override the work screen will show.

## Behaviour

1. Work shows large reps with − / +. Optional **Add weight** → kg stepper/field at 12.
2. **Log set** / **Failed** call `appendSet` with `completedReps` / `prescribedReps` from the on-screen values (failed still records the attempted reps shown), and `addedLoadKg` from the weight UI (0 if off).
3. Then rest: `prescribedReps` / sticky override for the upcoming setIndex becomes those reps (not a reset to `item.dose.reps`).
4. After rest, work opens with that sticky count; weight UI reset to off.
5. Holds: same controls treat the number as seconds when the slot is a hold (label copy: “seconds” vs “reps” if already distinguished elsewhere; otherwise keep current dose display).

## Out of scope

- Post-hoc edit of already-frozen log entries.
- Sticky or remembered load across sets or sessions.
- Changing planned dose in the block generator from in-session edits (session sticky only).

## Modules

- `src/ui/sessionChalk.ts` — work-stage +/− and Add weight UI; keep rest +/−.
- `src/ui/sessionControls.ts` — wire work-phase rep/weight adjust; on complete, persist sticky reps instead of resetting to `item.dose.reps`.
- `src/session/setLog.ts` — `editNextReps` / `prescribedForNextSet`; extend or add helpers for optional load on the active set (`addedLoadKg` already on `ActiveWorkState` / `SetLogEntry`).
- `src/ui/sessionState.ts` — resume/sync must keep sticky `nextRepsOverride` (and not reintroduce plan load as sticky weight).
- Tests under `tests/ui/` (and setLog unit tests) for: log with edited reps, sticky after rest, weight 12 then next set 0, skip leaves sticky alone.

## Why this shape

Inline edit (approach B) without a confirm sheet: one fewer tap on the happy path, numbers save only when the set advances. Reps stick because athletes usually repeat the same count; weight stays opt-in per set because load is sporadic.
