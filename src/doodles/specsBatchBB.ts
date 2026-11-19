import { BONES, HIP_SIDE, solvePose, zOut } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose, Prop, Side, Sideways } from "./rig";
import { add3, scale3, solveKeyframe3, sub3, type Point3 } from "./rig3d";
import { TOP_VIEWS, TWO_VIEWS } from "./sideways";
import { ARM as ARM_BONES, chain, dirs, frame, LEG, REACH, roots, SIDES, type LimbSpec, type Spine } from "./specsBatchBA";
import { FLOOR_PROP, along, round, supineTorso } from "./geom";

/**
 * Batch BB: shoulder, arm and chest stretches, plus knee-to-chest holds.
 * Floor at y = 0, up is negative, the side-view figure faces +x (lying face up
 * has the head at -x). Import only from ./rig and other batch files, never
 * from ./specs (that would be circular).
 */

const THIGH = BONES.thigh;
const SHIN = BONES.shin;
const ARM = BONES.upperArm + BONES.forearm + BONES.hand;

// ---------------------------------------------------------------- lying on the back, knees to the chest

const SUPINE_PELVIS: Point = [0, -22];
const FLAT_ANKLE: Point = [173.2, -8];

function supine(): Pose {
  return supineTorso(SUPINE_PELVIS, 79.6);
}

/** Both knees drawn towards the chest: thigh angle from the hip (-90 = straight up, more negative = towards the head), knee flexion in degrees, hands `grip` of the way up the thigh. */
function hugKnees(thigh: number, flex: number, grip: number): Pose {
  const hip = SUPINE_PELVIS;
  const kneeNear = along(hip, thigh, THIGH);
  const kneeFar = along(hip, thigh - 3, THIGH);
  const hold = (angle: number): Point => along(along(hip, angle, grip), angle + 90, 9);
  return {
    ...supine(),
    hands: { near: hold(thigh), far: hold(thigh - 3) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: kneeNear }, far: { at: kneeFar } },
    feet: { near: along(kneeNear, thigh + flex, SHIN), far: along(kneeFar, thigh - 3 + flex, SHIN) },
    toes: { near: 0, far: 0 },
  };
}

/**
 * One knee drawn to the chest, the other leg long on the floor. The hands sit
 * `grip` along the thigh from the hip ("thigh": behind it) or just below the knee on the shin.
 */
function oneKnee(thigh: number, flex: number, hands: "thigh" | "shin", grip = 50): Pose {
  const hip = SUPINE_PELVIS;
  const knee = along(hip, thigh, THIGH);
  const shin = thigh + flex;
  const hold: Point = hands === "thigh" ? along(along(hip, thigh, grip), thigh + 90, 9) : along(along(knee, shin, 16), shin - 90, 8);
  return {
    ...supine(),
    hands: { near: hold, far: [round(hold[0] + 3), round(hold[1] + 3)] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: knee }, far: { bend: -1 } },
    feet: { near: along(knee, shin, SHIN), far: FLAT_ANKLE },
    toes: { near: 0, far: -80 },
  };
}

// ---------------------------------------------------------------- iron crosses (face down, side + top)

/**
 * Lying face down, head at +x (the 2D spine laid flat facing the floor), arms
 * straight out to the sides in a T with the palms on the floor. The working
 * leg bends (the heel lifts off the floor), then the hip on that side lifts and
 * rolls (`hipTwist`) while the bent leg swings over behind the body, the foot
 * reaching across towards the opposite hand. The shoulders stay flat.
 */
const IC_FLAT: Spine = { pelvis: [-40, -16], chest: [40, -18], head: [95.7, -24] };
const IC_LIFT: Spine = { pelvis: [-39.1, -30], chest: [40, -18], head: [95.7, -24] };

type IronStage = "rest" | "bend" | "cross";

function ironCross(working: Side, stage: IronStage, hold: number): Keyframe {
  const spine = stage === "cross" ? IC_LIFT : IC_FLAT;
  // The lifting hip is the working one: + rolls the far hip down, so the near hip comes up.
  const roll = working === "near" ? 38 : -38;
  const sideways: Sideways = { pelvis: 0, hipTwist: stage === "cross" ? roll : 0 };
  const fig = solveKeyframe3(solvePose(spine), spine as Pose, sideways);
  const arms = {} as Record<Side, LimbSpec>;
  const legs = {} as Record<Side, LimbSpec>;
  for (const side of SIDES) {
    const s = fig.arms[side].root;
    arms[side] = { plan: chain(s, ARM_BONES, [s[0], -5, s[2] + zOut(side) * REACH], [s[0], -60, s[2]]) };
    const hip = fig.legs[side].root;
    const z = zOut(side) * 10;
    if (side !== working || stage === "rest") {
      legs[side] = { plan: chain(hip, LEG, [hip[0] - 200, -8, z], [hip[0] - 87, -60, z]), toe: 176 };
    } else if (stage === "bend") {
      legs[side] = { plan: dirs(hip, LEG, [-1, (-10 - hip[1]) / LEG[0], 0], [0.12, -1, 0]), toe: -96 };
    } else {
      // Thigh lifted back and over the other leg, shin swinging down and forward: the foot
      // comes down beyond the other side, towards the opposite hand.
      const across = -zOut(side);
      legs[side] = { plan: dirs(hip, LEG, [-0.2, -0.45, across * 0.87], [0.6, 0.6, across * 0.53]), toe: 20 };
    }
  }
  const key = frame(hold, spine, { arms, legs });
  return { ...key, sideways: { ...key.sideways, hipTwist: sideways.hipTwist }, face: { turn: 0 } };
}

// ---------------------------------------------------------------- isometric chest squeeze (two views)

/**
 * Standing, palms together in front of the chest, fingers forward, elbows out.
 * `press` 0 = hands just touching, 1 = squeezing (elbows a little wider and
 * lifted, hands a touch nearer the chest).
 */
function chestSqueeze(press: number): Keyframe {
  const pelvis: Point = [0, -174];
  const chest: Point = [0, -254];
  const shoulder = solvePose({ pelvis, chest }).arms.near.root;
  const elbowZ = 40 + 14 * press;
  const dz = elbowZ - 22;
  const dy = 24 - 10 * press;
  const elbow: Point = [round(shoulder[0] + Math.sqrt(BONES.upperArm ** 2 - dz ** 2 - dy ** 2)), round(shoulder[1] + dy)];
  const reach = BONES.forearm + BONES.hand;
  const hand: Point = [round(elbow[0] + Math.sqrt(reach ** 2 - elbowZ ** 2 - 4 ** 2)), round(elbow[1] - 4)];
  return {
    hold: 0,
    pose: {
      pelvis,
      chest,
      hands: { near: hand, far: hand },
      elbows: { near: { at: elbow }, far: { at: elbow } },
      feet: { near: [-12, 0], far: [12, 0] },
      toes: { near: 0, far: 0 },
    },
    sideways: {
      hands: { near: 0, far: 0 },
      elbows: { near: { at: -elbowZ }, far: { at: elbowZ } },
      feet: { near: -12, far: 12 },
    },
  };
}

// ---------------------------------------------------------------- one arm against the wall (front view)

const AW_WALL: Prop = { kind: "box", x: -74, y: -420, w: 14, h: 420 };

/** Forearm up the wall above the shoulder, elbow out to the wall; `lean` 0..1 shifts the hips towards the wall. */
function armAgainstWall(lean: number): Pose {
  const pelvis: Point = [round(-26 * lean), round(-170 + 2 * lean)];
  const chest = along(pelvis, -90 + 18 * lean, 80);
  const shoulder = solvePose({ pelvis, chest }, { view: "front" }).arms.near.root;
  const elbow: Point = [-56, round(shoulder[1] - Math.sqrt(BONES.upperArm ** 2 - (-56 - shoulder[0]) ** 2))];
  return {
    pelvis,
    chest,
    hands: { near: [-56, round(elbow[1] - (BONES.forearm + BONES.hand))], far: [round(pelvis[0] + 22), round(pelvis[1] - 6)] },
    elbows: { near: { at: elbow }, far: { bend: -1 } },
    feet: { near: [-30, 0], far: [14, 0] },
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- overhead reach (side + front)

/**
 * Standing tall, fingers interlaced. `press` 0: the hands rest on top of the
 * head, elbows out to the sides; 1: the arms pressed straight up over the
 * shoulders, beside the ears (just wide of the head circle in the front
 * view). The spine and legs stay straight.
 */
const OH_SPINE: Spine = { pelvis: [0, -LEG[0] - LEG[1]], chest: [0, -LEG[0] - LEG[1] - 80], head: [2, -LEG[0] - LEG[1] - 136] };
/** Sideways position of each hand: on the head (fingers interlaced), and overhead, wide enough to clear the ears. */
const OH_HAND_Z = { onHead: 8, up: 30 };

function overheadReach(press: 0 | 1, hold: number): Keyframe {
  const { arm, leg } = roots(OH_SPINE);
  const arms = {} as Record<Side, LimbSpec>;
  const legs = {} as Record<Side, LimbSpec>;
  for (const side of SIDES) {
    const s = arm[side];
    const z = zOut(side) * (press === 1 ? OH_HAND_Z.up : OH_HAND_Z.onHead);
    const dz = z - s[2];
    const hand: Point3 = press === 1 ? [s[0], s[1] - Math.sqrt((REACH - 0.2) ** 2 - dz * dz), z] : [8, -346, z];
    arms[side] = { plan: chain(s, ARM_BONES, hand, [s[0], s[1] - 30, zOut(side) * 120]) };
    legs[side] = { plan: dirs(leg[side], LEG, [0, 1, 0], [0, 1, 0]), toe: 0 };
  }
  return frame(hold, OH_SPINE, { arms, legs });
}

// ---------------------------------------------------------------- seated side bend from butterfly (two views)

const SB_PELVIS: Point = [0, -10];

/** Butterfly legs: knees out to the sides (thighs `azimuth` degrees out from straight ahead), soles together in the middle. */
function butterflyLegs(azimuth: number, kneeLift: number): { knee: Point; kneeZ: number; foot: Point; footZ: number } {
  const r = (azimuth * Math.PI) / 180;
  const flat = Math.sqrt(THIGH ** 2 - kneeLift ** 2);
  const knee: Point = [round(flat * Math.cos(r)), round(SB_PELVIS[1] - kneeLift)];
  const kneeZ = HIP_SIDE + flat * Math.sin(r);
  const footZ = 3;
  const footY = -7;
  const dy = footY - knee[1];
  const dz = kneeZ - footZ;
  return { knee, kneeZ: round(kneeZ), foot: [round(knee[0] + Math.sqrt(SHIN ** 2 - dy * dy - dz * dz)), footY], footZ };
}

const unit3 = (v: Point3): Point3 => scale3(v, 1 / Math.hypot(v[0], v[1], v[2]));
const flat3 = (p: Point3): Point => [round(p[0]), round(p[1])];

/**
 * Sitting with the soles together, knees open. The far hand is on the floor
 * beside the hips; the near hand is behind the head, the elbow lifted to the
 * ceiling. The torso leans to the far side (`lean`: z of the chest, + is far),
 * away from the lifted elbow.
 */
function seatedSideBend(lean: number): Keyframe {
  const legs = butterflyLegs(58, 18);
  const pelvis = SB_PELVIS;
  const chest: Point = [0, round(pelvis[1] - 80)];
  const legPins = {
    knees: { near: { at: legs.knee }, far: { at: legs.knee } },
    feet: { near: legs.foot, far: legs.foot },
    toes: { near: 0, far: 0 },
  };
  const legZ = {
    knees: { near: { at: -legs.kneeZ }, far: { at: legs.kneeZ } },
    feet: { near: -legs.footZ, far: legs.footZ },
  };
  const base = { pelvis, chest, ...legPins };
  const sw = { pelvis: 0, chest: lean, ...legZ };
  const fig = solveKeyframe3(solvePose(base), base, sw);
  const shoulderNear = fig.arms.near.root;
  const shoulderFar = fig.arms.far.root;
  const head = fig.head;
  const floorHand: Point3 = [round(shoulderFar[0] + 6), -2, round(shoulderFar[2] + 66)];
  const elbow = add3(shoulderNear, scale3(unit3([-0.2, -0.85, -0.45]), BONES.upperArm));
  const ear: Point3 = add3(head, [-28, 4, -14]);
  const hand = add3(elbow, scale3(unit3(sub3(ear, elbow)), BONES.forearm + BONES.hand));
  return {
    hold: 0,
    pose: {
      ...base,
      hands: { near: flat3(hand), far: flat3(floorHand) },
      elbows: { near: { at: flat3(elbow) }, far: { bend: 1 } },
    },
    sideways: {
      ...sw,
      hands: { near: round(hand[2]), far: floorHand[2] },
      elbows: { near: { at: round(elbow[2]) } },
    },
  };
}

// ---------------------------------------------------------------- seated, hands behind (side view)

/** Spine lean back (degrees from upright) that puts straight arms from the pelvis's shoulder down to a hand at `hand`. */
function leanForHand(pelvis: Point, hand: Point): number {
  const reachFor = (lean: number): number => {
    const r = (lean * Math.PI) / 180;
    const shoulder: Point = [pelvis[0] - Math.sin(r) * 98, pelvis[1] - Math.cos(r) * 98];
    return Math.hypot(shoulder[0] - hand[0], shoulder[1] - hand[1]);
  };
  let [lo, hi] = [0, 80];
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (reachFor(mid) > ARM - 0.6) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const SH_HAND: Point = [-68, -2];

/** Sitting with the hands planted behind, arms straight; the hips (and flat feet) slide forward `slide`, so the shoulders sink. */
function handsBehind(slide: number): Pose {
  const pelvis: Point = [slide, -10];
  const lean = leanForHand(pelvis, SH_HAND);
  const chest = along(pelvis, -90 - lean, 80);
  return {
    pelvis,
    chest,
    head: along(pelvis, -90 - lean + 4, 134),
    hands: { near: SH_HAND, far: [SH_HAND[0] + 4, -2] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [round(slide + 84), -4], far: [round(slide + 80), -4] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- shoulder circles (two views)

/**
 * Standing, arms hanging, the shoulders rolled in a circle by the girdle:
 * `phase` (eighths of a turn) 0 = forward, 2 = up, 4 = back, 6 = down. The
 * chest and head stay still; each shoulder (and the hanging arm with it)
 * traces the loop: forward and back in the side view, up and down in the front.
 */
function shoulderCircle(phase: number): Keyframe {
  const a = (phase * Math.PI) / 4;
  const girdle = { up: round(14 * Math.sin(a)), forward: round(12 * Math.cos(a)) };
  // The hands hang plumb under the moved shoulders (centre [0, -270]), arms all but straight.
  const hand: Point = [round(girdle.forward + 1), round(-270 - girdle.up + ARM - 0.3)];
  return {
    hold: 0,
    pose: {
      pelvis: [0, -172],
      chest: [0, -252],
      head: [2, -306],
      hands: { near: hand, far: hand },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      feet: { near: [-1, 0], far: [3, 0] },
      toes: { near: 0, far: 0 },
    },
    sideways: { shoulders: { near: girdle, far: girdle }, hands: { near: -23, far: 23 }, feet: { near: -12, far: 12 } },
  };
}

// ---------------------------------------------------------------- wall lat stretch (side view)

const WL_WALL: Prop = { kind: "box", x: 156, y: -420, w: 14, h: 420 };
const WL_HAND: Point = [153, -270];

/** Hands on the wall above the shoulders, legs straight under the hips, the torso hinged level and the chest sinking (`lean` is its angle above horizontal). */
function wallLat(lean: number): Pose {
  const r = (lean * Math.PI) / 180;
  let [lo, hi] = [-260, 150];
  const shoulderAt = (px: number): Point => [px + Math.cos(r) * 98, -173.6 - Math.sin(r) * 98];
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    const s = shoulderAt(mid);
    if (Math.hypot(WL_HAND[0] - s[0], WL_HAND[1] - s[1]) > ARM - 0.8) lo = mid;
    else hi = mid;
  }
  const px = round((lo + hi) / 2);
  const pelvis: Point = [px, -173.6];
  const chest = along(pelvis, -lean, 80);
  return {
    pelvis,
    chest,
    head: along(chest, -lean + 32, 56),
    hands: { near: WL_HAND, far: [WL_HAND[0] - 2, WL_HAND[1] + 4] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [round(px - 1), 0], far: [round(px + 1), 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- specs

export const BATCH_BB_SPECS: DoodleSpec[] = [
  {
    id: "fedb_hug_knees_to_chest",
    slug: "hug-knees-to-chest",
    title: "Hug Knees To Chest",
    props: [FLOOR_PROP],
    transition: 1.4,
    frames: [
      { hold: 0.6, pose: hugKnees(-90, 95, 48) },
      { hold: 1.4, pose: hugKnees(-126, 158, 76) },
    ],
  },
  {
    id: "fedb_iron_crosses_stretch",
    slug: "iron-crosses-stretch",
    title: "Iron Crosses Stretch",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1,
    frames: [
      ironCross("near", "rest", 0.4),
      ironCross("near", "bend", 0.2),
      ironCross("near", "cross", 1.4),
      ironCross("near", "bend", 0.2),
      ironCross("far", "rest", 0.4),
      ironCross("far", "bend", 0.2),
      ironCross("far", "cross", 1.4),
      ironCross("far", "bend", 0.2),
    ],
  },
  {
    id: "fedb_isometric_chest_squeezes",
    slug: "isometric-chest-squeezes",
    title: "Isometric Chest Squeezes",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.9,
    frames: [
      { ...chestSqueeze(0), hold: 0.5 },
      { ...chestSqueeze(1), hold: 1.2 },
    ],
  },
  {
    id: "wger_1452",
    slug: "knee-to-chest-stretch",
    title: "Knee To Chest Stretch",
    props: [FLOOR_PROP],
    transition: 1.4,
    frames: [
      { hold: 0.6, pose: oneKnee(-80, 100, "thigh", 40) },
      { hold: 1.4, pose: oneKnee(-124, 150, "thigh", 52) },
    ],
  },
  {
    id: "fedb_one_arm_against_wall",
    slug: "one-arm-against-wall",
    title: "One Arm Against Wall",
    view: "front",
    props: [AW_WALL, FLOOR_PROP],
    transition: 1.4,
    frames: [
      { hold: 0.6, pose: armAgainstWall(0) },
      { hold: 1.4, pose: armAgainstWall(1) },
    ],
  },
  {
    id: "fedb_one_knee_to_chest",
    slug: "one-knee-to-chest",
    title: "One Knee To Chest",
    props: [FLOOR_PROP],
    transition: 1.4,
    frames: [
      { hold: 0.6, pose: oneKnee(-112, 110, "shin") },
      { hold: 1.4, pose: oneKnee(-126, 150, "shin") },
    ],
  },
  {
    id: "fedb_overhead_stretch",
    slug: "overhead-stretch",
    title: "Overhead Stretch",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.4,
    frames: [overheadReach(0, 0.5), overheadReach(1, 1.6)],
  },
  {
    id: "fedb_seated_overhead_stretch",
    slug: "seated-overhead-stretch",
    title: "Seated Overhead Stretch",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.4,
    frames: [
      { ...seatedSideBend(6), hold: 0.6 },
      { ...seatedSideBend(44), hold: 1.4 },
    ],
  },
  {
    id: "wger_1841",
    slug: "seated-shoulder-stretch-hands-behind",
    title: "Seated Shoulder Stretch Hands Behind",
    props: [FLOOR_PROP],
    transition: 1.5,
    frames: [
      { hold: 0.6, pose: handsBehind(0) },
      { hold: 1.4, pose: handsBehind(64) },
    ],
  },
  {
    id: "fedb_shoulder_circles",
    slug: "shoulder-circles",
    title: "Shoulder Circles",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.25,
    frames: [0, 1, 2, 3, 4, 5, 6, 7].map((phase) => shoulderCircle(phase)),
  },
  {
    id: "wger_2693",
    slug: "wall-lat-stretch",
    title: "Wall Lat Stretch",
    props: [WL_WALL, FLOOR_PROP],
    transition: 1.5,
    frames: [
      { hold: 0.6, pose: wallLat(24) },
      { hold: 1.4, pose: wallLat(6) },
    ],
  },
];
