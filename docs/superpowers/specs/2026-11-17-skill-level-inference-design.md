# Skill levels: evidence-based inference

Issue: #112 · Replaces: `2026-11-15-family-tier-cascade-design.md` · Depends on: #107 (per-exercise outcome from the set log)

## Why

A single Library pick currently promotes a whole progression family. `cascadeFamilyTiers` gives every easier member `declared + (sourceRank − memberRank)`, one tier **up** per rung, and `shouldAdvance` advances any move at advanced/elite with zero sessions. On the Pixel 10 snapshot (2026-11-17), "Bulgarian split squat = advanced" made 15 lunge/split variants **elite**, and the next plan days swapped untested moves:

- Lower body · C: Step-up 4×7 → Bulgarian split squat 4×18
- Lower body · B: Supported Split Squat → (advance to Suspended Split Squat, gear missing) → Bodyweight squat 4×20

The plan level ("intermediate") is also written as `declaredTier` on every planned move and cascaded, so a default looks like the athlete's own pick.

Fast progression is wanted: the athlete climbs quickly. The fix is to make **inferred** levels conservative and quick to confirm. **Tested** results are never slowed down.

## Evidence (summary of the literature review, 2026-11-17)

| Finding | Source | Kind |
|---|---|---|
| Training transfers to a non-trained variation at ~40–57 % of the trained effect | Appleby et al. 2019 JSCR (ES 0.27/0.42 vs 0.67/0.74); Spitz et al. 2023 Sports Med (d 0.8 vs 1.84) | RCT; meta-analysis |
| Closely matched variations predict each other well (r ≈ 0.8–0.93). Different positions predict poorly (r ≈ 0.1–0.6) | van den Tillaar & Ball 2020; Johnson 2009; Halet 2009; Sánchez-Moreno 2016 | peer-reviewed |
| Progression families are not one scale: 19 exercises → 3 sub-dimensions; planche lead-ups activate muscles differently | Sattelmayer 2021 Arch Physiother (Rasch); Rosaci 2025 JSCR | peer-reviewed |
| Unilateral ↔ bilateral ratios are inconsistent | Škarabot 2016 EJAP | review |
| Passing an item implies its prerequisites. Failing an item counts against harder items. No system trusts one response (CAT minimum 4 items; BKT mastery ≈ 5 opportunities) | Doignon & Falmagne (knowledge-space theory); ALEKS; PROMIS CAT | theory; practitioner |
| Strength is kept ~3 weeks without training, then falls (~14.5 % by ~7 weeks) | McMaster 2013; Bosquet 2013 | meta-analyses |
| Tendon stiffness lags strength gains by 1–2 months | Mersmann 2017 Front Physiol; Mersmann 2023 | review; prospective |
| No proven safe step size for load increases | Buist 2008; Nielsen 2014; Impellizzeri 2020 | RCT; cohort; critique |

No source gives a count or fraction of tested moves needed to promote a group. Every number below marked *judgement* is our heuristic and can be tuned.

## Decisions

| # | Rule | Value | Basis |
|---|---|---|---|
| 1 | Direction of passes | Inference flows **downward only**, from a harder tested move to easier untested ones | evidence |
| 2 | Direction of failures | A failed set on move M at tier T caps the **inferred** tier of every harder rung in M's family at T | evidence |
| 3 | Corroboration (k) | An untested member is inferred only when **≥ 2 tested members** of its family support it | judgement (no system trusts one item) |
| 4 | Size | Inferred tier = supporting tier **− 1** (never above the evidence) | evidence (transfer < 60 %); step is judgement |
| 5 | Distance | Support counts within **1 rung** of the member. It counts within **2 rungs** only when ≥ 2 supporting members agree at that tier | judgement |
| 6 | Cross-family | Across a pattern (squat, hinge, …): when **≥ 1/3 of its families (min 2)** have a tested member at ≥ T, untested families get a **suggestion** at T − 1. Nothing changes silently | judgement; evidence that families differ |
| 7 | Confirmation | The first logged session on a move with an inferred tier settles it. A clean set at the prescribed dose → becomes **tested** at that tier. A failed set (`muscular_failure` short of target, per #107) → inferred tier removed, rule 2 applies | practitioner (test-to-advance) + ALEKS slip allowance |
| 8 | Expiry | Unconfirmed inferred tiers lapse **21 days** after they were inferred. Tested tiers get a **retest flag** after **42 days** with no session on that move. The tier is kept and nothing is lowered | evidence for timing; exact days judgement |
| 9 | Jump bound | An inferred tier rises by at most **1 tier per confirming session in that family**. Tested results (declare, logged reps) are **not** bounded | judgement (tendon lag, no proven step size) |
| 10 | Plan level | The plan level is a **dose default** for moves in generated days. It is stored separately, is never evidence and never cascades | design |

Effective tier for dosing and advancing = max(tested tier, unexpired inferred tier, plan default for that move). `shouldAdvance` keeps its current rules on the effective tier. Fast climbers still advance as soon as they test or log the level.

## Data model

`ExerciseMemory` (src/domain/types.ts) gains provenance. Existing fields stay.

```ts
interface ExerciseMemory {
  // existing: exerciseId, sessionsAtStandard, sessionsBelowFloor, lastAddedLoadKg,
  //           weakLinkSessionsRemaining, bestReps, avgSetDurationSeconds, setDurationSampleCount
  declaredTier?: SkillTier;        // athlete's own Library pick → tested
  declaredAt?: string;             // ISO
  loggedTier?: SkillTier;          // from logged reps vs standards (recordBestReps) → tested
  lastSessionAt?: string;          // ISO, last logged set on this move
  inferred?: {                     // derived; recomputed, never hand-set
    tier: SkillTier;
    from: string[];                // supporting exercise ids
    at: string;                    // ISO, when first inferred at this tier
  };
  failedCaps?: FailedCap[];        // rule 2: one per failing exercise; each caps harder rungs
  planTier?: SkillTier;            // rule 10 default from plan level
  skillTier?: SkillTier;           // effective tier, cached (derived)
}
```

`testedTier(m) = max(declaredTier, loggedTier)`. `skillTier` is always recomputed from the fields above. Nothing writes it directly.

## Components

| Unit | Responsibility |
|---|---|
| `src/progress/inferTiers.ts` (new, pure) | Given memories, the family index and `now`, return every member's `inferred` (rules 1–5, 8, 9) and `failedCaps` (rule 2, one per failing exercise). Replaces `cascadeFamilyTiers` |
| `src/progress/suggestTiers.ts` (new, pure) | Rule 6: per pattern, suggestions `{exerciseId, tier, fromFamilies}` for untested families. Read-only |
| `src/session/history.ts` | `declareSkillTier` writes `declaredTier`/`declaredAt` only, then runs `inferTiers`. `recordBestReps` writes `loggedTier`/`lastSessionAt`. The new per-exercise outcome (#107) applies rule 7 |
| `src/plan/levelDeclare.ts` | `declareLevelForDays` writes `planTier`, not `declaredTier`, and never triggers inference |
| `src/rules/skillDose.ts` | `effectiveSkillTier` = rule 10 formula. `shouldAdvance` unchanged apart from using it |
| `src/library/libraryDetail.ts` / `libraryView.ts` | Show the source of a level ("You", "Logged", "Inferred from Bulgarian split squat + Split squat", "Plan default"), the retest flag and suggestions with one-tap "Set level". Replace the "Updated N related moves" hint with "N related moves now inferred" |

## Migration (memory v1 → v2, on load)

- Keep `declaredTier` as athlete picks, with `declaredAt` = migration time. Any move whose `declaredTier` equals `levelForMove(exercise, planLevel)` (completed plan days are pruned, so the current days alone would miss them) is **ambiguous**: they may be plan-level writes. Migrate them to `planTier` and list them once in Settings → "Levels to confirm" so the athlete can re-declare the real ones.
- Derive `loggedTier` from `bestReps` via standards (same as `inferTierFromBest`).
- Drop the old cascaded `skillTier` values, then recompute through `inferTiers`.
- Version the key (`aurora.poc.memory.v2`) or add a `schemaVersion` field. Keep v1 readable for one release.

## Error handling

- Unknown exercise ids in memory are skipped, not thrown.
- Exercises off any ladder never receive inference.
- Clock skew: an `at` in the future is treated as now.
- If the family index changes (catalogue update) and supporting ids disappear, recompute. Inferences that lose support drop.

## Testing

Pure unit tests for `inferTiers` and `suggestTiers` with a hand-built family index:
- One tested member → no inference (k = 2)
- Two tested at advanced, 1 rung above → member inferred intermediate. 2 rungs above with agreement → intermediate, without agreement → none
- Never infers above the supporting tier, never upward to harder rungs
- A failure at T on a lower rung caps harder members' inference at T
- Expiry at 21 days, retest flag at 42 days (inject `now`)
- Jump bound: an inferred tier rises one step per confirming session
- Plan level writes `planTier` only, and `inferTiers` ignores it

Fixture test on `tests/fixtures/device/2026-11-17-pixel10.json` (#108), after migration:
- No move is elite unless declared or logged (Dragon Squat and Calf raise stay elite from logged reps)
- Lower body · C single-leg slot no longer resolves to Bulgarian split squat 4×18 from inference alone

## Out of scope

- Name-based ladder placement (`placeOnLadder`) accuracy. Families come from exercise names, which is a separate audit like #111.
- Changing `shouldAdvance` thresholds or dose standards.
- Persisting full set logs (beyond what #107 needs).
