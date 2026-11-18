import { BONES, HIP_SIDE, type DoodleSpec, type Keyframe, type Point, type Sideways } from "./rig";
import { PLANK_FOOT, pushUp } from "./specsBatchC";

/**
 * Batch AA (#174): the proof move for dual-view doodles. Drawn in one view
 * first; the judge asked for a front view (ADD VIEW): hands about twice
 * shoulder width, the chest shifts over the near hand while the far arm stays
 * straight out to the side, hands planted, no rotation.
 */

const HAND_X = 62;
/** Hands about twice shoulder width (shoulders at ±22). */
const HAND_Z = 80;
/** Feet stay planted while the body shifts. */
const FOOT_Z = 12;
/** Top: arms straight down to wide hands (lateral 58 of a 126 reach). */
const ARCHER_TOP = -110;
/** Bottom: the far arm still straight, reaching from the shifted shoulder to its hand. */
const ARCHER_BOTTOM = -60;
/** Sideways shift of the chest towards the near (working) hand at the bottom. */
const SHIFT = -50;

const wide = (pelvis: number): Sideways => ({
  pelvis,
  hands: { near: -HAND_Z, far: HAND_Z },
  feet: { near: -FOOT_Z, far: FOOT_Z },
});

/**
 * The body pivots on planted feet: when the hips shift sideways the straight
 * legs angle out, so the feet sit a little closer to the hands (in x).
 */
function foot(shift: number): Point {
  const leg = BONES.thigh + BONES.shin;
  const across = Math.abs(shift) + HIP_SIDE + FOOT_Z;
  const square = HIP_SIDE + FOOT_Z;
  const closer = Math.sqrt(leg * leg - square * square) - Math.sqrt(leg * leg - across * across);
  return [Math.round((PLANK_FOOT[0] + closer) * 10) / 10, PLANK_FOOT[1]];
}

function at(shoulderY: number, shift: number): Keyframe["pose"] {
  const base = pushUp(shoulderY, HAND_X);
  return { ...base, feet: { near: foot(shift), far: foot(shift) } };
}

function archer(): Keyframe[] {
  const mid = Math.round((ARCHER_TOP + ARCHER_BOTTOM) / 2);
  return [
    { hold: 0.4, pose: at(ARCHER_TOP, 0), sideways: wide(0) },
    { hold: 0, pose: at(mid, SHIFT / 2), sideways: wide(SHIFT / 2) },
    { hold: 0.4, pose: at(ARCHER_BOTTOM, SHIFT), sideways: wide(SHIFT) },
    { hold: 0, pose: at(mid, SHIFT / 2), sideways: wide(SHIFT / 2) },
  ];
}

export const BATCH_AA_SPECS: DoodleSpec[] = [
  {
    id: "hf_6",
    slug: "archer-push-up",
    title: "Archer Push-Up",
    views: ["side", "front"],
    transition: 0.6,
    frames: archer(),
  },
];
