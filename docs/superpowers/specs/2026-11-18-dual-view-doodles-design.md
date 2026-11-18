# Dual-view doodles

Issue: #174 · Builds on: [doodle rig v2](2026-11-15-doodle-rig-v2.md), [authoring guide](../../doodles-authoring.md)

## Problem

A doodle is one 2D view, and the rig keeps every bone at full length in that view. A move that travels in two planes at once can't be shown honestly: the archer push-up's straight arm goes out to the side, a fire hydrant's knee lifts sideways from all fours, a curtsy lunge's back leg crosses behind. 27 moves were left out of #138 and #141 for this reason.

Drawing a second 2D view with full-length bones doesn't fix it. Seen from the front, a plank's torso points at the viewer and must shrink to a stub; at full length it stands upright and reads as a squat (comparison drawing in the #174 thread).

## Model

Every bone has one true length L. A view draws two of its three components:

| View | Horizontal on screen | Vertical on screen |
|---|---|---|
| side | forward (x) | height (y) |
| front | sideways (z) | height (y) |

with dx² + dy² + dz² = L². Height is shared, so the views can't disagree about it; each view draws the bone at its own, usually shorter, length. A bone with no sideways component looks exactly as it does today in the side view.

z is the figure's sideways axis: negative towards the near side (the side-view camera), positive towards the far side. The front panel draws z as screen x, so the near side is on the viewer's left and the far side on the right. That is the same convention the existing `view: "front"` doodles use (near shoulder at −22, far at +22), so authors don't learn a second one. A test pins it: a far hand with positive z is drawn right of the head.

## Scope

- Opt-in per move: `views: ["side", "front"]`. A plain push-up stays one side view; the archer push-up gets both.
- The judge decides, not the drawer (see Process). Every move is drawn in one view first; a second view is added only when the independent reviewer asks for it.
- Existing ~300 specs are unchanged and render byte-identical.
- First delivery: rig, renderer, validator, cards, the review-process change, and the archer push-up (`hf_6`) as the proof move, run through the full process (one view → judge → second view if asked).
- Follow-up batch (not this PR): the moves left out of #138 / #141 go through the same process. Expected to need a second view: archer pull-up, wide / Maltese / side-to-side push-ups, commando pull-up, fire hydrant (+ circles), clamshell / reverse clamshell, frog pumps, seated hip abduction, curtsy and crossover reverse lunge, plank jacks, lateral plank walk, plank hip dips.
- Out: twisting moves (windshield wiper, side plank with rotation, front kickthrough, heel touchers). A sideways offset doesn't show rotation of the torso; leave them out rather than mislead.

## Process: one view first, the judge asks for a second

1. **Draw one view.** The drawer always draws the move in a single view (side, or front when the motion is lateral), as today. The drawer no longer leaves a move out just because it travels in two planes. It draws the best single view and notes in the report which plane it can't show.
2. **Judge.** The independent sceptical reviewer renders the cards and gives each move one of four verdicts:
   - **KEEP**: one view shows the move honestly.
   - **FIX**: one view is enough, but something is wrong (frame, joint, what it should be).
   - **ADD VIEW**: the move is right as far as it goes, but a second plane matters and one view misleads or hides it. The verdict names the missing view (front or side) and what it must show, e.g. "front: straight arm slides out to the side, chest over the working hand".
   - **DROP**: no pair of views shows it honestly (twists, rotations).
3. **Add the second view.** For ADD VIEW, a fix agent adds `views: ["side", "front"]` and the sideways offsets to the existing spec. It doesn't redraw the move from scratch. The side panel must still pass on its own.
4. **Judge again.** The reviewer re-checks only the moves that got a second view: both panels agree and the added view shows what the verdict asked for. Then KEEP, FIX or DROP.

A second view costs card width and attention, so the reviewer asks for one only when the single view would mislead, not to make a correct doodle richer. The authoring guide's drawer and reviewer prompts are updated to this process.

## Authoring

Unchanged for side-only specs. For a dual-view spec (only after an ADD VIEW verdict):

- Author facing +x as today. Any pinned point (`pelvis`, `chest`, `head`, `hands`, `feet`, `elbows.at`, `knees.at`) may take a third number, its sideways offset: `hands: { near: [10, 0, -70], far: [10, 0, 70] }`.
- A point given as `[x, y]` keeps the natural width of its chain: the shoulder's for an arm (±22), the hip's for a leg (±8), 0 for the spine.
- `elbows` / `knees` take an optional `out` (degrees): how far the bend plane rolls outward from the forward plane (0 = today's behaviour, 90 = the joint points straight out to the side, e.g. flared elbows at the bottom of a push-up).

The 2D `Point` type stays for side-only specs; pins accept `Point | Point3`.

## Solver (`src/doodles/rig.ts`)

- Internally every joint is `[x, y, z]`. Side-only specs get z from the fixed shoulder / hip offsets, so their (x, y) is exactly today's result.
- FABRIK and the two-bone solve work on 3-vectors. The bend sign is applied in the limb's bend plane: the plane through root and target that contains the forward-up direction, rolled by `out`.
- Spine solve is unchanged except that pelvis/chest/head may carry z (a hip shift in plank hip dips).
- Blending: limbs that swing blend each bone's direction by slerp (great-circle) instead of `lerpAngle`; planted ends still lerp. With all z equal to the natural offsets, slerp in the forward plane reduces to today's angle blend, so 2D output is unchanged.
- Turning round (`mirror`) is side-view only and not allowed with `views` (validator error).

Implementation note: keep the 2D path as the code path for side-only specs if the 3D generalisation can't be made byte-identical; the regression test decides.

## Rendering (`src/doodles/renderSvg.ts`)

- Side-only specs: unchanged.
- Dual-view specs: two panels in one SVG, side on the left, front on the right, same scale, one floor line under both, one SMIL clock. A small label under each panel ("side", "front") in the muted ink.
- Side panel: (x, y), far limbs at half opacity as today. Front panel: (z, y), both sides full strength; draw order by depth (the limb nearer the camera, i.e. larger x, on top).
- No zoom inset on dual-view specs; the brass highlight is drawn in both panels.
- The viewBox holds both panels with the existing padding. It fits the `.doodle` row (`width: 100%; max-height: 10rem`), which is height-limited and nearly screen-wide, so no CSS change.

## Validation (`src/doodles/validate.ts`)

- Bone lengths are checked in 3D (tolerance as today). Projected lengths are free.
- Floor: no joint below y = 0, which is shared by both views.
- Props, anatomy (joint ranges in the bend plane), arms through the head: as today, on the 3D figure / side projection.
- Both panels inside the viewBox.
- `views` together with `mirror` → error. `views` together with `view: "front"` → error.

## Tools

- `npm run doodles`: unchanged command; writes the dual-view SVG for opted-in specs.
- `npm run doodles:cards`: works unchanged (cards render the SVG); check that 8 frames stay readable at card width with two panels.
- Authoring guide: add a "Two views" section (sideways offsets, `out`, what stays out) and the one-view-first process. Drawer prompt: always draw one view, note the plane it can't show, don't leave a move out for that reason. Reviewer prompt: four verdicts (KEEP / FIX / ADD VIEW / DROP), ADD VIEW only when one view misleads. New prompt: adding a second view to an existing spec. Re-review prompt: both panels agree and the added view shows what was asked.

## Tests (Vitest, `tests/doodles/`)

1. Regression: every existing spec renders byte-identical to the SVG in `public/doodles` (or to a pre-change snapshot of `renderDoodleSvg`).
2. Solver: 3D bone lengths hold for a dual-view spec across all samples; a hand pinned 70 units sideways draws its arm shorter in the side panel than the arm's true length.
3. Front view orientation: the far hand with positive z is drawn to the right of the head.
4. Validator: `views` + `mirror` and `views` + `view: "front"` are rejected.
5. Archer push-up spec validates clean.

## Done when

- Acceptance criteria on #174 pass.
- Archer push-up taken through the process: drawn in one view, judged by an independent reviewer (expected ADD VIEW), second view added, judged again to KEEP.
- `npm run doodles`, `npx tsc --noEmit`, `npm run -s lint`, `npx vitest run` pass.
