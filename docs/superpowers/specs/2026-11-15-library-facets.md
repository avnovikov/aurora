# Library facets: area, muscle bucket, muscle search

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

## Known limits

- About 37% of moves have a single muscle entry, mostly wger and free-exercise-db stretches; some are wrong (Bent-Leg Hamstring Stretch maps to quads, Hip Crossover to quads). Strength moves are mostly right, so the filters are good for working moves and shaky for stretches. Fixing the muscle data is a separate piece of work.
- No facet counts are shown yet.
