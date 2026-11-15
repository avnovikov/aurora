# Story: joint history at setup, joint-aware exercises

**As** a lifter with past joint injuries, **I want** the app to ask about them at
setup and then steer exercise choice around them, **so that** progress never
costs me a re-injury.

## Acceptance
- First run (no `setupDone`) shows a setup screen: tap each injured joint, pick
  side (left / right / both) and kind (dislocation, ligament/tendon, surgery,
  other). "Nothing to declare" is one tap. Existing users see it once.
- Editable any time in Settings → Past joint injuries.
- Planner: a move flagged **avoid** for the history is swapped for a
  same-pattern move that is not (rule id `joint_history`, reason shown).
  A move flagged **caution** stays, with a "Mind your joints" note on the card.
- Old saved profiles load with an empty history.

## Rules (conservative, `src/safety/jointCare.ts`)
| History | Avoid (swap) | Caution (note) |
|---|---|---|
| Shoulder, any kind | skin the cat, German hang, back lever, crosses, shoulder dislocates, straight-arm press, bar pullover, ring fly, muscle-ups / kipping | dips, handstands, planche, front lever, pike push-ups, dead hangs |
| Knee, any kind | lateral / crossover knee loading (Cossack, lateral lunge, skater, shuffle, curtsy, sumo) | impact, deep flexion under load |
| Knee, ligament or surgery | the above plus jumps, hops, bounds, burpees | deep flexion |

Moves are tagged by **name** (`src/safety/movementRisk.ts`) because most of the
~600 imported catalogue moves carry no joint data. This is a heuristic; review
the regex list when the catalogue changes.

## Evidence and its limits
- Anterior shoulder dislocation recurs most in young, active people, mostly in
  the first two years; return to activity is individual
  ([narrative review](https://www.springermedicine.com/management-of-primary-anterior-shoulder-dislocations-a-narrative/25184252),
  [meta-analysis, Sports Med Open 2019](https://sportsmedicine-open.springeropen.com/track/pdf/10.1186/s40798-019-0203-2)).
- Knee: return to pivoting/cutting after ACL reconstruction carries a much higher
  risk of further ACL injury ([PMC10929313](https://pmc.ncbi.nlm.nih.gov/articles/PMC10929313));
  MCL rehab defers frontal-plane work until valgus laxity improves
  ([Sportsmith](https://www.sportsmith.co/articles/medial-collateral-ligament-injury-management-and-return-to-play/), commentary);
  load progressions should follow the mechanical load on each structure
  ([Sports Med 2022](https://pubmed.ncbi.nlm.nih.gov/34669175/)).
- **No source found names skin the cat.** Avoiding it is inferred from
  mechanism: loaded abduction, external rotation and extension is the
  position that provokes anterior instability. Not medical advice; a physio
  can loosen or tighten any rule.
