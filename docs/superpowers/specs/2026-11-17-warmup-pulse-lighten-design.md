# Warmup pulse → confirm lighten (#design)

**Status:** Approved for implementation  
**Date:** 2026-11-17

## Problem

Morning check-in (sleep / pain) can set a light day, but live strap signals during warmup are unused. A wound-up athlete can still get a full dose after a hard-looking warmup.

## Goals

- At **end of warmup only**, if pulse suggests wound-up, **ask once**: keep it light?
- Accept → same moves, **light-day dose rewrite** (`applyLightDayDose`).
- Persist **warmup-average HR**; after **5** comparable warmups use a personal baseline.
- Tiny **random forest** over sleep · pain · HR learns the confirm **default** (Lean light vs Keep).
- Labels: **accept/decline** (weight 1) + **session rating** after decline/accept (weight 2).

## Non-goals

- Silent auto-lighten without confirm  
- Full replan / progression swaps  
- Mid-warmup interrupt  

## Detection

1. Always record warmup-average BPM when ≥N samples exist.  
2. If ≥5 averages for this `warmupLevel`: wound-up when avg ≥ median + 8 bpm.  
3. Else: wound-up when last ~45s samples sit in zone `work` | `hard` | `max`.  
4. No strap / too few samples → skip gate.

## Forest

- Features: sleep (good/fair/poor), pain count (0–5), HR bucket (normal / end-zone high / baseline-high).  
- Predict: prefer light default (boolean).  
- Cold start: poor sleep OR any pain OR HR elevated → default Light.  
- Cap ~60 labeled examples; retrain on write.
