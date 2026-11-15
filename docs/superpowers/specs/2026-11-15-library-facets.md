# Library facets: area, muscle bucket, muscle search, stretch filter

The Library's `regions` chips (core, legs, push, pull, skill, general) mix three axes: body area, movement and type. They stay as they are, because the planner's variety rotation reads `regions`. Three Library-only facets are derived from each move's **primary** muscles (`src/library/facets.ts`) and never change `regions`.

## Decisions

| Question | Decision |
|---|---|
| Which muscles count? | **Primary only.** Secondary and stabiliser roles are ignored (a pull-up is Back, not Arms). |
| How many muscle buckets? | **Eight**: Chest, Back (lats, middle back, traps), Shoulders, Arms (biceps, triceps, forearms), Core (abdominals, lower back), Glutes & hips (glutes, abductors, adductors), Quads, Hamstrings & calves. Neck has no bucket (its few moves are mobility drills). |
| Where do they appear? | Library list (chips in an "Area & muscle" panel that opens while a facet is active) **and** the Plan editor pickers (two selects above the procedure; a slot's current pick always stays listed). |
| Upper body, skill, planks, hanging raises? | **Default, not yet confirmed:** area follows primary muscles. Upper and lower primaries together = Full body. A core move counts as Core unless a chest, back, shoulder or arm muscle is also primary, in which case it is Upper. Skill moves therefore land in Upper (13 of 14 have an upper primary). |

## Area rule

`upper` if any upper bucket is primary and no lower; `lower` the reverse; `full` if both; `core` if only core; none otherwise. Current counts: 254 upper, 225 lower, 107 core, 19 full, 4 none (neck drills). A test pins that only neck moves lack an area.

## Text search

The search box also matches primary muscle names, the bucket labels, the area labels ("upper body") and a few aliases (abs, lats, delts, glutes, hamstrings, …), for queries of three or more characters, so "ab" does not match every core move.

## Stretches (hidden by default)

The Library hides stretches by default. A row of three chips controls it: **No stretches** (default), **Stretches only**, **Everything**.

- **Definition** (`isStretch`, `src/library/facets.ts`): a mobility move that is a static hold, or any mobility move with "stretch" in its name (dynamic stretches such as World's Greatest Stretch included). Static holds that are really strengthening, neck or balance work are excluded by a short name list: wrist load, neck isometrics, chin tuck, head tilts and turns, pelvic tilts, single-leg balance, deep squat hold. Currently 149 of 609 moves.
- **Mobility drills stay visible** (hip circles, CARs, leg swings, cat-cow, thoracic rotation) and so do mobility moves used as prehab (side-lying external rotation, band pull-apart with external rotation). Only stretches are hidden.
- **Searching never dead-ends:** while stretches are hidden and a search has hidden matches, a line under the chips reads "N stretches match — show".
- **"For my joints" ignores the filter:** that list is curated and deliberately includes stretches (for example the serratus wall slide stretch).
- **Plan editor:** unaffected, since mobility moves are never plannable.
- The logic lives in `src/library/results.ts` (`selectLibraryResults`), a pure function that the view calls and the tests cover.

## Filter layout (three panels)

The old region chips (All, core, legs, push, pull, skill, general) are gone from the Library, along with their code. The filters now live in **three panels that look and behave the same** (`src/library/filterPanels.ts`):

| Panel | Contents |
|---|---|
| **Show** | For my joints (only with joint history), Only my gear, and the stretch choice (No stretches / Stretches only / Everything) |
| **Area & muscle** | All areas + four areas; All muscles + eight buckets |
| **Level** | All levels + beginner, intermediate, advanced, elite |

- All three are collapsed by default. A panel opens by itself while something in it is active, and the summary says what: "Show · my gear, stretches only", "Area & muscle · Upper body, Chest", "Level · Beginner". The default stretch choice (No stretches) does not count as active.
- A panel the user opens stays open across repaints (remembered in the view), so tapping a chip never snaps it shut.
- The "N stretches match — show" hint sits under the search box, outside the collapsed panels, so it is always visible.
- Same chip style everywhere: the levels row no longer has its own smaller buttons.
- The Novice chip is removed: no move has that level (it exists only for the athlete's own tier), so it always filtered to nothing.
- The region filter is removed from search too (`LibraryQuery.region`); the planner is unaffected because it reads each exercise's `regions`, not the query.

## Known limits

- About 37% of moves have a single muscle entry, mostly wger and free-exercise-db stretches; some are wrong (Bent-Leg Hamstring Stretch maps to quads, Hip Crossover to quads). Strength moves are mostly right, so the filters are good for working moves and shaky for stretches. Fixing the muscle data is a separate piece of work.
- No facet counts are shown yet.
