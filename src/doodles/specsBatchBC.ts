import { BONES, solvePose } from "./rig";
import type { DoodleSpec, Point, Pose } from "./rig";
import { FLOOR_PROP, along, lerp, round } from "./geom";

/**
 * Batch BC: shoulder, arm and wrist stretches, wrist circles and a seated calf stretch.
 * Floor at y = 0, up is negative, the side-view figure faces +x; the front view
 * has the near side on the viewer's left.
 * Import only from ./rig, ./geom and other batch files — never from ./specs.
 *
 * Left out:
 * - Shoulder Raise (fedb_shoulder_raise) and Shoulder shrug (wger_570): the rig has no shoulder
 *   girdle (the chest sits 80 above the pelvis and the neck cannot shorten), so the shoulders
 *   cannot rise towards the ears; sinking the head folds the neck and spine past their limits.
 * - Triceps Stretch (fedb_triceps_stretch) and Tricep Side Stretch (fedb_tricep_side_stretch): the
 *   far hand holds the elbow over the head; in one view the arms fold through the head, and in
 *   side + front the arms tangle round the head and the pull cannot be read.
 * - Sit Up Elbow Thrust (wger_1479): tried side + top; the torso twist is not drawn and the elbow
 *   crossing to the opposite knee lies along the legs, so only the opening elbow reads.
 */

const PELVIS: Point = [0, -172];
/** Shoulder height of the upright stance (chest at -250, shoulders 18 above it). */
const SHOULDER_Y = -270;
/** Shoulder to fingertip along a straight arm (a pinned elbow plus a hand exactly this far: pins must match the bone lengths). */
const REACH = BONES.upperArm + BONES.forearm + BONES.hand;

/**
 * Front-view stance: the pelvis a full leg length (thigh + shin) above the floor and each foot straight
 * under its hip (±8), so the legs stay straight and symmetric (a front view bends knees sideways), the
 * feet turned out evenly (no one-way toe ticks). Shoulders 18 above the chest.
 */
const FRONT_PELVIS: Point = [0, -(BONES.thigh + BONES.shin)];
const FRONT_CHEST: Point = [0, FRONT_PELVIS[1] - 80];
const FRONT_SHOULDER_Y = FRONT_CHEST[1] - 18;
const frontStance = {
  pelvis: FRONT_PELVIS,
  chest: FRONT_CHEST,
  feet: { near: [-8, 0], far: [8, 0] },
  knees: { near: { at: [-8, FRONT_PELVIS[1] + BONES.thigh] }, far: { at: [8, FRONT_PELVIS[1] + BONES.thigh] } },
  toes: { near: 180, far: 0 },
} as const satisfies Pick<Pose, "pelvis" | "chest" | "feet" | "knees" | "toes">;

// ---------------------------------------------------------------- cross-body shoulder stretch

/**
 * Front view: the near arm straight across the chest at `tilt` degrees from level (positive =
 * hand lower); the far hand holds it just above the elbow.
 */
function crossBody(tilt: number): Pose {
  const shoulder: Point = [-22, FRONT_SHOULDER_Y];
  const hand = along(shoulder, tilt, REACH);
  const elbow = along(shoulder, tilt, BONES.upperArm);
  const grip = along(shoulder, tilt, BONES.upperArm + 22);
  return {
    ...frontStance,
    hands: { near: hand, far: [grip[0], round(grip[1] - 3)] },
    elbows: { near: { at: elbow }, far: { bend: 1 } },
  };
}

// ---------------------------------------------------------------- side wrist pull

/** Front view: the near arm crossed in front of the body, wrist held by the far hand; `rise` 0 = at hip level with the elbow bent, 1 = straight at shoulder height. */
function wristPull(rise: number): Pose {
  const shoulder: Point = [-22, FRONT_SHOULDER_Y];
  // The elbow swings from down-and-out to level, the forearm from across the belly to level; the far hand cups the wrist.
  const elbow = along(shoulder, lerp(104, 0, rise), BONES.upperArm);
  const wrist = along(elbow, lerp(19.8, 0, rise), BONES.forearm + BONES.hand);
  return {
    ...frontStance,
    hands: { near: wrist, far: [round(wrist[0] - lerp(4, 36, rise)), round(wrist[1] + lerp(-2, 4, rise))] },
    elbows: { near: { at: elbow }, far: { bend: 1 } },
  };
}

// ---------------------------------------------------------------- biceps stretch (hands clasped behind)

/** Side view: both straight arms behind the back, hands clasped, lifted `lift` degrees back from hanging. */
function bicepsStretch(lift: number): Pose {
  const shoulder: Point = [0, SHOULDER_Y];
  const dir = 90 + lift;
  const hand = along(shoulder, dir, REACH);
  const elbow = along(shoulder, dir, BONES.upperArm);
  return {
    pelvis: PELVIS,
    chest: [0, -252],
    hands: { near: hand, far: hand },
    elbows: { near: { at: elbow }, far: { at: elbow } },
    feet: { near: [0, 0], far: [-4, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- upward stretch

/** Side view: both straight arms overhead, palms together, pressed `back` degrees behind vertical. */
function upwardStretch(back: number, lean: number, tuck: number): Pose {
  const spine = -90 - lean;
  const chest = along(PELVIS, spine, 80);
  const shoulder = along(PELVIS, spine, 98);
  const dir = -90 - back;
  const hand = along(shoulder, dir, REACH);
  const elbow = along(shoulder, dir, BONES.upperArm);
  return {
    pelvis: PELVIS,
    chest,
    head: [round(chest[0] + tuck), round(chest[1] - Math.sqrt(56 ** 2 - tuck ** 2))],
    hands: { near: hand, far: hand },
    elbows: { near: { at: elbow }, far: { at: elbow } },
    feet: { near: [0, 0], far: [-4, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- wrist circles

/** Side view: elbows bent, forearms held out in front, the hand turned `turn` degrees round the wrist (0 = straight on, 90 = down). */
function wristCircle(turn: number): Pose {
  const elbow: Point = [3, -210];
  const wrist: Point = [61, -211];
  return {
    pelvis: PELVIS,
    chest: [0, -252],
    hands: { near: wrist, far: wrist },
    elbows: { near: { at: elbow }, far: { at: elbow } },
    wrists: { near: turn, far: turn },
    feet: { near: [0, 0], far: [-4, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- seated calf stretch (hand or towel on the foot)

const SC_PELVIS: Point = [0, -10];

/**
 * Sitting, near leg straight and far knee bent with the foot flat. `lean` is the torso's angle from
 * the floor; `toes` the straight foot's angle (-90 upright, less = pointed). The hands (a towel in the
 * text) draw the toes back.
 */
function seatedCalf(lean: number, toes: number): Pose {
  const pelvis = SC_PELVIS;
  const ankle: Point = [173.6, -8];
  const tip = along(ankle, toes, 20);
  const thigh: Point = [92, -16];
  const knee = solvePose({ pelvis, feet: { far: [74, -4] }, knees: { far: { bend: -1 } } }).legs.far.mid;
  return {
    pelvis,
    chest: along(pelvis, -lean, 80),
    hands: lean > 60
      ? { near: thigh, far: [round(knee[0] + 4), round(knee[1] - 4)] }
      : { near: [round(tip[0] + 5), round(tip[1] + 2)], far: [round(tip[0] + 2), round(tip[1] + 8)] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { far: { bend: -1 } },
    feet: { near: ankle, far: [74, -4] },
    toes: { near: toes, far: 0 },
  };
}

const WRIST_TURNS = [0, 45, 90, 135, 180, 225, 270, 315, 360, 315, 270, 225, 180, 135, 90, 45];

export const BATCH_BC_SPECS: DoodleSpec[] = [
  {
    id: "fedb_shoulder_stretch",
    slug: "shoulder-stretch",
    title: "Shoulder Stretch",
    view: "front",
    transition: 1.4,
    frames: [
      { hold: 0.5, pose: crossBody(-4) },
      { hold: 1.2, pose: crossBody(8) },
    ],
  },
  {
    id: "fedb_side_wrist_pull",
    slug: "side-wrist-pull",
    title: "Side Wrist Pull",
    view: "front",
    transition: 1.5,
    frames: [
      { hold: 0.5, pose: wristPull(0) },
      { hold: 0, pose: wristPull(0.5) },
      { hold: 1.3, pose: wristPull(1) },
      { hold: 0, pose: wristPull(0.5) },
    ],
  },
  {
    id: "fedb_standing_biceps_stretch",
    slug: "standing-biceps-stretch",
    title: "Standing Biceps Stretch",
    transition: 1.5,
    frames: [
      { hold: 0.5, pose: bicepsStretch(10) },
      { hold: 1.3, pose: bicepsStretch(38) },
    ],
  },
  {
    id: "fedb_upward_stretch",
    slug: "upward-stretch",
    title: "Upward Stretch",
    transition: 1.5,
    frames: [
      { hold: 0.5, pose: upwardStretch(13, 0, 15) },
      { hold: 1.3, pose: upwardStretch(22, 5, 15) },
    ],
  },
  {
    id: "hf_167",
    slug: "wrist-circles",
    title: "Wrist Circles",
    transition: 0.22,
    frames: WRIST_TURNS.map((turn) => ({ hold: 0, pose: wristCircle(turn) })),
  },
  {
    id: "wger_1274",
    slug: "seated-calf-stretch-towel",
    title: "Seated calf stretch",
    props: [FLOOR_PROP],
    transition: 1.1,
    frames: [
      { hold: 0.6, pose: seatedCalf(80, -80) },
      { hold: 1.4, pose: seatedCalf(40, -104) },
    ],
  },
];
