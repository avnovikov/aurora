import { BONES, HIP_SIDE, SHOULDER_SIDE, solvePose, zOut, type Point, type Pose, type Side, type Sideways } from "./rig";

/**
 * Helpers for authoring dual-view keyframes (#174): 2D pins placed so the 3D
 * limbs, set out sideways by `sideways`, keep their true lengths.
 */

/** `views` of a dual-view doodle. */
export const TWO_VIEWS = ["side", "front"] as const;

const SIDES: Side[] = ["near", "far"];

/** Arm reach (shoulder to fingertip) less a hair, so a locked arm draws straight. */
export const LOCKED_REACH = BONES.upperArm + BONES.forearm + BONES.hand - 0.4;

/**
 * Shoulder height (bisected between `lo` and `hi`) at which every arm in
 * `sides` reaches its hand in 3D with the elbow locked: the lowest of their
 * locked heights, so the most stretched arm is straight and the others bend a
 * little. `at` builds the 2D pose for a shoulder height; `sw` gives the z.
 */
export function lockedY3(
  at: (y: number) => Pose,
  sw: Sideways,
  sides: Side[] = SIDES,
  lo = -150,
  hi = -30,
  reachLimit = LOCKED_REACH,
): number {
  const shift = sw.pelvis ?? 0;
  // Any arm still over-stretched at this height: the shoulders must come lower (higher y).
  const overReached = (y: number): boolean => {
    const pose = at(y);
    const solved = solvePose(pose);
    return sides.some((side) => {
      const shoulder = solved.arms[side].root;
      const hand = pose.hands?.[side] as Point;
      const shoulderZ = shift + zOut(side) * SHOULDER_SIDE;
      const dz = shoulderZ - (sw.hands?.[side] ?? shoulderZ);
      return Math.hypot(shoulder[0] - hand[0], shoulder[1] - hand[1], dz) > reachLimit;
    });
  };
  let [a, b] = [lo, hi];
  for (let i = 0; i < 40; i += 1) {
    const mid = (a + b) / 2;
    if (overReached(mid)) a = mid;
    else b = mid;
  }
  return Math.round(((a + b) / 2) * 10) / 10;
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
  for (const side of SIDES) {
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
