# Plan block replenish after session (design)

Issue: [#128](https://github.com/avnovikov/aurora/issues/128).

## Problem

When a generated plan day finishes, remaining days in the same block/group toward the same target are updated from the new session memory. The queue still shrinks: completing a day removes it and nothing tops the group back up. Over a few sessions the plan runs out of days toward that target.

## Goal

After every completed **generated block day**, in the same post-session commit that advances the queue (and updates remaining siblings), **append one new day** at the **end of the plan**: same group / same target, next emphasis in the **working → easier → focus** cycle, with moves chosen from **current** ladder steps so planned progressions are already on the day.

## Decisions

| Question | Decision |
|---|---|
| New day shape | Next letter in A (working) → B (easier) → C (focus) → A… |
| Queue placement | Always append at the end of the plan |
| When | After every completed generated day that belongs to a block/group toward a target |
| Transaction | Same post-session path as sibling update / queue advance (`advancePlanAfterSession` after memories are saved) |
| Approach | Hook `advancePlanAfterSession` (thin call into plan helpers as needed) |

## Behaviour

1. Session evaluation saves memories (and any existing sibling-day update runs in that commit path).
2. `advancePlanAfterSession` peeks the finished day (queue head / override) **before** `completeToday`.
3. If that day is **not** a generated block day (`block` missing, or seed / joint care / mobility one-off), behave as today: `completeToday` + clear override + save queue. No append.
4. If it **is** a generated block day:
   - Derive kind + target from the finished template (same as the block that created it).
   - Next letter: A→B, B→C, C→A; emphasis from that letter.
   - Generate **one** new `SessionTemplate` with:
     - **Same** `block.id` (same group) and **same** `targetExerciseIds` / kind.
     - **New** unique day id (must not reuse a pruned `day_…` id).
     - Slots from current `StepContext` (post-session memory), so progressions are planned in.
   - `completeToday` + clear override.
   - `savePlanDays([newDay])`, append `newDay.id` at end of queue, **one** `savePlanQueue`.

## Architecture

| Touch | Role |
|---|---|
| `src/ui/planView.ts` `advancePlanAfterSession` | Peek finished day; after advance, append when eligible; single queue save |
| `src/plan/generateBlock.ts` (or small helper next to it) | Build one day for a given letter/emphasis from kind + target + context; reuse existing pick/dose path |
| `src/plan/planDays.ts` / `blockActions` patterns | Persist the new day before the queue references it |
| Tests under `tests/plan/` | Replenish letter cycle, append position, skip non-block days, unique ids |

Generated days already carry `block: { id, letter, emphasis }` and `targetExerciseIds` (`generateBlock` / `buildDay`). Replenish reads those; it does not invent a new grouping key.

**Id collision:** cycling letters must not reuse ids. Prefer `newDayId()` (or equivalent) for the new template id while keeping `block.id` stable for “same group.”

**Equipment / exclusions:** if generation cannot place any moves (same error as `generateBlock`), skip append and leave the advanced queue as today; do not fail the session close.

## Out of scope

- Seed template days, Joint care, Mobility one-offs
- Changing block spacing for the new day (always end of plan)
- Regenerating remaining siblings from scratch (assumed already in the post-session path)
- Calendar dates; changing A/B/C recipe rules themselves

## Testing

- Finish generated A toward target T → queue loses A, gains new B at end; B shares `block.id` and target T; slots reflect post-session steps.
- Finish B → append C; finish C → append A (new id).
- Finish seed / joint care / mobility → no append.
- Override that does not match queue head: only advance/clear as today; append only when the completed session was a generated block day.
- One save path: after replenish, queue contains the new id and `findTemplate` resolves it.

## Acceptance

- [ ] Completing a generated block day appends one next working/easier/focus day at plan end, same `block.id` and target.
- [ ] New day uses current ladder/memory (progressions planned in).
- [ ] Non-block days unchanged.
- [ ] Session close still succeeds if generation cannot place moves (no append).
- [ ] Focused Vitest coverage for the cases above.
