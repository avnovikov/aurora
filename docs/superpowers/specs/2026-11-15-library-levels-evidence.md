# Library levels, progressions, standards and safety notes — evidence

Applies to every Library exercise: the seed list plus moves imported from HF, NTC-style, free-exercise-db and wger. The rules live in `src/data/enrich/`:

| File | What it decides |
|---|---|
| `families.ts` | Movement-family ladders: rank (easy → hard) and difficulty tier |
| `standards.ts` | Five-tier rep/hold standards |
| `cautions.ts` | Safety notes |
| `enrichCatalogue.ts` | Applies the above to every exercise |

Hand-curated seed chains and seed standards are never overwritten.

Strength of evidence is marked as follows:

- **[V]** — read in the primary source or official table.
- **[S]** — taken from an abstract or secondary summary; check against the full text before quoting numbers.
- **[conv]** — no comparative study exists; follows coaching convention or lever-length logic.

## 1. Progression ladders

| Family | Order (easy → hard) | Evidence |
|---|---|---|
| Push-up | wall → incline → knee → low incline → standard (diamond, wide, hand-release…) → decline / feet-elevated / deficit → archer, clap, pseudo-planche → one-arm | Wurm & Ebben 2011, JSCR, force-plate % body mass [S]; Ludewig 2004, AJSM, PMID 14977678 |
| Pull | dead/active hang → scapular pull-up → jumping / negative / isometric → pull-up ≈ chin-up → archer, typewriter, L-sit → muscle-up → one-arm, ring muscle-up | Youdas 2010, PMID 21068680 (pull-up ≈ chin-up); Prinold & Bull 2016, PMID 26383875 (prefer front grip); rest [conv] |
| Row | rings/TRX/incline → inverted row → wide/feet-elevated → one-arm | Fenwick 2009, JSCR [S]; [conv] |
| Dip | bench/chair/floor → support hold → bar dip → ring dip, Korean, L-sit dip | McKenzie 2022, IJERPH, doi:10.3390/ijerph192013211 |
| Squat → single-leg | squat → split squat / lunge / step-up → Bulgarian, Cossack → skater, shrimp → pistol → dragon squat | DiStefano 2009; split-squat EMG [S]; rest [conv] |
| Glute | clamshell → side-lying abduction / hydrant → bridge → single-leg bridge / kickback → hip thrust | DiStefano 2009, JOSPT, doi:10.2519/jospt.2009.2796; Reiman 2012, doi:10.3109/09593985.2011.604981; Boren 2011, PMID 22034614; Contreras 2015, PMID 26214739 |
| Hamstring | hinge / good morning → single-leg RDL → sliding curl → Nordic | Petersen 2011, PMID 21825112; van Dyk 2019, BJSM; Bourne 2017, BJSM [S] |
| Adductor | Copenhagen (short → long lever) | Serner 2014; Ishøi 2016, PMID 26589483; Harøy 2019, BJSM |
| Anti-extension | dead bug / bird dog → plank → plank variations → rollout, body saw → dragon flag | Kavcic 2004, PMID 15480148; Ekstrom 2007, JOSPT; Calatayud 2017, AJPMR; Escamilla 2010, PMID 20436242 |
| Compression | lying raises → hanging knee raise → tuck L-sit → L-sit / hanging leg raise → toes-to-bar, V-sit → manna | Escamilla 2006, PMID 16649890; L-sit and above [conv] |
| Scapular | wall slide → prone Y-T-W / retraction → scapular push-up → push-up plus | Ekstrom 2003, PMID 12774999; Cools 2007, AJSM; Ludewig 2004 |
| Calf | seated → double-leg → single-leg | Baxter 2021, MSSE, PMID 32658037 |
| Plyometric | snap-down / landing → squat jump → tuck, lunge, broad jump → box jump → depth jump | NSCA position statement 1993 [S] |
| Overhead / handstand / lever / planche | pike → elevated pike → wall HSPU → deficit → freestanding; lean → tuck → straddle → full | [conv]; Kinoshita 2022 [S] |

Link rules:

- A move without hand-set links gets the nearest rung below and above it.
- Seed, HF and NTC moves are preferred as link targets, in that order.
- Any non-seed link that points the wrong way on difficulty is dropped. This removed several inverted progressions that came from the HF dataset's own data.

## 2. Standards (max clean reps / hold seconds per tier)

How the norms map to tiers:

| Tier | Meaning |
|---|---|
| Novice | Below the clinical floor |
| Beginner | Around "fair" |
| Intermediate | Population median / "good" |
| Advanced | CSEP "excellent" or the military top score |
| Elite | Trained specialists |

Values are for men aged 20–39. Women's upper-body norms run about 0.6–0.7× of these.

| Source | Value |
|---|---|
| Payne 2000 (CSEP), doi:10.1139/h00-028 | Push-ups, men 20–29: fair 17–21, good 22–28, excellent ≥36 [S] |
| Yang 2019, JAMA Netw Open, PMID 30768197 | >40 push-ups linked to far fewer cardiovascular events [V] |
| US Army AFT scoring scales 2025 | Plank 1:30 pass → 3:40 max; hand-release push-ups [V] |
| USMC PFT | Pull-ups, men 21–25: 5 minimum, 23 maximum [S] |
| Strand 2014, J Hum Kinet, doi:10.2478/hukin-2014-0011 | Plank 83 s (women) / 124 s (men) [S] |
| McGill 1999, PMID 10453772 | Side bridge ≈ 70 ± 23 s [S] |
| Hébert-Losier 2017, PMID 28886865 | Single-leg calf raise median 21–24 [S] |
| Freckleton 2014, BJSM | Single-leg bridge: <20 poor, 25 average, >30 good [V] |
| Lein 2022, PMID 35949374 | Sit-to-stand medians; loose anchor only for squat |

**No adult population norms exist** for pull-ups (only the military scale), dead hang, wall sit, max-rep squat, hollow hold, Nordic reps, or any calisthenics skill. Those standards are reasoned extrapolations and should be read as guidance, not cut-offs.

Changes to the seed made by this review:

- `single_leg_calf_raise` changed from 6/10/15/20/25 to 8/15/25/35/45. The old elite value equalled the healthy median.
- `pullup` changed from 1/5/12/20/25 to 1/5/10/18/25, to match the USMC scale. Intermediate working reps drop from 10 to 8.

## 3. Safety notes and exclusions

| Move | Decision | Source |
|---|---|---|
| Behind-the-neck pull-up | **Excluded** | Kolber 2010, JSCR 24(6):1696; Prinold & Bull 2016 |
| Bench / chair / floor dips | Caution: ~101% of shoulder-extension range; prefer bar dips | McKenzie 2022 |
| Crunches, sit-ups, V-ups | Caution for flexion-intolerant back pain | Callaghan & McGill 2001, PMID 11114441; Contreras & Schoenfeld 2011 |
| Kipping | Caution: strict strength first | No peer-reviewed data |
| Neck circles, CARs, tilts, turns; neck bridge | Caution: dizziness or sudden pain are red flags | Australian Physiotherapy Association VBI guidance |
| Behind-the-head stretches | Caution | Kolber 2010 rationale |
| Depth jumps | Caution: master landings first | NSCA 1993 |
| Planche, levers, crosses, human flag, dragon flag | Caution: connective-tissue load | Gymnastics injury literature [S] |
| Handstand, planche, crow (wrist) | Caution | Gymnast wrist-pain review, pooled prevalence 53% [S] |
| Wall sit, isometric squat | Caution: no breath-holding; blood pressure | Edwards 2023, BJSM 57:1317 |
| Static stretches | Keep under 60 s per muscle before strength work | Behm 2016, PMID 26642915 |

## 4. Sources not imported

ExerciseDB: the repository licence (AGPL-3.0) covers only the API code. The exercise data and media fall under ExerciseDB's commercial Terms of Use, and the free endpoints are marked "for exploration only". Importing it would break the licensing rule in the design spec §8.

## 5. Descriptions (merged and rewritten)

Every exercise's raw text from all sources is gathered by `npm run descriptions:bundle -- <outDir>`. That includes the duplicates skipped at import (for example, free-exercise-db "Pushups" folds into HF "Standard Push-Up"), with filler such as "This will be your starting position" stripped out.

Writers rewrote each bundle in one house style:

- a one-sentence summary;
- 3–6 imperative steps;
- 2–4 short cues;
- 0–3 common mistakes.

The writers followed the exercise name when a source described a different variant. They added no medical claims; safety notes come only from §3.

The results are stored in `data/curated/descriptions/*.json` and compiled by `npm run descriptions:compile`. Compilation fails on any house-style violation (`src/data/describe/validate.ts`).

Attribution for each exercise is computed from its bundle, not written by hand, and shown as "Text adapted from …" on the detail page. wger-derived text stays CC-BY-SA with author credit.

## 6. Planner wiring

- The planner, session, progress and body views all read `EXERCISE_GRAPH`, which is the full enriched Library.
- Imported moves that duplicate a seed move are folded into the seed entry; their old ids redirect.
- Seed moves keep their curated chains. Progression continues along the ladder links into Library moves.
- Consecutive-day variety swaps come from the plannable Library (work moves that have standards). The order of preference is:
  1. same family;
  2. same pattern;
  3. same region.

  A swap may only be the same level or one easier.
- The Plan editor lists every plannable move, grouped by pattern and labelled with its level.
