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
| Core | anti-extension, compression, side plank, a second anti-extension move, glute (five slots, like the seed Abs / Core day, to stay in the 25–45 minute band) |
| Full body | one each of push-up, pull, single-leg squat, hamstring, anti-extension |
| Skill: ‹move› | the move's ladder first with the most sets, then the area's ladders it belongs to |
| Mobility | the existing mobility template |
| Joint care | the user's prehab list (part 3) |

**"Toward the goal" and "progression" are one mechanism.** Every ladder ends in a top move. A day with a target puts that ladder first and gives it the most sets; without a target every ladder simply advances.

**The generator chooses moves; it does not set training load.** Everything about dose comes from rules the library already has:

| What | Where it comes from |
|---|---|
| Starting step on a ladder | The same rule as the Library's "Generate plan" (`pickLevelAppropriateStep`): the first move at the athlete's tier, else the nearest tier. The tier is the highest effective tier of the ladder's members in memory (declared level, best reps, stored tier). Beginner with no data. |
| Reps | The planner's own tier-standard reps for this athlete and move (`applySkillDose`, target RIR 2 like every seed slot). The stored day is exactly what the session prescribes. |
| Sets | As in the seed days: first slot 4 (a skill day's first slot 5), the rest 3. |
| Rest | The library timing model (`resolveExerciseTiming`). |
| Warm-up, cool-down, time band | Borrowed from the seed day of the same area; a named skill borrows the seed day that trains the same ladder (a handstand day gets the wrist preparation). |
| Light day, deload, pain swap, advance, stall | Unchanged: the planner applies them to generated days like any other. |

**Block of days.** The days differ only in which move is chosen:

| Day | Choice |
|---|---|
| A (working) | the athlete's working step on each ladder |
| B (easier) | one rung easier where the ladder has one, else a sibling move at the same level |
| C (focus) | the goal's ladder first (with no goal, the weakest ladder), using different moves from A and B where the ladder has them |

Spacing: the first day goes at the requested index; each later day two positions after the previous one (or at the end of the queue).

**Audit (kept as tests in `tests/plan/planEngine.test.ts`).** Across nine scenarios (plain, poor sleep, deload, knee pain, joint history, no bar, results that trigger advance and stall, and combinations) every exercise, dose, rest and rule on the six seed days is identical before and after this change. For 30 generated days (five kinds, three days, two levels): all fit the 25 to 45 minute band, the stored preview equals the planner's prescription, and light-day and deload rules apply. The audit caught one fault, fixed before merge: a three-slot Core day ran 19 to 23 minutes, under the band, so the Core recipe now has five slots like the seed Abs / Core day.

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

**Exclusions** are a third reason a move is swapped out in `chooseSuitableExercise` (with joint avoid and missing gear), and a filter in generation. Joint and gear swaps keep their original rule exactly; only an excluded move uses a ladder-aware order (same ladder, nearest difficulty, never harder when an equal or easier move exists). Excluding from the plan also writes the list, so the Library shows the same state.

**Plan page (part 2), as built:** "Coming up", a list of day panels in the Library's panel style. Today is open by default; opening a day shows the planner's real session for a normal morning (`previewDay` calls `planSession`, so level, joint, gear, exclusion, deload and variety rules are all applied), not template defaults. Per exercise: **Swap** (up to eight choices, same ladder and nearest level first, described in the Library's words) and **Not for me** (adds the move to the exclusion list and puts the best substitute in the slot at once). Per day: **Make this day** (an area or a named skill: the day becomes a new block's first day and the other two are spaced after it), Earlier, Later, To the end (today only), Remove. **Add days** adds a block after today, or one Mobility day at the end. The last action is reported in a status line.

Removed with the old editor: the per-template "Procedure" editor, its 42 dropdowns of 335 options each, the area and muscle picker filters, "Reset to default" and the per-day type dropdown. Editing a seed day's move changes every day of that seed type (they share one list); generated days are edited individually.

Measured in Chrome at 390×844: page height 2,524px before, 1,694px after with today open; dropdowns 42 before, none after; every control at least 44px tall (queue controls were 40px).

**Library and Joint care (part 3), as built:**

- **Library:** an excluded move shows "Excluded by you" in the list (in place of its joint badge) and a **Not for me** switch on its page, which excludes or restores it. The Show panel gains **Excluded by me** (offered once something is excluded), listing exactly the excluded moves, stretches included. It is the same list the Plan page writes to.
- **Joint care day** (`plan/jointCareDay.ts`): built from the prehab list for the declared joints, taking turns between joints, gear-aware and never an excluded move. It is dosed like the seed Mobility day, not by anything new: every slot pinned (the planner never advances or regresses it), 2 sets, 10 reps or a 30 second hold, RIR 3, rest from the library timing model, the Mobility day's warm-up, and its 10 to 20 minute band (moves are dropped from the end until the session fits). With no joint history it is "Joint care · general" (shoulder and hip stability) and the page says so. It can be added from the Plan page ("Add days", one day) and chosen in Today's "Train something else" panel.
- The care move inside area days (part 1) now uses the same pinned Mobility-day dose.
- The issue asked for 10 to 15 minutes; the library's own band for this kind of day is 10 to 20, so that band is used. Measured: 13 to 19 minutes across five joint combinations.

## Testing

Pure functions throughout, tested without a DOM: recipes, step choice at different levels and results, block emphasis and spacing, registry resolution (seed, generated, unknown), exclusions in generation and in the planner. Browser checks at 390×844 for the page changes, before and after.

## Out of scope

Calendar dates (the queue stays an ordered list); progression rules themselves; a Joint care day for people with no joint history beyond a general care day.
