import { BONES, HIP_SIDE, SHOULDER_SIDE, solvePose, zOut } from "./rig";
import type { Point, Pose, Side, Solved } from "./rig";
import { add3, dot3, norm3, scale3, sub3, type Point3 } from "./rig3d";
import { round } from "./geom";

/**
 * Shared 3D limb toolkit for the batch spec files: limbs are placed in 3D by
 * `chain` / `dirs` (exact bone lengths), and `flat` drops them to side-view pins.
 * Never import ./specs (circular).
 */

/** Unit vector; a zero vector stays zero (unlike rig3d's `unit3`, which returns DOWN). */
export const unit3 = (a: Point3): Point3 => scale3(a, 1 / (norm3(a) || 1));

export interface Plan {
  mid: Point3;
  end: Point3;
}

export interface LimbSpec {
  plan: Plan;
  toe?: number;
}

export type Spine = Pick<Pose, "pelvis" | "chest" | "head" | "spine">;

export const ARM: [number, number] = [BONES.upperArm, BONES.forearm + BONES.hand];
export const LEG: [number, number] = [BONES.thigh, BONES.shin];
/** Shoulder to fingertips with the elbow locked, less a hair. */
export const REACH = BONES.upperArm + BONES.forearm + BONES.hand - 0.4;

export const SIDES: Side[] = ["near", "far"];

/** A limb from `root` reaching `end` (pulled in if too far), the middle joint on the `hint` side of the line. */
export function chain(root: Point3, [l1, l2]: [number, number], end: Point3, hint: Point3): Plan {
  const full = sub3(end, root);
  const d = Math.min(Math.max(norm3(full), Math.abs(l1 - l2) + 1), l1 + l2 - 0.3);
  const u = unit3(full);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const centre = add3(root, scale3(u, a));
  const toHint = sub3(hint, centre);
  let n = sub3(toHint, scale3(u, dot3(toHint, u)));
  if (norm3(n) < 1e-6) n = sub3([0, -1, 0], scale3(u, u[1] * -1));
  return { mid: add3(centre, scale3(unit3(n), h)), end: add3(root, scale3(u, d)) };
}

/** A limb given as two directions: the upper bone, then the lower. */
export function dirs(root: Point3, [l1, l2]: [number, number], d1: Point3, d2: Point3): Plan {
  const mid = add3(root, scale3(unit3(d1), l1));
  return { mid, end: add3(mid, scale3(unit3(d2), l2)) };
}

/** Where limbs root in an already solved pose: its shoulders and hips, set out sideways about the spine at z = `pz`. */
export function rootsOf(solved: Solved, pz = 0): { arm: Record<Side, Point3>; leg: Record<Side, Point3> } {
  const arm = {} as Record<Side, Point3>;
  const leg = {} as Record<Side, Point3>;
  for (const side of SIDES) {
    arm[side] = [solved.arms[side].root[0], solved.arms[side].root[1], pz + zOut(side) * SHOULDER_SIDE];
    leg[side] = [solved.legs[side].root[0], solved.legs[side].root[1], pz + zOut(side) * HIP_SIDE];
  }
  return { arm, leg };
}

/** Where limbs root: the solved spine's shoulders and hips. */
export const roots = (spine: Spine, pz = 0): ReturnType<typeof rootsOf> => rootsOf(solvePose(spine), pz);

/** A 3D point as a rounded side-view point. */
export const flat = (p: Point3): Point => [round(p[0]), round(p[1])];

/** Phase angles (degrees) of one full circle out and back the other way, for the elbow, wrist and similar circles. */
export const CIRCLE_PHASES = [0, 45, 90, 135, 180, 225, 270, 315, 360, 315, 270, 225, 180, 135, 90, 45];
