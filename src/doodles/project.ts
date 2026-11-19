import type { Point, Side, Solved, SolvedLimb } from "./rig";
import type { Figure3, Limb3, Point3 } from "./rig3d";

/** The panels gear is drawn on (side, front). */
export type Panel = "side" | "front";
/** Every panel a doodle can show; the top panel looks down on the figure. */
export type View = Panel | "top";

/**
 * Flatten a 3D figure into the 2D shape the renderer and validator already use.
 * Side: (x, y). Front: (z, y), seen from in front, near side (z < 0) on the left.
 * Top: (x, -z), seen from above with x as in the side view and the near side
 * (z < 0, the side view's camera) at the bottom of the panel.
 * Pins come along, so a pinned contact may touch the floor in the validator.
 */
export function project(figure: Figure3, panel: View): Solved {
  const flat = (p: Point3): Point => {
    if (panel === "side") return [p[0], p[1]];
    return panel === "front" ? [p[2], p[1]] : [p[0], -p[2]];
  };
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
    pins: figure.pins.map((pin) => ({ joint: pin.joint, target: flat(pin.target), actual: flat(pin.actual) })),
  };
}
