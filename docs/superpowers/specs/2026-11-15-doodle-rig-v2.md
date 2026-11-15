# Doodle rig v2 — joint-based stick figures

Status: draft. Replaces the two-bone IK rig in `src/doodles/rig.ts`.

## Why

The v1 rig solved each arm/leg with two-bone IK but left the torso free. Hip-to-shoulder length drifted between poses (about 60 to 130 units), so figures visibly stretched and shrank. Arch and handstand poses also need a spine that bends, which v1 cannot express.

## Principle: start with every joint, then remove the ones a move doesn't need

The full model has every joint that a human figure has in the side view. A pose may *pin* any joint to a position. Unpinned joints are solved. A move that doesn't need a joint (e.g. the wrist in a forearm plank) simply doesn't pin it, and the solver keeps it sensible. We remove joints from the *authoring* surface, never from the physics.

## Joints

| Chain | Joints (root → tip) | Bones (fixed length) |
|---|---|---|
| Spine | pelvis → waist → chest → neck → head | 40, 40, 20, 36 (torso ≈ 100) |
| Arm (×2) | chest → shoulder → elbow → wrist → hand | 60 upper arm, 58 forearm, 8 hand |
| Leg (×2) | pelvis → hip → knee → ankle → toe | 88 thigh, 86 shin, 20 foot |

Hips and shoulders are fixed offsets from pelvis and chest (near/far sides). Head centre sits at neck + head radius along the neck direction.

## Solver

- Every bone keeps its length exactly (FABRIK per chain, a few iterations).
- Pinned joints are fixed. The pelvis is the root; if a pose doesn't pin it, it stays at the previous keyframe's position.
- A chain's *direction* hint (`bend`) picks which way an unpinned elbow/knee folds.
- Chains are solved independently after the spine, so a pinned hand can't stretch the torso.
- If a pinned target is out of reach it is clamped to the reach circle and reported as `unreachable` by the validator.

## Authoring API (per keyframe)

```ts
pose: {
  pelvis?: [x, y],            // root; defaults to previous keyframe
  chest?: [x, y],             // pins the upper spine; otherwise solved
  head?: [x, y],              // pins head centre; otherwise neck follows spine
  hands: { near?: [x,y], far?: [x,y] },   // wrist/hand targets
  feet:  { near?: [x,y], far?: [x,y] },   // ankle targets
  elbows?: { near?: {bend?: 1|-1, at?: [x,y]} , far?: ... },
  knees?:  { near?: {bend?: 1|-1, at?: [x,y]} , far?: ... },
  toes?:   { near?: number, far?: number },   // foot direction, degrees (0 = +x, 90 = down)
}
```

Minimal authoring: a plank needs `pelvis`, `hands`, `feet`. An arch hang needs `chest` and `head` as well. Specs should pin the fewest joints that define the move.

## Validator (run on every keyframe, reported to the reviewer)

- Bone lengths within 0.5 units. This is the only length rule: the spine is
  made of fixed-length segments, so a bent spine is *expected* to have a
  shorter straight-line pelvis → neck distance. (An earlier draft also required
  that straight-line distance to stay constant; that silently forbade every
  arch, rounded back and head tuck, and was removed.)
- Anatomical ranges, on every animation sample (keyframes and transitions):
  lumbar and thoracic joints ≤ 35° each, neck ≤ 60°, knees and elbows flex
  ≤ 160° and never bend backwards more than 10°, no arm segment through the
  head.
- Unreachable pinned targets.
- Any joint or head below the floor (y > 0) except pinned feet/hands/toes/knees on the floor when the move says so.
- Any figure point outside the 16:10 viewBox.
- Any limb segment crossing a prop (bar, box, parallettes, parallel-bar uprights).

Output is a JSON report per spec. Reviewers must read the report before judging the image.

## Renderer

Same look as v1 (white stroke, black, far limbs at half opacity in side view). Draw polyline spine through pelvis → waist → chest → neck, arms and legs as polylines through their joints, head as circle. Animation remains SMIL `<animate>` on joint coordinates, sampled from the solver at each step.

## Acceptance

- Every spec passes the validator with zero errors.
- Reviewer PASS on every spec's contact sheet (three moments plus the transition frames).
- Existing 8 PASS specs are kept or re-authored to the same reviewer standard.
