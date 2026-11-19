import { BONES, HIP_SIDE, zOut, type DoodleSpec, type Keyframe, type Point, type Pose, type Side, type Sideways } from "./rig";
import { lockedY3, TWO_VIEWS } from "./sideways";
import { PLANK_FOOT, pushUp } from "./specsBatchC";

/**
 * Batch AA (#174): the proof move for dual-view doodles. Drawn in one view
 * first; the judge asked for a front view (ADD VIEW): hands about twice
 * shoulder width, the chest shifts over the near hand while the far arm stays
 * straight out to the side, hands planted, no rotation.
 */

const HAND_X = 54;
/** Hands about twice shoulder width (shoulders at ±22). */
const HAND_Z = 80;
/** Feet stay planted while the body shifts. */
const FOOT_Z = 12;
/** Sideways shift of the chest towards the near (working) hand at the bottom. */
const SHIFT = -50;
/** The working elbow rolls out a little, so its bend shows from the front. */
const ELBOW_OUT = 30;

/**
 * The body pivots on planted feet: when the hips shift sideways the straight
 * legs angle out, so each foot sits a little closer to the hands (in x).
 */
function foot(shift: number, side: Side): Point {
  const leg = BONES.thigh + BONES.shin;
  const hipZ = shift + zOut(side) * HIP_SIDE;
  const across = Math.abs(hipZ - zOut(side) * FOOT_Z);
  const square = Math.abs(HIP_SIDE - FOOT_Z);
  const closer = Math.sqrt(leg * leg - square * square) - Math.sqrt(leg * leg - across * across);
  return [Math.round((PLANK_FOOT[0] + closer) * 10) / 10, PLANK_FOOT[1]];
}

function at(shoulderY: number, shift: number): Pose {
  const base = pushUp(shoulderY, HAND_X);
  return {
    ...base,
    feet: { near: foot(shift, "near"), far: foot(shift, "far") },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

const wide = (pelvis: number, bentNear: boolean): Sideways => ({
  pelvis,
  hands: { near: -HAND_Z, far: HAND_Z },
  feet: { near: -FOOT_Z, far: FOOT_Z },
  ...(bentNear ? { elbows: { near: { out: ELBOW_OUT } } } : {}),
});

/** Shoulder height at which `side`'s arm is locked straight to its wide hand. */
function lockedY(shift: number, side: Side): number {
  return lockedY3((y) => at(y, shift), wide(shift, false), [side]);
}

function archer(): Keyframe[] {
  const top = lockedY(0, "near");
  const bottom = lockedY(SHIFT, "far");
  const midY = Math.round((top + bottom) / 2);
  return [
    { hold: 0.4, pose: at(top, 0), sideways: wide(0, false) },
    { hold: 0, pose: at(midY, SHIFT / 2), sideways: wide(SHIFT / 2, true) },
    { hold: 0.4, pose: at(bottom, SHIFT), sideways: wide(SHIFT, true) },
    { hold: 0, pose: at(midY, SHIFT / 2), sideways: wide(SHIFT / 2, true) },
  ];
}

export const BATCH_AA_SPECS: DoodleSpec[] = [
  {
    id: "hf_6",
    slug: "archer-push-up",
    title: "Archer Push-Up",
    views: TWO_VIEWS,
    transition: 0.6,
    frames: archer(),
  },
];
