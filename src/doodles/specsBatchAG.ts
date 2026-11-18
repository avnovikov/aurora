import { solvePose } from "./rig";
import type { DoodleSpec, Point, Pose } from "./rig";
import { proneFromAbove, SIDE_LYING_FLOOR } from "./specsWarmup";

/**
 * Batch AG: all fours, face down and hip moves. Floor at y = 0, up is negative,
 * the side-view figure faces +x (lying face up has the head at -x, lying face
 * down the head at +x). Side-lying moves use the front view (near = bottom side,
 * far = top side); the skydiver is seen from above like the prone Y-T-W.
 * Import only from ./rig and other batch files — never from ./specs (that would be circular).
 *
 * Left out:
 * - Fire hydrant (ntc_fire_hydrant) and Fire Hydrant Circles (wger_1956): the
 *   bent knee lifts out to the side, straight at the camera in side view; from
 *   the front the all-fours torso points at the camera and from above the
 *   thighs and arms do, and the rig cannot foreshorten any of them.
 * - Scorpion Kick (wger_1207): the hips rotate to swing the foot across the
 *   body; the rig has no torso rotation.
 * - Butterfly Superman (wger_1908): fingers laced behind the head with the elbows
 *   out wide. From the side the fixed-length arms can only reach the back of the
 *   head with the elbow folded backwards or through the head; from above the
 *   lift of the chest and elbows points at the camera, so nothing moves.
 * - Seated Hip Abduction (wger_1672): the knees push apart sideways, invisible
 *   from the side; from the front the seated thighs point at the camera and
 *   cannot be foreshortened, so the knees would hang a full thigh below the seat.
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

type Side = "near" | "far";

// ---------------------------------------------------------------- clamshell to reverse clamshell (front view, head left)

/* Same geometry as the clamshell in specsBatchD / specsBatchO: knees forward and up, feet together. */
const CLAM_PELVIS: Point = [0, -24];
const CLAM_BOTTOM_KNEE = along([CLAM_PELVIS[0], CLAM_PELVIS[1] + 8], -24, 88);
const CLAM_BOTTOM_FOOT = along(CLAM_BOTTOM_KNEE, 30, 86);

/** Side-lying, head on the straight lower arm, knees bent, feet together; `open` (0..1) lifts the top knee. */
function clamshell(open: number): Pose {
  const topAnkle: Point = [round(CLAM_BOTTOM_FOOT[0] + 6 - 40 * open), round(CLAM_BOTTOM_FOOT[1] - 12 - 10 * open)];
  return {
    pelvis: CLAM_PELVIS,
    chest: [-80, CLAM_PELVIS[1]],
    head: [-134, -30],
    spine: { bend: -1 },
    hands: { near: [-223.5, -3], far: [26, -44] },
    elbows: { near: { bend: 1 }, far: { bend: -1 } },
    knees: { near: { at: CLAM_BOTTOM_KNEE }, far: { bend: -1 } },
    feet: { near: CLAM_BOTTOM_FOOT, far: topAnkle },
    toes: { near: 0, far: 0 },
  };
}

/** Closed clamshell with the top knee kept on the bottom knee and the top shin turned up by `lift` degrees. */
function reverseClam(lift: number): Pose {
  const closed = clamshell(0);
  const top = solvePose(closed, { view: "front" }).legs.far;
  const shin = angle(top.mid, top.joint);
  return {
    ...closed,
    knees: { near: { at: CLAM_BOTTOM_KNEE }, far: { at: [round(top.mid[0]), round(top.mid[1])] } },
    feet: { near: CLAM_BOTTOM_FOOT, far: along(top.mid, shin - lift, 86) },
    toes: { near: 0, far: round(-lift / 2) },
  };
}

// ---------------------------------------------------------------- all fours (side view)

const AF_PELVIS: Point = [-50, -92];
const AF_HANDS = { near: [48, 0] as Point, far: [44, 0] as Point };
const AF_FEET = { near: [-136, -4] as Point, far: [-132, -4] as Point };

/** Hands under the shoulders, knees under the hips, tops of the feet flat. */
function allFours(): Pose {
  return { pelvis: AF_PELVIS, hands: AF_HANDS, feet: AF_FEET, toes: { near: 180, far: 180 } };
}

/** Chest where the straight support arm left it, pinned once a hand leaves the floor. */
const AF_CHEST = along(AF_PELVIS, -20.5, 80);
const AF_SHOULDER = along(AF_PELVIS, -20.5, 98);

/** Bird dog: `arm` reaches forward a little below level, the opposite leg pushes straight back at hip height. */
function birdDog(arm: Side): Pose {
  const leg: Side = arm === "near" ? "far" : "near";
  return {
    pelvis: AF_PELVIS,
    chest: AF_CHEST,
    hands: { [arm]: along(AF_SHOULDER, 20, 125), [leg]: AF_HANDS[leg] },
    feet: { [arm]: AF_FEET[arm], [leg]: along(AF_PELVIS, 182, 173.6) },
    toes: { [arm]: 180, [leg]: 95 },
  };
}

/** Rear leg raise: the near leg pushed straight back and up, a little above hip height. */
function rearLegRaise(): Pose {
  return {
    ...allFours(),
    knees: { near: { at: along(AF_PELVIS, 189, 88) } },
    feet: { near: along(AF_PELVIS, 189, 173.6), far: AF_FEET.far },
    toes: { near: 100, far: 180 },
  };
}

/**
 * Knee circle on all fours: the near knee off the floor at `thigh` degrees from the hip
 * (90 = straight down, < 90 forward under the chest, > 90 back), the shin at `shin` degrees.
 */
function kneeCircle(thigh: number, shin: number): Pose {
  const knee = along(AF_PELVIS, thigh, 88);
  return {
    ...allFours(),
    knees: { near: { at: knee } },
    feet: { near: along(knee, shin, 86), far: AF_FEET.far },
    toes: { near: round(shin + 90), far: 180 },
  };
}

// ---------------------------------------------------------------- lying face up (side view, head left)

const SUPINE_CHORD = 77;

/** Upper back and head on the floor, arms long by the sides, hips at `pelvis` (as specsBatchD). */
function lyingFaceUp(pelvis: Point): Pose {
  const dy = -18 - pelvis[1];
  const chest: Point = [round(pelvis[0] - Math.sqrt(SUPINE_CHORD ** 2 - dy * dy)), -18];
  const head: Point = [round(chest[0] - 55), -24];
  const base: Pose = { pelvis, chest, head, spine: { bend: -1 } };
  const shoulder = solvePose(base).arms.near.root;
  const reach = 125.4;
  const handY = -6;
  const handX = round(shoulder[0] + Math.sqrt(reach ** 2 - (shoulder[1] - handY) ** 2));
  return {
    ...base,
    hands: { near: [handX, handY], far: [handX, handY - 1] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

/** Frog pump: heels pulled in close to the seat, soles together; `pelvisY` lifts the hips. */
function frogPump(pelvisY: number): Pose {
  return {
    ...lyingFaceUp([-12, pelvisY]),
    feet: { near: [62, -6], far: [58, -6] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- skydiver (seen from above, head at +x)

/** Arms out in a T; legs `spread` degrees either side of the body line. */
function skydiver(spread: number): Pose {
  const base = proneFromAbove(90);
  const hipNear: Point = [-40, -158];
  const hipFar: Point = [-40, -142];
  return {
    ...base,
    // Straight legs: knees pinned on the hip-to-ankle line.
    knees: { near: { at: along(hipNear, 180 + spread, 88) }, far: { at: along(hipFar, 180 - spread, 88) } },
    feet: { near: along(hipNear, 180 + spread, 173.97), far: along(hipFar, 180 - spread, 173.97) },
    toes: { near: 180 + spread, far: 180 - spread },
  };
}

// ---------------------------------------------------------------- hamstring kicks (standing, side view)

/** A full straight leg above the floor, so the standing legs are drawn dead straight. */
const HK_PELVIS: Point = [0, -173.9];

/** Standing tall, or kicking the straight `kick` leg up to the opposite hand held out at shoulder height. */
function hamstringKick(kick: Side | null): Pose {
  if (!kick) {
    return {
      pelvis: HK_PELVIS,
      chest: [0, -253.9],
      hands: { near: [4, -146.1], far: [-4, -146.1] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      // Straight legs: knees pinned halfway down, so the kick swings up straight.
      knees: { near: { at: [0, -85.9] }, far: { at: [0, -85.9] } },
      feet: { near: [0, 0], far: [0, 0] },
      toes: { near: 0, far: 0 },
    };
  }
  const other: Side = kick === "near" ? "far" : "near";
  const chest = along(HK_PELVIS, -88, 80);
  const shoulder = along(HK_PELVIS, -88, 98);
  return {
    pelvis: HK_PELVIS,
    chest,
    hands: { [other]: along(shoulder, 2, 125.9), [kick]: along(shoulder, 120, 120) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { [kick]: { at: along(HK_PELVIS, -30, 88) } },
    feet: { [kick]: along(HK_PELVIS, -30, 173.9), [other]: [0, 0] },
    toes: { [kick]: -80, [other]: 0 },
  };
}

// ---------------------------------------------------------------- specs

export const BATCH_AG_SPECS: DoodleSpec[] = [
  {
    id: "wger_2449",
    slug: "clamshell-to-reverse-clamshell",
    title: "Clamshell to Reverse Clamshell",
    view: "front",
    props: [SIDE_LYING_FLOOR],
    transition: 0.9,
    frames: [
      { hold: 0.3, pose: clamshell(0) },
      // Feet together, the top knee opens towards the ceiling...
      { hold: 0.5, pose: clamshell(1) },
      { hold: 0.3, pose: clamshell(0) },
      // ...then knees together, the top foot lifts.
      { hold: 0.5, pose: reverseClam(95) },
    ],
  },
  {
    id: "ntc_frog_pumps",
    slug: "frog-pumps",
    title: "Frog pumps",
    transition: 0.4,
    frames: [
      { hold: 0.15, pose: frogPump(-24) },
      { hold: 0.25, pose: frogPump(-66) },
    ],
  },
  {
    id: "wger_1910",
    slug: "kneeling-superman",
    title: "Kneeling Superman",
    transition: 1,
    frames: [
      { hold: 0.3, pose: allFours() },
      { hold: 0.7, pose: birdDog("near") },
      { hold: 0.3, pose: allFours() },
      { hold: 0.7, pose: birdDog("far") },
    ],
  },
  {
    id: "wger_1210",
    slug: "skydiver-arms-t",
    title: "Skydiver with arms in T-position",
    view: "front",
    transition: 0.7,
    frames: [
      // Seen from above: chest, arms and legs held off the floor (invisible here), legs open and close.
      { hold: 0.3, pose: skydiver(2) },
      { hold: 0.3, pose: skydiver(14) },
    ],
  },
  {
    id: "wger_1387",
    slug: "hamstring-kicks",
    title: "Hamstring Kicks",
    transition: 0.6,
    frames: [
      { hold: 0.2, pose: hamstringKick(null) },
      { hold: 0.3, pose: hamstringKick("near") },
      { hold: 0.2, pose: hamstringKick(null) },
      { hold: 0.3, pose: hamstringKick("far") },
    ],
  },
  {
    id: "fedb_rear_leg_raises",
    slug: "rear-leg-raises",
    title: "Rear Leg Raises",
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: allFours() },
      { hold: 0.6, pose: rearLegRaise() },
    ],
  },
  {
    id: "fedb_hip_circles_prone",
    slug: "hip-circles-prone",
    title: "Hip Circles (prone)",
    transition: 0.6,
    frames: [
      // Side view: the knee sweeps forward under the chest, then back and up behind
      // (the out-to-the-side half of the circle points at the camera).
      { hold: 0.1, pose: kneeCircle(55, 185) },
      { hold: 0, pose: kneeCircle(115, 215) },
      { hold: 0.1, pose: kneeCircle(178, 270) },
      { hold: 0, pose: kneeCircle(140, 235) },
    ],
  },
];
