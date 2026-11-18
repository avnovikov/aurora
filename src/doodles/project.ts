import type { Point, Side, Solved, SolvedLimb } from "./rig";
import type { Figure3, Limb3, Point3 } from "./rig3d";

/** The two panels of a dual-view doodle. */
export type Panel = "side" | "front";

/**
 * Flatten a 3D figure into the 2D shape the renderer and validator already use.
 * Side: (x, y). Front: (z, y), seen from in front, near side (z < 0) on the left.
 */
export function project(figure: Figure3, panel: Panel): Solved {
  const flat = (p: Point3): Point => (panel === "side" ? [p[0], p[1]] : [p[2], p[1]]);
  const limb = (l: Limb3): SolvedLimb => ({ root: flat(l.root), mid: flat(l.mid), joint: flat(l.joint), end: flat(l.end) });
  const limbs = (r: Record<Side, Limb3>): Record<Side, SolvedLimb> => ({ near: limb(r.near), far: limb(r.far) });
  return {
    pelvis: flat(figure.pelvis),
    waist: flat(figure.waist),
    chest: flat(figure.chest),
    neck: flat(figure.neck),
    head: flat(figure.head),
    arms: limbs(figure.arms),
    legs: limbs(figure.legs),
    pins: [],
  };
}
