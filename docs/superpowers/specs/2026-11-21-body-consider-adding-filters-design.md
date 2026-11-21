# Body “Consider adding”: gear, declared high joints, By pattern level

Extends [#234 Body balance](2026-11-20-body-balance-design.md). Narrows which Library moves appear under **Consider adding**.

## Problem

`suggestMoves` already requires owned gear and ranks by coverage, novelty, source, and catalogue difficulty. It does not:

- drop moves that put **high** catalogue load on a joint the athlete has declared, or
- require difficulty to match the athlete’s **By pattern** median tier from Progress.

So suggestions can be joint-heavy for a known injury or pitched above/below the pattern average they already see on Progress.

## Goal

Keep the same section (up to three tappable moves, “Your plan is not changed.”). Change only eligibility.

## Rules

Hard filters, applied after today’s area / pattern / exclusion checks and **before** ranking. Order does not matter for the result set.

### 1. Owned gear (unchanged)

Drop any move where `missingGear(exercise, equipment)` is non-empty.

### 2. Declared joints — high load only

Pass `jointHistory` from the profile into `buildBalanceModel` → `suggestMoves`.

Drop a move when `jointLoadsFor(exercise.name)` includes an entry with `level === "high"` whose `joint` appears in the athlete’s joint history.

- **Moderate** (and any undeclared joint) → keep.
- Empty joint history → no joint-based drops.
- Do **not** use `assessExercise` avoid/caution here; this filter is catalogue high-load on selected joints only.

### 3. Same level as By pattern average

Build the Progress level profile once per suggest run: `buildLevelProfile({ graph, memories })`.

For each candidate, target tier = that move’s pattern row’s `tier`, with:

| Case | Target difficulty |
|---|---|
| Pattern has a By pattern row | that row’s median tier |
| Pattern has no row yet | `intermediate` (today’s catalogue default) |
| Median tier is `novice` | `beginner` (catalogue `Difficulty` has no novice) |

Keep the move only when `(exercise.difficulty ?? "intermediate") === target`.

Exact match only — never “tier or easier.”

## Unchanged

- Light / not-trained area targeting and pair light-side selection.
- Ranking: more wanted primaries, prefer untrained-in-memory, source rank, then difficulty rank among survivors, distinct names, `MAX_MOVES = 3`.
- UI copy and layout; zero survivors → section omitted as today.
- Plan is never mutated.

## Data flow

```
loadProfile().equipment + jointHistory
loadMemories()
        │
        ▼
buildBalanceModel ──► suggestMoves
                         ├─ missingGear
                         ├─ high load ∩ declared joints
                         └─ difficulty === By pattern median (with fallbacks above)
```

## Out of scope

- Soft ranking when the filtered set is empty (no backfill with harder/easier or high-joint moves).
- Filtering on moderate joint load.
- Planner / Library / joint-care avoid-swap behaviour.
- New Body UI or copy explaining why a move was omitted.

## Acceptance criteria

- [ ] Owned gear still required for every suggested move.
- [ ] Move with high catalogue load on a **declared** joint never appears; same move with only moderate load (or high load on an undeclared joint) may appear if other filters pass.
- [ ] Suggested move difficulty equals the By pattern median for its pattern; missing pattern row → intermediate; novice median → beginner.
- [ ] Empty joint history does not change joint filtering (no joint drops).
- [ ] Vitest in `tests/body/balance.test.ts` covers the three filters and the novice/missing-pattern tier edges.
- [ ] No UI/copy change beyond which rows appear.

## Files (expected)

- `src/body/balance.ts` — `MoveInput` / `BalanceInput` gain `jointHistory`; filters in `suggestMoves`.
- `src/ui/bodyView.ts` — pass `loadProfile().jointHistory`.
- `tests/body/balance.test.ts` — new cases.
- Reuse: `jointLoadsFor`, `buildLevelProfile`, `missingGear`.
