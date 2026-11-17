# Progress rethink — profile, weak-links, readiness + History

**Product:** Aurora · Rassvet  
**Date:** 2026-11-17  
**Status:** Approved for implementation (brainstorm §1 IA + locked decisions; Approach 3)

## Problem

Progress today is plan-target path cards (“Towards your targets”). That does not explain training status: athletes sit at **different tiers on different patterns**, advance often by **dose on the same move** (ACSM double progression), and need to see **what is lagging** plus a way into **set-level history**.

## Goals

1. Progress answers “wtf is going on” with three cards grounded in training/medical progression.
2. History is a first-class tab: browse all logs, or open filtered from Progress drill-ins.
3. History rows show **exercise · sets · reps/hold · when**.

## Non-goals

- Redesigning Plan / Library / session chalk.
- Live A/B analytics experiment (design bake-off already done in conversation).
- HR trend on Progress (keep out until data exists).

## Surfaces (Approach 3)

### Progress tab — “now”

Stacked cards:

1. **Level profile** — one row per pattern with trained data.
2. **Weak-links** — ranked moves going worse than the rest.
3. **Current readiness** — few *current* goals (explicit target or implicit next-level).

### History tab — parallel

- Always in the shell tab bar (sibling to Progress).
- Default: chronological set log across sessions.
- Drill-in from Progress applies a filter chip; clear chip → full History.

### Drill-in rules

| From | History filter |
|------|----------------|
| Profile row (pattern) | All trained exercises in that pattern |
| Weak-link row | That exercise only |
| Readiness row | That exercise only |

## Card A — Level profile

- Athletes are **not** one global level. Each **pattern** has its own tier.
- Visual: continuum **novice → elite**; the bar sits in the band for the pattern’s tier and fills by **within-tier %**.
- Text: `Vertical pull · Intermediate 48%` where **48% = progress within Intermediate toward Advanced** (not % of the whole line, not relative to best pattern).

### Within-tier % (definition)

Given standards for an exercise and `bestReps`:

- `tier` = highest tier whose standard `bestReps` meets (`inferTierFromBest`).
- If `tier === elite`: within-tier % = 100.
- Else:  
  `pct = (bestReps - standards[tier]) / (standards[nextTier] - standards[tier])`  
  clamped to `[0, 1)`, displayed as integer %.

### Pattern aggregation

- Consider exercises in the pattern that have training signal (`bestReps` or sessions).
- Pattern **tier** = median (or majority) of per-exercise tiers; document choice in code as **median by tier index**, ties → lower tier.
- Pattern **within-tier %** = mean of within-tier % among exercises at that pattern tier (ignore exercises at other tiers for the % number; they still affect median tier).
- Bar position on the full line:  
  `(tierIndex + withinPct) / (SKILL_TIERS.length - 1)`  
  so Intermediate @ 48% sits mid-Intermediate band.

## Card B — Weak-links

- Rank exercises with training signal by **how far below** the athlete’s typical within-tier fill (or pattern peers).
- Show top lagging items (cap ~3–5) with: name, best vs next-tier bar, short reason (e.g. “−33% vs your level average”).
- Empty: no trained exercises yet → short hint to train / open Library.

## Card C — Current readiness

**Current** goals only (not every plan north-star):

- **Explicit:** plan `targetExerciseIds` the athlete is actively pursuing (templates with targets that appear in current plan queue / resolved templates — same source as today’s plan targets, but UI emphasises *current*).
- **Implicit:** next-level on an active path move (dose bar to clear current tier before next exercise variation).

Each row: goal label + kind chip (explicit / implicit) + **dose bar** on the current rung (best / standard for next tier) + one-line criterion (ACSM-style: sessions/reps to clear).

Reuse existing plan-progress helpers where they still fit; do not lead with named ladder lists.

## History data

Today `HistoryEntry` stores session summary only (`exerciseIds`, `setCount`) — **not** per-set reps.  

**Change:** when a session is appended to history, also persist the session’s `WorkoutLog.entries` (or a compact copy: exerciseId, setIndex, completedReps, loggedAt, stopReason).  

History UI renders from those set entries; sessions without set payloads (legacy) show exercise ids + set count only, with a “no set detail” note.

New storage: either extend `HistoryEntry` with `sets?: SetLogEntry[]` or add `aurora.poc.setHistory.v1`. Prefer **extend HistoryEntry** to keep one timeline.

## Shell

Add `history` to `AppTab` and tab bar (label **History**), placed after **Progress**.

## Empty / early states

- No memories: Profile empty + CTAs; Weak-links empty; Readiness falls back to plan targets “not started” or empty + Library/Plan CTAs.
- History empty: “Sets you log in a session appear here.”

## Testing

- Pure model tests: within-tier %, pattern aggregation, weak-link ranking, history filter helpers.
- UI smoke: Progress renders three sections; History filter chip from drill-in.
- Persistence: appendHistory stores sets; loadHistory returns them.

## References

- ACSM Progression Models in Resistance Training (dose before load/variation).
- JOSPT load progression / weak-link framing (floor → ceiling, limiting capacity).
- Prior Progress plan-targets work (#35) — path cards demoted, not deleted from domain if still used by Plan.
