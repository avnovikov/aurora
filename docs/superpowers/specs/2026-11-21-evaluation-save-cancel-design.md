# Evaluation Save / Cancel

## Goal

On every post-session **How was that?** screen, the athlete selects a feeling (easy → wiped), then either **Save** (commit as today) or **Cancel** (discard and leave the plan day unchanged).

## Decisions

- Feeling taps **select only** (highlight via `selected` / `aria-pressed`); they do not commit.
- **Save** enabled only after a feeling is selected (and after the existing 400ms arm). Runs today’s path: `commitSessionEvaluation` → history + memories → lighten reinforce → `advancePlanAfterSession` → Today.
- **Cancel** available once armed. No history, memories, or plan advance. Lands on Today; same queue day remains; live session stays abandoned (`clearSession` still runs at session finish — no resume).
- Applies to **every** finished session (not only last-day / debug).

## Modules

- `src/ui/evaluationView.ts` — select + Save / Cancel handlers
- `src/ui/app.ts` — `showEvaluation` wires Save vs Cancel
- `tests/ui/evaluationSaveCancel.test.ts` (+ update memory test that assumed instant pick)

## Out of scope

- Resuming the abandoned live session after Cancel
- Changing evaluation labels or dose logic
- Separate confirm modal
