import { solvePose } from "./rig";
import type { DoodleSpec, Point, Pose } from "./rig";

/**
 * Batch AE (#174): lying core moves — crunches and sit-ups, reverse-crunch
 * hip raises, bottoms up, cocoons and forearm-plank butt-ups.
 * Floor at y = 0, up is negative. Lying face up has the head at -x and the
 * feet at +x; the forearm plank faces +x.
 * Import only from ./rig — never from ./specs (that would be circular).
 *
 * Left out:
 * - Air Bike (fedb_air_bike) and Bicycle Crunch (hf_115): elbow to the
 *   opposite knee is a rotation of the torso; side view shows only the leg
 *   pedal and the twist that defines the move is invisible.
 * - Cross-Body Crunch (fedb_cross_body_crunch): one shoulder crosses the body
 *   to the opposite knee, again a torso rotation.
 * - Alternate Heel Touchers (fedb_alternate_heel_touchers): the side bend only
 *   shows from above, where the bent knees point at the camera (see batch Y).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Where circles around `a` (radius ra) and `b` (radius rb) meet; `pick` chooses between the two points. */
function meet(a: Point, ra: number, b: Point, rb: number, pick: (p: Point, q: Point) => boolean): Point {
  const d = dist(a, b);
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  const p: Point = [round(a[0] + ux * x - uy * h), round(a[1] + uy * x + ux * h)];
  const q: Point = [round(a[0] + ux * x + uy * h), round(a[1] + uy * x - ux * h)];
  return pick(p, q) ? p : q;
}

const upper = (p: Point, q: Point): boolean => p[1] < q[1];

const THIGH = 88;
const SHIN = 86;
/** Shoulder to fingertip with the elbow just short of locked. */
const REACH = 125.4;

/** Shoulder of a solved pose (near side). */
const shoulderOf = (pose: Pose): Point => solvePose(pose).arms.near.root;

/** Knees pinned on the hip→ankle line, so straight legs never kink. */
function straightLegs(pelvis: Point, near: number, far: number, toe = 0): Pick<Pose, "knees" | "feet" | "toes"> {
  return {
    knees: { near: { at: along(pelvis, near, THIGH) }, far: { at: along(pelvis, far, THIGH) } },
    feet: { near: along(pelvis, near, THIGH + SHIN), far: along(pelvis, far, THIGH + SHIN) },
    toes: { near: round(near + toe), far: round(far + toe) },
  };
}

// ---------------------------------------------------------------- curl-ups (head at -x, pelvis fixed)

const CURL_PELVIS: Point = [-8, -20];
const CURL_FEET: Point = [84, -2];

type Arms = "temple" | "chest" | "overhead";

/**
 * Torso pivots at the hips at `theta` (≈183 lying, ≈212 crunched, 270 sitting
 * upright); `tuck` tips the chin toward the chest. Knees bent, feet flat.
 * - temple: fingertips lightly beside the head, the elbow out past the face.
 * - chest: arms crossed on the chest, hands at the opposite shoulders.
 * - overhead: straight arms reaching past the head, just clear of it.
 */
function curl(theta: number, tuck: number, arms: Arms): Pose {
  const pelvis = CURL_PELVIS;
  const chest = along(pelvis, theta, 80);
  const head = along(chest, theta + tuck, 56);
  const base: Pose = { pelvis, chest, head };
  const shoulder = shoulderOf(base);
  const legs: Pose = { feet: { near: CURL_FEET, far: [CURL_FEET[0] - 3, CURL_FEET[1]] }, toes: { near: 0, far: 0 } };
  if (arms === "chest") {
    const elbow = along(shoulder, theta + 150, 60);
    const elbowFar = along(shoulder, theta + 148, 60);
    return {
      ...base,
      ...legs,
      hands: { near: along(elbow, theta - 8, 66), far: along(elbowFar, theta - 10, 66) },
      elbows: { near: { at: elbow }, far: { at: elbowFar } },
    };
  }
  if (arms === "overhead") {
    const reach = theta + 28;
    return {
      ...base,
      ...legs,
      hands: { near: along(shoulder, reach, REACH), far: along(shoulder, reach + 1, REACH) },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
    };
  }
  // Face side of the torso is theta + 90; the elbow points that way.
  const face = ((theta + 90) * Math.PI) / 180;
  const facing = (p: Point, q: Point): boolean =>
    (p[0] - shoulder[0]) * Math.cos(face) + (p[1] - shoulder[1]) * Math.sin(face) >
    (q[0] - shoulder[0]) * Math.cos(face) + (q[1] - shoulder[1]) * Math.sin(face);
  const hand = along(head, theta + 75, 22);
  const handFar = along(hand, theta, 3);
  return {
    ...base,
    ...legs,
    hands: { near: hand, far: handFar },
    elbows: { near: { at: meet(shoulder, 60, hand, 66, facing) }, far: { at: meet(shoulder, 60, handFar, 66, facing) } },
  };
}

// ---------------------------------------------------------------- crunch with legs up (head at -x)

const LEGS_UP_PELVIS: Point = [0, -20];

/** Legs straight up, arms reaching from the shoulders toward the toes; `theta` curls the shoulders up. */
function legsUpCrunch(theta: number, tuck: number): Pose {
  const pelvis = LEGS_UP_PELVIS;
  const chest = along(pelvis, theta, 80);
  const head = along(chest, theta + tuck, 56);
  const base: Pose = { pelvis, chest, head };
  const shoulder = shoulderOf(base);
  const legs = straightLegs(pelvis, -88, -89);
  const toe = legs.feet?.near as Point;
  const aim = angle(shoulder, toe);
  return {
    ...base,
    ...legs,
    hands: { near: along(shoulder, aim, REACH), far: along(shoulder, aim - 1, REACH) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

// ---------------------------------------------------------------- lying, arms by the sides (head at -x)

const SUPINE_CHORD = 77;

/** Back on the floor (chest at y = -18), straight arms by the sides with the palms down. */
function supine(pelvis: Point): Pose {
  const dy = -18 - pelvis[1];
  const chest: Point = [round(pelvis[0] - Math.sqrt(SUPINE_CHORD ** 2 - dy * dy)), -18];
  const head: Point = [round(chest[0] - 55), -24];
  const base: Pose = { pelvis, chest, head, spine: { bend: -1 } };
  const shoulder = shoulderOf(base);
  const handY = -12;
  const handX = round(shoulder[0] + Math.sqrt(125.9 ** 2 - (shoulder[1] - handY) ** 2));
  return {
    ...base,
    hands: { near: [handX, handY], far: [round(handX - 0.4), handY] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

/** Bent legs: thigh at `thigh` degrees from the pelvis, shin at `shin` degrees from the knee. */
function bentLegs(pelvis: Point, thigh: number, shin: number): Pick<Pose, "knees" | "feet" | "toes"> {
  const kneeNear = along(pelvis, thigh, THIGH);
  const kneeFar = along(pelvis, thigh - 2, THIGH);
  return {
    knees: { near: { at: kneeNear }, far: { at: kneeFar } },
    feet: { near: along(kneeNear, shin, SHIN), far: along(kneeFar, shin - 2, SHIN) },
    toes: { near: round(Math.min(shin - 10, 10)), far: round(Math.min(shin - 12, 8)) },
  };
}

/** Bent-knee hip raise: knees bent, feet just off the floor; `lift` 1 draws the knees in and curls the hips up. */
function hipRaise(lift: number): Pose {
  const pelvis: Point = [round(-10 - 12 * lift), round(-20 - 30 * lift)];
  const thigh = -48 - 70 * lift;
  // The knee angle stays the same: the shin follows the thigh round.
  return { ...supine(pelvis), ...bentLegs(pelvis, thigh, thigh + 112) };
}

/** Bottoms up stages. */
function bottomsUp(stage: "flat" | "tuck" | "up" | "hips"): Pose {
  if (stage === "flat") {
    const pelvis: Point = [-10, -20];
    return { ...supine(pelvis), ...straightLegs(pelvis, -2, -3, 6) };
  }
  if (stage === "tuck") {
    const pelvis: Point = [-14, -24];
    return { ...supine(pelvis), ...bentLegs(pelvis, -112, 20) };
  }
  if (stage === "up") {
    const pelvis: Point = [-12, -22];
    return { ...supine(pelvis), ...straightLegs(pelvis, -88, -89) };
  }
  // Pelvis curls up off the floor; the straight legs press toward the ceiling, tipping back a little.
  const pelvis: Point = [-28, -62];
  return { ...supine(pelvis), ...straightLegs(pelvis, -104, -105) };
}

// ---------------------------------------------------------------- cocoons (head at -x)

/** Lying long: straight arms overhead held just off the floor, straight legs just off the floor. */
function cocoonOpen(): Pose {
  const pelvis: Point = [0, -18];
  const chest: Point = [-79, -22];
  const base: Pose = { pelvis, chest, head: along(chest, 184, 56) };
  const shoulder = shoulderOf(base);
  return {
    ...base,
    hands: { near: along(shoulder, 212, REACH), far: along(shoulder, 213, REACH) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    ...straightLegs(pelvis, -6, -7),
  };
}

/** Halfway: shoulders lifting, arms straight up, knees drawing in. */
function cocoonMid(): Pose {
  const pelvis: Point = [-2, -20];
  const theta = 198;
  const chest = along(pelvis, theta, 80);
  const base: Pose = { pelvis, chest, head: along(chest, theta + 8, 56) };
  const shoulder = shoulderOf(base);
  return {
    ...base,
    hands: { near: along(shoulder, -86, REACH), far: along(shoulder, -87, REACH) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    ...bentLegs(pelvis, -60, 10),
  };
}

/** Closed: shoulders curled up, knees tucked to the chest with the hips just off the floor, arms reaching past the knees. */
function cocoonClosed(): Pose {
  const pelvis: Point = [-6, -30];
  const theta = 212;
  const chest = along(pelvis, theta, 80);
  const base: Pose = { pelvis, chest, head: along(chest, theta + 16, 56) };
  const shoulder = shoulderOf(base);
  return {
    ...base,
    hands: { near: along(shoulder, -12, REACH), far: along(shoulder, -13, REACH) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    ...bentLegs(pelvis, -98, 28),
  };
}

// ---------------------------------------------------------------- butt-ups (forearm plank, facing +x)

const BU_ELBOW: Point = [62, -4];
const BU_FOOT: Point = [-206, -19];

/** Forearm plank (`pike` 0) to a high pike on the forearms (`pike` 1). */
function buttUp(pike: number): Pose {
  // The shoulders rock back behind the elbows as the hips rise; the heels lift.
  const shoulder = along(BU_ELBOW, -90 - 42 * pike, 60);
  const foot: Point = [round(BU_FOOT[0] + 4 * pike), round(BU_FOOT[1] - 8 * pike)];
  const pelvis = meet(foot, 173.6, shoulder, 98, upper);
  const chest = along(pelvis, angle(pelvis, shoulder), 80);
  // Elbows exactly an upper arm from the shoulder, a hair either side of the mark.
  const elbowNear = along(shoulder, angle(shoulder, [BU_ELBOW[0] + 1, BU_ELBOW[1]]), 60);
  const elbowFar = along(shoulder, angle(shoulder, [BU_ELBOW[0] - 1, BU_ELBOW[1]]), 60);
  return {
    pelvis,
    chest,
    elbows: { near: { at: elbowNear }, far: { at: elbowFar } },
    // Head stays in line with the upper back; it lifts a little off the spine line in the pike so it clears the arms.
    head: along(chest, angle(pelvis, shoulder) - 34 * pike, 56),
    hands: { near: [round(elbowNear[0] + 66), elbowNear[1]], far: [round(elbowFar[0] + 66), elbowFar[1]] },
    feet: { near: foot, far: foot },
    toes: { near: round(62 - 10 * pike), far: round(62 - 10 * pike) },
  };
}

export const BATCH_AE_SPECS: DoodleSpec[] = [
  {
    id: "fedb_3_4_sit_up",
    slug: "three-quarter-sit-up",
    title: "3/4 Sit-Up",
    transition: 0.8,
    frames: [
      // Bottom: three quarters of the way down, back still off the floor.
      { hold: 0.15, pose: curl(204, 10, "temple") },
      { hold: 0.35, pose: curl(268, 10, "temple") },
    ],
  },
  {
    id: "wger_1933",
    slug: "abdominal-crunch",
    title: "Abdominal Crunch",
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: curl(183, 2, "temple") },
      { hold: 0.45, pose: curl(212, 12, "temple") },
    ],
  },
  {
    id: "fedb_bent_knee_hip_raise",
    slug: "bent-knee-hip-raise",
    title: "Bent-Knee Hip Raise",
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: hipRaise(0) },
      { hold: 0.45, pose: hipRaise(1) },
    ],
  },
  {
    id: "fedb_bottoms_up",
    slug: "bottoms-up",
    title: "Bottoms Up",
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: bottomsUp("flat") },
      { hold: 0.1, pose: bottomsUp("tuck") },
      { hold: 0.15, pose: bottomsUp("up") },
      { hold: 0.45, pose: bottomsUp("hips") },
      { hold: 0.1, pose: bottomsUp("up") },
    ],
  },
  {
    id: "fedb_butt_ups",
    slug: "butt-ups",
    title: "Butt-Ups",
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: buttUp(0) },
      { hold: 0.5, pose: buttUp(1) },
    ],
  },
  {
    id: "fedb_cocoons",
    slug: "cocoons",
    title: "Cocoons",
    transition: 0.6,
    frames: [
      { hold: 0.4, pose: cocoonOpen() },
      { hold: 0, pose: cocoonMid() },
      { hold: 0.5, pose: cocoonClosed() },
      { hold: 0, pose: cocoonMid() },
    ],
  },
  {
    id: "fedb_crunch_hands_overhead",
    slug: "crunch-hands-overhead",
    title: "Crunch - Hands Overhead",
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: curl(183, 0, "overhead") },
      { hold: 0.45, pose: curl(210, 0, "overhead") },
    ],
  },
  {
    id: "wger_174",
    slug: "crunches-with-legs-up",
    title: "Crunches With Legs Up",
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: legsUpCrunch(183, 4) },
      { hold: 0.45, pose: legsUpCrunch(214, 14) },
    ],
  },
  {
    id: "fedb_janda_sit_up",
    slug: "janda-sit-up",
    title: "Janda Sit-Up",
    // Slow up, slow down.
    transition: 1.4,
    frames: [
      { hold: 0.4, pose: curl(183, 2, "chest") },
      { hold: 0.4, pose: curl(250, 12, "chest") },
    ],
  },
];
