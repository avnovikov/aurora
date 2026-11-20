import { kettlebellOnFloor } from "./rig";
import type { BellMode, DoodleSpec, Keyframe, Point, Pose, Side, Sideways } from "./rig";
import { TWO_VIEWS } from "./sideways";
import { FLOOR_PROP, along, chestOf, round, shoulderOf } from "./geom";
import { PLANK_FOOT, lockedShoulderY, straightBody } from "./specsBatchC";

/**
 * Batch BK (#216): kettlebell moves. Floor at y = 0, up is negative, side view
 * faces +x (far limbs pale behind, near limbs bright).
 *
 *   two-arm row, deadlift, sumo deadlift         hinged, flat back, the bell(s) on the floor
 *   single-arm plank to row                      plank with one hand on a bell
 *   dynamic side hold                            one-legged stance, the bell hanging by the side
 *   double clean and press, double front squat   two bells, bell kept close to the body
 *   swings (two ids), curls (two ids)            straight-arm swing, elbows pinned curls
 *   hip airplane                                 hinged on one leg, side + front panels
 *
 * Left out: wger_2668 (the text never says in which plane the bell circles) and
 * wger_2727 (wrist turnover: the bell turns round the forearm's axis, which the
 * gear can only hang straight below the grip).
 */

const BELL = 14;
const FLOOR_HAND = round(kettlebellOnFloor(BELL));
/** Arm reach (shoulder to fingertip), a hair short so a straight arm draws straight. */
const REACH = 125.8;

const BENT = { near: { bend: 1 }, far: { bend: 1 } } as const;
const kf = (pose: Pose, hold: number, extra: Partial<Keyframe> = {}): Keyframe => ({ pose, hold, ...extra });
const off = (p: Point, dx: number, dy: number): Point => [round(p[0] + dx), round(p[1] + dy)];

/** Pelvis and chest for a straight spine of `spine` degrees whose shoulder sits at `shoulder`. */
function torsoFromShoulder(shoulder: Point, spine: number): { pelvis: Point; chest: Point } {
  const pelvis = along(shoulder, spine + 180, 98);
  return { pelvis, chest: chestOf(pelvis, spine) };
}

// ---------------------------------------------------------------- hinged: rows and deadlifts

/** Hinged, arms hanging straight down so the hands (the bells) rest on the floor at `handX`. */
function hingeDown(handX: number, spine: number): { pelvis: Point; chest: Point; shoulder: Point } {
  const shoulder: Point = [handX, round(FLOOR_HAND - REACH)];
  return { ...torsoFromShoulder(shoulder, spine), shoulder };
}

const ROW_HINGE = hingeDown(24, -2);

/**
 * Two-arm row: both bells on the floor ahead of the feet, hips back, back flat.
 * `pull`: both elbows drawn back past the ribs, the bells at the stomach.
 */
function twoArmRow(pull: boolean | "lowering"): Pose {
  const { pelvis, chest, shoulder } = ROW_HINGE;
  // The elbows drive up past the back (like the one-arm row), so the bells come to the stomach.
  const elbow = along(shoulder, -132, 60);
  const up = (dx: number): Point => [round(elbow[0] + 7 + dx), round(elbow[1] + 65.6)];
  // Lowering: the arms open forward under the shoulders first, so the bells drop clear of the knees.
  const low = (dx: number): Point => [round(shoulder[0] + 14 + dx), round(shoulder[1] + 76)];
  let hands: Pose["hands"] = { near: [shoulder[0], FLOOR_HAND], far: [shoulder[0] - 2, FLOOR_HAND] };
  if (pull === true) hands = { near: up(0), far: up(-2) };
  if (pull === "lowering") hands = { near: low(0), far: low(-2) };
  return {
    pelvis,
    chest,
    hands,
    elbows: pull === true ? { near: { at: elbow }, far: { at: elbow } } : BENT,
    feet: { near: [-16, 0], far: [-22, 0] },
    toes: { near: 0, far: 0 },
  };
}

const DEAD_FEET: Pose["feet"] = { near: [-14, 0], far: [-20, 0] };
const DEAD_HINGE = hingeDown(6, -34);

/** Kettlebell deadlift: hinge with a flat back to the bell between the feet, stand tall with it at the thighs. */
function deadlift(down: boolean): Pose {
  if (down) {
    const { pelvis, chest } = DEAD_HINGE;
    return {
      pelvis,
      chest,
      hands: { near: [6, FLOOR_HAND], far: [4, FLOOR_HAND] },
      elbows: BENT,
      feet: DEAD_FEET,
      toes: { near: 0, far: 0 },
    };
  }
  const pelvis: Point = [-16, -172];
  return {
    pelvis,
    chest: chestOf(pelvis, -90),
    hands: { near: [-4, -146], far: [-6, -146] },
    elbows: BENT,
    feet: DEAD_FEET,
    toes: { near: 0, far: 0 },
  };
}

/** Sumo stance: feet wide apart (sideways), toes and knees out, torso steeper and hips lower than a conventional pull. */
const SUMO_FEET_Z = 44;
const SUMO_HANDS_Z = 9;
function sumo(down: boolean, hold: number): Keyframe {
  const sideways: Sideways = {
    hands: { near: -SUMO_HANDS_Z, far: SUMO_HANDS_Z },
    feet: { near: -SUMO_FEET_Z, far: SUMO_FEET_Z },
    knees: { near: { out: 22 }, far: { out: 22 } },
  };
  if (down) {
    const pelvis: Point = [-52, -98];
    const spine = -40;
    const s = shoulderOf(pelvis, spine);
    return {
      hold,
      sideways,
      pose: {
        pelvis,
        chest: chestOf(pelvis, spine),
        hands: { near: [s[0], FLOOR_HAND], far: [s[0], FLOOR_HAND] },
        feet: { near: [0, 0], far: [0, 0] },
        toes: { near: 0, far: 0 },
      },
    };
  }
  const pelvis: Point = [2, -166];
  return {
    hold,
    sideways,
    pose: {
      pelvis,
      chest: chestOf(pelvis, -90),
      hands: { near: [14, -141], far: [14, -141] },
      elbows: BENT,
      feet: { near: [0, 0], far: [0, 0] },
      toes: { near: 0, far: 0 },
    },
  };
}

// ---------------------------------------------------------------- single-arm plank to row

const PLANK_HAND_X = 62;
const PLANK_TOP = lockedShoulderY(PLANK_FOOT, [PLANK_HAND_X, FLOOR_HAND]);

/**
 * High plank, both hands on bells (the far one is the support); `row` draws the near
 * elbow back so its bell comes up beside the ribs while the other hand keeps the plank.
 */
function plankRow(row: boolean): Pose {
  const { pelvis, chest, shoulder } = straightBody(PLANK_FOOT, PLANK_TOP);
  const elbow = along(shoulder, 175, 60);
  return {
    pelvis,
    chest,
    hands: {
      near: row ? [round(elbow[0] + 7), round(elbow[1] + 65.6)] : [PLANK_HAND_X, FLOOR_HAND],
      far: [PLANK_HAND_X - 2, FLOOR_HAND],
    },
    elbows: { near: row ? { at: elbow } : { bend: 1 }, far: { bend: 1 } },
    feet: { near: PLANK_FOOT, far: PLANK_FOOT },
    toes: { near: 62, far: 62 },
  };
}

// ---------------------------------------------------------------- dynamic side hold

/**
 * Standing on one leg with a soft knee, the bell hanging by the side in the near
 * hand. `stand` is the leg on the floor; the other foot is just lifted, knee bent
 * and the foot a little off the floor behind. `stand` undefined: both feet down,
 * the moment of the switch (the standing foot stays down until the other lands).
 * The band the bell hangs from isn't drawn: the gear hangs it straight from the grip.
 */
function sideHold(stand: Side | undefined): Pose {
  const pelvis: Point = [0, -166];
  const base = {
    pelvis,
    chest: chestOf(pelvis, -90),
    hands: { near: [10, -144] as Point, far: [-6, -144] as Point },
    elbows: BENT,
  };
  if (!stand) {
    return { ...base, knees: { near: { bend: -1 }, far: { bend: -1 } }, feet: { near: [4, 0], far: [-4, 0] }, toes: { near: 0, far: 0 } };
  }
  const up: Side = stand === "near" ? "far" : "near";
  const knee = along(pelvis, 50, 88);
  return {
    ...base,
    knees: { [stand]: { bend: -1 }, [up]: { at: knee } } as Pose["knees"],
    feet: { [stand]: [2, 0], [up]: along(knee, 124, 86) } as Pose["feet"],
    toes: { [stand]: 0, [up]: 20 } as Pose["toes"],
  };
}

// ---------------------------------------------------------------- double clean and press, double front squat

interface Stand {
  pelvis: Point;
  spine: number;
}
const TALL: Stand = { pelvis: [2, -172], spine: -90 };
/** Hinged, the bells hanging between the knees. */
const HINGE: Stand = { pelvis: [-52, -150], spine: -38 };
/** Hips nearly through as the bells start up. */
const DRIVE: Stand = { pelvis: [-6, -170], spine: -84 };

/**
 * A clean keeps the bell close: `low` the elbow bends back beside the ribs and the
 * hand floats up in front of the hips; `high` the elbow is up and back, the hand
 * at the lower chest close to the body; `rack` the elbow drops in front of the ribs.
 */
type ArmState = "hang" | "between" | "low" | "high" | "rack" | "mid" | "over";

function armPin(state: ArmState, shoulder: Point, side: Side): { hand: Point; elbow?: Point } {
  const near = side === "near";
  const slight = near ? 0 : -2;
  const bent = (upper: number, lower: number): { hand: Point; elbow: Point } => {
    const elbow = along(shoulder, upper + slight, 60);
    return { hand: along(elbow, lower, 66), elbow };
  };
  const straight: Partial<Record<ArmState, number>> = { hang: 90 + slight, between: near ? 110 : 100, over: -88 + slight };
  const angle = straight[state];
  if (angle !== undefined) return { hand: along(shoulder, angle, REACH) };
  const bends: Partial<Record<ArmState, [number, number]>> = { low: [112, 40], high: [118, -16], rack: [75, -68] };
  const bend = bends[state];
  return bend ? bent(...bend) : { hand: off(shoulder, near ? 62 : 58, -88) };
}

/** Eyes up at the bells: the head tips back so the locked arms stay clear of it. */
const WINDOW_HEAD: Point = [-22, -300];

function pairPose(stand: Stand, near: ArmState, far: ArmState): Pose {
  const shoulder = shoulderOf(stand.pelvis, stand.spine);
  const a = armPin(near, shoulder, "near");
  const b = armPin(far, shoulder, "far");
  return {
    pelvis: stand.pelvis,
    chest: chestOf(stand.pelvis, stand.spine),
    hands: { near: a.hand, far: b.hand },
    elbows: { near: a.elbow ? { at: a.elbow } : { bend: 1 }, far: b.elbow ? { at: b.elbow } : { bend: 1 } },
    feet: { near: [4, 0], far: [-4, 0] },
    toes: { near: 0, far: 0 },
    ...(near === "over" ? { head: WINDOW_HEAD } : {}),
  };
}

const racked = (s: ArmState): BellMode => (s === "rack" || s === "mid" || s === "over" ? "rack" : "hang");
const pair = (stand: Stand, state: ArmState, hold: number): Keyframe => ({
  pose: pairPose(stand, state, state),
  hold,
  bell: racked(state),
});

/** Both bells: hang, hinge, pull up close to the body, rack, press overhead, lower to the rack and back down. */
const CLEAN_PRESS: Keyframe[] = [
  pair(TALL, "hang", 0.3),
  pair(HINGE, "between", 0.2),
  pair(DRIVE, "low", 0),
  pair(TALL, "high", 0),
  pair(TALL, "rack", 0.3),
  pair(TALL, "mid", 0),
  pair(TALL, "over", 0.5),
  pair(TALL, "mid", 0),
  pair(TALL, "rack", 0.15),
  pair(TALL, "low", 0),
];

/** A squat-family pose: hands relative to the shoulder (near, far). */
function squatPose(pelvis: Point, spine: number, near: Point, far: Point): Pose {
  const shoulder = shoulderOf(pelvis, spine);
  return {
    pelvis,
    chest: chestOf(pelvis, spine),
    hands: { near: off(shoulder, near[0], near[1]), far: off(shoulder, far[0], far[1]) },
    elbows: BENT,
    feet: { near: [6, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}
/** Two bells racked at the shoulders, elbows tucked in front of the ribs. */
const RACK_NEAR: Point = [32, -10];
const RACK_FAR: Point = [28, -6];

// ---------------------------------------------------------------- swings (side view)

/** Both hands on one bell, arms straight from the shoulder at `deg` (90 down, 0 forward, 180 back). */
function swingPose(stand: Stand, deg: number, extra: Partial<Pose> = {}): Pose {
  const shoulder = shoulderOf(stand.pelvis, stand.spine);
  const hand = along(shoulder, deg, REACH);
  return {
    pelvis: stand.pelvis,
    chest: chestOf(stand.pelvis, stand.spine),
    hands: { near: hand, far: hand },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [4, 0], far: [-4, 0] },
    toes: { near: 0, far: 0 },
    ...extra,
  };
}
/** Hips back, the bell hiked between the thighs. */
const HIKE: Stand = { pelvis: [-62, -132], spine: -32 };
/** Hips driving through, the arms still low. */
const SWING_DRIVE: Stand = { pelvis: [-12, -168], spine: -82 };
const swing = (stand: Stand, deg: number, hold: number): Keyframe => kf(swingPose(stand, deg), hold, { bell: "swing" });

/** The bell set on the floor 25 ahead of the toes, hips back, back flat, hands on the handle. */
const FLOOR_SET = hingeDown(32, -30);
function bellOnFloorPose(): Pose {
  const { pelvis, chest } = FLOOR_SET;
  return {
    pelvis,
    chest,
    hands: { near: [32, FLOOR_HAND], far: [30, FLOOR_HAND] },
    elbows: BENT,
    feet: { near: [-18, 0], far: [-24, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- curls

/** Elbow(s) pinned at the sides of the ribs, the forearm `fore` degrees (90 hanging down, -60 raised). */
function curlPose(fore: number, both: boolean): Pose {
  const pelvis: Point = [2, -172];
  const shoulder = shoulderOf(pelvis, -90);
  const elbow = along(shoulder, 92, 60);
  const hand = fore === 90 ? off(shoulder, 12, 125.4 - 4) : along(elbow, fore, 66);
  const pin = fore === 90 ? {} : { elbows: { near: { at: elbow }, ...(both ? { far: { at: elbow } } : {}) } };
  return {
    pelvis,
    chest: chestOf(pelvis, -90),
    hands: { near: hand, far: both ? hand : [-6, -146] },
    ...(fore === 90 ? { elbows: BENT } : { elbows: { far: { bend: 1 }, ...pin.elbows } }),
    feet: { near: [4, 0], far: [-4, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- hip airplane (side + front)

/** How far the hips and shoulders roll open (degrees), together as one unit about the standing hip. */
const AIRPLANE_ROLL = 75;
/** Arms out like wings: shoulder centre to fingertip along the shoulder line. */
const WING = 147;

/**
 * Stand on the near leg (soft knee), hinge until the torso and the free (far) leg make a long
 * line, arms out to the sides like wings. `open` 0: hips and shoulders square to the floor;
 * 1: pelvis and torso rolled open together (`hipTwist` = `twist`) about the standing hip, the
 * free-side hip, shoulder and arm turning up to the ceiling and the free leg lifting with them,
 * the near arm pointing down at the floor. Twist + turns the far shoulder towards the chest's
 * front (the floor, hinged), so opening is negative.
 */
function airplane(open: number): Keyframe {
  const pelvis: Point = [0, -164];
  const spine = -6;
  const roll = -AIRPLANE_ROLL * open;
  const r = (roll * Math.PI) / 180;
  const centre = shoulderOf(pelvis, spine);
  // The chest's front for a hinged spine: the spine direction turned +90 (down).
  const u = (spine * Math.PI) / 180;
  const front: Point = [-Math.sin(u), Math.cos(u)];
  const reach = WING * Math.sin(r);
  const wing = (sign: number): Point => [round(centre[0] + sign * reach * front[0]), round(centre[1] + sign * reach * front[1])];
  const wingZ = round(WING * Math.cos(r));
  return {
    hold: open === 0 || open === 1 ? 0.5 : 0,
    pose: {
      pelvis,
      chest: chestOf(pelvis, spine),
      hands: { far: wing(1), near: wing(-1) },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 } },
      feet: { near: [2, 0], far: { dir: 188 - 8 * open, length: 173.9 } },
      toes: { near: 0 },
    },
    sideways: {
      twist: round(roll),
      hipTwist: round(roll),
      feet: { near: -8, far: round(8 + 26 * open) },
      hands: { near: -wingZ, far: wingZ },
    },
  };
}

export const BATCH_BK_SPECS: DoodleSpec[] = [
  {
    id: "fedb_two_arm_kettlebell_row",
    slug: "two-arm-kettlebell-row",
    title: "Two-Arm Kettlebell Row",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near", "far"], size: BELL },
    transition: 0.7,
    frames: [kf(twoArmRow(false), 0.4), kf(twoArmRow(true), 0.5), kf(twoArmRow("lowering"), 0)],
  },
  {
    id: "wger_1003",
    slug: "kettlebell-deadlifts",
    title: "Kettlebell deadlifts",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 1,
    frames: [kf(deadlift(true), 0.5), kf(deadlift(false), 0.5)],
  },
  {
    id: "wger_1612",
    slug: "kettlebell-sumo-deadlift",
    title: "Kettlebell sumo deadlift",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 1,
    frames: [sumo(true, 0.5), sumo(false, 0.5)],
  },
  {
    id: "wger_1022",
    slug: "single-arm-plank-to-row",
    title: "Single Arm Plank to Row",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near", "far"], size: BELL },
    transition: 0.6,
    frames: [kf(plankRow(false), 0.4), kf(plankRow(true), 0.5)],
  },
  {
    id: "wger_1099",
    slug: "dynamic-side-hold",
    title: "Dynamic side hold",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.8,
    frames: [kf(sideHold("far"), 0.6), kf(sideHold(undefined), 0.1), kf(sideHold("near"), 0.6), kf(sideHold(undefined), 0.1)],
  },
  {
    id: "wger_1360",
    slug: "double-kettlebell-clean-and-press",
    title: "Double Kettlebell Clean and Press",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near", "far"], size: BELL },
    transition: 0.4,
    frames: CLEAN_PRESS,
  },
  {
    id: "wger_1361",
    slug: "double-kettlebell-front-squat",
    title: "Double Kettlebell Front Squat",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near", "far"], size: BELL },
    transition: 1.1,
    frames: [
      kf(squatPose([0, -172], -90, RACK_NEAR, RACK_FAR), 0.4, { bell: "rack" }),
      kf(squatPose([-48, -66], -78, RACK_NEAR, RACK_FAR), 0.5, { bell: "rack" }),
    ],
  },
  {
    id: "wger_331",
    slug: "kettlebell-swings",
    title: "Kettlebell Swings",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.35,
    frames: [swing(HIKE, 128, 0.15), swing(SWING_DRIVE, 55, 0), swing(TALL, -4, 0.2), swing(SWING_DRIVE, 55, 0)],
  },
  {
    id: "wger_9",
    slug: "2-handed-kettlebell-swing",
    title: "2 Handed Kettlebell Swing",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.4,
    frames: [
      kf(bellOnFloorPose(), 0.5),
      swing(HIKE, 128, 0.1),
      swing(SWING_DRIVE, 55, 0),
      swing(TALL, -4, 0.2),
      swing(SWING_DRIVE, 55, 0),
    ],
  },
  {
    id: "wger_974",
    slug: "curl-with-kettlebell-two-hands",
    title: "Curl with kettlebell two hands",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.9,
    frames: [kf(curlPose(90, true), 0.4), kf(curlPose(-62, true), 0.5)],
  },
  {
    id: "wger_975",
    slug: "one-handed-kettlebell-curls",
    title: "One-handed kettlebell curls",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.9,
    frames: [kf(curlPose(90, false), 0.4), kf(curlPose(-62, false), 0.5)],
  },
  {
    id: "wger_2447",
    slug: "hip-airplane",
    title: "Hip Airplane",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.9,
    frames: [airplane(0), airplane(0.5), airplane(1), airplane(0.5)],
  },
];
