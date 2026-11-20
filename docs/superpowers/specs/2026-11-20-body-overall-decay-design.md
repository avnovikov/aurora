# Body: Overall decayed load (default)

Issue: #217

## Why

Body’s default “Week” hard window over-weights the last few days and ignores the
rest of the athlete’s work. Literature on training cessation gives a better
default: recent work stays fully “live” for a short hold, then fades.

## Evidence (anchors)

| Finding | Source |
|---|---|
| Maximal force: no clear loss in the first **~2 weeks** of cessation | Bosquet et al. 2013, *Scand J Med Sci Sports* (meta, 103 studies) |
| Mean strength **−14.5%** over mean **~7.2 weeks** detraining → **~85% retained** | McMaster et al. 2013, *Sports Med* |
| Age (≥65) larger loss (~1.8–2.5× SMD); **sex does not** change force/power SMD | Bosquet 2013; Lemmer 2000 |
| Young vs older: both held ~**12 weeks**, then older lost more by week 31 (−8% vs −14%) | Lemmer et al. 2000, *MSSE* |

Exact day counts for the Body curve are product judgement pinned to those anchors.
v1 is **age- and sex-agnostic**. Optional later: faster decay when profile age ≥ 65.

## Decisions

1. **Default chip = Overall** — every history session contributes; credit fades with age.
2. **Weight curve** — age in days from `completedAt` to `now`:
   - `t ≤ 14` → weight **1.0**
   - `t > 14` → `exp(−λ · (t − 14))` with `λ = −ln(0.85) / (49 − 14)`  
     so **day 49 ≈ 0.85**. Keeps fading; no hard cutoff.
3. **Overall metric** — same as today’s load: `setCount × role weight × session weight`  
   (primary 1, secondary 0.5, stabilizer 0.25; strongest role per group).
4. **Period chips** — **Month / 3 months / Half year / Year** only (**no Week**).  
   Hard windows. Metric = **total exercise appearances** per muscle group: each
   `exerciseId` in a session inside the window adds **1** to each of that exercise’s
   muscle groups (once per group). Not set-weighted.
5. **Copy** — Overall tagline explains full credit for ~2 weeks then fade; period
   tagline says exercise counts in the window.

## Out of scope

- Age-scaled λ, sex-scaled λ, power vs grind decay
- Changing level retest (21 / 42 day) constants
- Changing silhouette / heat opacity math beyond using the new scores
