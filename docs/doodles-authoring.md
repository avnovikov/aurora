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
- The rig keeps every bone at full length and cannot shorten a limb pointing at the viewer. Motion straight toward the camera (fire hydrant from the side, a lateral plank walk) still can't be shown. Leave those out rather than mislead.
  - A knee that bends toward the camera is the common case: in front view any lowering throws that knee 40–60 units sideways (it reads as a lateral lunge), so Dragon Squat and curtsy lunge stay out even with depth shading. In side view their crossing is sideways and invisible.
  - A side-view knee that travels out to the side (Spiderman) has to swing forward under the hip, with the foot lifted, on its way to the elbow. Keep that frame brief so it doesn't read as kneeling.
- Props: bar, box, parallelBars, parallettes, plus an optional `band` between the thighs. A straight-arm support on low parallettes reads as sitting on a stool: draw it on dip bars.

## Descriptions vs doodles

Curated Library text is owned by the **description fidelity judge**, not by the doodle drawer.

- Do **not** edit `data/curated/descriptions/*.json` while drawing.
- Draw from the exercise **name**, existing curated text in `src/data/generated/descriptions.ts`, and gear in `src/data/generated/equipment.ts`.
- If the text contradicts the move you would draw: **DROP/skip** that id (say why) or hand off a **description rewrite** pass first. Do not patch copy mid-batch.
- Gate: `npm run descriptions:fidelity` (also covered by `tests/data/fidelity.test.ts`). Hard fails must be rewritten from originals before doodles proceed on those ids.

## Prompt: drawing a batch

> You are adding animated stick-figure doodles for exercises in the Aurora calisthenics app. Work only in the worktree `<path>` (branch `<branch>`). Do not touch other worktrees, never use git stash, do not push.
>
> Read `docs/doodles-authoring.md`, `src/doodles/rig.ts`, the top of `src/doodles/specs.ts` and the existing batch files closest to your moves. The move's text is in `src/data/generated/descriptions.ts`, and its gear is in `src/data/generated/equipment.ts`. The name and existing curated coaching are the authority for how to draw. **Do not edit** `data/curated/descriptions`. If text contradicts the move, DROP/skip that id or stop for a description rewrite pass — do not rewrite copy while drawing.
>
> Create `src/doodles/specsBatch<X>.ts` exporting `BATCH_<X>_SPECS`, and register it in `DOODLE_SPECS`. Write one spec per id, with `id` set to the exercise id, `slug` in kebab case and `title` set to the name: `<ids>`.
>
> Quality bar: a wrong doodle is worse than none. Get the body position and gear right, and show the motion in the right plane, big enough to read. Use near/far depth (see the authoring doc) for limbs that pass in front of or behind each other. Render cards for every id, read every PNG, and iterate. Leave out a move only if no side or front view, depth shading included, shows it honestly, and say why.
>
> Finish: `npm run doodles` with no errors, `npx tsc --noEmit`, `npm run -s lint` and `npx vitest run`. Commit as `feat(doodles): batch <X> — N new doodles`. Report ids done, ids left out with reasons, and doubts. Do not list description edits — you must not make them.

## Prompt: description rewrite (before doodles if fidelity fails)

> You are rewriting curated Library descriptions so they pass the fidelity judge. Work only in the worktree `<path>` (branch `<branch>`). Do not touch doodle specs unless required for compile.
>
> Run `npm run -s descriptions:fidelity` and open `reports/description-fidelity.tsv`. For each **hard fail** id, rewrite the entry in `data/curated/descriptions/*.json` from that exercise’s original source lines only (same corpus as `scripts/build-description-bundles.ts` / `loadSourceCorpus`). Preserve house style (`descriptionProblems` in `src/data/describe/validate.ts`). Keep seated/standing/incline as distinct moves. Do **not** invent biomechanics that are not in the sources. Do not use generic fills (“Set up for … braced torso”).
>
> Then: `npm run -s descriptions:compile`, `npm run -s descriptions:fidelity` (zero hard fails), and `npx vitest run tests/data/descriptions.test.ts tests/data/fidelity.test.ts`. Commit as `fix(descriptions): rewrite fidelity hard fails`.

## Prompt: independent review

> You are an independent, sceptical reviewer of new doodles: you didn't draw them. Read and report only. Render `npm run -s doodles:cards -- <outDir> <ids>`, then read every PNG and every frame. Judge each move on four points:
> 1. Is it recognisably this move, with the right position, gear and plane?
> 2. Is the anatomy plausible in every frame? Remember that pale limbs are behind the body and bright limbs are in front. A bright limb crossing another is correct when it really passes in front (a Spiderman knee outside the elbow), so judge crossings by depth, not as tangles.
> 3. Is it readable at about 340 px wide?
> 4. Is a near-duplicate of another doodle right or misleading?
>
> Give each move one of three verdicts: KEEP, FIX (with frame, joint, what is wrong and what it should be) or DROP. Report a table and the counts.
