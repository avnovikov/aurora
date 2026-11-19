# Sideways hints in the pose

Issue: #210. Last follow-up from #175 (dual-view doodles, `2026-11-18-dual-view-doodles-design.md`).

## Problem

In a two-view doodle each keyframe's `sideways` already says how far each joint sits to the side (z). But authors placing a knee or foot also re-type that distance by hand, through two helpers in `src/doodles/sideways.ts`:

- `reach3(root, degrees, length, dz)` — a joint `length` from `root` along a 2D direction, foreshortened by `dz` (10 call sites in batches AB and AC). `dz` is retyped from the keyframe's `sideways` (e.g. `CROSS_KNEE_Z + HIP_SIDE`), and the sign rules are easy to get wrong.
- `spreadFeet(pose, sw)` — straight planted legs with feet set out sideways: each foot slides in along the floor so the 3D leg keeps its length (5 call sites in AB).

`lockedY3` (lower the body until the arms lock) stays an authoring helper: the rule for how the body lowers lives in each spec's pose function, so it can't become a hint without changing output.

## Design

### Authored pose

`Keyframe.pose` becomes `AuthoredPose | LegacyPose`. `AuthoredPose` is `Pose` plus three hints; `solvePose` still takes a plain `Pose`, so an unresolved hint can't reach the solver (the type checker enforces it).

- **Knee direction** — `knees[side] = { dir, length?, bend? }`: the thigh points `dir` degrees from the hip (0 = +x, 90 = down). The knee lands `length` (default `BONES.thigh`) from the pelvis, foreshortened by the knee's z minus the hip's z.
- **Foot direction** — `feet[side] = { dir, length? }`: from the knee along `dir` (default length `BONES.shin`, foreshortened by foot z minus knee z) when the knee is pinned (`at` or `dir`); otherwise a straight leg from the pelvis (default length `BONES.thigh + BONES.shin`, foreshortened by foot z minus hip z).
- **Spread feet** — `spreadFeet: true` on the pose: planted feet given as points slide in so straight legs keep their 2D length with their sideways z (exactly today's `spreadFeet`). Feet given as direction hints are left to the rule above.

z values come from the keyframe's `sideways` with the same defaults the 3D solve uses (`rig3d.ts`, "default: the limb root's z"): the hip sits at `(sideways.pelvis ?? 0) + zOut(side) * HIP_SIDE`, and a knee (`sideways.knees[side].at`) or foot (`sideways.feet[side]`) without its own z sits at the hip's z. With no `sideways` every dz is 0, so hints behave as plain 2D.

### One resolver

`resolveSideways(pose: AuthoredPose, sideways?: Sideways): Pose` in `rig.ts` (beside the `Sideways` types; `rig.ts` can't import `sideways.ts` without a module cycle). It applies `spreadFeet` first, then knee hints, then foot hints, using today's arithmetic and rounding (`reach3` to 0.001, `spreadFeet` to 0.01), and returns the pose unchanged (same object) when it has no hints. Hints need an explicit `pelvis`; without one it throws a clear error.

It runs:
- in `solveKeyframes`, on each keyframe before solving — so the 2D timing and spine, the 3D limbs and the validator all see the resolved pose;
- in `lockedY3`, on each pose it tries.

`spreadFeet` becomes a private helper of the resolver; `reach3` stays exported from `rig.ts` (tests use it).

### Migration

All 15 call sites move to hints. A site whose retyped `dz` does not match its keyframe's `sideways` would change output; the snapshot diff catches it and that site keeps a plain point instead (reported in the PR).

## Proof

All 386 generated SVGs byte-identical to a snapshot taken before the change.

## Tests

- Each hint resolves to the same point as the old helper call (knee dir; foot dir from a knee; straight-leg foot; custom `length`; spread feet).
- A hint with no `sideways` equals the 2D `reach3` with dz 0.
- A plain pose comes back unchanged; hints without a pelvis throw.
- The snapshot diff.

## Out of scope

A solver-level "arms locked" constraint; any visual change.
