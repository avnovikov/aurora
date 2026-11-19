import { kettlebellOnFloor, SHOULDER_SIDE } from "./rig";
import type { BellMode, DoodleSpec, Keyframe, Point, Pose, Sideways } from "./rig";
import { TWO_VIEWS } from "./sideways";

/**
 * Batch AR (#212): kettlebell cleans, a one-legged deadlift, the sumo high pull.
 * Side view, facing +x, floor at y = 0.
 *
 * Gear: one bell in the near hand (`hang` below the grip, `rack` on the back of
 * the forearm, `swing` along the forearm: a bottoms-up bell stands on the fist).
 *
 * Left out: the two-bell cleans (a bell's mode is per keyframe, so one bell
 * can't hang while the other is racked) and the pass-throughs (figure 8, pass
 * between the legs, lunge pass-through: the bell changes hands, and a bell is
 * bound to one hand for the whole loop).
 */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const BELL = 14;
const FLOOR_HAND = round(kettlebellOnFloor(BELL));
/** Shoulder: 98 up the spine from the pelvis. */
const shoulderOf = (pelvis: Point, spine: number): Point => along(pelvis, spine, 98);
const chestOf = (pelvis: Point, spine: number): Point => along(pelvis, spine, 80);
/** Arm reach (shoulder to fingertip), a hair short so a locked arm draws straight. */
const REACH = 125.4;

interface Stand {
  pelvis: Point;
  spine: number;
  /** Feet x (near, far). */
  feet?: [number, number];
  /** Heels up. */
  toes?: [number, number];
}

/** Body and legs of a keyframe; the caller adds hands. */
function body({ pelvis, spine, feet = [4, -4], toes = [0, 0] }: Stand): Pose {
  return {
    pelvis,
    chest: chestOf(pelvis, spine),
    feet: { near: [feet[0], 0], far: [feet[1], 0] },
    toes: { near: toes[0], far: toes[1] },
  };
}

/** Both hands hanging from the shoulder at `angle` (90 = straight down). */
function hanging(stand: Stand, angle = 90): Pose {
  const s = shoulderOf(stand.pelvis, stand.spine);
  const hand = along(s, angle, REACH);
  const far = along(s, angle - 2, REACH);
  return { ...body(stand), hands: { near: hand, far } };
}

const frame = (pose: Pose, hold: number, bell?: BellMode): Keyframe => ({ pose, hold, ...(bell ? { bell } : {}) });

const TALL: Stand = { pelvis: [2, -172], spine: -90 };

/** Standing with the bell hanging at the thigh. */
function standHang(): Pose {
  return { ...body(TALL), hands: { near: [12, -146], far: [-6, -146] } };
}

/** Hinged, bell hanging between the knees (hang clean start). */
const HANG_STANCE: Stand = { pelvis: [-52, -150], spine: -38 };
function hangBetween(): Pose {
  return hanging(HANG_STANCE, 104);
}

/** Bell set on the floor ahead of the toes, hips back, chest up. */
const FLOOR_STANCE: Stand = { pelvis: [-62, -116], spine: -30, feet: [-18, -26], toes: [0, 0] };
function atFloor(): Pose {
  const s = shoulderOf(FLOOR_STANCE.pelvis, FLOOR_STANCE.spine);
  return { ...body(FLOOR_STANCE), hands: { near: [round(s[0] + 4), FLOOR_HAND], far: [round(s[0] - 2), FLOOR_HAND] } };
}

/**
 * The near arm bent: upper arm `up` degrees from the shoulder, forearm `fore`
 * degrees from the elbow (0 = +x, 90 = down, -90 = up), elbow and hand pinned
 * so the forearm keeps its direction.
 */
function bentArm(shoulder: Point, up: number, fore: number): Pick<Pose, "hands" | "elbows"> {
  const elbow = along(shoulder, up, 60);
  return { hands: { near: along(elbow, fore, 66) }, elbows: { near: { at: elbow } } };
}

/** Standing tall (hips under the shoulders) with the near arm bent and the far arm hanging. */
function tallArm(up: number, fore: number, pelvis: Point = [2, -172]): Pose {
  const stand: Stand = { pelvis, spine: -90 };
  const arm = bentArm(shoulderOf(pelvis, -90), up, fore);
  return { ...body(stand), hands: { near: arm.hands!.near!, far: [-8, -150] }, elbows: arm.elbows };
}

/** The pull: hips driven through, the bell close to the body, the elbow back. */
const pull = (): Pose => tallArm(105, -50);

/** Front rack: elbow tucked to the ribs, the fist at the collarbone, the bell on the back of the forearm. */
const rack = (): Pose => tallArm(75, -68);

/** Bottoms-up rack: forearm vertical, the bell upside down on the fist. */
const bottomsUp = (): Pose => tallArm(55, -76);

/** Overhead: the arm locked out straight above the shoulder (the bell racked on the back of the forearm). */
function overhead(pelvis: Point = [2, -172]): Pose {
  const stand: Stand = { pelvis, spine: -90 };
  return { ...body(stand), hands: { near: along(shoulderOf(pelvis, -90), -84, REACH), far: [pelvis[0] - 10, pelvis[1] + 26] } };
}

/** A quarter squat with the torso upright, the near arm racked or overhead. */
function dipped(arm: "rack" | "overhead"): Pose {
  const pelvis: Point = [-8, -138];
  if (arm === "overhead") return { ...overhead(pelvis), feet: body({ pelvis, spine: -90 }).feet };
  return tallArm(75, -68, pelvis);
}

/** One-legged deadlift: the standing leg and the bell hand on the same (near) side, the free leg back in line with the torso. */
function oneLeg(hinge: boolean): Pose {
  if (!hinge) {
    return {
      ...body({ pelvis: [0, -172], spine: -90, feet: [0, -34] }),
      feet: { near: [0, 0], far: [-34, -34] },
      toes: { near: 0, far: 70 },
      hands: { near: [12, -146], far: [-6, -146] },
    };
  }
  const pelvis: Point = [-6, -167];
  const spine = -6;
  const s = shoulderOf(pelvis, spine);
  return {
    pelvis,
    chest: chestOf(pelvis, spine),
    hands: { near: along(s, 90, REACH), far: along(s, 88, REACH) },
    feet: { near: [0, 0], far: [-179, -166] },
    toes: { near: 0, far: 90 },
  };
}

/** Sumo high pull stance: feet wide apart (sideways), knees tracking out. */
const SUMO_FEET_Z = 44;
const SUMO_HANDS_Z = 9;

/**
 * Sumo high pull. `bottom`: hips back, both hands on the bell on the floor.
 * `stand`: tall, bell at the thighs. `top`: elbows high and out, the bell at the chest.
 */
function sumoFrame(stage: "bottom" | "stand" | "top", hold: number): Keyframe {
  const sideways: Sideways = {
    hands: { near: -SUMO_HANDS_Z, far: SUMO_HANDS_Z },
    feet: { near: -SUMO_FEET_Z, far: SUMO_FEET_Z },
    knees: { near: { out: 22 }, far: { out: 22 } },
    ...(stage === "top" ? { elbows: { near: { out: 120 }, far: { out: 120 } } } : {}),
  };
  if (stage === "bottom") {
    const stance: Stand = { pelvis: [-52, -98], spine: -40, feet: [0, 0] };
    const s = shoulderOf(stance.pelvis, stance.spine);
    return { hold, sideways, pose: { ...body(stance), hands: { near: [s[0], FLOOR_HAND], far: [s[0], FLOOR_HAND] } } };
  }
  const pelvis: Point = [2, -166];
  const stand: Stand = { pelvis, spine: -90, feet: [0, 0] };
  if (stage === "stand") {
    return { hold, sideways, pose: { ...body(stand), hands: { near: [14, -141], far: [14, -141] } } };
  }
  const hand: Point = [30, -250];
  return { hold, sideways, pose: { ...body(stand), hands: { near: hand, far: hand } } };
}

/** Clean and jerk, two views: in the front panel the racked fist sits at the collarbone and the locked-out arm beside the head. */
const RACK_Z = -14;
const LOCKOUT_Z = -30;
const HANG_Z = -22;
const jerkFrame = (pose: Pose, hold: number, z: number, bell: BellMode = "rack"): Keyframe => ({
  pose,
  hold,
  bell,
  sideways: { hands: { near: z }, feet: { near: -9, far: 9 } },
});

// ---------------------------------------------------------------- pirate ships (two views)

/** Shoulder height and chest of the wide-stance figure. */
const PIRATE_PELVIS: Point = [0, -158];
const PIRATE_SHOULDER = shoulderOf(PIRATE_PELVIS, -90);
const FEET_Z = 42;

/** The bell hanging at waist level, both hands on it, the arms straight and `deg` degrees from +x in the side view (90 = down). */
function pirateLow(deg: number): Keyframe["pose"] {
  const hand = along(PIRATE_SHOULDER, deg, REACH - 1);
  return {
    pelvis: PIRATE_PELVIS,
    chest: chestOf(PIRATE_PELVIS, -90),
    hands: { near: hand, far: hand },
    feet: { near: [0, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Head height (the head's centre) and how far out to the side the hands go at the top of each swing. */
const PIRATE_TOP_Y = -290;
const PIRATE_TOP_Z = 50;

/**
 * Top of a swing, the bell out to one side (`z`) at head height, both arms
 * long and soft-elbowed from their own shoulders. The figure can't turn its
 * shoulders towards the bell, so the arm nearer the bell reaches a little
 * further forward than the other: the hands sit along the handle, a hand's
 * width apart front to back, as they do when the chest turns.
 */
function pirateTop(z: number): Keyframe["pose"] {
  const reach = REACH + 0.55;
  const rise = PIRATE_TOP_Y - PIRATE_SHOULDER[1];
  const flat = (shoulderZ: number): number => Math.sqrt(reach ** 2 - rise ** 2 - (z - shoulderZ) ** 2);
  const hand = (shoulderZ: number): Point => [round(PIRATE_SHOULDER[0] + flat(shoulderZ)), PIRATE_TOP_Y];
  return {
    pelvis: PIRATE_PELVIS,
    chest: chestOf(PIRATE_PELVIS, -90),
    hands: { near: hand(-SHOULDER_SIDE), far: hand(SHOULDER_SIDE) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [0, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

function pirateFrame(pose: Keyframe["pose"], z: number, hold: number, bell: BellMode): Keyframe {
  const sideways: Sideways = {
    hands: { near: z, far: z },
    feet: { near: -FEET_Z, far: FEET_Z },
    knees: { near: { out: 18 }, far: { out: 18 } },
  };
  return { pose, hold, bell, sideways };
}

export const BATCH_AR_SPECS: DoodleSpec[] = [
  {
    id: "fedb_kettlebell_hang_clean",
    slug: "kettlebell-hang-clean",
    title: "Kettlebell Hang Clean",
    props: [{ kind: "floor" }],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.5,
    frames: [
      frame(standHang(), 0.3),
      frame(hangBetween(), 0.3),
      frame(pull(), 0),
      frame(rack(), 0.5, "rack"),
      frame(pull(), 0),
    ],
  },
  {
    id: "fedb_kettlebell_dead_clean",
    slug: "kettlebell-dead-clean",
    title: "Kettlebell Dead Clean",
    props: [{ kind: "floor" }],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.5,
    frames: [
      frame(atFloor(), 0.4),
      frame(pull(), 0),
      frame(rack(), 0.5, "rack"),
      frame(pull(), 0),
    ],
  },
  {
    id: "fedb_one_arm_kettlebell_clean",
    slug: "one-arm-kettlebell-clean",
    title: "One Arm Kettlebell Clean",
    props: [{ kind: "floor" }],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.5,
    frames: [
      frame(atFloor(), 0.4),
      frame(pull(), 0),
      frame(rack(), 0.5, "rack"),
      frame(pull(), 0),
    ],
  },
  {
    id: "fedb_bottoms_up_clean_from_the_hang_position",
    slug: "bottoms-up-clean-from-the-hang",
    title: "Bottoms-Up Clean from the Hang Position",
    props: [{ kind: "floor" }],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.5,
    frames: [
      frame(standHang(), 0.3),
      frame(hangBetween(), 0.3),
      frame(pull(), 0),
      frame(bottomsUp(), 0.6, "swing"),
      frame(pull(), 0),
    ],
  },
  {
    id: "fedb_kettlebell_one_legged_deadlift",
    slug: "kettlebell-one-legged-deadlift",
    title: "Kettlebell One Legged Deadlift",
    props: [{ kind: "floor" }],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 1.1,
    frames: [frame(oneLeg(false), 0.5), frame(oneLeg(true), 0.6)],
  },
  {
    id: "fedb_kettlebell_sumo_high_pull",
    slug: "kettlebell-sumo-high-pull",
    title: "Kettlebell Sumo High Pull",
    views: TWO_VIEWS,
    props: [{ kind: "floor" }],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.6,
    frames: [sumoFrame("bottom", 0.4), sumoFrame("stand", 0), sumoFrame("top", 0.5), sumoFrame("stand", 0)],
  },
  {
    id: "fedb_kettlebell_pirate_ships",
    slug: "kettlebell-pirate-ships",
    title: "Kettlebell Pirate Ships",
    views: TWO_VIEWS,
    props: [{ kind: "floor" }],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.7,
    frames: [
      pirateFrame(pirateLow(65), 0, 0.3, "hang"),
      pirateFrame(pirateTop(-PIRATE_TOP_Z), -PIRATE_TOP_Z, 0.4, "swing"),
      pirateFrame(pirateLow(65), 0, 0.3, "hang"),
      pirateFrame(pirateTop(PIRATE_TOP_Z), PIRATE_TOP_Z, 0.4, "swing"),
    ],
  },
  {
    id: "fedb_one_arm_kettlebell_clean_and_jerk",
    slug: "one-arm-kettlebell-clean-and-jerk",
    title: "One Arm Kettlebell Clean and Jerk",
    views: TWO_VIEWS,
    props: [{ kind: "floor" }],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.45,
    frames: [
      jerkFrame(standHang(), 0.3, HANG_Z, "hang"),
      jerkFrame(hangBetween(), 0.2, HANG_Z, "hang"),
      jerkFrame(pull(), 0, RACK_Z, "swing"),
      jerkFrame(rack(), 0.4, RACK_Z),
      jerkFrame(dipped("rack"), 0.1, RACK_Z),
      jerkFrame(overhead(), 0, LOCKOUT_Z),
      jerkFrame(dipped("overhead"), 0.3, LOCKOUT_Z),
      jerkFrame(overhead(), 0.6, LOCKOUT_Z),
      jerkFrame(rack(), 0.2, RACK_Z),
      jerkFrame(pull(), 0, RACK_Z, "swing"),
    ],
  },
];
