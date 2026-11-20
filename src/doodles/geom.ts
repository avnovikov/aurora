import type { Point, Prop } from "./rig";

/**
 * 2D helpers shared by the pose-spec batches. Imports only rig types, so a
 * batch can use it without going near ./specs (which would be circular).
 */

/** One decimal, the precision the specs are authored in. */
export const round = (value: number): number => Math.round(value * 10) / 10;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
export function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

/** Direction from `a` to `b` in degrees (same convention as `along`). */
export const angle = (a: Point, b: Point): number => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;

/** Shoulder: 98 up the spine from the pelvis. */
export const shoulderOf = (pelvis: Point, spine: number): Point => along(pelvis, spine, 98);
/** Chest: 80 up the spine from the pelvis. */
export const chestOf = (pelvis: Point, spine: number): Point => along(pelvis, spine, 80);

/** The ground line every standing or lying doodle sits on. */
export const FLOOR_PROP: Prop = { kind: "floor" };

/**
 * The free (near) hand of a bent-over lift, given the near shoulder: on the floor
 * beside the lead foot (`onFloor`, 12 to the near side, forearm a hair short of
 * locked) or hanging by the side (6 to the near side, a little short of `reach`).
 * `z` is the hand's sideways position.
 */
export function freeHand(
  shoulder: readonly [number, number, number],
  onFloor: boolean,
  reach: number,
): { hand: Point; z: number } {
  const [nx, ny, nz] = shoulder;
  if (onFloor) {
    const dy = -4 - ny;
    return { hand: [round(nx + Math.sqrt(Math.max(0, (reach - 0.6) ** 2 - dy ** 2 - 12 ** 2))), -4], z: round(nz - 12) };
  }
  return { hand: [round(nx), round(ny + Math.sqrt((reach - 4) ** 2 - 36))], z: round(nz - 6) };
}

/**
 * A torso lying face up, head at -x: chest on the floor `chord` behind the pelvis
 * (the horizontal run of the spine from a raised pelvis), head resting on it.
 */
export function supineTorso(pelvis: Point, chord: number): { pelvis: Point; chest: Point; head: Point; spine: { bend: -1 } } {
  const dy = -18 - pelvis[1];
  const chest: Point = [round(pelvis[0] - Math.sqrt(chord ** 2 - dy * dy)), -18];
  return { pelvis, chest, head: [round(chest[0] - 55), -24], spine: { bend: -1 } };
}
