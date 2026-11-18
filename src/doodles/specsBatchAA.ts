import { BONES, HIP_SIDE, SHOULDER_SIDE, solvePose, type DoodleSpec, type Keyframe, type Point, type Pose, type Side, type Sideways } from "./rig";
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
/** Arm reach (shoulder to fingertip) less a hair, so a locked arm draws straight. */
const LOCKED_REACH = BONES.upperArm + BONES.forearm + BONES.hand - 0.4;
/** The working elbow rolls out a little, so its bend shows from the front. */
const ELBOW_OUT = 30;

const zOut = (side: Side): number => (side === "near" ? -1 : 1);

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

/**
 * Shoulder height (bisected between `lo` and `hi`) at which every arm in
 * `sides` reaches its hand in 3D with the elbow locked: the lowest of their
 * locked heights, so the most stretched arm is straight and the others bend a
 * little. `at` builds the 2D pose for a shoulder height; `sw` gives the z.
 */
export function lockedY3(
  at: (y: number) => Pose,
  sw: Sideways,
  sides: Side[] = ["near", "far"],
  lo = -150,
  hi = -30,
  reachLimit = LOCKED_REACH,
): number {
  const shift = sw.pelvis ?? 0;
  const lockedFor = (side: Side): number => {
    const reach = (y: number): number => {
      const pose = at(y);
      const shoulder = solvePose(pose).arms[side].root;
      const hand = pose.hands?.[side] as Point;
      const shoulderZ = shift + zOut(side) * SHOULDER_SIDE;
      const dz = shoulderZ - (sw.hands?.[side] ?? shoulderZ);
      return Math.hypot(shoulder[0] - hand[0], shoulder[1] - hand[1], dz);
    };
    let [a, b] = [lo, hi];
    for (let i = 0; i < 40; i += 1) {
      const mid = (a + b) / 2;
      if (reach(mid) > reachLimit) a = mid;
      else b = mid;
    }
    return (a + b) / 2;
  };
  return Math.round(Math.max(...sides.map(lockedFor)) * 10) / 10;
}

/**
 * A joint `length` from `root` (3D: x, y and z) heading along the 2D angle
 * `degrees` (0 = +x, 90 = down) while it sits `dz` sideways from the root: the
 * 2D point is foreshortened so the 3D bone keeps its length.
 */
export function reach3(root: Point, degrees: number, length: number, dz: number): Point {
  const flat = Math.sqrt(Math.max(0, length * length - dz * dz));
  const r = (degrees * Math.PI) / 180;
  return [Math.round((root[0] + Math.cos(r) * flat) * 1000) / 1000, Math.round((root[1] + Math.sin(r) * flat) * 1000) / 1000];
}

/**
 * Straight legs with the feet set out sideways (`sw.feet`): each planted foot
 * slides along the floor towards the hip so the 3D leg keeps its 2D length.
 * For poses whose legs are straight from the pelvis to the feet.
 */
export function spreadFeet(pose: Pose, sw: Sideways): Pose {
  const pelvis = pose.pelvis as Point;
  const feet: Partial<Record<Side, Point>> = { ...pose.feet };
  for (const side of ["near", "far"] as Side[]) {
    const foot = pose.feet?.[side];
    if (!foot) continue;
    const hipZ = (sw.pelvis ?? 0) + zOut(side) * HIP_SIDE;
    const dz = (sw.feet?.[side] ?? hipZ) - hipZ;
    const leg = Math.hypot(foot[0] - pelvis[0], foot[1] - pelvis[1]) - 0.2;
    const flat = Math.sqrt(Math.max(0, leg * leg - dz * dz - (foot[1] - pelvis[1]) ** 2));
    feet[side] = [Math.round((pelvis[0] - flat) * 100) / 100, foot[1]];
  }
  return { ...pose, feet };
}

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
    views: ["side", "front"],
    transition: 0.6,
    frames: archer(),
  },
];
