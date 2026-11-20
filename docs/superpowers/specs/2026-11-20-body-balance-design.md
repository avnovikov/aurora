# Body: balance first, design

Issue #234. Signed-off mock: [2026-11-20-body-balance-mock.html](2026-11-20-body-balance-mock.html) (Desk Studio job 20261120-1324-body-tab-neglect; Creative Director 8.75 for the figure screen; the user chose the caricature placed beside the headline). Caricature SVGs: [2026-11-20-body-balance-caricatures/](2026-11-20-body-balance-caricatures/). The mock uses DESIGN.md role names; the app uses `--on-accent` and `--control-edge`.

## Issue
Redesign the Body tab to answer **"what is the balance?"**, from the signed-off Desk Studio design (job `20261120-1324-body-tab-neglect`, Creative Director 8.75). The spec and mock are under `docs/superpowers/specs/2026-11-20-body-balance-*`.

## What changes
- **Headline about balance,** naming pairs and never body areas. For example: "Squat and hinge are even. Pushing has no pulling to match." A sub-line names the untrained areas.
- **A small caricature doodle beside the headline,** in the exercise-doodle style and animated, with reduced motion respected:
  - one figure per verdict (10 singles)
  - six two-pair combinations
  - "even" when all pairs are within 2:1, "untrained" when the window is empty
- **Five time windows** in one 48px segmented row: Overall · Month · 3 months · Half year · Year.
- **An anatomical front/back figure.** Each region inflates or deflates by level in fixed steps (Heavy 1.12, Moderate 1, Light 0.85, Not trained 0.85). Untrained regions are dashed see-through outlines inside a fixed body contour. No text sits on the figure.
- **A key and two lines:** "Not trained: …" and "Lighter than the rest: …".
- **Four full-width balance rows:** Push v Pull, Upper v Lower, Front v Back, Squat v Hinge. Each has a takeaway word (Even / Mostly X / No X), shares and a split bar. There are no comment lines under the rows. The accent goes only on the most uneven pair's word.
- **"Consider adding":** up to three real Library moves for the light side, tappable to open the exercise page, with Back returning to Body. Below them: "Your plan is not changed."
- **Footnotes** state the rules: within 2:1 is a coaching convention, and what each pair leaves out.
- **States:** empty, and a window with no sessions.
- **Removed:** raw scores, the top-8 list, the formula tagline, the wrapping mode buttons, joint care, and the "mate" copy.

## Rules
- **Levels:** Not trained = 0. Heavy, Moderate and Light are measured against the median of the trained areas, at ≥1.5×, ≥0.75× and >0.
- **Pairs from movement pattern:** Push = horizontal/vertical push, Pull = horizontal/vertical pull, Upper = push+pull, Lower = squat+hinge, Squat v Hinge.
- **Front v Back from muscle areas,** as defined in the spec.
- **Takeaway:** the smaller share is at least ⅓ → Even; above 0 → Mostly <bigger side>; 0 → No <smaller side>.
- **Caricature:** 0 uneven pairs → even. 1 uneven pair → its single figure. 2 or more → the combination for the two most uneven pairs if one exists, otherwise the most uneven pair's single figure.

## Acceptance criteria
- [ ] Pure model for levels, pairs, takeaway, headline text, move suggestions and caricature choice, with Vitest covering every rule, including the 2:1 boundaries and the combinations.
- [ ] The figure uses the existing silhouette regions; untrained regions are dashed; no text on the figure.
- [ ] Suggested moves exist in the Library, respect the user's equipment, and open the exercise page; Back returns to Body.
- [ ] Accent appears once; the screen works in all six palettes; targets ≥44px; reduced motion is respected.
- [ ] tsc, smell and the Vitest suite pass; screenshots in Rassvet and Alvorada.


## Strategy (from the product designer, with the user's overrides)

The user asked for this redo. It replaces strategy-v1.md, which put neglect first.

## Outcome
In under five seconds the user can see, for the chosen window:
- which kinds of training are even and which side is missing
- the same balance shown by the body figure's shape
- real Library moves for the missing side, underneath

## Flow
1. **Headline, balance first.** It names pairs only, never body areas, so it cannot overclaim.
   - Example: "Squat and hinge are even. Pushing has no pulling to match."
   - Sub-line: "Lats, middle back and traps had none in this window."
2. **Window control.** One row of five segments (Overall · Month · 3 months · Half year · Year), 48px tall, Overall selected. Under it a 13px caption: "Recent training, older sessions fade".
3. **Balance.** Three pattern pairs, each with its shares and a takeaway word.
4. **Figure.** Front and back side by side, large (about 300px tall).
   - Each region inflates or deflates with its level.
   - Not trained regions are dashed see-through outlines.
   - Below it: the four-step key, then "Not trained: Lats, Middle back, Traps, Lower back, Neck, Abductors" and "Lighter than the rest: Adductors, Calves, Forearms, Biceps".
5. **Consider adding.** Up to three Library moves for the light side of the most uneven pair, each with its name and the areas it trains. No doses. Below them: "Your plan is not changed." This section sits in the lower half.
6. **Tab bar** in flow, Body selected.

## Out
- Joint care, all of it.
- The 17-row neglected list.
- Raw scores and any ranking.
- Continuous sizing by raw score.
- Left v right: history stores no side.
- Planes of motion.
- (Front v Back is KEPT — see user override below.)
- Praise and motivation words: well, good, great, covered, strong, solid, keep it up.

## Balance rule (every pair comes from movement pattern)
- **What is counted:** each exercise in a finished session adds the session's setCount to its pattern, decayed in Overall. Footnote: "Shares count sets per session, not per move."
- **The pairs:**
  - Push v Pull = horizontal_push + vertical_push v horizontal_pull + vertical_pull.
  - Upper v Lower = the four push/pull patterns v squat + hinge.
  - Squat v Hinge = knee-dominant v hip-dominant.
- **Excluded from the pairs:** core, conditioning, mobility and skill. They still shape the figure. Footnote: "Core, conditioning and mobility are not in the pairs."
- **Takeaway word,** from the smaller side's share:
  - at least one third: "Even"
  - above 0 and under one third: "Mostly <bigger side>"
  - 0: "No <smaller side>"
- **Key line:** "Even means within 2:1. A coaching convention, not a medical norm."
- **Untrained area inside an Even pair:** if a primary area of an Even pair is Not trained, the tile adds a line, e.g. "Even. Lower back not trained."
- **Sample (Overall):**
  - Push v Pull 100 / 0, "No pulling".
  - Upper v Lower 52 / 48, "Even".
  - Squat v Hinge 45 / 55, "Even", plus "Lower back not trained".


**USER OVERRIDE (after v2 strategy): keep Front v Back.** Four pairs: Push v Pull, Upper v Lower, Squat v Hinge, **Front v Back**.
- Front v Back comes from muscle areas, the v1 definition: Front = chest, abdominals, quadriceps, biceps; Back = traps, lats, middle back, lower back, glutes, hamstrings, calves, triceps. Shoulders, forearms, neck, adductors and abductors are left out (footnote). Same takeaway rule (2:1).
- Sample, Overall: Front v Back 58 / 42, "Even". Its tile also notes "Upper back not trained", because lats, middle back and traps are all Not trained.
- On the figure, the front view vs the back view is this pair made visible.

## Level rule (drives the words, the shading and the size)
- Not trained = 0 in the window.
- m = the median score of the trained areas.
  - Heavy: 1.5m or more.
  - Moderate: 0.75m up to under 1.5m.
  - Light: above 0 and under 0.75m.
- If only one area is trained, it is Moderate.
- Key line: "Compared with your other trained areas in this window."

## Inflate / deflate figure
- **Four fixed steps.** Each region polygon is scaled about its own centroid:

  | Level | Scale | Look |
  |---|---|---|
  | Heavy | 1.12 | fuller |
  | Moderate | 1.00 | as drawn |
  | Light | 0.85 | thinner |
  | Not trained | 0.85 | no fill, 1px dashed controlEdge outline, see-through |

- **Body contour.** A 1px edge-coloured contour of head, torso and limbs never scales, so regions visibly swell past it or shrink inside it.
- **Overlap.** Heavy is capped at 1.12. Paint Light first and Heavy last.
- **Pairs.** Left and right regions mirror each other.
- **Four channels, never colour alone:**
  - size
  - fill brightness in one hue: foreground at about 90%, 60% and 35%, and none
  - solid or dashed outline
  - words
  - No hue changes, so it works in all six palettes and in greyscale.
- **Key swatches** are drawn at their real step size and outline.
- **Animation:** 300ms ease-out on a window change; none with reduced motion.
- **Sample effect:**
  - broad chest and shoulders
  - full glutes
  - thin biceps and calves
  - a hollow, dashed upper back and lower back

## Tone
- **Order:** even, then missing, then moves.
- **Allowed words:** "even", "no pulling", "mostly push", "lighter than the rest", "not trained", "consider adding".
- **Sample moves** (sentence case, no doses, mark them data-sample):
  - Inverted row (Lats, Middle back)
  - Band pull-aparts (Traps, Middle back)
  - Kneeling Superman (Lower back). "Superman" keeps its capital as a proper noun.
- **Move selection:**
  - a pattern on the light side
  - at least one primary area that is Not trained or Light
  - ordered by how many such areas the move covers
  - at most three moves

## Accent
- Once, on the takeaway word of the most uneven pair ("No pulling").
- None when all three pairs are Even.
- The figure never uses the accent.

## Page budget
About 1.5 screens, at most about 1260px:

| Part | Height (px) |
|---|---|
| headline | 150 |
| window control | 96 |
| pairs | 150 |
| figure, key and two lines | 420 |
| consider adding | 200 |
| tab bar | 56 |

## States
- **ready**
- **all even:**
  - headline "All three pairs are even in this window"
  - Consider adding lists only Not trained areas, or is hidden
- **a pair with neither side trained:** muted "Neither in this window"
- **window with no sessions:**
  - headline "No sessions in the last 30 days"
  - every region dashed at its Not trained size
  - pairs read "No data in this window"
  - "Try Half year"
- **empty,** `[data-state="empty"]`, CSS only:
  - the contour plus dashed regions
  - the control dimmed
  - "Body fills in after your first finished session."

## Three roughs (all muscles only)
- **A. Scales, report page.** Headline, window, three pair tiles in a row, the inflating figure at full width, then Consider adding. The tiles answer the question and the figure is the evidence.
- **B. Inflated body as hero** (recommended).
  - After the headline and window, the inflate/deflate figure fills most of the first screen, front and back side by side.
  - A dashed horizontal rule across both views is captioned with the Upper v Lower shares.
  - Push v Pull and Squat v Hinge appear as direct labels beside the views, e.g. "Pull: none" by the hollow upper back and "Hinge 55" by the glutes.
  - Then the key and the two lines, then the moves. There are no tiles.
- **C. Ledger with one diverging chart.**
  - Three rows centred on a midline, sides named at the ends, the takeaway word at the right.
  - The light side carries its moves inline: "Pull: none. Inverted row, Band pull-aparts".
  - A medium inflating figure and the key below. This is the shortest page.

## Measure
The share of Body visits showing an uneven pair after which the next finished session includes a move from the light side.
