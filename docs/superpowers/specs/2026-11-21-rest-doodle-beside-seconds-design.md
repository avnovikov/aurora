# Rest doodle beside countdown seconds

**Issue:** #274  
**Base:** `origin/dev`

## Goal

On every rest screen (work rest and warmup/cool-down station gaps), show the upcoming move’s doodle to the **right** of the countdown seconds, about as tall as the digit block (~95px). Keep the next-move name as text above the time.

## Layout

```
{Rest | Get ready}                 ← phase eyebrow
next {name} · …                    ← text only (.rest-next-line)
[ 90 s ]  [ doodle ~95px ]         ← .session-dose flex: figure then doodle
cue…
```

## Decisions

- Doodle sits **right of** `[data-rest-left]` in the dose row (not beside the name).
- Doodle height ≈ dose figure (~95px); definite `height` so viewBox SVGs do not collapse.
- Work rest: doodle of `currentWork`; station gap: doodle of the upcoming `WarmupStep`.
- Missing `doodlePath`: no empty frame.
- Station gaps use the same structure as work rest (phase + next line + dose row), not a combined `Rest · next` eyebrow alone.

## Modules

- `src/ui/sessionChalk.ts` — split text lead vs dose-row doodle; wire `stationGapHtml`
- `src/styles/session.css` — dose-row flex + large rest doodle
- `tests/ui/sessionScreen.test.ts` (+ station gap coverage)

## Out of scope

- Rest timer / swipe / next-reps controls
- Work-set doodle sizing
