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

## 7. Joint history: Library flags, cautions and prehab (2026-11-15)

The Library now reads the profile's joint history ([joint-history spec](2026-11-15-joint-history.md)): list rows get a "Skipped for your joints" / "Mind your joints" badge, the detail page explains why, and a **For my joints** filter lists prehab moves (`src/safety/prehab.ts`) for each declared joint.

### New safety notes (`cautions.ts`)

| Move | Note | Evidence |
|---|---|---|
| Skin the cat, German hang, shoulder dislocate | Skip with instability, hypermobility or past dislocation | Overview of shoulder instability, Open Orthop J 2013;7:338 (anterior instability shows in abducted + externally rotated positions) [S]. **No study of these moves exists**; the rule is inferred from mechanism. |
| Dead hang, one-handed hang | Hang active, step up to the bar, stop when tired | Swinburne University explainer, 2023 (opinion-level) [conv] |
| Lateral lunge, Cossack, skater, curtsy, shuffle | Gradual load; frontal-plane work is held back after knee ligament injury | MCL return-to-play commentary (Sportsmith) [conv]; ACL return-to-cutting risk, PMC10929313 [S] |

### Prehab list: what each pick rests on

| Joint | Moves | Evidence |
|---|---|---|
| Shoulder | Scapular push-up, scapular pull-up, Y-T-W, serratus wall slide, scapular retraction, ring face pull | Serratus activity highest in push-up plus and dynamic hug, Decker 1999, AJSM 27(6):784 [V]; trapezius/serratus exercises, Ekstrom 2003, JOSPT 33(5):247 [S]. Scapular stabilisation helps rotator-cuff and impingement pain (13-RCT meta-analysis, 690 participants); for *instability* the evidence is weak and dated (nonoperative-management systematic review) [S]. |
| Shoulder | Side-lying external rotation (**new, wger #578, CC-BY-SA-4.0**) | Elbow-at-side rotator-cuff staple, kept out of the abducted/externally rotated provoking position [conv]. Reinold 2004, JOSPT 34(7):385 compared external-rotation variants; I could not verify its side-lying result. |
| Knee / hip | Copenhagen, side-lying hip abduction, clamshell, glute bridge | Copenhagen raises eccentric adductor strength and reduces groin symptoms (2021 and 2025 systematic reviews; injury-prevention link still needs more trials) [S]. Hip-abductor strengthening raises strength but did **not** significantly change knee valgus (RCT, PMC4424529) [S]. |
| Knee | Single-leg soft-landing holds, deficit step-down, tibialis raise | Landing and step-down control are standard rehab tests/drills [conv]; no outcome trial found. |

### Looked for, not added

- **Spanish squat, terminal knee extension, reverse Nordic as evidence-backed moves:** searches returned no trial evidence. Reverse Nordic is already in the Library (wger) but is deliberately not on the prehab list.
- **Prone external rotation at 90° abduction** (high rotator-cuff EMG in Reinold 2004): left out because it is the abducted + externally rotated position that provokes anterior instability.
- **Face pulls with a band:** left out (and "Ring Face Pull" removed from the shoulder prehab list). They finish with the elbows high and the arm externally rotated, the position unstable shoulders should avoid.
- **Monster walks, lateral band steps, quadruped hip abduction (band optional):** left out; sideways stepping is the load the knee rules steer away from, and the last is a bodyweight move.
- **Band-assisted pull-up, banded front raise, banded shoulder drills (a video link only), band dorsiflexion (no instructions):** not imported.
- **Cable moves:** no cable equipment.
- **Dumbbell rotator-cuff rows in wger** (#406, #1715): the same movement as side-lying external rotation; not imported as duplicates.
- The raw wger and free-exercise-db dumps were already well mined; one gap (side-lying external rotation) was found.

### Bands (`requires: ["band"]`)

`band` is now an equipment option. Six wger band moves are imported (CC-BY-SA-4.0, author credited): band pull-aparts, band pull-apart with external rotation, banded scapular retraction, seated band row, band terminal knee extension, banded clamshell. They carry `requires: ["band"]`, appear in the Library with "Needs: band", and show in "For my joints" only when the profile has a band.

Gear-dependent moves are **never auto-planned and never placed on a progression ladder**: before this rule, "retraction" and "row" keywords made a band move the *easier* step of the seed Scapular push-up. 
Terminal knee extension and the seated row rest on convention: no trial evidence was found.

### Joint load per exercise (`src/safety/jointLoad.ts`)

The Library detail page lists which joints a move stresses and why. For a joint in the user's history with no avoid rule, a *high* load becomes a caution (never an avoid).

| Joint | Evidence found | Strength |
|---|---|---|
| Wrist | Press-to-handstand wrist moments ~40% of body weight; chronic wrist pain common in adult handstand practitioners (PMC12550924); adolescent gymnast wrist pain pooled prevalence 53% (PMC12804664, meta-analysis) | [S]; no data for plank or push-up wrist load |
| Knee | One-legged squats load the patellofemoral joint more than two-legged at every angle tested (IJSPT 2025); long-stride lunges raise posterior cruciate force and lunge patellofemoral load depends on angle (Escamilla, IJSPT); cruciate shear low in the first 60° of bend, compressive load rises with depth (Escamilla 2001, MSSE) | [S]; **no force data for pistol squat or step-up** |
| Shoulder | Dips reach the end of extension range (McKenzie 2022); pull-up impingement risk peaks at the bottom, pronated grip may help (secondary source) | [S] / [conv] |
| Elbow | Static holds, levers and planche load the elbow flexors and forearm tendons; workload spikes linked to overuse | **Blog and forum level only; no controlled study found** [conv] |
| Lumbar | Repeated flexion (Callaghan & McGill 2001, already §3) | [S]; nothing found on hanging leg raises or L-sits |
| Hip, ankle | Not researched yet | none |

### Equipment is enforced (`src/data/enrich/equipment.ts`, `src/safety/gear.ts`)

Every Library move gets `requires` from its name: **bar** (pull-ups, hangs, levers, inverted rows, muscle-ups, toes-to-bar), **rings** (ring and suspension/TRX moves, crosses), **parallettes** (parallel-bar dips and holds), plus **band** from the wger tags. Benches, chairs, walls and the floor are assumed. The rules are ordered regexes with explicit exclusions for look-alikes (hamstring, elbow lever, chin tuck, hip dips); a test pins them. Count at time of writing: 52 bar, 30 rings, 7 parallettes, 6 band, 514 none.

- **Planner:** a move needing gear missing from the profile is swapped for the first same-pattern plannable move with no missing gear and no joint avoid flag (rule id `equipment`, reason shown). If none exists (e.g. every vertical pull needs a bar), the move is kept with a "Needs bar" note on the card.
- **Library:** an **Only my gear** chip hides moves needing gear you lack; detail pages say "Needs: …".
- **Plan editor:** the exercise pickers list only moves you have the gear for (the current pick always stays).
- Not enforced: the variety rotation can still propose a gear move, but the final swap step catches it; warmup stations are not gated.
