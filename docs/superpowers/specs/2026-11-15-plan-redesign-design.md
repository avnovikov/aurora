# Plan redesign: area days from progression ladders (design)

Issues: #42 engine, #43 Plan page, #44 Library exclusions and Joint care day. This spec covers all three so they fit; each ships as its own PR.

## What the user asked for

The Plan page is "more just to see how and what". There are really two plans: **what area comes next**, and **a preview of the exercises on one day**. The page should be read first: look at what is coming, tap a day to see its exercises. Two quick edits: "I want upper body on that day", and "drop an exercise I am uncomfortable with and give me a substitute". The days must follow a progression toward a goal and use previous results and level, generated as a block of two to three days with the first inserted.

Decisions made in the brainstorm:

| Question | Decision |
|---|---|
| Main purpose of the page | Read first; edit occasionally |
| What "Upper body today" means | Days built from progression ladders (not an arbitrary mix), a block of 2–3 generated days, the first inserted where asked, the rest spaced down the plan |
| Dropping an exercise | **Excluded for good.** One persistent exclusion list; the planner never uses an excluded move; it can be excluded from the plan and managed (restored) in the Library |
| Day types | Upper body, Lower body, Core, Full body, **Skill: ‹named move›** (any hard exercise), Mobility, Joint care |
| Joint care | **Both:** a care move inside matching area days by default, and a separate light Joint care day |
| Delivery | Three parts, in order: engine, Plan page, Library exclusions plus Joint care day |

## Progression approach

An area day is a fixed **recipe of movement ladders**, each slot filled with the athlete's **current step** on that ladder. The app already has about 22 ranked ladders (easy to hard) and per-exercise memory (tier, best reps, sessions at standard), and the planner already advances a move when the standard is met and regresses it after a stall. The generator only chooses the *starting* step; it does not re-implement progression.

| Area | Ladders (slot per ladder) |
|---|---|
| Upper body | push-up, pull, overhead push, row (+ shoulder care move) |
| Lower body | single-leg squat, hamstring, glute, calf (+ knee or hip care move) |
| Core | anti-extension, compression, side plank |
| Full body | one each of push-up, pull, single-leg squat, hamstring, anti-extension |
| Skill: ‹move› | the move's ladder first with the most sets, then the area's ladders it belongs to |
| Mobility | the existing mobility template |
| Joint care | the user's prehab list (part 3) |

**"Toward the goal" and "progression" are one mechanism.** Every ladder ends in a top move. A day with a target puts that ladder first and gives it the most sets; without a target every ladder simply advances.

**Current step** for a ladder: the hardest plannable member (gear owned, safe for joint history, not excluded) whose difficulty does not exceed the athlete's tier on that ladder; the tier is the highest of the members' tiers in memory (the Library's family cascade already raises easier members). With no data it is Beginner.

**Block of days:**

| Day | Emphasis | How it differs |
|---|---|---|
| A | strength | working step on each ladder, 4 sets |
| B | volume | one step easier where one exists, 3 sets (an easier move means more reps at the tier standard) |
| C | target or weakest | the target ladder first; with no target, the weakest ladder first; a different member from A where possible |

Spacing: the first day goes at the requested index; the others at every second position after it (ending at the queue's end).

### Evidence and its limits

- Training frequency matters little once weekly volume is matched (Schoenfeld 2019, Journal of Sports Sciences, 25 studies; the earlier 2016 analysis favoured twice a week over once). So 2–3 days per area per week is sound and spacing is not critical.
- Hard-and-easy variation versus steady linear progression gives the same strength gains (Harries 2015, JSCR; Grgic 2017, PeerJ). Varying days is a choice for interest and recovery, not a proven advantage.
- "Add reps, then move to a harder variation" for bodyweight training has no trial evidence found; it is coaching convention, as in the Library evidence doc.

## Architecture

**Generated days are `SessionTemplate`s** stored under their own ids (`day_…`) in a `planDays` store, and resolve through the same `resolveTemplate` as seed days. Everything that reads the queue (Today, Progress, schedule override, Library targets, variety rotation) already speaks `SessionTemplate`, so nothing downstream changes shape. Generated days do not repeat; completing one removes it from the queue and the store prunes unreferenced days.

New units, each with one purpose:

| Unit | Does | Depends on |
|---|---|---|
| `plan/dayKinds` | day kinds, labels, seed focus to kind, `dayTitle`, area recipes | nothing |
| `plan/exclusions` | persistent exclusion list | storage |
| `plan/planDays` | generated-day store; `findTemplate`, `isKnownTemplate` | storage |
| `plan/ladderSteps` | current step per ladder from level and results | ladder index, catalogue |
| `plan/generateBlock` | recipes, steps, emphasis, spacing; pure | the above |

Seed days keep their ids and work untouched; `dayTitle` shows them under area names (Legs: Lower body, Abs / Core: Core, Bars: Upper body, Skill: Skill: Freestanding handstand), so existing queues migrate without rewriting stored data.

**Exclusions** are a fourth reason a move is swapped out in `chooseSuitableExercise` (after joint avoid, missing gear), and a filter in generation. Excluding from the plan also writes the list, so the Library shows the same state.

**Plan page (part 2):** a timeline of days; tapping a day expands the planner's real output for it (not template defaults), with per-exercise "Not for me" (exclude and substitute) and "Swap"; "Make this day…" and "Add a block" pick an area and generate. Same look as the Library and Today: panels, chips, toggles, labelled groups, 44px targets.

**Library and Joint care (part 3):** Excluded mark and Exclude / Restore; an Excluded choice in the Show panel; the Joint care day generated from `prehabFor`, 10–15 minutes at light dose.

## Testing

Pure functions throughout, tested without a DOM: recipes, step choice at different levels and results, block emphasis and spacing, registry resolution (seed, generated, unknown), exclusions in generation and in the planner. Browser checks at 390×844 for the page changes, before and after.

## Out of scope

Calendar dates (the queue stays an ordered list); progression rules themselves; a Joint care day for people with no joint history beyond a general care day.
