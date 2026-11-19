# Plan level from logged performance

Issue: #115 · Follows: `2026-11-17-skill-level-inference-design.md` (rule 10; `planTier` raise-only deferred here)

## Why

Since #112 the plan level (auto / beginner … elite) is still set by hand. Generating days writes a per-move `planTier` dose default that only rises. Nothing moves the plan level from how the athlete actually performs.

## Decisions

| # | Rule | Value |
|---|---|---|
| 1 | Raise evidence | **Logged only** (`loggedTier` / `bestReps` vs standards). Declared, inferred, and `planTier` do not count. |
| 2 | Window | Working (non-pinned) slots on the **first 3 days of the plan queue** (the days about to be trained). Fewer than 3 days → gate does not raise. |
| 3 | Pass | Slot **passes** when logged performance is at the **current plan level’s standards boundary** (`bestReps ≥ standards[current]`) **or** already at/above the **next** tier (`loggedTier ≥ next(current)` or `bestReps ≥ standards[next]`). |
| 4 | Fail | Unlogged slots, missing standards, or below the boundary **fail**. They stay in the denominator. |
| 5 | Gate | `passed / total ≥ 0.8` over that pool (one ratio across all working slots in the 3 days). |
| 6 | On pass | **Auto-raise** the stored plan level **one tier**, and **show on Plan** why it moved (A + B). |
| 7 | Lower | **Manual only.** Auto never lowers. |
| 8 | Exercise tiers | Stay on **performance**. Changing the plan level does not rewrite logged/declared evidence. `planTier` remains a dose default for moves **without** logged evidence and must not override logged performance when dosing. |
| 9 | `auto` | Gate uses the **effective generation tier** for new days. A raise **writes the next concrete tier** (leaves `auto`). Athlete can set lower or return to `auto` by hand. |
| 10 | Cap | At most **one tier up per evaluation**. Elite does not raise further. |

## Components

| Unit | Responsibility |
|---|---|
| `src/progress/planLevelGate.ts` | Pure: days + memories + current tier → `{ passed, total, shouldRaise, nextTier }`. |
| `src/plan/planLevel.ts` | Persist level; apply one-step raise; store/clear a short “just raised” notice for Plan. |
| Session close + Plan open | Evaluate the gate; if `shouldRaise`, bump once and set the notice. |
| `src/plan/levelDeclare.ts` | Keep `planTier` as dose default only; never override logged performance. |
| Plan UI | Show/dismiss the raise notice; level control remains editable. |

## Error handling

- Unknown exercise ids and slots without catalogue entries are skipped (neither pass nor fail).
- Pinned slots are skipped.
- `total === 0` → do not raise.
- Clock / missing `bestReps` with only `loggedTier` still allows a next-tier pass via `loggedTier`.

## Testing

- < 3 plan days → no raise
- 79% vs 80% (e.g. 11/15 vs 12/15)
- Unlogged counts as fail
- Boundary pass and next-tier pass
- Elite → no further raise
- One-step only
- Apply path sets notice once per raise
- `planTier` / declared alone do not satisfy the gate

## Out of scope

- Per-exercise inference hardening (#116)
- Changing `shouldAdvance` thresholds
- Auto-lowering the plan level
