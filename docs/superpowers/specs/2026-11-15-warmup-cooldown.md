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
