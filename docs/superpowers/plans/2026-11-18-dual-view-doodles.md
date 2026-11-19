# Dual-view doodles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a doodle opt in to a side + front view pair drawn from one 3D-solved figure, change the review process to "one view first, the judge asks for a second", and prove it on 100 new doodles.

**Architecture:** The 2D rig (`rig.ts`) and single-view renderer stay untouched, so every existing SVG is unchanged (the existing "generated for every spec" test proves it). A new `rig3d.ts` takes the 2D solve for the spine and timing, and solves the four limbs in 3D using per-keyframe sideways offsets. `project.ts` flattens a 3D figure into the existing 2D `Solved` shape for a side (x, y) or front (z, y) panel, so the renderer reuses `figureSvg` per panel. `validate.ts` routes dual-view specs to a 3D validator.

**Tech Stack:** TypeScript, tsx scripts, Vitest, SMIL SVG.

Spec: `docs/superpowers/specs/2026-11-18-dual-view-doodles-design.md` · Issue: #174

## Global Constraints

- Side-only specs render byte-identical (within the existing `sameDrawing` 0.11 tolerance): `rig.ts` changes are limited to new `export`s.
- Front panel: near side on the viewer's left (z < 0), far side on the right (z > 0); same convention as `view: "front"` (shoulders ±22, hips ±8).
- Dual view = `views: ["side", "front"]`. Not allowed with `mirror` or `view: "front"`. Props allowed in two views: `bar`, `box`.
- No zoom inset on dual-view specs; brass highlight drawn in both panels.
- The judge decides: drawers always draw one view; a second view is added only on an ADD VIEW verdict.
- Imports in batch files: `./rig` (and `./rig3d` types) only, never `./specs`.
- Before claiming done: `npm run doodles`, `npx tsc --noEmit`, `npm run -s lint`, `npx vitest run`.

## Spec amendment (authoring surface)

The spec's "third number on a pin" becomes a keyframe-level `sideways` map, so the 2D `Pose`/`Point` types stay unchanged:

```ts
frames: [{
  pose: { pelvis: [-130, -118], chest: [-60, -112], hands: { near: [0, 0], far: [0, 0] }, feet: { … } },
  sideways: { hands: { near: -30, far: 90 }, elbows: { near: { out: 70 } } },
  hold: 0.4,
}]
```

`sideways` values are absolute z. Missing entries default to the chain's natural width.

---

### Task 1: Types and guards

**Files:**
- Modify: `src/doodles/rig.ts` (types + exports only)
- Modify: `src/doodles/validate.ts`
- Test: `tests/doodles/dualView.test.ts` (new)

**Interfaces — produces:**
```ts
// rig.ts
export interface SidewaysHint { at?: number; out?: number }
export interface Sideways {
  pelvis?: number;
  hands?: Partial<Record<Side, number>>;
  feet?: Partial<Record<Side, number>>;
  elbows?: Partial<Record<Side, SidewaysHint>>;
  knees?: Partial<Record<Side, SidewaysHint>>;
}
// Keyframe gains:  sideways?: Sideways;
// DoodleSpec gains: views?: readonly ["side", "front"];
export const SHOULDER_ALONG = 18, SHOULDER_SIDE = 22, HIP_SIDE = 8; // now exported
// validate.ts
export function dualViewGuards(spec: DoodleSpec): string[]
```

- [ ] Step 1: failing tests — `dualViewGuards` returns an error for `views` + any `mirror`, `views` + `view: "front"`, `views` + a `parallelBars`/`parallettes` prop, and `sideways` on a spec without `views`; returns `[]` for a plain dual spec.
- [ ] Step 2: run `npx vitest run tests/doodles/dualView.test.ts` → FAIL (not exported).
- [ ] Step 3: add the types, export the three constants, implement `dualViewGuards`, and push its messages into `validateSpec`'s errors.
- [ ] Step 4: tests pass; `npx vitest run tests/doodles` still green (byte-identical check).
- [ ] Step 5: commit `feat(doodles): dual-view spec types and guards (#174)`.

### Task 2: 3D keyframe solve

**Files:**
- Create: `src/doodles/rig3d.ts`
- Test: `tests/doodles/rig3d.test.ts`

**Interfaces — produces:**
```ts
export type Point3 = readonly [number, number, number];
export interface Limb3 { root: Point3; mid: Point3; joint: Point3; end: Point3 }
export interface Figure3 {
  pelvis: Point3; waist: Point3; chest: Point3; neck: Point3; head: Point3;
  arms: Record<Side, Limb3>; legs: Record<Side, Limb3>;
  pins: { joint: string; target: Point3; actual: Point3 }[];
}
export function solveKeyframe3(spine: Solved, pose: Pose, sideways: Sideways | undefined): Figure3
```

Algorithm:
- Spine: `pelvis…head` from the 2D `Solved` (the caller passes the 2D solve of the same pose), z = `sideways.pelvis ?? 0`.
- Roots: shoulder = 2D shoulder (x, y), z = spineZ ∓ `SHOULDER_SIDE` (near −, far +); hip likewise with `HIP_SIDE`.
- Target (x, y) from the pose pin, z from `sideways` (else root z); unpinned target = root + (0, reach·0.98, 0) as in 2D.
- Two-bone solve in 3D: `d = unit(target − root)`, reach clamped like `solveJoint`, θ = acos((l1² + r² − l2²)/(2·l1·r)). Bend normal `n = unit(cross([0,0,1], d))` made orthogonal to d (fallback `[0,-1,0]` when d ∥ z), then rolled about d by `out` degrees towards the limb's outward side (near: −z, far: +z). `mid = root + l1·(cosθ·d + bend·sinθ·n)`; bend from `pose.elbows/knees[side].bend` or the limb default (+1 arms, −1 legs).
- `elbows/knees.at` (x, y from the pose, z from `sideways.*.at` or root z) pins the mid as in 2D.
- Arm end: fingertip on the forearm line (forearm + hand), or with `pose.wrists[side]` the wrist is pinned and the hand points at that angle in the xy plane. Leg end: ankle pinned; foot direction `toes[side]` in the xy plane, default square to the side-projected shin.

- [ ] Step 1: failing tests — (a) every 3D bone has its `BONES` length within 1e-6 for a dual pose with sideways hands; (b) with no `sideways`, every limb's (x, y) matches `solvePose(pose)` within 0.5; (c) far hand pinned at z = 90: its side-projected upper arm + forearm is shorter than `BONES.upperArm + BONES.forearm`; (d) `out: 90` on a bent near elbow puts the elbow's z below the shoulder's z.
- [ ] Step 2: run → FAIL.
- [ ] Step 3: implement `rig3d.ts` (vector helpers local to the file).
- [ ] Step 4: run → PASS.
- [ ] Step 5: commit `feat(doodles): 3D limb solve for dual-view doodles (#174)`.

### Task 3: 3D timeline

**Files:**
- Modify: `src/doodles/rig3d.ts`
- Test: `tests/doodles/rig3d.test.ts`

**Interfaces — produces:**
```ts
export interface Timeline3 { duration: number; keyTimes: number[]; poses: Figure3[]; keyframeIndex: number[] }
export function sampleTimeline3(spec: DoodleSpec, stepsPerTransition?: number): Timeline3
```

Algorithm: call `sampleTimeline(spec)` (2D) for timing and the spine at every sample. Solve each keyframe with `solveKeyframe3`. For a sample at eased t between keyframes A and B, rebuild each limb from the sample's roots:
- planted (both ends pinned and the end moves < 24, or both on the floor, the same rule as `staysPlanted`): target = lerp of the ends; bend plane normal = slerp of the A and B normals; two-bone solve.
- otherwise swing: upper-bone direction = slerp(A, B), lower-bone direction = slerp(A, B); mid and joint from those; the end bone follows the same blend.
Slerp handles near-antiparallel vectors by rotating about z.

- [ ] Step 1: failing tests — 3D bone lengths hold (≤ 0.5) at every sample of a two-keyframe dual spec; `keyTimes` equal the 2D timeline's.
- [ ] Step 2: run → FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run → PASS.
- [ ] Step 5: commit `feat(doodles): 3D timeline for dual-view doodles (#174)`.

### Task 4: Projection and two-panel rendering

**Files:**
- Create: `src/doodles/project.ts`
- Modify: `src/doodles/renderSvg.ts`
- Test: `tests/doodles/dualView.test.ts`

**Interfaces — produces:**
```ts
// project.ts
export type Panel = "side" | "front";
export function project(figure: Figure3, panel: Panel): Solved   // side: (x, y); front: (z, y); pins: []
// renderSvg.ts
export function renderDoodleSvg(spec: DoodleSpec): string        // branches on spec.views
export function dualLayout(spec: DoodleSpec, timeline: Timeline3): { view: ViewBox; frontShift: number }
```

Rendering: side panel = `figureSvg` of side projections, far side at half opacity. Front panel = `figureSvg` with front opacity of front projections, shifted right by `frontShift` (side panel's right edge + 2·PADDING − front panel's left edge). Props: side as today; front: `bar` → line from z −90 to +90 at its y, `box` → rect z −60…60 at its y/h. One floor line under both panels only if a prop isn't already the floor (none drawn today, so none here). Labels "side" / "front" in `var(--doodle-ink)` at 0.5 opacity, font-size 14, centred under each panel. Focus highlight drawn in both; inset never.

- [ ] Step 1: failing tests — (a) a dual spec's SVG contains two `<text>` labels "side" and "front"; (b) far hand with z = +90 is drawn right of the head in the front panel (parse via `project`); (c) every projected point of both panels lies inside `dualLayout(...).view`; (d) a dual spec with a focus zoom renders no `clipPath`.
- [ ] Step 2: run → FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run → PASS; `npx vitest run tests/doodles` green.
- [ ] Step 5: commit `feat(doodles): render side and front panels (#174)`.

### Task 5: Dual-view validation

**Files:**
- Modify: `src/doodles/validate.ts`
- Test: `tests/doodles/dualView.test.ts`

`validateSpec` routes `spec.views` specs to `validateDual`, which returns the same `SpecReport` shape:
- 3D bone length error over every sample ≤ 0.5.
- Keyframe pins: 3D miss ≤ 0.5 → else `frame i: hands.far unreachable by …`.
- Floor: `belowFloor` on the side projection (y is shared).
- Anatomy: spine issues on the side projection; knee/elbow flexion from the 3D angle between bones ≤ 160°; arm through head when the 3D distance from head centre to an arm segment < 20.
- Props: `propCrossings` on the side projection.
- Every projected point of both panels inside the dual viewBox.

- [ ] Step 1: failing tests — a dual spec whose far hand is out of reach reports `unreachable`; a valid dual spec reports `ok`; a bent-past-160° elbow is reported.
- [ ] Step 2: run → FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run → PASS; full `npx vitest run tests/doodles` green.
- [ ] Step 5: commit `feat(doodles): validate dual-view doodles in 3D (#174)`.

### Task 6: Authoring guide and process

**Files:**
- Modify: `docs/doodles-authoring.md`, `docs/superpowers/specs/2026-11-18-dual-view-doodles-design.md` (authoring amendment above)

- [ ] Add "Two views" section: when the judge asks for it, `views`, `sideways` (absolute z, defaults, `out`), pin the chest when hands go wide (the 2D spine lean ignores z), allowed props, what stays out (twists).
- [ ] Replace the drawer prompt: always draw one view; note the plane it can't show; never leave a move out only for being two-plane.
- [ ] Replace the reviewer prompt: KEEP / FIX / ADD VIEW / DROP, ADD VIEW only when one view misleads, naming the view and what it must show.
- [ ] New prompts: "Add a second view" (fix agent edits the existing spec) and "Re-judge" (both panels agree; the added view shows what was asked).
- [ ] Commit `docs(doodles): one view first, judge asks for a second (#174)`.

### Task 7: Proof move — archer push-up

- [ ] Draw `hf_6` in side view in a new `src/doodles/specsBatchAA.ts` (register in `DOODLE_SPECS`), cards, iterate.
- [ ] Independent judge (reviewer prompt) on the card → expected ADD VIEW.
- [ ] Add the front view per the verdict; cards; re-judge → KEEP.
- [ ] `npm run doodles`, tsc, lint, vitest; commit `feat(doodles): archer push-up in two views (#174)`.

### Task 8: 100 doodles through the process

- [ ] Pick 100 ids without a doodle: first the 14 from `npm run doodles:missing`, then the moves left out of #138/#141, then Library moves on body / bar / dip bars / box gear, ranked by Library order; skip gear with no prop (rings, dumbbell, band-only, partner, machines).
- [ ] Group by body position into ~8 batches of 12–13 (files `specsBatchAB` … `specsBatchAI`); one worktree + drawer agent per batch (drawer prompt).
- [ ] Merge batches into `feature/174-dual-view-doodles`; `npm run doodles`.
- [ ] Two independent judges split the 100 (reviewer prompt) → KEEP / FIX / ADD VIEW / DROP table.
- [ ] Fix agents: one for FIX, one for ADD VIEW (add-view prompt). Re-judge changed moves.
- [ ] Final checks; commit; PR against `mvp` with `Closes #174`, listing counts per verdict, moves dropped and why, and text changes. Do not merge.
