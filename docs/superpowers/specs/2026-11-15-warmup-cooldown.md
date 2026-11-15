# Warm-ups and cool-downs — evidence-based, session-specific

Status: approved for implementation.

## Problem

Each template's warm-up is 4 stations picked from a pool of 6 drills (about 5 min). Sessions differ by at most two drills, so the Legs and Skill warm-ups are nearly identical. There is no cool-down, so stretching (which the evidence supports for range-limited goals) has no place in the session.

## Evidence (all read as abstracts or summaries, marked [S] in the evidence doc)

- **Structure: RAMP** (Jeffreys 2007): Raise → Activate/Mobilise → Potentiate. Use moderate effort, about 5–15 min (Bishop 2003, Sports Med, PMID 12762825). In the Fradkin 2010 meta-analysis (PMID 19996770), warm-ups improved performance in 79% of criteria.
- **Injury:** structured warm-ups reduce injuries: FIFA 11+ (Soligard 2008, BMJ); Thorborg 2017 found IRR 0.61. Strength training (RR 0.32) and balance training (RR 0.55) carry the effect; stretching does not (RR 0.96) (Lauersen 2014, BJSM, PMID 24100287). The warm-up therefore includes activation and balance drills, not stretching alone.
- **Static stretching before training:** fine at ≤30 s per muscle (under 60 s total), followed by dynamic and specific drills. Losses become likely at 60 s or more (Kay & Blazevich 2012, PMID 21659901; Simic 2013, PMID 22316148; Behm 2016, PMID 26642915).
- **Cool-down stretching:** does not reduce soreness (Herbert 2011 Cochrane; Afonso 2021) or injury (Lauersen 2014). It does build range: ACSM recommends about 60 s per muscle group (2–4 × 15–30 s), at least 2–3 days/week (Garber 2011, MSSE); range gains plateau at about 4 min per session (Ingram 2025, Sports Med, PMID 39614059). This matters here because pistol depth depends on ankle dorsiflexion (Dill 2014, J Athl Train, PMID 25144599) and the handstand line depends on shoulder flexion. The cool-down is therefore **optional**, short and targeted, and never presented as an injury or soreness fix.
- **Session-specific:**
  - Skill: wrist preparation (wrist pain in about 53% of gymnasts; DiFiori 2006 AJSM), serratus/upward rotation (Ludewig 2004 AJSM, push-up plus).
  - Legs: ankle dorsiflexion (Dill 2014), glute medius (Reiman 2012), single-leg balance (Lauersen 2014, 11+).
  - Bars: posterior cuff (Reinold 2004 JOSPT), scapular work (Andersson 2016 BJSM, OSTRC shoulder programme).
  - Core: McGill-style bracing (secondary sources only).

## Design

### Stations
- A station references a **Library exercise id**. Name, cues and doodle come from the Library entry (curated description, `doodleFor`).
- Each station adds: `phase` (raise | mobilise | activate | potentiate | cooldown), `holdSeconds`, `source` (short citation shown on the station), and optionally `regions` for the gap rule.
- Seed stations (march, hip circles, ankle rocks, wrist load, scap push-up, glute bridge) keep their ids.

### Warm-up lists (in RAMP order; the shared Raise is March in place 60 s then Jumping jacks 60 s)

| Template | Mobilise | Activate | Potentiate |
|---|---|---|---|
| Skill (handstand) | wrist circles 45, wrist rocks 45, wall angel 45, child's pose 40 (2×20 s) | scapular push-up 45, hollow hold 40 | wall handstand hold 50 |
| Legs (pistol) | ankle rocks 60, 90/90 hip switch 45, deep squat hold 30 | glute bridge 45, side-lying hip abduction 60, single-leg balance 60 | split squat 45, 1-leg box squat 45 |
| Bars | arm circles 45, open book 60, wall angel 45 | side-lying external rotation 60, prone Y-T-W 45, scapular pull-up 45 | active hang 40 |
| Abs/Core | cat-cow 45, hip circles 45 | side plank 60, bird dog 60, dead bug 45 | hollow body rock 30 |
| Full body | ankle rocks 45, hip circles 45, wall angel 45, wrist rocks 45 | glute bridge 45, scapular push-up 45, single-leg balance 45 | bodyweight squat 30, incline push-up 30 |
| Mobility | cat-cow 45, world's greatest stretch 60, 90/90 hip switch 45, wall angel 45, wrist rocks 45 | — | — |

### Cool-down lists (optional; 60 s per target ≈ 2 × 30 s, about 4 min)

| Template | Stretches |
|---|---|
| Skill | wrist stretch, kneeling forearm stretch, child's pose (lats), thread the needle |
| Legs | calf stretch (hands against wall), standing calf stretch, kneeling hip flexor, 90/90 hip switch held |
| Bars | doorway pectoral stretch, child's pose (lats), kneeling forearm stretch, thread the needle |
| Abs/Core | cobra stretch, child's pose |
| Full body | calf stretch (hands against wall), kneeling hip flexor, child's pose, wrist stretch |
| Mobility | none (the session is the stretching) |

### Session
- New phase `cooldown` after the last work item. The done screen offers "Cool-down · about 4 min" (start/skip). Cool-down stations run in the same timed station view as the warm-up.
- Duration estimates: the warm-up counts towards the session estimate; the cool-down is optional and shown separately ("+4 min cool-down").
- **Length limits (revised 2026-11-15):** the 30–45 min band is a *soft* target. It stays the displayed target, and an estimate outside it is flagged in the label ("(target …)"), but it does not fail. The *hard* limit is **60 min** for warm-up + work (`SESSION_HARD_CAP_MINUTES`), enforced in tests. Warm-up holds are therefore kept at the evidence-based doses above and are not shortened to fit 45 min.
- Mobility: the listed holds give 6.5 min, under the 7 min floor, so its 90/90 hip switch and wrist rocks run 60 s instead of 45 s (7.0 min).
- Equipment: bar stations appear only in the Bars template (which needs a bar anyway).

### Acceptance
- Every station id exists in the Library; every template's warm-up is in RAMP order and 7–10 min; every cool-down is ≤ 5 min with 30–60 s per stretch.
- Tests cover the lists, the RAMP ordering, the band, the cool-down phase transitions (start, skip, finish), and persistence/resume.
- `npm test`, `npm run smell` and `npm run build` pass.

## v2 — Kavadlo-style warm-ups with a submaximal ramp (supersedes the warm-up lists above)

### What was wrong with v1
- **Wrong ending.** Potentiate ended on the session's own work or near-target moves: Skill ended on a wall handstand hold (also its first work slot), Legs on a 1-leg box squat, Bars on an active hang.
- **What the evidence says instead:** end with progressive, submaximal, task-specific practice, not the target or a working-intensity set.
  - Blazevich & Babault 2019, Front Physiol 10:1359: PAPE adds little once a specific progressive warm-up is done; long or intense warm-ups risk fatigue.
  - Bishop 2003: the warm-up must not be too intense.
  - Abad 2011: ramp sets at about 50% then 70%.
- **The user dislikes jumping jacks and marching.**

### Structure (every session, about 8–10 min)
1. **Raise:** toy soldiers (walking straight-leg kicks), about 1 min. Any moderate whole-body activity raises temperature, and temperature explains most of the benefit (Fradkin 2010; Blazevich 2019).
2. **Kavadlo's 5:**
   - drills: wrist roll (= wrist circles), reach and touch, downdog/updog switch, hollow body, plank;
   - dose: about 30 s each, "no more than five minutes" in total;
   - source: Kavadlo A. & D., *Get Strong*, Dragon Door 2017, "The Warm-up".
3. **Session prep** (evidence from v1): ankle rocks and deep squat hold (pistol depth, Dill 2014); wrist rocks and shoulder dislocates (handstand; Kavadlo, PCC); scapular work and active hang (bars; Andersson 2016, Reinold 2004).
4. **Ramp:** easier versions of the day's first moves, clearly below working effort (about 50–70%, 2+ reps left in reserve). Never the session's target, never a max hold. Kavadlo/PCC: "easier variations of the day's exercises", e.g. squats and split squats before pistols.
5. **Transition:** 1–2 min easy rest before the first work set (no consensus figure; enough to recover from submaximal sets without losing temperature, per McGowan 2015).

### Lists
| Session | Raise | Kavadlo's 5 | Prep | Ramp (submaximal) |
|---|---|---|---|---|
| Legs (pistol) | toy soldiers | yes | ankle rocks, deep squat hold | bodyweight squats → split squats → 1-leg box squat to a HIGH box |
| Skill (handstand) | toy soldiers | yes | wrist rocks, shoulder dislocates | scapular push-ups (easy) → pike hold → partial wall walk-up (to about 60°) |
| Bars (muscle-up) | toy soldiers | yes | shoulder dislocates, active hang | scapular pull-ups → 2–3 easy pull-ups (about 50% of max) |
| Abs/Core | toy soldiers | yes | glute bridge, dead bug | easy hollow hold (about 50% effort) |
| Full body | toy soldiers | yes | ankle rocks, wrist rocks | bodyweight squats, incline push-ups |
| Mobility | toy soldiers | yes | deep squat hold | (none: no strength work follows) |

New hand-written Library moves (with curated descriptions): toy soldiers, reach and touch, downdog/updog switch, wall walk-up. Cool-downs are unchanged; Kavadlo repeats the warm-up drills after training and "may add stretches".

## v3 — programme-based, tiered warm-ups (supersedes v2's lists; keeps its ramp and rest)

### Why v3
- **The user asked for medical and scientific grounding,** not one coach's routine. Kavadlo's five drills are coaching consensus, so they are removed from the warm-ups; the moves stay in the Library.
- **The user asked for levels:** warm-ups should match the athlete's level in the session's area, including the middle (activation) drills, not only the final ramp.

### Evidence base
- **Tested programmes:**
  - FIFA 11+ (Soligard 2008 BMJ; Thorborg 2017 BJSM, injury rate ratio 0.61), which has 3 difficulty levels per exercise;
  - HarmoKnee (Kiani 2010, knee injuries −77%);
  - OSTRC shoulder programme (Andersson 2016 BJSM, OR 0.72);
  - FIFA 11+ Shoulder (Ejnisman 2016, design paper).
- **Which components work:**
  - strength (RR 0.32) and balance/proprioception (RR 0.55) carry the effect;
  - stretching alone does not (RR 0.96) (Lauersen 2014);
  - neuromuscular training 10–15 min, 2–3×/week is as good as longer (Steib 2017).
- **EMG-based shoulder drills:** push-up plus and prone Y (Cools 2007; Ekstrom 2003).
- **Dynamic stretching:** controlled, not ballistic (Behm 2016; Opplert & Babault 2018).
- **Known gaps:**
  - no trial of wrist-loading or handstand-specific warm-ups (Wolf 2017), so wrist drills are labelled [C];
  - no trial of hip mobility before deep single-leg squats;
  - acute ankle-mobilisation evidence is mixed.

### Level used
- **Source:** the athlete's tier in the session's target family:
  - Legs → squat/pistol family;
  - Skill → handstand family;
  - Bars → pull family;
  - Abs/Full → their target families.
- **How it's derived:** from skill memory and the family ladder index (cascadeFamilyTiers / familyLadderIndex), reduced to three warm-up levels:
  - novice/beginner → **beginner**;
  - intermediate → **intermediate**;
  - advanced/elite → **advanced**.
- **When unknown:** beginner.

### Structure (every session, every level)
1. **Raise:** toy soldiers, 40–60 s, controlled, building amplitude.
2. **Mobilise/Activate:** the session's prep, chosen by level.
3. **Ramp:** progressively harder, clearly sub-maximal (≤ ~70% effort, 2+ reps in reserve). Never the session's target; never a max hold of a work move.
4. **Transition:** 75 s "Get ready" rest.

### Lists by level (B / I / A)

**Legs (pistol)**
- Mobilise: ankle rocks (knee-to-wall), all levels.
- Activate:
  - B: single-leg balance (eyes open), glute bridge, bodyweight squat;
  - I: single-leg balance (eyes open), single-leg glute bridge, walking lunge;
  - A: single-leg balance (eyes closed), single-leg glute bridge, walking lunge.
  - Sources: 11+ / HarmoKnee.
- Ramp:
  - B: bodyweight squat → split squat;
  - I: split squat → 1-leg box squat to a high box;
  - A: 1-leg box squat (high box) → assisted pistol (holding support, partial depth).

**Skill (handstand)**
- Mobilise: wrist rocks [C], all levels.
- Activate:
  - all levels: push-up plus (Cools/Ekstrom) and prone Y-T-W (Ekstrom);
  - B: plank; I and A: side plank (11+).
- Ramp:
  - B: pike hold → partial wall walk-up (about 45°);
  - I: wall walk-up (about 60°);
  - A: wall walk-up → easy chest-to-wall hold, 10–15 s, at or below about 50% of max.

**Bars (pull / muscle-up)**
- Mobilise: quadruped thoracic rotation (OSTRC aim), all levels.
- Activate:
  - all levels: side-lying external rotation (Reinold; OSTRC), push-up plus, prone Y-T-W, scapular pull-up;
  - I and A: sleeper stretch 2×20 s for internal-rotation range (OSTRC aim; static ≤30 s).
- Ramp:
  - B: dead hang → jumping pull-ups ×3;
  - I: jumping pull-ups → 2 easy strict pull-ups;
  - A: 2 easy sets of pull-ups (≤50% of max).
  - No muscle-up drills.

**Abs/Core**
- Activate: glute bridge, plank, side plank (11+ / HarmoKnee) and dead bug [C], all levels.
- Ramp:
  - B: slow dead bug → tuck hollow hold;
  - I and A: easy hollow hold at about 50%.

**Full body**
- Activate:
  - B: bodyweight squat, push-up plus, single-leg balance, plank;
  - I and A: walking lunge, push-up plus, single-leg balance, plank.
- Ramp:
  - B: squat → incline push-up;
  - I and A: squat → easy push-ups.

**Mobility** (no levels, no ramp)
- leg swings (front and side), world's greatest stretch, ankle rocks, cat-cow (Behm 2016; Opplert 2018).

### New Library moves
- push-up plus;
- assisted pistol squat (holding a support);
- chest-to-wall handstand;
- single-leg balance (eyes open).

Each comes with a curated description and level, then a doodle.
