# Family tier cascade from Library declare

## Goal

When you set **Your level** on a Library exercise, raise related moves in the same movement family to a sensible floor so onboarding does not require declaring every rung by hand.

Example: Advanced on Dragon Flag implies Elite (or at least Advanced+) on easier anti-extension work such as plank, hollow hold, and rollout.

## Decisions

| Choice | Decision |
|---|---|
| Conflict policy | Raise only on `skillTier` — never lower; never rewrite `declaredTier` on related moves |
| Scope | Whole movement family (ladder siblings included), not just `easierId` chain |
| Floor math | Rank-aware: `min(elite, declared + (sourceRank − memberRank))` |
| Harder moves | Untouched |
| Trigger | Library declare now; `cascadeFamilyTiers` is reusable for session logging later |
| Reps | Do not invent `bestReps` for related moves |

## Architecture

1. `declareSkillTier` writes the source exercise’s `declaredTier` / `skillTier`.
2. `cascadeFamilyTiers` looks up family + rank via `placeOnLadder` (same rules as enrich; band moves stay off ladders).
3. Every same-or-easier family member is raised with `maxTier`.
4. Library detail shows a short hint: “Updated N related moves in this family.”

## Modules

- `src/progress/familyLadderIndex.ts` — catalogue → family/rank index
- `src/progress/cascadeFamilyTiers.ts` — pure cascade math
- `src/session/history.ts` — `declareSkillTier` returns `{ memories, cascadedCount }`
- `src/ui/libraryView.ts` / `src/library/libraryDetail.ts` — hint after declare

## Out of scope

- Cascading from logged `bestReps` / session evaluation (hook exists; not wired)
- Cross-family inference (e.g. dragon flag → pull-up)
- Suggest-then-confirm UI for each related move
