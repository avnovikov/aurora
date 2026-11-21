# Design: Kettlebell counts as dumbbell for weighted cousin swap

**As** an athlete who owns a kettlebell but not a dumbbell, **I want** Add weight on a mapped unweighted move to swap me onto the weighted twin, **so that** load and the named move stay consistent the same way they do for dumbbell owners.

Related: #251 / `docs/superpowers/specs/2026-11-21-session-added-load-sticky-weighted-cousins-design.md`.

## Decisions

| Topic | Choice |
|-------|--------|
| Scope | Cousin swap gear check only |
| Equivalence | Owning `kettlebell` satisfies a twin that requires `dumbbell` |
| Direction | One-way for this fix: kettlebell → counts as dumbbell (not needed the other way for cousins; twins require dumbbell) |
| Library / plan / Body | Unchanged — still use real `missingGear` with profile equipment as stored |
| Twin catalogue | Keep Dumbbell-named twins; do not retarget to goblet / KB squat rows |
| Settings UI | Keep separate Dumbbell and Kettlebell chips |

## Behaviour

When Add weight crosses 0 → load and the current move has a `weightedId` twin:

1. Build the equipment list used **only** for `athleteOwnsGearFor` in `sessionLoadCousin.ts`.
2. If the athlete’s profile includes `kettlebell` and does not include `dumbbell`, use `[...equipment, "dumbbell"]` for that check.
3. If the twin is then gear-ok, swap live work + Plan write as today; otherwise sticky kg only.

| Profile | Mapped unweighted + Add weight |
|---------|--------------------------------|
| Has `dumbbell` | Swap to twin (unchanged) |
| Has `kettlebell` only | Swap to same twin (new) |
| Has neither | Sticky kg; no swap (unchanged) |

## Implementation sketch

- Touch: `src/ui/sessionLoadCousin.ts` (`athleteOwnsGearFor` or a tiny helper next to it).
- Do **not** change `src/safety/gear.ts` global `isOwned` / `missingGear`.
- Do **not** edit curated equipment rows / `orRequires` for this behaviour.

## Tests

- KB-only athlete: Add load on `bodyweight_squat` (or `hip_hinge`) → swaps to twin, sets `loadSwapFromId`.
- Body-only athlete: still no swap (existing case).
- Step-up + KB-only: still swaps (existing `orRequires` case remains green).

## Out of scope

- Global dumbbell ↔ kettlebell alias for Library, planning, or Body filters.
- Merging Settings into one “Dumbbell or kettlebell” chip.
- Preferring a kettlebell-named twin when only KB is owned.
- Carrying added load across different exercises.

## Acceptance criteria

- [ ] Own GitHub issue; implement in worktree from `origin/dev`; PR targets `dev`
- [ ] KB-only profile swaps on curated cousins the same as dumbbell
- [ ] Body-only profile still sticky-kg only
- [ ] Library / plan gear filtering behaviour unchanged
- [ ] Focused Vitest coverage in `tests/ui/sessionLoadCousin.test.ts`
