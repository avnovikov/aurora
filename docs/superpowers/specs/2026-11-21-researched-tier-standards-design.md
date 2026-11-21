# Researched tier standards (#262)

Status: implemented on `feature/262-researched-tiers`.
Data: [`2026-11-21-researched-tier-standards/tier-research.json`](2026-11-21-researched-tier-standards/tier-research.json) (CSV alongside), one row per exercise, 370 rows (325 researched, plus 45 added by the fourth step).
Generated table: `src/data/enrich/researchedStandards.ts`. Do not edit it by hand. To rebuild it after changing the research JSON:

```sh
npm run standards:researched              # writes the table, prints counts and dropped rows
npm run standards:researched -- --parents  # also prints each computed row's parent, step and band
npm run standards:researched -- --report   # also prints band changes and every variant-order conflict with its anchors
```

Then run `npx vitest run tests/data/researchedStandards.test.ts tests/scripts/tierDerivation.test.ts`. The script is `scripts/build-researched-standards.mjs`, and the derivation is `scripts/lib/tierDerivation.ts`. Rerunning the script on unchanged data gives an identical file.

The current state is described in "Fourth step: anchors and computed derivation" below. The sections before it record the three research passes as they were made; where they give a band for a derived row, the fourth step has since recomputed it.

## Problem

Before this change, every Library move without an Endura twin or a coaching row got its five-tier band (novice, beginner, intermediate, advanced, elite) from a generic table keyed by difficulty. For example, every beginner rep move had 10/20/35/50/75. Those numbers were not about the move itself, and many plyometric, loaded and drill moves had a "max rep" band even though nobody tests them that way.

## Method

Each of the 325 generic-table moves was researched on 2026-11-21, as follows (a second pass followed, see below):

1. **Research.** One researcher pass per movement family looked for published norms for the exact exercise. These included population norms (Cooper, Eurofit, Biering-Sørensen), community standards calculators (StrengthLevel, FitnessVolt) and coaching criteria.
2. **At least two sources.** A band counts as **sourced** only when two or more independent sources gave numbers for the exact move.
3. **Agreeing sources: average.** When the sources agreed within about ±25% at a tier, the tier value is their average.
4. **Disagreeing sources: median of three.** When the sources differed by more than that, a third source was found and the tier value is the median of the three.
5. **Percentile mapping.** Population percentiles map to tiers as follows: about the 20th–25th percentile is beginner, the 50th is intermediate, about the 80th is advanced and the 95th is elite. Novice is round(0.67 × beginner), as for Endura (#189).
6. **Derived bands: the ×1.2 rule.** A move with no sources of its own takes its parent's band. The parent is a sourced move, an Endura or coaching anchor, or another derived move in its chain. An easier variant multiplies the parent by 1.2 (rounded up), and a harder variant divides it by 1.2 (rounded). This is the same rule `scaleStandards` uses for Endura (#189). Holds are rounded to 5 s.
7. **Not a max-rep test.** Plyometrics, loaded kettlebell, dumbbell and band moves, and mobility or activation drills are prescribed by sets, contacts or load. These moves are **not_max_test** and get no band.
8. **Checker.** A second agent per family checked each row. It checked that the URLs were real, that the arithmetic was right, that tiers increased strictly, and that each move stayed in order against its `easierId` and `harderId`. Each row got a verdict of accept, adjusted (numbers or status changed) or reject.

## Second research pass

**Why.** The first pass left 182 rows at low confidence and 14 at no_data, and the checker found direction errors in the derived chains (an easier move parented to a harder one, or the reverse). The second pass looked again for real norms before the table is applied, and re-checked every parent.

**Method.** A deeper search per movement family, then a verifier agent. Each researcher searched the move and its synonyms again, followed `easierId` and `harderId` in the catalogue to pick the right parent and the right direction (an easier variant × 1.2, a harder variant ÷ 1.2), and rewrote the method text. Rows it touched carry `pass2: true` (167 of the 325). The same rules as the first pass apply: two independent sources for sourced, and no invented numbers. The verifier then opened 42 cited pages and confirmed 30.

**Source types searched.** Community standards calculators (StrengthLevel, FitnessVolt), PubMed and PMC papers, journals such as IJSPT and JSSM, clinical and occupational norms (Chase et al. plank norms, Cooper, military and police tests, the weight-bearing lunge test, FMS), coaching and programming sites (NASM, ACE, Gymnastic Bodies, Fitbod, Healthline), recreational gymnastics program requirements, kettlebell sport rank tables and logged-workout sites (Exercise.com).

**Result.** 0 new rows became sourced: no derived row found a second independent source. The counts are 37 sourced, 156 derived, 125 not_max_test and 7 no_data (first pass: 37, 153, 121, 14). What changed:

- 46 derived rows got a better parent or a corrected easier/harder direction; 44 bands changed in all (for example the lying hip-lift moves now hang off the floor reverse crunch).
- 10 rows changed status: Torso Twist, Single-Leg Lunge with Kettlebell and Weighted Step-ups went from derived to not_max_test; Single-Leg Deadlift with Dumbbell from no_data to not_max_test; Dumbbell Single-leg Hip Thrust, Flutter Kicks, Kneeling Superman, Skydiver with arms in T-position, Towel Superman and Reverse Hyperextension from no_data to derived.
- The method texts changed wording ("Parent is easierId …", "harderId is …", "forearm plank anchor"), so the parent lookup in the script was rewritten (see Band source on the exercise).
- Variant-order violations among researched pairs went from 19 to 22; pairs with an Endura, coaching or seed neighbour stayed at 21.
- 125 moves are now tierless (121 before). `isPlannable` and the dosing code were not touched; the tierless-dosing question below is open.

## Counts

After the second research pass (below). The first pass had 37 sourced, 153 derived, 121 not_max_test and 14 no_data. For the counts after the fourth step, see that section.

| Outcome | Research rows | Applied in code |
|---|---:|---:|
| Sourced | 37 | 37 |
| Derived | 156 | 155 (Side Plank left out: the coaching list covers it, see Precedence) |
| Not a max-rep test | 125 | 125 (standards removed) |
| No data | 7 | 0 (generic table) |
| Total in the generated table | | 317 rows (37 + 155 + 125) |

The script excludes empty bands, checker rejects and every `no_data` row. These 8 moves (7 no_data and Side Plank) stay out of the table; the 7 no_data moves stay on the generic table (listed below). Every sourced and derived band passed the band check (five integer tiers ≥ 1, strictly increasing), so the check dropped no rows.

Across the whole Library (708 moves), the band sources are now: 95 Endura, 17 coaching list, 23 seed table, 37 sourced, 155 derived, 11 generic and 125 none. The other 245 moves are warm-ups, mobility and conditioning moves that never had tiers. The research rates 175 rows low confidence, 94 medium and 56 high.

## Precedence

`standardsFor({ id, name, effort, difficulty, placement })` in `src/data/enrich/standards.ts` picks the first match from this list:

1. **Endura twin** by name (`enduraRuleFor`). The label is the Endura row, e.g. "Endura push-up men 20–29". Since the fourth step, the plain push-up, pull-up, incline push-up and straight-bar dip rows match the exact move only, so a harder or easier variant falls through to step 3.
2. **Coaching list** (`SPECIFIC`) by ladder family, effort and keywords. The label is the coaching source, e.g. "McGill 1999".
3. **Researched table** by exercise id. A `sourced` or `derived` row gives its band. A `not_max_test` row gives no standards at all.
4. **Generic table** by difficulty, labelled "Generic by difficulty".

The seed moves keep `SEED_STANDARDS` in `seed.ts`, labelled from its notes. Research changes only moves that would otherwise reach step 4. One researched row is covered by the coaching list: **Side Plank** (`hf_100`) keeps McGill 1999, and its derived band has the same numbers (15/30/60/90/120). The script leaves it out of the table (`COVERED_BY_COACHING`), so each move has one band in code. A test fails if any other researched row is shadowed by Endura or the coaching list.

## Band source on the exercise

`Exercise.standardsSource` is `{ kind, label }`, where `kind` is one of `seed | endura | coaching | sourced | derived | generic | none`. The labels are:

- **sourced:** "Sourced: StrengthLevel, FitnessVolt", publisher names only. Full titles and URLs are kept as comments in the generated file and in the research JSON.
- **derived:** "Derived from <parent>". The sit-up is "Matched to crunches" (user decision, fourth step). The script reads the parent from the method text in this order: (1) an explicit id (`hf_…`, `wger_…`, `fedb_…`, `ntc_…`) that names a catalogue move; (2) "easierId <name>", "harderId <name>" or "Parent is <name>", where the name is a catalogue move or a known anchor; (3) the earliest known anchor name (push-up, pull-up, dip, split squat, pistol, pike push-up, forearm plank, dead hang, hollow hold, hanging knee raise, side plank, inverted row, crunches, L-sit, sit-up and the other entries in `PARENTS`), with "crunch" as the last text match; (4) the row's own `easierId` or `harderId` from the catalogue. If none match, the script stops with an error. Because step 4 reads the catalogue, the script now runs under `tsx`. Thirteen rows are set by hand in `PARENT_OVERRIDES`: the first move named is not the parent (for example, Cross-body mountain climber names mountain climbers but derives from the forearm plank), or the band comes from one data source or coaching targets and has no parent move (Flutter Kicks, Neck Bridge, Dragon Flag, Iron Cross, the lunge-style get-up and the back-extension study row). The overrides left over from the first pass that the new method texts made unnecessary (Roll-overs into V-sits, Flat Bench Lying Leg Raise) were removed.
- **none:** "Not a max-rep test".

The Library detail shows the band source under the standards strip as "Band: …", through `describeStandardsSource` in `levelSource.ts`. A tierless move shows only "No tiers: not a max-rep test. Dosed by sets, contacts or load." It has no level picker and no standards strip.

## Moves without standards

After the second pass, 125 moves are tierless (121 before: Torso Twist, Single-Leg Deadlift with Dumbbell, Single-Leg Lunge with Kettlebell and Weighted Step-ups moved to not_max_test). `isPlannable` and the dosing code are unchanged by the second pass; the open dosing question below is still with the user.

The consumers already guarded on `exercise.standards`: dose (`applySkillDose`), advance (`shouldAdvanceProgression`), the plan level gate (`planLevelGate` and `planLevelRaise`), level profile, readiness, weak-link board, history and memory migration, and the Library picker and strip. Mobility moves already took the same path.

**Resolved in the fourth step (user decision, 2026-11-21).** `isPlannable` is back to the `dev` rule: a move must have standards to be generated into a plan. A tierless move is never chosen by the generator, so no generated slot gets the `doseFor` placeholder (8 reps at RIR 2). A tierless move can still appear in a seed day, for example through a stall regression, and there it keeps the seed slot's dose. The Library shows a tierless move's own level from `exercise.difficulty` as "Move level: Intermediate" (for example) above "No max-rep tiers: not a max-rep test. Dosed by sets, contacts or load.", with no rep or hold numbers and no picker.

The paragraphs below record the intermediate state of the second and third passes.

The one consumer that changed (then) was `isPlannable`. It used to require standards, which would have removed the tierless moves from the planner. It then also accepted a tierless work move (`isTierless`: `standardsSource.kind === "none"`). The plan level gate skips the slot, and ladder steps and path placement use difficulty, not standards.

**Open dosing issue (review, 2026-11-21), now resolved.** A generated tierless slot is prescribed the seed-day sets × 8 reps at RIR 2. Those 8 reps and RIR 2 are the placeholder input that `doseFor` in `generateBlock.ts` hands to `applySkillDose`, which before this change always replaced them with tier-standard reps, because every plannable move had standards. For a tierless move nothing replaces them, so they become the dose: a new load rule, and for the five tierless holds (Ski hops, Isometric Chest Squeezes, Isometric Wipers, Push Up to Side Plank, Single Arm Plank to Row) an 8-second hold. On `dev` these moves were dosed by `applySkillDose` from their generic band (for example 3 × 12 at RIR 3). No tierless move has a Library `prescription`. Proposed fix, not applied: restore the old rule that a generated slot needs standards (`isPlannable` requires `exercise.standards`), so the generator chooses a move it can dose from the library; tierless moves stay in the Library and in seed-day swaps, which keep the seed slot's dose.

One test fixture changed. Body balance "Consider adding" had used the reverse snow angel's best reps to set the pull pattern level. That move is now tierless, so the test uses Bodyweight Mid Row instead.

## Left on the generic table

Seven moves have no data after two passes, and stay on the generic table:

- `hf_107` Manna: no numbers (first pass proposed 1/2/4/6/10, not applied).
- `hf_66` Ice Cream Maker: no numbers (proposed 1/2/4/7/10, not applied).
- `hf_64` Pelican Curl: no numbers (proposed 1/2/4/6/10, not applied).
- `wger_1605` Copenhagen Adduction Exercise: only a training prescription.
- `wger_1101` Horizontal traction isometry: no hold norms.
- `ntc_archer_push_up_hold` Archer Push-Up Hold: no hold norms.
- `hf_93` Tibialis Raise: no source and no anchor.

Moved out of this list by the second pass: Dumbbell Single-leg Hip Thrust, Flutter Kicks, Kneeling Superman, Skydiver with arms in T-position, Towel Superman and Reverse Hyperextension are now derived; Torso Twist and Single-Leg Deadlift with Dumbbell are now not_max_test. Dropped by the band check: none.

These moves are not in the research set and also stay generic: `hf_31` Planche Lean, `fedb_alternating_hang_clean`, `fedb_double_kettlebell_alternating_hang_clean` and `fedb_kettlebell_hang_clean`. That makes 11 generic moves in the Library.

## Known oddities (kept, listed)

- **Sit-up 22/33/40/47/55** (`fedb_sit_up`), Cooper: replaced in the fourth step by the crunch band 16/24/40/60/85 (user decision). The narrow Cooper gaps no longer reach its children.
- **Scissor Kick 15/30/67/89/134** (`fedb_scissor_kick`): this comes from one modelled FitnessVolt table, with Healthline as a dose reference only. The jumps are big (×2.2 from beginner to intermediate), and the source does not say whether a rep counts one leg or both.
- **Ab wheel** (`wger_1573` 3/4/8/14/25, `hf_113` 3/5/10/14/22): the sources differ by about 160%. The community calculators report about 21 at intermediate, against 8 from coaching guidance, so the median of three was used. The AOL/Brewer coaching URL returned 404 when the checker spot-checked it.
- **Incline Row - Rings** (`wger_2678`): the band is 6/10/23/40/57, the inverted row × 1.2, the same shape as Ring Row. It is applied as delivered.
- **Crow Pose** (`hf_129`) and **Elbow Lever** (`hf_128`): both take the wall handstand rule band 12/24/48/72/108 s. The research notes that this is generous against yoga and Hybrid Calisthenics targets (30 s top standard for the elbow lever; a source-led elbow lever band would be about 8/15/25/40/60).
- **Bear plank hold** (`ntc_bear_plank`): elite is 390 s, a very long test; the research suggests capping at 300 s in the app. Not applied.

### Variant-order violations

Superseded by the fourth step: the pinned pair lists below were replaced by the list of anchor conflicts in "Remaining conflicts: data questions".

`tests/data/researchedStandards.test.ts` checked every easier → harder pair where both moves have researched bands and the same effort. The easier move should have numbers ≥ the harder one at every tier. **22 pairs** break that rule after the second pass (19 after the first). They are reported here and pinned in the test (`KNOWN_VARIANT_ORDER_VIOLATIONS`), and are not fixed in code. The three new pairs come from re-parenting: Oblique Crunches and Oblique Crunches - On The Floor (now from the sit-up) and Reverse Crunch (now from the abdominal crunch), each against the Sit-Up.

| Easier | Harder | Tiers where easier < harder |
|---|---|---|
| 3/4 Sit-Up 7/10/33/63/100 | Jackknife Sit-Up 15/23/28/33/38 | novice, beginner |
| Alternate Heel Touchers 19/29/48/72/102 | Toe Touchers 22/33/40/47/55 | novice, beginner |
| Cross-Body Crunch 16/24/40/60/85 | Sit-Up 22/33/40/47/55 | novice, beginner |
| Crunch - Hands Overhead 13/20/33/50/71 | Sit-Up | novice, beginner, intermediate |
| Crunches 16/24/40/60/85 | Sit-Up | novice, beginner |
| Crunches With Legs Up 16/24/40/60/85 | Sit-Up | novice, beginner |
| Abdominal Crunch 16/24/40/60/85 | Sit-Up | novice, beginner |
| Oblique Crunches 9/13/26/41/59 (new) | Sit-Up | novice to advanced |
| Oblique Crunches - On The Floor 9/13/26/41/59 (new) | Sit-Up | novice to advanced |
| Reverse Crunch 9/14/25/37/52 (new) | Sit-Up | all |
| Bicycle Crunch 8/12/40/75/120 | Sit-Up, Frog Sit-Ups 19/28/34/40/46, Full Sit Outs 22/33/40/47/55 | novice, beginner |
| Bicycle Crunch | Janda Sit-Up 18/28/33/39/46, Sit Up Elbow Thrust 18/28/33/39/46 | novice, beginner |
| Butterfly Sit Up 6/8/28/53/83 | Jackknife Sit-Up | novice, beginner |
| Hanging Pike 1/5/8/10/13 | Pike Compression 2/6/8/10/14 | novice, beginner, elite |
| Hyperextensions (no bench) 12/18/29/40/50 | Single-Leg Romanian Deadlift 5/8/18/34/54 | elite |
| Single-Leg Romanian Deadlift | Single-leg hamstring curl 14/21/27/33/39 | novice, beginner, intermediate |
| Plank Jump-In 9/14/26/41/68 | Plank Shoulder Tap 10/15/40/63/90 | all |
| Straddle Planche 2/3/6/10/16 | Full Planche 2/3/8/15/30 | intermediate, advanced, elite |
| Tuck L-sit 7/10/20/30/45 | L-Sit 5/10/30/45/60 | intermediate, advanced, elite |

The first-pass "Hyperextensions (no bench) → Single-Leg Romanian Deadlift" pair broke four tiers; it now breaks only elite, because the second pass raised the hyperextension band from 4/11/17/21/28 to 12/18/29/40/50. Most pairs are crunch-family moves sitting against the narrow sit-up band, whose Cooper novice and beginner values (22/33) are high.

A second check covers pairs where one move is researched and its neighbour has an Endura, coaching or seed band. **21 pairs** break the rule (21 after the first pass; the set is the same, but several bands changed). They are pinned as `KNOWN_NEIGHBOUR_VARIANT_ORDER_VIOLATIONS`:

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
| Archer Australian Pull-Up 3/4/8/13/18 (Endura) | One-Arm Inverted Row 4/5/10/16/22 | all |
| Bent-Knee Australian Pull-Up 3/4/8/13/18 (Endura) | Inverted Row 5/8/19/33/47 | all |
| Low incline push-up 10/15/35/65/100 (Endura) | Pushups (Close and Wide) 11/17/22/29/36 | novice, beginner |
| Reverse lunge to knee drive 3/5/13/23/38 | Bulgarian split squat 5/7/18/34/55 (seed) | all |
| Reverse lunge 6/10/15/20/25 (seed) | Reverse lunge to knee drive | advanced, elite |
| Step-up 6/10/15/20/25 (seed) | Step-Up with Knee Drive 4/6/15/28/45 | advanced, elite |
| Unilateral Lunges 4/6/15/28/45 | Cossack squat (seed) | novice, beginner |
| Vpushup 10/15/19/25/30 | Hindu Push-Up 11/17/22/29/36 (Endura) | all |
| Supported Split Squat 5/8/18/34/54 (Endura) | Bodyweight Walking Lunge, Forward Lunge, Bodyweight lunge 13/20/30/60/100 | all |
| Supported Split Squat (Endura) | Crossover Reverse Lunge, Curtsy Lunge 11/17/29/50/67 | all |

## Third pass: untrusted sources

**Why.** The user marked the sources behind the neighbour conflicts untrusted and asked for new ones. The 19 rows that conflicted with an Endura, seed or coaching neighbour were researched again (`pass3: true` in `tier-research.json`). Their old sources are kept in the `untrustedSources` field of the research files, marked untrusted. The app never shows them, and the generated table does not cite them.

**Outcome.**

- 0 new sourced bands. No new source gave a max-rep norm. The new finds were prescriptions (sets x reps), timed tests, distance tests (WBLT) and reliability studies.
- All 19 rows are now `derived` from the trusted neighbour, labelled "Derived from <neighbour>" (for example Cossack squat, pull-up, split squat, Bulgarian split squat, archer Australian pull-up).
- 12 constraints are now met and 7 are not met (Gorilla Chin/Crunch, Gironda Sternum Chins, Side To Side Chins, Archer Dip, Vpushup, Reverse lunge to knee drive, Inverted Row).
- Pinned violations: researched pairs 22 -> 36, neighbour pairs 21 -> 9. The researched count rose because the lunge family and the inverted row were re-banded, and the new bands now clash with their own researched neighbours (the Inverted Row against the rows around it, the lunge variants against Reverse lunge to knee drive 6/9/22/41/66). Both lists are re-pinned in `tests/data/researchedStandards.test.ts`.

**Finding.** Most remaining conflicts do not come from the researched bands. They come from the Endura name matcher giving the plain pull-up or push-up band to harder or easier variants:

- L-Sit Pull-Up, Hindu Push-Up, Push-up with shoulder tap, the Archer Straight-Bar Dip proxy and Bent-Knee Australian Pull-Up each carry a plain band.
- Endura muscle-up elite 20 is above its own pull-up elite 18, although a muscle-up is harder. No variant between the two can satisfy both.
- The Endura incline push-up has novice 10 and beginner 15, below the push-up's 11 and 17, although it is easier.

**Lunge units bug.** The old lunge sources counted total reps for both legs (13/20/30/60/100). The anchors are per leg. The lunge rows are now per leg: 4/6/15/28/45, from the supported split squat 5/8/18/34/54 divided by 1.2 and floored.

**Confirmed misfires** (from the `anchorMisfire` fields):

- fedb_gorilla_chin_crunch: Confirmed. hf_49 L-Sit Pull-Up carries the plain Endura pull-up band 3/4/8/13/18, matched by name. An L-sit pull-up, which holds hip flexion for the whole rep, is clearly harder than a strict pull-up and should be about pull-up/1.2 = 2/3/6/10/15.
- hf_124: Confirmed. Push-up with shoulder tap carries the plain Endura push-up band 11/17/22/29/36. The tap makes it harder than a push-up, so it should be about /1.2 (10/15/19/25/30).
- ntc_archer_dip: Confirmed in principle, with a correction. The Archer Straight-Bar Dip carries a plain two-arm straight-bar dip proxy (3/5/12/22/35), but it is near-unilateral and harder than both a straight-bar dip and a parallel-bar archer dip. Re-band the neighbour to about archer dip/1.2 = 1/3/7/12/17.
- fedb_pushups_close_and_wide_hand_positions: Confirmed. Endura incline band 10/15/35/65/100 has novice 10 and beginner 15, below the push-up's 11/17, although an incline push-up is easier.
- wger_1090: Confirmed. hf_10 Hindu Push-Up carries the plain Endura push-up band 11/17/22/29/36, matched by name. A Hindu push-up is harder than a standard push-up, so re-anchor hf_10 to push-up/1.2 or lower.
- ntc_reverse_lunge_knee_drive: Confirmed. The two neighbours contradict each other: Bulgarian split squat (5/7/18/34/55) has intermediate 18, above reverse_lunge's 15. The reverse_lunge seed (6/10/15/20/25) is a coaching target, not a max test. Re-anchor it before enforcing the constraint.
- hf_85: Partly confirmed. The Hip hinge and Good Morning neighbours (5/10/15/20/30) are coaching composites, not max tests, so both bands are unmeasured.
- hf_90: Partly confirmed, no action needed. The step_up seed is a coaching composite; elite 25 per leg is low next to the lunge family at elite 45.
- wger_1907: Confirmed as a note only. The cossack_squat seed is a patterning target, so the constraint binds only at novice and beginner. The 1-2 rep raise is small.
- fedb_gironda_sternum_chins: Confirmed. The Endura muscle-up elite 20 is above its pull-up elite 18. Re-band the muscle-up advanced and elite to at most pull-up/1.2 (about 11 and 15 or lower).
- fedb_side_to_side_chins: Confirmed. Same muscle-up calibration problem as Gironda chins.
- hf_39: Confirmed. TopEndSports norms for the bent-knee horizontal pull-up (men 18-35) are 10-14, 15-19, 20-29, 30+, roughly twice the Endura vertical pull-up band. ntc_bent_knee_australian_pull_up should be re-banded to about 8/12/17/24/30.
- hf_42: Partly confirmed. The Archer Australian Pull-Up carries the Endura pull-up band by name, but its values sit close to inverted row/1.2, so the misfire is minor.
- wger_1324, fedb_bodyweight_walking_lunge, fedb_crossover_reverse_lunge, hf_81, hf_79: no anchor misfire. The conflict was the units mismatch above.
- hf_73: not a misfire. The Cossack squat band is a coaching composite but a valid upper bound for the sissy squat.

## Fourth step: anchors and computed derivation

**Why.** Each research pass fixed derived bands one row at a time, and each fix broke a chain further out: the derived bands depend on each other (inverted row → ring and TRX rows → archer row → one-arm row; split squat → lunge family). The user approved a deterministic finish: fixed anchors, and every other band computed from its parent by plain code (no agents), plus the product decisions below.

### User decisions (2026-11-21)

1. **Muscle-up capped below the pull-up.** Endura muscle-up elite 20 sat above the pull-up's 18. Elite is now floor(18 ÷ 1.2) = 15, so the band is 1/2/6/12/15, below the pull-up 3/4/8/13/18 at every tier. Changed where it is defined: the Endura rule and the seed `muscle_up` band, labelled "Endura muscle-up men 20–29, elite capped below pull-up". The Kipping Muscle Up takes the same rule.
2. **Sit-up matched to crunches.** The sit-up takes the crunch band 16/24/40/60/85 in place of Cooper 22/33/40/47/55, labelled "Matched to crunches" (`DECISIONS` in the script). Its variants are computed from it.
3. **Tierless moves are not generated.** `isPlannable` is back to the `dev` rule (a move needs standards), so the "8 reps at RIR 2" placeholder never becomes a dose. Seed-day slots keep their seed dose. The Library shows "Move level: <difficulty>" next to "No max-rep tiers: …", with no numbers and no picker.

### Endura matcher fix

The plain push-up, pull-up, incline push-up and straight-bar dip rules now match the exact move only (`ruleExact`): "Push-up", "Push-ups", "Pushups", "Standard Push-Up", "Press-up(s)"; "Pull-up(s)", "Pullup(s)", "Standard Pull-Up"; "Incline Push-Up(s)" and "Incline Push-Up Medium" (medium is the standard grip); "Straight Bar Dip(s)". The chin-up rule no longer matches the Australian Chin-Up, which is a row; this one was not on the user's list but is the same misfire as the Australian pull-ups. Every other rule is unchanged. A move that no longer matches falls through to the researched table, where it now has a row (`pass4: true` in the research JSON) naming its parent.

48 moves changed. The muscle-up and Kipping Muscle Up keep their rule with the capped band. Maltese Push-Up and Planche Push-Up fall through to the generic table (elite 1/2/4/8/12): their only catalogue neighbour is the tuck planche hold, so they have no rep-move parent. The other 45 are below. The Bent-Knee Australian Pull-Up is an anchor from one measured table (TopEndSports bent-knee horizontal pull-up, men 18–35: 10–14, 15–19, 20–29, 30+), and the other 44 are computed.

| Move | Old Endura band | New band | Parent, step |
|---|---|---|---|
| Australian Chin-Up (`ntc_australian_chin_up`) | chin-up 4/6/14/24/35 | 6/10/14/20/25 | Bent-Knee Australian Pull-Up, harder |
| Incline Push-Up Close-Grip (`fedb_incline_push_up_close_grip`) | incline push-up 10/15/35/65/100 | 8/12/29/54/83 | Incline Push-Up, harder |
| Incline Push-Up Reverse Grip (`fedb_incline_push_up_reverse_grip`) | incline push-up 10/15/35/65/100 | 8/12/29/54/83 | Incline Push-Up, harder |
| Incline Push-Up Wide (`fedb_incline_push_up_wide`) | incline push-up 10/15/35/65/100 | 8/12/29/54/83 | Incline Push-Up, harder |
| Low incline push-up (`ntc_incline_push_up_low`) | incline push-up 10/15/35/65/100 | 17/26/33/42/53 | Knee push-up, easier |
| Archer Australian Pull-Up (`ntc_archer_inverted_row`) | pull-up 3/4/8/13/18 | 4/6/9/13/16 | Feet-Elevated Australian Pull-Up, harder |
| Archer Pull-Up (`hf_50`) | pull-up 3/4/8/13/18 | 2/3/6/10/15 | Pull-up, harder |
| Bent-Knee Australian Pull-Up (`ntc_bent_knee_australian_pull_up`) | pull-up 3/4/8/13/18 | 8/12/17/24/30 | anchor: TopEndSports table |
| Explosive Pull-Up (`hf_54`) | pull-up 3/4/8/13/18 | 2/3/6/10/15 | Pull-up, harder |
| Feet-Elevated Australian Pull-Up (`ntc_feet_elevated_australian_pull_up`) | pull-up 3/4/8/13/18 | 5/8/11/16/20 | Inverted Row, harder |
| Front lever pull-up (`wger_1252`) | pull-up 3/4/8/13/18 | 2/3/6/10/15 | Pull-up, harder |
| Headbanger Pull-Up (`hf_63`) | pull-up 3/4/8/13/18 | 2/3/6/10/15 | Pull-up, harder |
| Jumping Pull-Up (`wger_2748`) | pull-up 3/4/8/13/18 | 4/5/10/16/22 | Pull-up, easier |
| L-Sit Pull-Up (`hf_49`) | pull-up 3/4/8/13/18 | 2/3/6/10/15 | Pull-up, harder |
| Slow Eccentric Pull-Up Negative (`wger_2730`) | pull-up 3/4/8/13/18 | 4/5/10/16/22 | Pull-up, easier |
| Towel Pull-Up (`hf_53`) | pull-up 3/4/8/13/18 | 2/3/6/10/15 | Pull-up, harder |
| Typewriter Pull-Up (`hf_51`) | pull-up 3/4/8/13/18 | 2/3/6/10/15 | Pull-up, harder |
| Clock Push-Up (`fedb_clock_push_up`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Deficit Push ups (`wger_1777`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Dive Bomber Push-Up (`hf_14`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Hand-release push-up (`ntc_hand_release_push_up`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Hindu Push-Up (`hf_10`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Incline Shoulder Press Up (`wger_1716`) | push-up 11/17/22/29/36 | 8/12/29/54/83 | Incline Push-Up, harder |
| Knee push-up (`ntc_knee_push_up`) | push-up 11/17/22/29/36 | 14/21/27/35/44 | Standard Push-Up, easier |
| Plyo Push-up (`fedb_plyo_push_up`) | push-up 11/17/22/29/36 | 7/11/15/20/25 | Hindu Push-Up, harder |
| Pseudo Planche Push-Up (`hf_9`) | push-up 11/17/22/29/36 | 7/11/15/20/25 | Hindu Push-Up, harder |
| Push-up rotations (`wger_985`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Push-Up Wide (`fedb_push_up_wide`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Push-up with shoulder tap (`ntc_push_up_shoulder_tap`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Push-Ups - Close Triceps Position (`fedb_push_ups_close_triceps_position`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Push-Ups With Feet Elevated (`fedb_push_ups_with_feet_elevated`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Russian Push Ups (`wger_2530`) | push-up 11/17/22/29/36 | 7/11/15/20/25 | Push-Ups With Feet Elevated, harder |
| Shoulder width three-point push-up (`wger_1209`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Side to Side Push Ups (`wger_583`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Sphinx Push-Up (`hf_11`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Spiderman Push-Up (`hf_13`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Staggered push-up (`ntc_staggered_push_up`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Superman Push-Up (`hf_18`) | push-up 11/17/22/29/36 | 1/2/6/12/20 | Clap Push-Up, harder |
| Suspended Push-Up (`fedb_suspended_push_up`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Triceps push up (`wger_2684`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| TRX/Rings Push-Up (`wger_2764`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Typewriter Push-Up (`hf_7`) | push-up 11/17/22/29/36 | 7/11/15/20/25 | Hindu Push-Up, harder |
| Tyson push-ups (`wger_2679`) | push-up 11/17/22/29/36 | 7/11/15/20/25 | Push-Ups With Feet Elevated, harder |
| Weighted push-ups (`wger_1902`) | push-up 11/17/22/29/36 | 9/14/18/24/30 | Standard Push-Up, harder |
| Archer Straight-Bar Dip (`ntc_archer_straight_bar_dip`) | straight-bar dip 3/5/12/22/35 | 2/4/10/18/29 | Straight Bar Dip, harder |

### Anchors

An anchor's band is fixed and never computed. There are 145:

| Anchor | Count | Notes |
|---|---:|---|
| Endura, coaching list, seed | 88 | Library moves outside the research table (48 Endura, 17 coaching, 23 seed), after the matcher fix and the muscle-up cap. |
| Sourced research rows | 31 | The 32 rows with two or more sources, less the sit-up. |
| User decision | 1 | Sit-up, matched to crunches. |
| Single source | 12 | Derived rows whose parent is a data source or coaching target, not a move: Bent-Knee Australian Pull-Up (TopEndSports), Flutter Kicks (StrengthLevel table), Hyperextensions (back-extension study), Hip Thrust, Single-leg hamstring curl and Unilateral Hip Thrust (single-leg bridge test), Chin-up Isometric Hold (flexed-arm hang), Double Kettlebell Snatch (single-bell rank tables), Dragon Flag, Iron Cross, Neck Bridge and the lunge-style get-up (coaching targets). |
| Unit conversion | 13 | Derived rows whose parent has the other effort (reps from a hold, or a hold from reps, at a stated pace), all from a fixed anchor: the dynamic plank moves from the forearm plank, Dynamic side plank, Hollow Body Rock, L-Sit Dip, Front Lever Row, Australian Pull-Up Hold, Swimmers. A ×1.2 step cannot cross units, so their research band is kept; the script fails if one of their parents were computed. |

### Computed derivation

The other 180 rows are computed by `deriveChains` in `scripts/lib/tierDerivation.ts`:

1. **Parent.** The existing parent lookup (hand override, id in the method text, "easierId/harderId/Parent is <name>", earliest anchor name, catalogue neighbour) now returns the parent's id, through `PARENT_IDS` for anchor names. Fourth-step overrides: the lunge family hangs off the supported split squat (`wger_2557`, the catalogue easierId the research divided), Pike Compression and Roll-overs off the hanging leg raise ("HKR ÷ 1.2 twice"), Deficit Step-Down off the Archer Squat ("pistol × 1.2 twice, via archer level"), Butterfly Sit Up off the 3/4 sit-up, Oblique Crunches - On The Floor off Oblique Crunches, Elbow to Knee off Crunches.
2. **Step.** Easier or harder comes from the catalogue: the parent is the move's `easierId` (or names it as `harderId`), or the reverse (71 rows). When the two are not linked, from the method text (90 rows): ×1.2, ×1.44 or "easier"; ÷1.2, ÷1.44 or "harder"; ×1.0, "same band" or "copied from" means the same band. 19 rows are set by hand in `STEP_OVERRIDES` because the text names both directions or none, or quotes an old factor while its numbers say otherwise (Reverse Crunch and Double Kettlebell Push Press are harder, not easier). 18 rows in all take the parent's band unchanged ("same"), each because the research says the move is the parent's band.
3. **Band.** Easier: parent × 1.2, rounded up. Harder: parent ÷ 1.2, rounded down, at least 1, then raised by 1 where flooring tied two tiers. Holds of 10 s or more round to 5 s in the same direction. A computed band therefore always sits at or above its parent (easier) or at or below it (harder), at every tier.
4. **Order.** Bands are computed breadth-first from the anchors, so every parent is computed before its children. A cycle, a missing parent or a parent with another effort stops the script with an error.

Each computed row in the generated table carries `parent: { id, step }`, so the tests recompute every band from its parent and walk every chain back to an anchor.

**Result.** 31 sourced, 206 derived (180 computed, 25 single-source or conversion anchors, the sit-up) and 125 not_max_test rows; 8 dropped as before. The Library's 708 moves: 48 Endura, 17 coaching, 23 seed, 31 sourced, 206 derived, 13 generic (the 11 before, plus Maltese Push-Up and Planche Push-Up), 125 tierless, 245 without tiers. 92 of the research's derived proposals changed, most of them because their parent changed: the sit-up family (now from 16/24/40/60/85), the row family (now from the TopEndSports bent-knee table), the push-up and pull-up variants, and rows the research had derived by a ratio or two steps that are now one ×1.2 step. Some computed bands are ones the research had called implausible: Wall walk-up (pike push-up ÷ 1.2 = 4/5/15/29/48; research 1/2/5/9/15) and Japanese Handstand (wall handstand ÷ 1.2 = 8/15/25/50/75 s; research 1/3/5/10/20). They follow the rule and are listed as follow-ups.

### Remaining conflicts: data questions

Every easierId/harderId pair is checked after the derivation. 56 pairs that touch a researched band still put an easier move below a harder one at some tier (29 with both moves researched, 27 with one; a further 13 pairs between Endura, coaching and seed moves were never in scope). None is inside one chain: following both moves back to their anchors gives two different anchors every time, whose bands leave no room for the moves the catalogue puts between them. The test pins these 26 anchor pairs (`KNOWN_ANCHOR_CONFLICTS`); a new one fails it. They are data questions for the user:

| Anchors (easier > harder) | Bands | What breaks |
|---|---|---|
| Supported Split Squat > Bulgarian split squat | 5/8/18/34/54 vs 5/7/18/34/55 | Equal bands, but the catalogue puts the lunge family (supported ÷ 1.2 = 4/6/15/28/45) and Reverse lunge to knee drive (Bulgarian × 1.2 = 6/9/22/41/66) between them. 6 pairs. |
| Supported Split Squat > Cossack squat | 5/8/18/34/54 vs 5/8/12/16/20 (seed) | Unilateral Lunges 4/6/15/28/45 below the cossack's novice and beginner. |
| Reverse lunge > Bulgarian split squat | 6/10/15/20/25 (seed) vs 5/7/18/34/55 | The seed reverse lunge is a coaching target, below the knee-drive lunge from beginner up. 2 pairs. |
| Hip hinge > single-leg bridge test | 5/10/15/20/30 (seed) vs 14/21/27/33/39 | Single-Leg Romanian Deadlift (hip hinge ÷ 1.2) below Single-leg hamstring curl. |
| Pull-up > Muscle-up (and Kipping Muscle Up) | 3/4/8/13/18 vs 1/2/6/12/15 | The capped muscle-up's advanced 12 is above pull-up ÷ 1.2 = 10, so L-sit, archer, typewriter, towel, explosive and headbanger pull-ups and Gironda and side-to-side chins (2/3/6/10/15) fall below it at advanced. 9 pairs. Capping advanced at 10 would clear them. |
| Scapular pull-up > Pull-up | 3/6/10/15/20 (seed) vs 3/4/8/13/18 | Jumping pull-up and pull-up negative (pull-up × 1.2 = 4/5/10/16/22) above the scapular pull-up at novice, advanced and elite. 2 pairs. |
| Bent-Knee Australian Pull-Up > Pull-up | 8/12/17/24/30 vs 3/4/8/13/18 | Four rungs between them (inverted row, feet-elevated, archer, one-arm row) at ÷ 1.2 each leave the one-arm row 3/5/7/10/13 below the pull-up from intermediate up. |
| Bent-Knee Australian Pull-Up > Chin-Up | 8/12/17/24/30 vs 4/6/14/24/35 (Endura) | Australian Chin-Up (bent-knee ÷ 1.2 = 6/10/14/20/25) below the chin-up at advanced and elite. |
| Bodyweight Mid Row, Suspended Row, Rowing with TRX band, TRX Rows > Bent-Knee Australian Pull-Up | 6/9/23/40/59 (sourced) vs 8/12/17/24/30 | The sourced TRX rows are below the bent-knee table at novice and beginner. 5 pairs. |
| Wall Push-Up > Standard Push-Up | 14/21/27/35/44 vs 11/17/22/29/36 | Wall is the push-up × 1.2 (an Aurora proxy), one step, but the catalogue puts incline, low incline and knee push-ups between them. |
| Wall Push-Up > Incline Push-Up (and Medium) | 14/21/27/35/44 vs 10/15/35/65/100 | The Endura incline's novice and beginner are below the wall push-up. 6 pairs with its grip variants. |
| Incline Push-Up (and Medium) > Standard Push-Up | 10/15/35/65/100 vs 11/17/22/29/36 | The Endura incline's novice and beginner (10/15) are below the knee push-up (push-up × 1.2 = 14/21). 6 pairs. |
| Ring Push-Up > Standard Push-Up | 5/8/15/24/36 (Endura proxy) vs 11/17/22/29/36 | Hindu, Sphinx and Dive Bomber push-ups (push-up ÷ 1.2) are above the ring push-up the catalogue calls easier. 3 pairs. |
| Diamond Push-Up, Close-grip Press-ups > Standard Push-Up | 3/5/15/30/50 (Endura) vs 11/17/22/29/36 | The Endura diamond curve crosses the push-up's: far below at novice and beginner, above at elite. 2 pairs. |
| Plank Jump-In > Standard Push-Up | 9/14/26/41/68 (forearm plank at 4 s per rep) vs 11/17/22/29/36 | Plank Shoulder Tap (push-up × 1.2 = 14/21/27/35/44) above the jump-in at novice and beginner. |
| Bicycle Crunch > Sit-Up | 8/12/40/75/120 (sourced) vs 16/24/40/60/85 | The sourced bicycle crunch's novice and beginner are below the sit-up and its harder variants. 6 pairs. |
| 3/4 Sit-Up > Sit-Up | 7/10/33/63/100 (sourced) vs 16/24/40/60/85 | Jackknife Sit-Up (from the sit-up) above the 3/4 sit-up at novice and beginner, also through Butterfly Sit Up. |
| Abdominal Crunch > Sit-Up | 16/24/40/60/85 vs 16/24/40/60/85 | Matched bands, but Crunch - Hands Overhead, Reverse Crunch and Suspended Reverse Crunch sit between them in the catalogue. 3 pairs. A consequence of decision 2. |
| Straddle Planche > Full Planche | 2/3/6/10/16 vs 2/3/8/15/30 | Both sourced; carried over. |
| Tuck L-sit > L-Sit | 7/10/20/30/45 vs 5/10/30/45/60 | Both sourced; carried over. |

### Planner audit

The user's rule: no invented dosing, and every planner change must be explained. `scripts/audit-planner-output.mts` dumps the planner's output for one source tree; `scripts/compare-planner-output.mjs` compares two dumps and explains each difference. Run on the merge-base with `origin/dev` (`7ac4fd1`) and on this branch:

- **Seed days:** 6 seed days × 11 scenarios (plain, poor sleep, deload, pain shoulder, pain knee, joint history, no gear, all gear, advance, stall, declared advanced) = 66 plans. 57 identical. 9 differ only in one slot's dose, each on a move whose band changed (for example Sliding Leg Curl, Floor windshield wiper, Bent-Knee Australian Pull-Up as a swap). No seed-day move selection changed.
- **Generated blocks:** 4 area kinds and 5 skill targets × 6 contexts (plain, no gear, all gear, joint history, level beginner, level advanced) = 54 blocks, 711 slots. 301 slots differ: 117 because `dev` chose a move that is tierless now, 39 where the ladder walk moved on after such a slot dropped out, and 145 doses from a band change.
- **Plans of generated days** (plain and deload): 324 plans, 292 differ, all explained the same way (214 dose from a band change, 154 selection because a tierless move dropped out, 10 selection with a band change).
- **Unexplained differences: 0.** The dose rules themselves are unchanged: `git diff 7ac4fd1 -- src/rules src/plan src/progress src/safety` is empty, and `isPlannable` has `dev`'s code.
- **No invented dose:** no generated slot holds a tierless move or a move without standards, and no generated slot or planned item has the 8 reps at RIR 2 placeholder (on the third-pass branch head, 117 slots did). Two tierless moves (Fire hydrant, `wger_468`) appear in seed days only as stall regressions, with the same dose as on `dev`.

`tests/plan/tierlessMoves.test.ts` keeps the no-tierless and no-placeholder checks over every area kind as a permanent test.

## Follow-ups

1. Answer the data questions above. The ones with the most pairs: the supported split squat against the Bulgarian split squat (equal anchors), the muscle-up's advanced tier (12 against the pull-up's 10 after one step), the wall, incline and knee push-up ladder, and the sourced TRX rows against the bent-knee table.
2. Replace or drop the AOL/Brewer citation on the two ab wheel rows (404).
3. Decide the generic leftovers. The three skill placeholders (Manna, Ice Cream Maker, Pelican Curl), Maltese Push-Up and Planche Push-Up need a decision; the rest have no data after two passes.
4. Recheck the computed bands the research called implausible (Wall walk-up, Japanese Handstand), and the Crow Pose, Elbow Lever and Bear plank elite bands.
5. Any dose rule of their own for tierless moves (contacts for plyometrics, load for kettlebell moves) needs evidence first; until then the generator does not pick them.
