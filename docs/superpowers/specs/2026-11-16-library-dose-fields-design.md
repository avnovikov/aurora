# Library dose fields — warmup expands, work uses tiers

Status: approved for implementation (2026-11-16).

## Problem

Warm-up timer stations sometimes show prescriptions like `2 × 20 s each side` in cues, but the session runs one blob timer with a single halfway side-switch. The UI never expands multi-round / per-side doses into separate timed steps. Separately, some moves (e.g. glute bridge) are ambiguous between hold and reps, and animated doodles can lag on first paint.

## Decisions

| Topic | Decision |
|---|---|
| Where dose lives | **Library** owns structured dose fields. Descriptions are pre-parsed into fields; runtime does not parse cue text. |
| Warm-up / cool-down | Dose **only** from Library prescription. Planner/stations do not override. Expand into one timed step per segment. |
| Work | Dose from **tier standards** (`applySkillDose`). If a description min/max exists, **clamp** the pick into that band. |
| Effort | Explicit `hold` \| `reps` on the exercise (and on warm-up stations that need a mode). Dual-use moves (e.g. glute bridge) must declare which mode this use is. |
| Side plank (warmup) | Always the warm-up prescription (e.g. `2 × 20 s` per side → 4 timers). Tier standards stay for work / skill ceilings. |
| Doodles | On warm-up (and cool-down) start, pre-render all station doodles into cache. Invalidate only when the colour palette / theme changes. Optional: add a few more out-of-the-box doodle specs. |

## Library fields

```ts
/** Pre-parsed from description / curated dose text. */
interface ExercisePrescription {
  /** How this library row is performed when prescribed. */
  effort: "hold" | "reps";
  rounds: number;           // ≥ 1
  amountMin: number;        // seconds or reps
  amountMax: number;        // ≥ amountMin
  scope: "total" | "perSide";
}
```

- Stored on the Library exercise (seed + enriched catalogue) as optional `prescription`.
- Pre-parse once at catalogue build / enrich (and hand-author for seed / warm-up sources of truth).
- Free-text cues may still *display* the human string; they are not the runtime source.

## Warm-up expansion

Given `prescription` with `effort: "hold"`:

- Segment count = `rounds × (scope === "perSide" ? 2 : 1)`.
- Each segment hold = `amountMin` (or a single chosen value in `[amountMin, amountMax]` — warm-up uses the authored warm-up value when present on the station only as a *selection inside the band*, not an override outside it).  
  **Revision from discussion:** stations must not override Library dose. Warm-up lists reference exercise ids; hold length and segments come from `prescription`. If a station needs a different dose, that is a different Library row (or a named prescription variant), not a silent `holdSeconds` override.
- `perSide` mid-timer switch is replaced by **separate steps** (left / right labels) when `scope === "perSide"`.
- `effort: "reps"` warm-up stations run a rep-oriented station (not a fake hold timer), or a short window derived only if prescription says hold.

Practical v1 compromise (ship without renaming every station):

1. Add `prescription` on Library exercises used in warm-up.
2. `buildWarmupView` expands from `prescription` when present.
3. Remove conflicting `extraCues` that imply a different structure; keep `holdSeconds` only as fallback when `prescription` is absent (legacy stations), then migrate the mismatched ones (`hf_100`, `hf_99`, multi-hold cues).

## Work dosing

1. `applySkillDose` picks reps/hold seconds from tier standards.
2. If `prescription` exists, clamp: `clamp(working, amountMin, amountMax)`.
3. Seed template doses must not sit outside standards ∩ prescription.

## Doodle cache

- API: `prefetchDoodles(idsOrPaths: string[]): void` (or warm-up-specific helper).
- Call when a warm-up / cool-down sequence starts, with every station’s doodle id/path.
- Reuse existing `SVG_CACHE` in `doodleMarkup.ts`; expose prefetch that fills it.
- Clear cache when theme / palette tokens that affect `--doodle-*` change.

## Acceptance

- `hf_100` warm-up produces **4** timed steps of 20 s (L, R, L, R or equivalent), not one 90 s timer.
- Multi-round hold cues that gain `prescription` expand to N steps.
- Work doses for exercises with `prescription` never leave `[amountMin, amountMax]`.
- Effort mismatches (rep standards + hold-only timer with no prescription) are fixed or flagged in tests for the warm-up set.
- Warm-up start prefetches doodles; first station shows motion without a visible generate hitch when specs exist.
- `npm test` passes for touched areas.

## Out of scope (later)

- Full catalogue pre-parse of every “Hold 20–30 seconds” mobility line into `prescription`.
- Redesigning McGill work pyramids for side plank (work stays on tier standards).
- New doodle artwork beyond a small optional set.
