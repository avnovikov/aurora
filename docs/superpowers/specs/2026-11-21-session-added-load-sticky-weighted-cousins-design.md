# Design: Sticky added load + weighted cousins on Add weight

**As** an athlete mid-work set, **I want** added weight to stick for later sets of this move, and when an unweighted move has a weighted twin **I want** Add weight to switch me onto that twin (and undo when load returns to 0), **so that** load and the named move stay consistent.

## Decisions

| Topic | Choice |
|-------|--------|
| Sticky load | Same exercise only (across its sets); clears when leaving the exercise |
| Weighted import | v1: import **map targets only** (Dumbbell twins + Weighted Step-ups + Weighted push-ups). Allow those equipment tags in selection; do not flood Library with all KB/DB rows |
| Twin preference | Dumbbell-first; KB duplicates of the same pattern are not imported in v1 |
| Link direction | Unweighted → weighted (`weightedId` on the bodyweight / unloaded move) |
| Many-to-one | Several unweighted ids may point at the same weighted twin |
| On Add weight | If current id has `weightedId` → swap live work + write Plan slot; set load to profile `addWeightKg` |
| On load → 0 | Restore the original unweighted id (session + Plan); clear load |
| No twin | Sticky kg only; no swap |
| Already on weighted | ± kg only; no second hop |
| Gear on twins | `requires: ["dumbbell"]` (Settings label: “Dumbbell or kettlebell”) |
| Unlinked load rows | Not imported in v1 |

## Curated map (unweighted → weighted)

| Unweighted id | Unweighted name | Weighted twin (wger name) |
|---------------|-----------------|---------------------------|
| `hip_hinge` | Hip hinge | Dumbbell Deadlift |
| `hf_85` | Single-Leg Romanian Deadlift | Single-Leg Deadlift with Dumbbell |
| `bodyweight_squat` | Bodyweight squat | Dumbbell Front Squat |
| `bulgarian_split` | Bulgarian split squat | Bulgarian Squat with Dumbbells |
| `hf_79` | Forward Lunge | Dumbbell Lunges Walking |
| `reverse_lunge` | Reverse lunge | Dumbbell Rear Lunge |
| `step_up` | Step-up | Weighted Step-ups |
| `calf_raise` | Calf raise | Dumbbell Calf Raise |
| `hf_2` | Standard Push-Up | Weighted push-ups |
| `fedb_bodyweight_mid_row` | Bodyweight Mid Row | Renegade Row |
| `glute_bridge` | Glute bridge | Dumbbell Hip Thrust |
| `hf_87` | Hip Thrust | Dumbbell Hip Thrust |
| `fedb_single_leg_glute_bridge` | Single Leg Glute Bridge | Dumbbell Single-leg Hip Thrust |
| `wger_1913` | Unilateral Hip Thrust | Dumbbell Single-leg Hip Thrust |

**No twin (sticky kg only):** Cossack squat, Side split squats, Lateral Lunge, hamstring / sliding leg curls, Nordic curl, swings (Hip hinge already → deadlift).

**Not linked:** Dynamic side hold (not a side plank), Glute Bridge Single-Arm Press (combo), barbell Hip Thrust, seated DB calf raise (prefer standing).

## Behaviour

### Sticky added load

Today `workStateAfterLoggedSet` clears `addedLoadKg` to `0`, and `syncWorkState` reloads plan dose (usually 0). Change:

1. After a logged set of the **same** exercise, keep the previous `addedLoadKg`.
2. When advancing to a **different** exercise / slot, do not carry load; new work state uses `item.dose.addedLoadKg` (typically 0).
3. Mid-set ± and “Add your X kg” still edit `ActiveWorkState.addedLoadKg` as today.

### Add weight with twin

When the athlete taps **Add your X kg** (or equivalent first load) on work:

1. If `EXERCISE_GRAPH[current].weightedId` is set **and** profile equipment includes `dumbbell`, swap; otherwise sticky kg on the current move only.
2. `setDayExercise(programId, slotId, weightedId)`.
3. `replaceWorkMove` (reuse session work-adjust helper) for the live item; set `loadSwapFromId` to the previous exercise id.
4. Set `workState.addedLoadKg` to `state.addWeightKg`.
5. Keep **current set index**; do not reset the whole exercise to set 1.
6. No new status chrome in v1 (reuse paint of the new move name).

When already loaded (`addedLoadKg > 0`) and on a weighted move: ± only.

### Load → 0

When minus (or edit) brings `addedLoadKg` to 0:

1. If `loadSwapFromId` is set, restore that id via `setDayExercise` + `replaceWorkMove`, then clear `loadSwapFromId`.
2. Clear load.

### Resume / persistence

Session snapshot must keep `addedLoadKg`, current `exerciseId`, and `loadSwapFromId` so resume matches the screen.

## Data model

- Add optional `weightedId?: string` on `SeedExercise` / `Exercise` (link from unweighted → weighted only).
- Curated table lives in source (e.g. `src/data/weightedCousins.ts` or enrich step) and is applied when building / enriching the catalogue so `EXERCISE_GRAPH[id].weightedId` is available at runtime.
- Weighted twins get `requires: ["dumbbell"]` via equipment compile / curated equipment audit for new ids.
- **Weighted Step-ups**: empty wger equipment → curated equipment `requires: ["dumbbell"]` (covers KB + DB in Settings copy).

## Import

1. Allow **Dumbbell** (and empty-equipment / bodyweight-tagged rows that are map targets: Weighted Step-ups, Weighted push-ups) when the record name is a curated map target.
2. Do **not** broadly allow all Kettlebell rows in v1.
3. Dedupe / `WGER_SAME_AS_EXISTING` if a target collides with an existing library name.
4. Re-run catalogue generate + equipment compile so new ids land in `LIBRARY_CATALOGUE` with standards/timing from enrich (same path as other wger imports).

## Modules

| Area | Touch |
|------|--------|
| `src/session/setLog.ts` | Keep `addedLoadKg` in `workStateAfterLoggedSet`; optional `loadSwapFromId` on `ActiveWorkState` |
| `src/ui/sessionState.ts` | `syncWorkState` must not wipe an in-progress sticky load for the same slot/set; clear load when exercise/slot changes |
| `src/ui/sessionControls.ts` | Add-weight / ± hooks: twin swap + restore on zero |
| `src/ui/sessionWorkAdjust.ts` | Reuse `replaceWorkMove` + `setDayExercise` |
| `src/data/weightedCousins.ts` (new) | Curated unweighted → weighted map; apply onto catalogue |
| `src/data/wger/selection.ts` | Allow Dumbbell/Kettlebell + Weighted Step-ups; restrict to map targets for v1 |
| Equipment / enrich | `requires: ["dumbbell"]` on twins |
| Tests | Sticky load across sets; clear on next exercise; swap+Plan on add; restore on zero; many-to-one restore via `loadSwapFromId`; no swap without twin |

## Edge cases

- Athlete lacks `dumbbell` in profile: no twin swap; sticky kg on current move still allowed (today’s Add weight UX).
- Twin missing from graph (import lag): treat as no twin.
- Mid-set swap: keep set index; discard only if `replaceWorkMove` changes effort kind in a way that breaks the clock — same as Swap today.
- Last set of exercise with load: logged entry keeps `addedLoadKg`; next exercise starts unloaded.
- Plan write always (like Swap), including when restoring on zero.

## Out of scope

- Carrying load across different exercises in one session.
- Auto-linking by name similarity at runtime.
- Separate `kettlebell` equipment id (keep Settings `dumbbell`).
- Broad import of all 176 load-tagged wger rows.
- Side-squat / hamstring-curl twins (none usable in wger).

## Acceptance criteria

- [ ] Own GitHub issue; implement in worktree from `origin/dev`; PR targets `dev`
- [ ] Added load sticks across sets of the same exercise; does not stick to the next exercise
- [ ] Curated map applied; listed twins import with `requires: ["dumbbell"]`
- [ ] Add weight on a mapped unweighted move swaps to twin + Plan write; zero restores original
- [ ] All four glute/hip-thrust unweighted moves link to their Dumbbell twins
- [ ] Step-up ↔ Weighted Step-ups works
- [ ] Focused Vitest coverage for sticky load + swap/restore

## Why this shape

Sticky load fixes the real mid-session bug without inventing session-wide load state. Explicit `weightedId` links avoid brittle name matching (bridge ≠ thrust). Dumbbell-first twins match “Add your X kg” gear. Reusing `replaceWorkMove` / `setDayExercise` keeps Plan and live session aligned with existing Swap behaviour.
