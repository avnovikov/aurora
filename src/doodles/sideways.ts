import { BONES, resolveSideways, solvePose, type AuthoredPose, type Point, type Side, type Sideways } from "./rig";
import { solveKeyframe3 } from "./rig3d";

/**
 * Helpers for authoring dual-view keyframes (#174): 2D pins placed so the 3D
 * limbs, set out sideways by `sideways`, keep their true lengths.
 */

/** `views` of a dual-view doodle. */
export const TWO_VIEWS = ["side", "front"] as const;
/** `views` of a side + top doodle (floor moves seen from above). */
export const TOP_VIEWS = ["side", "top"] as const;

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
  // Any arm still over-stretched at this height: the shoulders must come lower (higher y).
  const overReached = (y: number): boolean => {
    const pose = resolveSideways(at(y), sw);
    // Shoulders as the 3D solve places them (a sideways lean tilts them).
    const figure = solveKeyframe3(solvePose(pose), pose, sw);
    return sides.some((side) => {
      const shoulder = figure.arms[side].root;
      const hand = pose.hands?.[side] as Point;
      const dz = shoulder[2] - (sw.hands?.[side] ?? shoulder[2]);
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
