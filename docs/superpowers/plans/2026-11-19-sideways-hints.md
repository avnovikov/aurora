# Sideways Hints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let doodle authors give knees and feet as directions (and planted feet as "spread") in the pose, resolved against the keyframe's own `sideways`, replacing the 15 hand-written `reach3` / `spreadFeet` call sites with byte-identical output (issue #210, spec `docs/superpowers/specs/2026-11-19-sideways-hints-design.md`).

**Architecture:** A new `AuthoredPose` type (Pose plus hints) is what keyframes hold; `resolveSideways(pose, sideways)` in `rig.ts` turns hints into the plain points today's helpers compute, with the same arithmetic and rounding. It runs once per keyframe in `solveKeyframes` (feeding the 2D timeline, the 3D solve and the validator) and inside `lockedY3`. `solvePose` keeps taking a plain `Pose`.

**Tech Stack:** TypeScript, Vitest, `npm run doodles` (writes `public/doodles/*.svg`, `src/data/generated/doodleMap.ts`).

## Global Constraints

- Work only in `/Users/alexei/Documents/calistenics/.worktrees/210-sideways-hints` (branch `feature/210-sideways-hints` from `origin/dev`). Never use `git stash`. PR into `dev`.
- All 386 generated SVGs and `doodleMap.ts` stay byte-identical. Snapshot before Task 1:

```bash
cd /Users/alexei/Documents/calistenics/.worktrees/210-sideways-hints
SNAP=/private/tmp/claude-503/-Users-alexei-Documents-calistenics--worktrees-pulse-lost-grace/fad277ac-6258-454d-b3af-ce95fda43e1d/scratchpad/210-before
npm run -s doodles && rm -rf $SNAP && mkdir -p $SNAP && cp -R public/doodles $SNAP/ && cp src/data/generated/doodleMap.ts $SNAP/
```

  Check: `npm run -s doodles && diff -rq $SNAP/doodles public/doodles && diff -q $SNAP/doodleMap.ts src/data/generated/doodleMap.ts` prints nothing.
- `rig.ts` must not import `sideways.ts` (module cycle: `sideways.ts` evaluates `BONES` at load).
- Batch spec files import only from `./rig`, `./sideways` or other batch/helper modules, never `./specs`.
- Do not edit exercise descriptions or anything under `data/`.
- Finish every task with `npm run -s doodles` (no errors), `npx tsc --noEmit`, `npm run -s lint`, `npx vitest run` all passing.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: `AuthoredPose`, `resolveSideways`, wiring

**Files:**
- Modify: `src/doodles/rig.ts` (types ~lines 20–90; `solveKeyframes` ~line 660)
- Modify: `src/doodles/sideways.ts` (`reach3`, `spreadFeet`, `lockedY3`)
- Test: create `tests/doodles/sidewaysHints.test.ts`

**Interfaces:**
- Produces (in `rig.ts`): `export interface KneeHint extends JointHint { dir?: number; length?: number }`, `export interface FootHint { dir: number; length?: number }`, `export type AuthoredPose = Omit<Pose, "knees" | "feet"> & { knees?: Partial<Record<Side, KneeHint>>; feet?: Partial<Record<Side, Point | FootHint>>; spreadFeet?: boolean }`, `export function resolveSideways(pose: AuthoredPose, sideways?: Sideways): Pose`; `Keyframe.pose: AuthoredPose | LegacyPose`.
- `sideways.ts` keeps exporting `reach3` and `spreadFeet` in this task (Task 2 migrates callers, then removes the exports); `lockedY3`'s `at` becomes `(y: number) => AuthoredPose`.

- [ ] **Step 1: Write the failing tests** — `tests/doodles/sidewaysHints.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BONES, HIP_SIDE, resolveSideways, type AuthoredPose, type Point, type Pose } from "../../src/doodles/rig";
import { reach3, spreadFeet } from "../../src/doodles/sideways";

const PELVIS: Point = [-30, -87];

describe("resolveSideways", () => {
  it("returns a plain pose unchanged (same object)", () => {
    const pose: Pose = { pelvis: PELVIS, feet: { near: [-200, -18] } };
    expect(resolveSideways(pose, { feet: { near: -40 } })).toBe(pose);
  });

  it("places a knee by direction, foreshortened by knee z minus hip z", () => {
    const pose: AuthoredPose = { pelvis: PELVIS, knees: { near: { dir: 40 } } };
    const out = resolveSideways(pose, { knees: { near: { at: 24 } } });
    expect(out.knees?.near?.at).toEqual(reach3(PELVIS, 40, BONES.thigh, 24 - -HIP_SIDE));
  });

  it("places a foot from a direction knee, foreshortened by foot z minus knee z", () => {
    const pose: AuthoredPose = { pelvis: PELVIS, knees: { near: { dir: 40 } }, feet: { near: { dir: 170 } } };
    const out = resolveSideways(pose, { knees: { near: { at: 24 } }, feet: { near: 2 } });
    const knee = reach3(PELVIS, 40, BONES.thigh, 24 - -HIP_SIDE);
    expect(out.feet?.near).toEqual(reach3(knee, 170, BONES.shin, 2 - 24));
  });

  it("places a straight-leg foot from the pelvis with a custom length", () => {
    const pose: AuthoredPose = { pelvis: PELVIS, feet: { far: { dir: 180, length: 173.6 } } };
    const out = resolveSideways(pose, { pelvis: 10, feet: { far: 78 } });
    expect(out.feet?.far).toEqual(reach3(PELVIS, 180, 173.6, 78 - (10 + HIP_SIDE)));
  });

  it("treats a missing sideways as plain 2D (dz 0)", () => {
    const pose: AuthoredPose = { pelvis: PELVIS, knees: { far: { dir: 92 } }, feet: { far: { dir: 200 } } };
    const out = resolveSideways(pose);
    const knee = reach3(PELVIS, 92, BONES.thigh, 0);
    expect(out.knees?.far?.at).toEqual(knee);
    expect(out.feet?.far).toEqual(reach3(knee, 200, BONES.shin, 0));
  });

  it("spreads planted feet exactly like spreadFeet", () => {
    const plain: Pose = { pelvis: PELVIS, feet: { near: [-200, -18], far: [-200, -18] } };
    const sw = { pelvis: -20, feet: { near: -40, far: 40 } };
    expect(resolveSideways({ ...plain, spreadFeet: true }, sw)).toEqual(spreadFeet(plain, sw));
  });

  it("needs an explicit pelvis for hints", () => {
    expect(() => resolveSideways({ knees: { near: { dir: 40 } } })).toThrow(/pelvis/);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/doodles/sidewaysHints.test.ts`
Expected: FAIL — `resolveSideways` / `AuthoredPose` not exported from rig.

- [ ] **Step 3: Types** — in `src/doodles/rig.ts`, after `JointHint`:

```ts
/** A knee given by direction (resolved by `resolveSideways`): the thigh points `dir` degrees from the hip (0 = +x, 90 = down). */
export interface KneeHint extends JointHint {
  dir?: number;
  /** Thigh length to use (default BONES.thigh). */
  length?: number;
}

/**
 * A foot given by direction: from the knee along `dir` (a shin, default
 * BONES.shin) when the knee is pinned, otherwise a straight leg from the pelvis
 * (default BONES.thigh + BONES.shin).
 */
export interface FootHint {
  dir: number;
  length?: number;
}

/** What keyframes hold: a `Pose` whose knees and feet may be direction hints, resolved against the keyframe's `sideways`. */
export type AuthoredPose = Omit<Pose, "knees" | "feet"> & {
  knees?: Partial<Record<Side, KneeHint>>;
  feet?: Partial<Record<Side, Point | FootHint>>;
  /** Planted feet (points) slide in so straight legs keep their 2D length with their sideways z. */
  spreadFeet?: boolean;
};
```

and change `Keyframe.pose` to `pose: AuthoredPose | LegacyPose;`. Fix any type errors this causes by resolving (never by casting a hint to a point).

- [ ] **Step 4: The resolver** — move the bodies of `reach3` and `spreadFeet` from `sideways.ts` into `rig.ts` as non-exported `reach3` and `spreadPlanted` (identical arithmetic and rounding), and add, below the `Sideways` types:

```ts
const isPoint = (foot: Point | FootHint | undefined): foot is Point => Array.isArray(foot);

function hasHints(pose: AuthoredPose): boolean {
  if (pose.spreadFeet) return true;
  return (["near", "far"] as Side[]).some((side) => pose.knees?.[side]?.dir !== undefined || (pose.feet?.[side] !== undefined && !isPoint(pose.feet[side])));
}

/**
 * Turns an authored pose's sideways hints into plain pins (see `AuthoredPose`),
 * foreshortening each by its joint's z from `sideways`: hips at
 * `pelvis ± HIP_SIDE`, a knee or foot without its own z at its hip's z (as the
 * 3D solve defaults). A pose without hints comes back as the same object.
 */
export function resolveSideways(pose: AuthoredPose, sideways: Sideways = {}): Pose {
  if (!hasHints(pose)) return pose as Pose;
  const pelvis = pose.pelvis;
  if (!pelvis) throw new Error("sideways hints (knee/foot dir, spreadFeet) need an explicit pelvis");
  const { spreadFeet: spread, knees: kneeHints, feet: footHints, ...rest } = pose;
  const planted = spread ? spreadPlanted(pelvis, footHints ?? {}, sideways) : { ...footHints };
  const knees: Partial<Record<Side, JointHint>> = {};
  const feet: Partial<Record<Side, Point>> = {};
  for (const side of ["near", "far"] as Side[]) {
    const hipZ = (sideways.pelvis ?? 0) + zOut(side) * HIP_SIDE;
    const kneeZ = sideways.knees?.[side]?.at ?? hipZ;
    const hint = kneeHints?.[side];
    let kneeAt = hint?.at;
    if (hint) {
      const { dir, length, ...joint } = hint;
      if (dir !== undefined) kneeAt = reach3(pelvis, dir, length ?? BONES.thigh, kneeZ - hipZ);
      knees[side] = kneeAt ? { ...joint, at: kneeAt } : joint;
    }
    const foot = planted[side];
    if (foot === undefined) continue;
    if (isPoint(foot)) {
      feet[side] = foot;
      continue;
    }
    const footZ = sideways.feet?.[side] ?? hipZ;
    feet[side] = kneeAt
      ? reach3(kneeAt, foot.dir, foot.length ?? BONES.shin, footZ - kneeZ)
      : reach3(pelvis, foot.dir, foot.length ?? BONES.thigh + BONES.shin, footZ - hipZ);
  }
  return {
    ...rest,
    ...(kneeHints ? { knees } : {}),
    ...(footHints ? { feet } : {}),
  };
}
```

`spreadPlanted(pelvis, feet, sideways)` is today's `spreadFeet` loop applied to the feet that are points (skip hint feet), returning a new feet record. If lint flags `resolveSideways`'s complexity, split the per-side body into a helper — keep the arithmetic identical. Check the existing `zOut`, `HIP_SIDE`, `BONES` names in `rig.ts` and use them.

- [ ] **Step 5: Keep `sideways.ts` exports working** until Task 2 migrates their callers: export the moved `reach3` from `rig.ts` and re-export it from `sideways.ts` (`export { reach3 } from "./rig";`), and keep `spreadFeet` in `sideways.ts` as

```ts
/** Planted straight legs with feet out sideways (removed in Task 2: use `spreadFeet: true` on the pose). */
export function spreadFeet(pose: Pose, sw: Sideways): Pose {
  return resolveSideways({ ...pose, spreadFeet: true }, sw);
}
```

The Step 1 tests compare hints against these exports, so `reach3` must be the original arithmetic, moved unchanged.

- [ ] **Step 6: Wire it in**
  - `rig.ts` `solveKeyframes`: `const poses = spec.frames.map((frame) => toPose(frame.pose, frame.sideways));` where `toPose` (or the line calling it) first applies `resolveSideways(frame.pose, frame.sideways)` to non-legacy poses. Legacy poses pass through as today.
  - `sideways.ts` `lockedY3`: `at: (y: number) => AuthoredPose`; inside `overReached`, `const pose = resolveSideways(at(y), sw);` then use `pose` as now.

- [ ] **Step 7: Run tests and the snapshot check**

Run: `npx vitest run tests/doodles && npm run -s doodles && diff -rq $SNAP/doodles public/doodles && diff -q $SNAP/doodleMap.ts src/data/generated/doodleMap.ts`
Expected: tests PASS; the diffs print nothing (no spec uses hints yet).

- [ ] **Step 8: Full checks and commit**

Run: `npx tsc --noEmit && npm run -s lint && npx vitest run`

```bash
git add src/doodles/rig.ts src/doodles/sideways.ts tests/doodles/sidewaysHints.test.ts
git commit -m "feat(doodles): sideways hints in the pose, resolved per keyframe (#210)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Migrate the call sites, retire the helpers, docs

**Files:**
- Modify: `src/doodles/specsBatchAB.ts` (lines ~112, 121, 235, 267, 274, 292, 300, 388, 393, 403)
- Modify: `src/doodles/specsBatchAC.ts` (lines ~272, 273, 305, 312, 420)
- Modify: `src/doodles/sideways.ts` (drop the `reach3` / `spreadFeet` exports)
- Modify: `docs/doodles-authoring.md` ("Two views" section)
- Modify: `tests/doodles/sidewaysHints.test.ts` (compare against the rig-internal originals if the `sideways.ts` exports go away — see Step 4)

**Interfaces:**
- Consumes: `AuthoredPose`, `KneeHint`, `FootHint`, `resolveSideways` from Task 1.

- [ ] **Step 1: List the sites** — `grep -n "reach3(\|spreadFeet(" src/doodles/specsBatch*.ts`. Expect 15 lines in AB and AC.

- [ ] **Step 2: Migrate each site**, one file at a time, then run `npm run -s doodles && diff -rq $SNAP/doodles public/doodles` after each file. Patterns:
  - `spreadFeet(p, sw)` → `{ ...p, spreadFeet: true }` (the keyframe's `sideways` must be the same `sw`; if a site passes a different object than the keyframe's `sideways`, check they are equal).
  - `lockedY3((y) => spreadFeet(push(y), s), s, straight)` → `lockedY3((y) => ({ ...push(y), spreadFeet: true }), s, straight)`.
  - Knee: `const k = reach3(pelvis, 40, THIGH, CROSS_KNEE_Z + HIP_SIDE); … knees: { [side]: { at: k } }` → `knees: { [side]: { dir: 40 } }`.
  - Foot from that knee: `reach3(k, 170, SHIN, dz)` → `feet: { [side]: { dir: 170 } }`.
  - Straight leg: `reach3(pelvis, deg, 173.6, z - HIP_SIDE)` → `feet: { near: { dir: deg, length: 173.6 }, far: { dir: deg, length: 173.6 } }` — the dz now comes from the keyframe's `sideways`, so check that keyframe's `sideways.feet` / `sideways.pelvis` give the same dz the site typed. A pose function shared by several keyframes must get the hint only where every keyframe using it carries matching `sideways`.
  - `reach3(x, deg, len, 0)` on a keyframe with no sideways for that joint → the same hint (dz resolves to 0).
  - Lengths equal to `BONES.thigh` / `BONES.shin` (`88`, `86`, `THIGH`, `SHIN`) → omit `length`; any other length (e.g. `173.6`, `LEG - 2`) → keep it as `length`.
  - Delete constants and imports that become unused (e.g. `HIP_SIDE`, `THIGH`, `SHIN` where no longer needed).
  - If a site can't migrate without changing output (the diff shows its SVG), revert that site to its original code and list it in the report with the reason.

- [ ] **Step 3: Confirm** — `grep -n "reach3\|spreadFeet(" src/doodles/specsBatch*.ts` lists only sites you reported as unmigratable; the snapshot diff prints nothing.

- [ ] **Step 4: Retire the helpers** — if no batch file still calls them, remove the `reach3` / `spreadFeet` exports from `sideways.ts` (and `rig.ts` keeps `reach3` non-exported). Update `tests/doodles/sidewaysHints.test.ts` to compare against literal expected points computed once from the current helpers (paste the numbers the Task 1 tests produced; run the old expressions in a scratch script under `/private/tmp/claude-503/-Users-alexei-Documents-calistenics--worktrees-pulse-lost-grace/fad277ac-6258-454d-b3af-ce95fda43e1d/scratchpad/` to get them before removing the exports).

- [ ] **Step 5: Docs** — in `docs/doodles-authoring.md` "Two views", after the `sideways` bullet, add:

```markdown
- Give a knee or foot that goes sideways as a **direction** instead of a point: `knees: { near: { dir: 40 } }` (thigh angle from the hip), `feet: { near: { dir: 170 } }` (shin from that knee, or a straight leg from the hip when the knee isn't pinned; `length` overrides the bone length). The solver shortens it in the side view by the joint's z from the keyframe's `sideways`, so don't retype z offsets. Planted straight legs with feet out to the side: `spreadFeet: true` on the pose. `lockedY3` (in `sideways.ts`) still finds the shoulder height at which wide arms lock.
```

- [ ] **Step 6: Full checks, snapshot, commit**

Run: `npm run -s doodles && diff -rq $SNAP/doodles public/doodles && diff -q $SNAP/doodleMap.ts src/data/generated/doodleMap.ts && npx tsc --noEmit && npm run -s lint && npx vitest run`
Expected: diffs print nothing; all pass.

```bash
git add -A src/doodles tests/doodles docs/doodles-authoring.md
git commit -m "refactor(doodles): sideways hints replace reach3/spreadFeet call sites (#210)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
