# Warmup / work shared Set X of Y hero line

**Issue:** #255  
**Branch:** `feature/255-warmup-work-set-line` → `dev`

## Goal

When a warm-up station expands into multiple rounds of the same exercise, show a clear **Set X of Y**. Use the same set-line look on work so set progress reads identically in both phases.

## Hero stack

| Surface | Eyebrow (`.session-phase`) | Set line | Name |
|---------|----------------------------|----------|------|
| Warmup, multi-round (`Y > 1`) | `Warmup` | `Set X of Y` | move |
| Warmup, single step | `Warmup` | omit | move |
| Work | omit | `Set X of Y` | move |

Work does **not** get a `Work` phase label. The set line is shared markup + CSS for warmup and work.

## Warmup X / Y

- Consecutive steps with the same `stationId` form a run.
- `Y` = length of that run; `X` = 1-based index of `warmupIndex` inside the run.
- Show the set line only when `Y > 1`.
- Per-side left/right stay in the move name (`… (left)` / `… (right)`); they do not redefine what a “set” is beyond prescription rounds.

## Work X / Y

Unchanged source: `state.setIndex` of `item.dose.sets`. Always show the shared set line (including `1 of 1` if the dose has one set).

## Rest / cool-down

- Work rest may keep `… · Set X of Y` in the rest eyebrow as today.
- Warmup gaps stay `Rest · next …`.
- Cool-down: no set line in this change.

## Out of scope

Voice, chalk strip copy, single-timer stations whose cues mention “2 sets” without expanding into multiple steps.

## Acceptance

- Multi-round warmup shows `Warmup` → `Set X of Y` → name.
- Single warmup step omits the set line.
- Work set line matches warmup set line (class + copy pattern).
- Focused Vitest for the run helper and chalk HTML.
