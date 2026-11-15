# Rest swipe to start next set

## Goal

During between-set **Rest** and post-warm-up **Get ready**, swipe **right** to end the wait early and show the next work set. Swipe left does not commit.

## Scope

- Rest phase with a work item queued (including Get ready after warm-up).
- Not warm-up/cool-down station holds.
- Not work-phase swipe (that still finishes the set/exercise either direction).

## Behaviour

- Same commit rules as work swipe (`SWIPE_COMMIT_RATIO`, flick speed, exit / snap-back timings), except only **right** may commit.
- On right commit: clear the rest timer, set `phase` to `work`, paint (identical outcome to the countdown reaching 0).
- Left drag is allowed; release always cancels (snap back). Short right also cancels.
- Pointer on −/+ (and other interactive controls) does not start a swipe.
- Hint on rest stage: “Swipe right to start”.
- Voice: stopping the timer early stops further rest cues for that rest (timer `clear`).

## Approach

Extend the existing swipe helper with a direction mode rather than a second gesture stack.

- `commitDirections: "both" | "right"` (default `"both"` for work).
- Work: `wireSwipe(stage, onFinish)` → both directions, finish exercise/set path unchanged.
- Rest: `wireSwipe(stage, onStart, { commitDirections: "right" })` → right starts the set.

## Modules

- `src/ui/sessionSwipe.ts` — `decideSwipeRelease` respects `commitDirections`; left never commits when `"right"`.
- `src/ui/sessionChalk.ts` — rest markup gets `data-swipe-stage` (or equivalent) and the hint.
- `src/ui/sessionControls.ts` — wire rest stage to clear rest + existing rest-done callback.
- `src/ui/sessionView.ts` / rest handle — ensure early start clears `restHandle` before advancing.
- `tests/ui/sessionSwipe.test.ts` — right-only decisions.
- Rest UI test — swipe right leaves rest for work; left leaves rest running.

## Out of scope

- Separate left-side actions on rest.
- New “Start set” button (swipe is the early-start control).
- Changing rest length, cues, or Get ready duration.
