# Drawing doodles

Doodles are animated SVG stick figures generated from TypeScript pose specs. Never hand-draw an SVG.

## Tools

| Command | What it does |
|---|---|
| `npm run doodles:missing [-- body,bar,…]` | Ranks the moves the planner schedules that have no doodle (seed, area, skill and joint care days, every level, three times through). Start here when choosing what to draw. |
| `npm run doodles` | Validates every spec and writes `public/doodles/doodle-<slug>.svg` and `src/data/generated/doodleMap.ts`. It does not delete the SVG of a removed spec: `git rm` it. |
| `npm run doodles:cards -- <outDir> <id>…` | One PNG per move: the Library text and 8 frames of the animation. Read every card and look at every frame. |

## Conventions

- `src/doodles/rig.ts` holds the types, bone lengths and solver. The registry `DOODLE_SPECS` is in `src/doodles/specs.ts`. Each batch is a `specsBatch<X>.ts`, which imports from `./rig` only, never `./specs`.
- Floor at y = 0, up is negative, and the side-view figure faces +x. Pin only the joints that define the move.
- **Depth.** In side view the far arm and far leg are drawn at half opacity behind the body, and the near limbs are drawn bright on top. Use this to show depth:
  - A bright near knee crossing the near arm reads as passing *in front of* it (outside the arm), not through it. That is how Spiderman push-ups and planks are drawn: knee to the outside of the elbow.
  - A pale far leg crossing behind the bright standing leg reads as passing *behind* it: Dragon Squat, curtsy lunge.
  - So crossings between limbs are fine when the near/far choice puts the right limb in front. The validator only rejects limbs through props and arms through the head.
  - Pick which side moves (near or far) so the limb that is in front in real life is the bright one.
- In front view both sides are drawn at full strength, unless the spec sets `depth: "far-behind"`; then the far side is drawn pale, for moves where one leg passes behind the other.
- The rig keeps every bone at full length and cannot shorten a limb pointing at the viewer. Motion straight toward the camera (fire hydrant from the side, a lateral plank walk) still can't be shown. Leave those out rather than mislead.
- Props: bar, box, parallelBars, parallettes, plus an optional `band` between the thighs. A straight-arm support on low parallettes reads as sitting on a stool: draw it on dip bars.

## Prompt: drawing a batch

> You are adding animated stick-figure doodles for exercises in the Aurora calisthenics app. Work only in the worktree `<path>` (branch `<branch>`). Do not touch other worktrees, never use git stash, do not push.
>
> Read `docs/doodles-authoring.md`, `src/doodles/rig.ts`, the top of `src/doodles/specs.ts` and the existing batch files closest to your moves. The move's text is in `src/data/generated/descriptions.ts`, and its gear is in `src/data/generated/equipment.ts`. The name and common coaching are the authority, so fix wrong text in `data/curated/descriptions/*.json` and run `npm run -s descriptions:compile`.
>
> Create `src/doodles/specsBatch<X>.ts` exporting `BATCH_<X>_SPECS`, and register it in `DOODLE_SPECS`. Write one spec per id, with `id` set to the exercise id, `slug` in kebab case and `title` set to the name: `<ids>`.
>
> Quality bar: a wrong doodle is worse than none. Get the body position and gear right, and show the motion in the right plane, big enough to read. Use near/far depth (see the authoring doc) for limbs that pass in front of or behind each other. Render cards for every id, read every PNG, and iterate. Leave out a move only if no side or front view, depth shading included, shows it honestly, and say why.
>
> Finish: `npm run doodles` with no errors, `npx tsc --noEmit`, `npm run -s lint` and `npx vitest run`. Commit as `feat(doodles): batch <X> — N new doodles`. Report ids done, ids left out with reasons, text fixes and doubts.

## Prompt: independent review

> You are an independent, sceptical reviewer of new doodles: you didn't draw them. Read and report only. Render `npm run -s doodles:cards -- <outDir> <ids>`, then read every PNG and every frame. Judge each move on four points:
> 1. Is it recognisably this move, with the right position, gear and plane?
> 2. Is the anatomy plausible in every frame? Remember that pale limbs are behind the body and bright limbs are in front. A bright limb crossing another is correct when it really passes in front (a Spiderman knee outside the elbow), so judge crossings by depth, not as tangles.
> 3. Is it readable at about 340 px wide?
> 4. Is a near-duplicate of another doodle right or misleading?
>
> Give each move one of three verdicts: KEEP, FIX (with frame, joint, what is wrong and what it should be) or DROP. Report a table and the counts.
