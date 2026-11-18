# Drawing doodles

Doodles are animated SVG stick figures generated from TypeScript pose specs. Never hand-draw an SVG.

## Tools

| Command | What it does |
|---|---|
| `npm run doodles:missing [-- body,bar,…]` | Ranks the moves the planner schedules that have no doodle (seed, area, skill and joint care days, every level, three times through). Start here when choosing what to draw. |
| `npm run doodles` | Validates every spec and writes `public/doodles/doodle-<slug>.svg` and `src/data/generated/doodleMap.ts`. It does not delete the SVG of a removed spec: `git rm` it. |
| `npm run doodles:cards -- <outDir> <id>…` | One PNG per move: the Library text and 8 frames of the animation. Read every card and look at every frame. Cards draw the SVGs in `public/doodles`, so run `npm run doodles` first. `DOODLE_CARD_FRAMES=24` shows fast moments such as a turn. |

## Conventions

- `src/doodles/rig.ts` holds the types, bone lengths and solver. The registry `DOODLE_SPECS` is in `src/doodles/specs.ts`. Each batch is a `specsBatch<X>.ts`, which imports from `./rig` only, never `./specs`.
- Floor at y = 0, up is negative, and the side-view figure faces +x. Pin only the joints that define the move.
- **Depth.** In side view the far arm and far leg are drawn at half opacity behind the body, and the near limbs are drawn bright on top. Use this to show depth:
  - A bright near knee crossing the near arm reads as passing *in front of* it (outside the arm), not through it. That is how the Spiderman plank is drawn: knee to the outside of the elbow. (Not the Spiderman push-up: at push-up depth the elbow is on the torso line, so the thigh tangles with it.)
  - A pale far leg crossing behind the bright standing leg reads as passing *behind* it.
  - So crossings between limbs are fine when the near/far choice puts the right limb in front. The validator only rejects limbs through props and arms through the head.
  - Pick which side moves (near or far) so the limb that is in front in real life is the bright one.
- In front view both sides are drawn at full strength.
- **Turning round.** A side-view keyframe with `mirror: <x>` is drawn reflected about that line, so the figure faces −x. Author it facing +x as usual. Between a mirrored and an unmirrored keyframe the figure turns: it narrows to front-on and opens out facing the other way. Joint ranges are checked as authored; the mid-turn samples skip the bone-length and joint-range checks. Bench Jump uses it for "turn around and jump back": the jump back is the same keyframes mirrored about the bench. Keep the arms forward around a turn, or the turn won't show (a figure standing with arms down looks the same both ways).
- In a single view the rig keeps every bone at full length and cannot shorten a limb pointing at the viewer, so motion straight toward the camera (fire hydrant from the side, a lateral plank walk) doesn't show in one view. Draw the best single view anyway and say which plane it misses; the judge decides whether it needs a second view (see "Two views"), where foreshortening is correct.
  - A knee that bends toward the camera is the common case: in front view any lowering throws that knee 40–60 units sideways (it reads as a lateral lunge), and in side view the crossing of a Dragon Squat or curtsy lunge is sideways and invisible. These are the typical ADD VIEW cases.
  - A side-view knee that travels out to the side (Spiderman) has to swing forward under the hip, with the foot lifted, on its way to the elbow. Keep that frame brief so it doesn't read as kneeling.
- Props: bar, box, parallelBars, parallettes, plus an optional `band` between the thighs. A straight-arm support on low parallettes reads as sitting on a stool: draw it on dip bars.

## Two views (only when the judge asks)

Every move is drawn in **one view first**. A second view is added only when the independent reviewer gives it an **ADD VIEW** verdict, because one view hides or misleads about a plane that matters (archer push-up: the straight arm slides out to the side). A plain push-up stays one view.

- Opt in with `views: ["side", "front"]` on the spec. The figure is solved in 3D and drawn twice, side panel left and front panel right, same scale, one clock. The front panel looks at the figure's face: near side (z < 0) on the viewer's left, far side on the right.
- Author facing +x in side view as usual, then give a keyframe `sideways` positions (absolute z): `sideways: { hands: { far: 90 }, feet: { near: -40 }, elbows: { near: { out: 70 } }, knees: { far: { at: 60 } }, pelvis: 0 }`. Anything not given keeps its natural width: shoulders ±22, hips ±8, spine at `pelvis` (default 0).
- `out` (degrees) rolls a knee's or elbow's bend outward from the forward plane: 0 is today's bend, 90 points the joint straight out to the side (flared elbows, a fire-hydrant knee).
- Each bone keeps its true length in 3D, so a limb that goes sideways is drawn **shorter in the side view**. That's correct, not a bug.
- **Pin the chest** when hands go wide. Without it the 2D spine leans as if the hands were straight ahead and the arm can't reach (`hands.far unreachable`).
- Props in two views: `bar` and `box` only. A sloped bench drawn as short bar strokes (`slopedBench` in `specsBatchAD.ts`) shows end-on as the board's outline, and its thin posts as two legs. No `mirror` (turning round) and no `view: "front"` together with `views`.
- Still out: twists and rotations of the torso (windshield wiper, side plank with rotation, kickthrough). A sideways offset doesn't show rotation.

## Prompt: drawing a batch

> You are adding animated stick-figure doodles for exercises in the Aurora calisthenics app. Work only in the worktree `<path>` (branch `<branch>`). Do not touch other worktrees, never use git stash, do not push.
>
> Read `docs/doodles-authoring.md`, `src/doodles/rig.ts`, the top of `src/doodles/specs.ts` and the existing batch files closest to your moves. The move's text is in `src/data/generated/descriptions.ts`, and its gear is in `src/data/generated/equipment.ts`. Draw what the text says. Don't edit the text, not even to suit the rig: if it looks wrong or can't be drawn as written, leave it and say so in your report.
>
> Create `src/doodles/specsBatch<X>.ts` exporting `BATCH_<X>_SPECS`, and register it in `DOODLE_SPECS`. Write one spec per id, with `id` set to the exercise id, `slug` in kebab case and `title` set to the name: `<ids>`.
>
> Quality bar: a wrong doodle is worse than none. Get the body position and gear right, and show the motion in the right plane, big enough to read. Use near/far depth (see the authoring doc) for limbs that pass in front of or behind each other. Render cards for every id, read every PNG, and iterate. Always draw **one** view (side, or front when the motion is lateral). Don't leave a move out just because it travels in two planes: draw the best single view and say in your report which plane it can't show; the judge decides whether it needs a second view. Leave a move out only if it twists or rotates the torso, or no view shows its main motion at all, and say why.
>
> Finish: `npm run doodles` with no errors, `npx tsc --noEmit`, `npm run -s lint` and `npx vitest run`. Commit as `feat(doodles): batch <X> — N new doodles`. Report ids done, ids left out with reasons, text fixes and doubts.

## Prompt: independent review

> You are an independent, sceptical reviewer of new doodles: you didn't draw them. Read and report only. Render `npm run -s doodles:cards -- <outDir> <ids>`, then read every PNG and every frame. Judge each move on four points:
> 1. Is it recognisably this move, with the right position, gear and plane?
> 2. Is the anatomy plausible in every frame? Remember that pale limbs are behind the body and bright limbs are in front. A bright limb crossing another is correct when it really passes in front (a Spiderman knee outside the elbow), so judge crossings by depth, not as tangles.
> 3. Is it readable at about 340 px wide?
> 4. Is a near-duplicate of another doodle right or misleading?
>
> Give each move one of four verdicts:
> - **KEEP**: one view shows the move honestly.
> - **FIX**: one view is enough but something is wrong: frame, joint, what is wrong and what it should be.
> - **ADD VIEW**: right as far as it goes, but a second plane matters and this view misleads or hides it. Name the missing view (front or side) and exactly what it must show, e.g. "front: straight arm slides out to the side, chest over the working hand". Don't ask for a second view to make a correct doodle richer.
> - **DROP**: no pair of views shows it honestly (twists, rotations).
>
> Report a table and the counts.

## Prompt: adding a second view

> You are adding a second view to doodles a reviewer marked ADD VIEW. Work only in the worktree `<path>` (branch `<branch>`). Read `docs/doodles-authoring.md` ("Two views"), `src/doodles/rig.ts` (`Sideways`) and `src/doodles/rig3d.ts`. For each id: edit its **existing** spec (don't redraw the move): add `views: ["side", "front"]` and keyframe `sideways` positions so the front panel shows what the verdict asks for: `<id: verdict text>`. The side panel must still read correctly on its own. Run `npm run doodles`, render cards, read every frame of both panels, iterate. Finish with tsc, lint and vitest, commit `feat(doodles): second view for N doodles`, and report per id what the front panel now shows.

## Prompt: re-judge after a second view

> You are an independent, sceptical reviewer. Read and report only. Render cards for `<ids>` and read every frame. For each move: do the side and front panels show the same moment (same heights, same timing)? Does the added view show what the ADD VIEW verdict asked for (`<id: verdict text>`)? Is anything foreshortened wrongly or tangled? Verdict: KEEP, FIX (panel, frame, joint, what it should be) or DROP.
