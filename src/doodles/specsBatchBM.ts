import type { DoodleSpec, Face, Keyframe, Point, Pose } from "./rig";
import { TWO_VIEWS } from "./sideways";

/**
 * Batch BM: neck moves (head facing, issue #216). A tall standing figure with
 * the arms relaxed; only `face` (turn / tilt / nod) moves, except where a hand
 * pulls the head. Import only from ./rig and ./sideways, never ./specs.
 */

const PELVIS: Point = [0, -172];
const CHEST: Point = [0, -252];

/** Standing tall, feet under the hips, arms hanging. */
function stand(extra: Partial<Pose> = {}): Pose {
  return {
    pelvis: PELVIS,
    chest: CHEST,
    hands: { near: [4, -154], far: [-4, -154] },
    feet: { near: [6, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
    ...extra,
  };
}

const frame = (face: Face, hold = 0.4, pose: Pose = stand()): Keyframe => ({ pose, hold, face });

/** A ring of faces (tilt, nod), each a short hold, for a head roll. */
function ring(points: readonly (readonly [number, number])[]): Keyframe[] {
  return points.map(([tilt, nod]) => frame({ tilt, nod }, 0.05));
}

/**
 * One hand on the back of the head, pulling it down and across: the head centre is
 * the neck (chest + 20) plus 36 along the nodded neck, the hand sits on the back of the skull.
 */
function pull(side: "near" | "far", nod: number, turn: number): Keyframe {
  const sign = side === "near" ? -1 : 1;
  const r = (nod * Math.PI) / 180;
  const centre: Point = [36 * Math.sin(r), -272 - 36 * Math.cos(r)];
  const back: Point = [centre[0] - 26 * Math.cos(r), centre[1] - 26 * Math.sin(r)];
  return {
    hold: 0.9,
    face: { turn: sign * turn, nod },
    pose: stand({ hands: { [side]: back, [side === "near" ? "far" : "near"]: side === "near" ? [-4, -154] : [4, -154] }, elbows: { [side]: { bend: 1 } } }),
    sideways: { hands: { [side]: sign * 12 }, elbows: { [side]: { out: 80 } } },
  };
}

/** The hand lifting past the chest on its way to the head (keeps the elbow bend in range). */
function lift(side: "near" | "far"): Keyframe {
  const sign = side === "near" ? -1 : 1;
  return {
    hold: 0.05,
    face: { turn: sign * 20, nod: 15 },
    pose: stand({ hands: { [side]: [-30, -286] }, elbows: { [side]: { bend: 1 } } }),
    sideways: { hands: { [side]: sign * 14 }, elbows: { [side]: { out: 60 } } },
  };
}

const rest = (hold: number): Keyframe => ({ pose: stand(), hold, face: { turn: 0, nod: 0 } });

export const BATCH_BM_SPECS: DoodleSpec[] = [
  {
    id: "wger_1011",
    slug: "neck-extension-stretch",
    title: "Front neck stretch",
    transition: 1.3,
    frames: [frame({ nod: 0 }, 0.5), frame({ nod: -55 }, 1.2), frame({ nod: 0 }, 0.5)],
  },
  {
    id: "wger_1018",
    slug: "neck-side-tilt",
    title: "Head tilts",
    views: TWO_VIEWS,
    transition: 1.1,
    frames: [
      frame({ tilt: 0 }, 0.4),
      frame({ tilt: -38 }, 0.9),
      frame({ tilt: 0 }, 0.4),
      frame({ tilt: 38 }, 0.9),
    ],
  },
  {
    id: "wger_1015",
    slug: "neck-circles-clockwise",
    title: "Clockwise neck circles",
    views: TWO_VIEWS,
    transition: 0.7,
    frames: ring([[-38, 0], [-27, -28], [0, -45], [27, -28], [38, 0], [27, 34], [0, 56], [-27, 34]]),
  },
  {
    id: "wger_1016",
    slug: "neck-circles-counterclockwise",
    title: "Counterclockwise neck circles",
    views: TWO_VIEWS,
    transition: 0.7,
    frames: ring([[38, 0], [27, -28], [0, -45], [-27, -28], [-38, 0], [-27, 34], [0, 56], [27, 34]]),
  },
  {
    id: "wger_1017",
    slug: "neck-half-circles",
    title: "Neck half circles",
    views: TWO_VIEWS,
    transition: 0.8,
    frames: ring([[-40, 8], [-28, 38], [0, 56], [28, 38], [40, 8], [28, 38], [0, 56], [-28, 38]]),
  },
  {
    id: "wger_1939",
    slug: "neck-cars",
    title: "Neck CARs",
    views: TWO_VIEWS,
    transition: 1,
    frames: ring([[0, 56], [-36, 40], [-44, 0], [-30, -32], [0, -48], [30, -32], [44, 0], [36, 40]]),
  },
  {
    id: "wger_1013",
    slug: "left-levator-scapulae-stretch",
    title: "Left levator scapulae stretch",
    views: TWO_VIEWS,
    transition: 1.2,
    frames: [rest(0.5), lift("near"), pull("near", 38, 45), pull("near", 50, 45), lift("near"), rest(0.4)],
  },
  {
    id: "wger_1014",
    slug: "right-levator-scapulae-stretch",
    title: "Right levator scapulae stretch",
    views: TWO_VIEWS,
    transition: 1.2,
    frames: [rest(0.5), lift("far"), pull("far", 38, 45), pull("far", 50, 45), lift("far"), rest(0.4)],
  },];
