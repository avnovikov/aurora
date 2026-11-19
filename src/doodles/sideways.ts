import { BONES, SHOULDER_SIDE, resolveSideways, solvePose, zOut, type AuthoredPose, type Point, type Pose, type Side, type Sideways } from "./rig";

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
  at: (y: number) => AuthoredPose,
  sw: Sideways,
  sides: Side[] = SIDES,
  lo = -150,
  hi = -30,
  reachLimit = LOCKED_REACH,
): number {
  const shift = sw.pelvis ?? 0;
  // Any arm still over-stretched at this height: the shoulders must come lower (higher y).
  const overReached = (y: number): boolean => {
    const pose = resolveSideways(at(y), sw);
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

export { reach3 } from "./rig";

/** Planted straight legs with feet out sideways (removed in Task 2: use `spreadFeet: true` on the pose). */
export function spreadFeet(pose: Pose, sw: Sideways): Pose {
  return resolveSideways({ ...pose, spreadFeet: true }, sw);
}
