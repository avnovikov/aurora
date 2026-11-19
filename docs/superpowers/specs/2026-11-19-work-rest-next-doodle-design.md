# Work rest: doodle beside next move

**Issue:** #177  
**Base:** `origin/dev`

## Goal

On work rest (between sets and Get ready), when naming the upcoming set, show that move’s doodle next to the name. The rest countdown stays the primary hero.

## Behavior

1. Work rest eyebrow is only the phase: `Rest` or `Get ready`.
2. Under it, a `rest-next` row shows:
   - compact doodle for `currentWork` (when `doodlePath` exists)
   - `next {name} · Set {n} of {sets}`
3. Countdown (`data-rest-left`) remains the large dose figure under that row.
4. Warm-up / cool-down station gaps stay unchanged: single eyebrow `Rest · next {name}`, no doodle.
5. Missing doodle path: text row only, no empty frame.

## Approach

Split the work-rest eyebrow (not station gaps). Extend the work-rest hero markup only; leave `stationGapHtml` on the existing `restHeroHtml` path.

## Out of scope

- Station gap doodles
- Changing rest timer, swipe, or next-reps controls
