# Researched tier standards (#262)

Status: implemented on `feature/262-researched-tiers`.
Data: [`2026-11-21-researched-tier-standards/tier-research.json`](2026-11-21-researched-tier-standards/tier-research.json) (CSV alongside), one row per exercise, 325 rows.
Generated table: `src/data/enrich/researchedStandards.ts`. Do not edit it by hand. To rebuild it after changing the research JSON:

```sh
npm run standards:researched              # writes the table, prints the dropped rows
npm run standards:researched -- --parents  # also prints each derived row's parent label
```

Then run `npx vitest run tests/data/researchedStandards.test.ts`. The script is `scripts/build-researched-standards.mjs`; rerunning it on unchanged data gives an identical file.

## Problem

Before this change, every Library move without an Endura twin or a coaching row got its five-tier band (novice, beginner, intermediate, advanced, elite) from a generic table keyed by difficulty. For example, every beginner rep move had 10/20/35/50/75. Those numbers were not about the move itself, and many plyometric, loaded and drill moves had a "max rep" band even though nobody tests them that way.

## Method

Each of the 325 generic-table moves was researched on 2026-11-21, as follows:

1. **Research.** One researcher pass per movement family looked for published norms for the exact exercise. These included population norms (Cooper, Eurofit, Biering-Sørensen), community standards calculators (StrengthLevel, FitnessVolt) and coaching criteria.
2. **At least two sources.** A band counts as **sourced** only when two or more independent sources gave numbers for the exact move.
3. **Agreeing sources: average.** When the sources agreed within about ±25% at a tier, the tier value is their average.
4. **Disagreeing sources: median of three.** When the sources differed by more than that, a third source was found and the tier value is the median of the three.
5. **Percentile mapping.** Population percentiles map to tiers as follows: about the 20th–25th percentile is beginner, the 50th is intermediate, about the 80th is advanced and the 95th is elite. Novice is round(0.67 × beginner), as for Endura (#189).
6. **Derived bands: the ×1.2 rule.** A move with no sources of its own takes its parent's band. The parent is a sourced move, an Endura or coaching anchor, or another derived move in its chain. An easier variant multiplies the parent by 1.2 (rounded up), and a harder variant divides it by 1.2 (rounded). This is the same rule `scaleStandards` uses for Endura (#189). Holds are rounded to 5 s.
7. **Not a max-rep test.** Plyometrics, loaded kettlebell, dumbbell and band moves, and mobility or activation drills are prescribed by sets, contacts or load. These moves are **not_max_test** and get no band.
8. **Checker.** A second agent per family checked each row. It checked that the URLs were real, that the arithmetic was right, that tiers increased strictly, and that each move stayed in order against its `easierId` and `harderId`. Each row got a verdict of accept, adjusted (numbers or status changed) or reject.

## Counts

| Outcome | Research rows | Applied in code |
|---|---:|---:|
| Sourced | 37 | 37 |
| Derived | 153 (1 rejected) | 151 (Side Plank left out: the coaching list covers it, see Precedence) |
| Not a max-rep test | 121 | 121 (standards removed) |
| No data | 14 | 0 (generic table) |
| Total in the generated table | | 309 rows (37 + 151 + 121) |

The script excludes empty bands, checker rejects and every `no_data` row, including the three no_data rows where the checker proposed a placeholder band. These 15 moves stay on the generic table (listed below). Every sourced and derived band passed the band check (five integer tiers ≥ 1, strictly increasing), so the check dropped no rows.

Across the whole Library, the band sources are now: 95 Endura, 17 coaching list, 23 seed table, 37 sourced, 151 derived, 19 generic and 121 none. The other 245 moves are warm-ups, mobility and conditioning moves that never had tiers.

## Precedence

`standardsFor({ id, name, effort, difficulty, placement })` in `src/data/enrich/standards.ts` picks the first match from this list:

1. **Endura twin** by name (`enduraRuleFor`). The label is the Endura row, e.g. "Endura push-up men 20–29".
2. **Coaching list** (`SPECIFIC`) by ladder family, effort and keywords. The label is the coaching source, e.g. "McGill 1999".
3. **Researched table** by exercise id. A `sourced` or `derived` row gives its band. A `not_max_test` row gives no standards at all.
4. **Generic table** by difficulty, labelled "Generic by difficulty".

The seed moves keep `SEED_STANDARDS` in `seed.ts`, labelled from its notes. Research changes only moves that would otherwise reach step 4. One researched row is covered by the coaching list: **Side Plank** (`hf_100`) keeps McGill 1999, and its derived band has the same numbers (15/30/60/90/120). The script leaves it out of the table (`COVERED_BY_COACHING`), so each move has one band in code. A test fails if any other researched row is shadowed by Endura or the coaching list.

## Band source on the exercise

`Exercise.standardsSource` is `{ kind, label }`, where `kind` is one of `seed | endura | coaching | sourced | derived | generic | none`. The labels are:

- **sourced:** "Sourced: StrengthLevel, FitnessVolt", publisher names only. Full titles and URLs are kept as comments in the generated file and in the research JSON.
- **derived:** "Derived from <parent>", where the parent is read from the method text. Six rows are set by hand in the script (`PARENT_OVERRIDES`): their method names no parent, or the first move it names is not the parent (for example, Cross-body mountain climber names mountain climbers but derives from the forearm plank).
- **none:** "Not a max-rep test".

The Library detail shows the band source under the standards strip as "Band: …", through `describeStandardsSource` in `levelSource.ts`. A tierless move shows only "No tiers: not a max-rep test. Dosed by sets, contacts or load." It has no level picker and no standards strip.

## Moves without standards

The consumers already guarded on `exercise.standards`: dose (`applySkillDose`), advance (`shouldAdvanceProgression`), the plan level gate (`planLevelGate` and `planLevelRaise`), level profile, readiness, weak-link board, history and memory migration, and the Library picker and strip. Mobility moves already took the same path.

The one consumer that changed is `isPlannable`. It used to require standards, which would have removed the tierless moves from the planner. It now also accepts a tierless work move (`isTierless`: `standardsSource.kind === "none"`). The plan level gate skips the slot, and ladder steps and path placement use difficulty, not standards.

**Open dosing issue (review, 2026-11-21).** A generated tierless slot is prescribed the seed-day sets × 8 reps at RIR 2. Those 8 reps and RIR 2 are the placeholder input that `doseFor` in `generateBlock.ts` hands to `applySkillDose`, which before this change always replaced them with tier-standard reps, because every plannable move had standards. For a tierless move nothing replaces them, so they become the dose: a new load rule, and for the five tierless holds (Ski hops, Isometric Chest Squeezes, Isometric Wipers, Push Up to Side Plank, Single Arm Plank to Row) an 8-second hold. On `dev` these moves were dosed by `applySkillDose` from their generic band (for example 3 × 12 at RIR 3). No tierless move has a Library `prescription`. Proposed fix, not applied: restore the old rule that a generated slot needs standards (`isPlannable` requires `exercise.standards`), so the generator chooses a move it can dose from the library; tierless moves stay in the Library and in seed-day swaps, which keep the seed slot's dose.

One test fixture changed. Body balance "Consider adding" had used the reverse snow angel's best reps to set the pull pattern level. That move is now tierless, so the test uses Bodyweight Mid Row instead.

## Left on the generic table

No data (checker accepted):

- `wger_1605` Copenhagen Adduction Exercise: only a training prescription.
- `wger_1234` Dumbbell Single-leg Hip Thrust: only a timed bridge hold, and the move is load-dependent.
- `fedb_flutter_kicks` Flutter Kicks: only a timed cadence test.
- `wger_1910` Kneeling Superman, `wger_1210` Skydiver with arms in T-position, `wger_1455` Towel Superman: only Sørensen hold norms.
- `wger_1809` Reverse Hyperextension: machine or loaded.
- `wger_1736` Single-Leg Deadlift with Dumbbell: load-dependent, arguably not_max_test.
- `ntc_archer_push_up_hold` Archer Push-Up Hold: no hold norms.

No data, where the checker proposed a placeholder band that is not applied:

- `hf_107` Manna (proposed 1/2/4/6/10)
- `hf_66` Ice Cream Maker (proposed 1/2/4/7/10)
- `hf_64` Pelican Curl (proposed 1/2/4/6/10)

Rejected by the checker:

- `wger_1377` Torso Twist: should be not_max_test, since it has no point of failure.
- `wger_1101` Horizontal traction isometry: no hold norms.
- `hf_93` Tibialis Raise: no source and no anchor.

Dropped by the band check: none.

These moves are not in the research set and also stay generic: `hf_31` Planche Lean, `fedb_alternating_hang_clean`, `fedb_double_kettlebell_alternating_hang_clean` and `fedb_kettlebell_hang_clean`.

## Known oddities (kept, listed)

- **Sit-up 22/33/40/47/55** (`fedb_sit_up`): the Cooper percentiles are close together, so the intermediate-to-elite gaps are narrow (7–8 reps). Its derived children inherit this: Frog Sit-Ups, Full Sit Outs, Toe Touchers, Wind Sprints, Janda and Jackknife.
- **Scissor Kick 15/30/67/89/134** (`fedb_scissor_kick`): this comes from one modelled FitnessVolt table, with Healthline as a dose reference only. The jumps are big (×2.2 from beginner to intermediate), and the source does not say whether a rep counts one leg or both.
- **Ab wheel** (`wger_1573` 3/4/8/14/25, `hf_113` 3/5/10/14/22): the sources differ by about 160%. The community calculators report about 21 at intermediate, against 8 from coaching guidance, so the median of three was used. The AOL/Brewer coaching URL returned 404 when the checker spot-checked it.
- **Incline Row - Rings** (`wger_2678`): the method says it is the inverted row ÷ 1.2. The band is 6/9/23/40/59, which is the ×1.2 band and the same as Ring Row. It is applied as delivered.
- **Crow Pose** (`hf_129`): the method says elite is capped at 90 s, but the band has 108 s.
- **Low confidence:** 182 of the 325 rows are rated low confidence by the research, against 87 medium and 56 high.

### Variant-order violations

`tests/data/researchedStandards.test.ts` checks every easier → harder pair where both moves have researched bands and the same effort. The easier move should have numbers ≥ the harder one at every tier. These 19 pairs break that rule. They are reported here and pinned in the test (`KNOWN_VARIANT_ORDER_VIOLATIONS`), and are not fixed in code:

| Easier | Harder | Tiers where easier < harder |
|---|---|---|
| 3/4 Sit-Up 7/10/33/63/100 | Jackknife Sit-Up 15/23/28/33/38 | novice, beginner |
| Alternate Heel Touchers 19/29/48/72/102 | Toe Touchers 22/33/40/47/55 | novice, beginner |
| Cross-Body Crunch 16/24/40/60/85 | Sit-Up 22/33/40/47/55 | novice, beginner |
| Crunch - Hands Overhead 13/20/33/50/71 | Sit-Up | novice, beginner, intermediate |
| Crunches 16/24/40/60/85 | Sit-Up | novice, beginner |
| Crunches With Legs Up 16/24/40/60/85 | Sit-Up | novice, beginner |
| Abdominal Crunch 16/24/40/60/85 | Sit-Up | novice, beginner |
| Bicycle Crunch 8/12/40/75/120 | Sit-Up, Frog Sit-Ups, Full Sit Outs | novice, beginner |
| Bicycle Crunch | Janda Sit-Up 18/28/33/39/46, Sit Up Elbow Thrust 18/28/33/39/46 | novice, beginner |
| Butterfly Sit Up 6/8/28/53/83 | Jackknife Sit-Up | novice, beginner |
| Hanging Pike 1/5/8/10/13 | Pike Compression 2/6/8/10/14 | novice, beginner, elite |
| Hyperextensions (no bench) 4/11/17/21/28 | Single-Leg Romanian Deadlift 5/8/18/34/54 | novice, intermediate, advanced, elite |
| Single-Leg Romanian Deadlift 5/8/18/34/54 | Single-leg hamstring curl 14/21/27/33/39 | novice, beginner, intermediate |
| Plank Jump-In 9/14/26/41/68 | Plank Shoulder Tap 10/15/40/63/90 | all |
| Straddle Planche 2/3/6/10/16 | Full Planche 2/3/8/15/30 | intermediate, advanced, elite |
| Tuck L-sit 7/10/20/30/45 | L-Sit 5/10/30/45/60 | intermediate, advanced, elite |

Most are crunch-family moves sitting against the narrow sit-up band, whose Cooper novice and beginner values (22/33) are high.

A second check covers pairs where one move is researched and its neighbour has an Endura, coaching or seed band. These 21 pairs break the rule and are pinned as `KNOWN_NEIGHBOUR_VARIANT_ORDER_VIOLATIONS`:

| Easier | Harder | Tiers where easier < harder |
|---|---|---|
| Cossack squat 5/8/12/16/20 (seed) | Sissy Squat 3/4/10/18/28 | advanced, elite |
| Gironda Sternum Chins 2/3/7/11/15 | Muscle-up 1/2/6/12/20 (seed) | advanced, elite |
| Side To Side Chins 2/3/7/11/15 | Muscle-up (seed) | advanced, elite |
| Gorilla Chin/Crunch 2/3/7/11/15 | L-Sit Pull-Up 3/4/8/13/18 (Endura) | all |
| Plank Shoulder Tap 10/15/40/63/90 | Push-up with shoulder tap 11/17/22/29/36 (Endura) | novice, beginner |
| Hip hinge 5/10/15/20/30 (seed) | Single-Leg Romanian Deadlift 5/8/18/34/54 | intermediate, advanced, elite |
| Good Morning 5/10/15/20/30 (coaching) | Single-Leg Romanian Deadlift | intermediate, advanced, elite |
| Archer Dip 2/4/9/15/21 | Archer Straight-Bar Dip 3/5/12/22/35 (Endura) | all |
| Archer Australian Pull-Up 3/4/8/13/18 (Endura) | One-Arm Inverted Row 3/5/10/16/22 | beginner to elite |
| Bent-Knee Australian Pull-Up 3/4/8/13/18 (Endura) | Inverted Row 5/8/19/33/47 | all |
| Low incline push-up 10/15/35/65/100 (Endura) | Pushups (Close and Wide) 11/17/22/29/36 | novice, beginner |
| Reverse lunge to knee drive 4/6/15/28/45 | Bulgarian split squat 5/7/18/34/55 (seed) | all |
| Reverse lunge 6/10/15/20/25 (seed) | Reverse lunge to knee drive | advanced, elite |
| Step-up 6/10/15/20/25 (seed) | Step-Up with Knee Drive 4/6/15/28/45 | advanced, elite |
| Unilateral Lunges 4/6/15/28/45 | Cossack squat (seed) | novice, beginner |
| Vpushup 9/14/18/24/30 | Hindu Push-Up 11/17/22/29/36 (Endura) | all |
| Supported Split Squat 5/8/18/34/54 (Endura) | Bodyweight Walking Lunge, Forward Lunge, Bodyweight lunge 13/20/30/60/100 | all |
| Supported Split Squat (Endura) | Crossover Reverse Lunge, Curtsy Lunge 11/17/25/50/83 | all |

## Follow-ups

1. Resolve the 19 + 21 variant-order pairs. Either re-derive the crunch family from the sit-up, or move the sit-up off the crunch chains. Then shrink `KNOWN_VARIANT_ORDER_VIOLATIONS`.
2. Replace or drop the AOL/Brewer citation on the two ab wheel rows (404).
3. Research the 15 generic leftovers. Torso Twist is likely not_max_test, and the three skill placeholders (Manna, Ice Cream Maker, Pelican Curl) need a decision.
4. Fix the open dosing issue above before merging: a generated tierless slot must not take the `doseFor` placeholder (sets × 8 at RIR 2). Any dose rule of their own (contacts for plyometrics, load for kettlebell moves) needs evidence first.
5. Recheck the Incline Row - Rings and Crow Pose bands against their method text.
