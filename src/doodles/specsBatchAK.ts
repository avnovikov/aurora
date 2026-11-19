import { BONES, HIP_SIDE, SHOULDER_SIDE } from "./rig";
import type { DoodleSpec, Keyframe, Point, Prop } from "./rig";
import { TWO_VIEWS } from "./sideways";
import { allFoursKey, HYDRANT_SHIN, HYDRANT_THIGH, liftedKnee, type Dir3 } from "./specsBatchAG";

/**
 * Batch AK (#174): moves left out of the single-view batches because no one
 * view shows them, drawn in two views (side + front, keyframe `sideways`) from
 * the start. Floor at y = 0, up is negative, the side-view figure faces +x;
 * the front panel looks at the face, near side (z < 0) on the viewer's left.
 * Import only from ./rig and other batch files — never from ./specs (that would be circular).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

const THIGH = BONES.thigh;
const SHIN = BONES.shin;

// ---------------------------------------------------------------- fire hydrant (all fours)

/** `v` with its part along `t` removed, so the shin stays square to the thigh. */
function squareTo(t: Dir3, v: Dir3): Dir3 {
  const n = Math.hypot(t[0], t[1], t[2]);
  const u: Dir3 = [t[0] / n, t[1] / n, t[2] / n];
  const k = v[0] * u[0] + v[1] * u[1] + v[2] * u[2];
  return [v[0] - k * u[0], v[1] - k * u[1], v[2] - k * u[2]];
}

/** The bent knee somewhere on its circle out to the side; the shin stays square to the thigh, pointing back. */
const hydrant = (thigh: Dir3): Keyframe => liftedKnee("near", thigh, squareTo(thigh, [-1, 0.15, 0]));

/**
 * Fire hydrant circles: knee up and out to the side, then circling forward, out
 * and back: forward towards the elbow, out at hip height, back behind the hip,
 * and low under the side of the hip.
 */
const HYDRANT_CIRCLE: Keyframe[] = [
  { ...hydrant([0.6, 0.3, 0.74]), hold: 0 },
  { ...hydrant([0, -0.05, 1]), hold: 0 },
  { ...hydrant([-0.6, 0.15, 0.78]), hold: 0 },
  { ...hydrant([0, 0.55, 0.84]), hold: 0 },
];

// ---------------------------------------------------------------- seated hip abduction (box seat)

/** Hip joint height when seated; the feet sit flat, hip width apart, under the knees. */
const SEAT_PELVIS: Point = [0, -88];
const SEAT_TOP = -76;
/** Seen from the front the seat is a narrow post inside the knees (±7 together), so no shin crosses its sides. */
const SEAT_BOX: Prop = { kind: "box", x: -70, y: SEAT_TOP, w: 110, h: -SEAT_TOP, frontHalf: 5 };
/** Feet flat on the floor, a little wider than the hips. */
const SEAT_FOOT_Z = 32;
const SEAT_ANKLE_Y = -6;
/** Knees together: each knee this far from the body line. */
const KNEES_TOGETHER_Z = 7;

interface Leg3 {
  knee: Point;
  kneeZ: number;
  foot: Point;
}

/**
 * Seated leg (far side; mirror z for near) with the thigh turned `turn` degrees
 * out from straight ahead, level with the hip, and the foot planted.
 */
function seatedLeg(turn: number, footX: number): Leg3 {
  const r = (turn * Math.PI) / 180;
  const knee: Point = [round(SEAT_PELVIS[0] + THIGH * Math.cos(r)), SEAT_PELVIS[1]];
  const kneeZ = HIP_SIDE + THIGH * Math.sin(r);
  return { knee, kneeZ: round(kneeZ), foot: [footX, SEAT_ANKLE_Y] };
}

/** Shin length from a seated knee to the planted foot (should be SHIN). */
function shinGap(turn: number, footX: number): number {
  const leg = seatedLeg(turn, footX);
  return Math.hypot(leg.foot[0] - leg.knee[0], leg.foot[1] - leg.knee[1], SEAT_FOOT_Z - leg.kneeZ);
}

/** Foot x so the shin is exactly SHIN long with the knees together. */
const SEAT_FOOT_X = (() => {
  const turn = (Math.asin((KNEES_TOGETHER_Z - HIP_SIDE) / THIGH) * 180) / Math.PI;
  const kneeX = SEAT_PELVIS[0] + THIGH * Math.cos((turn * Math.PI) / 180);
  const dy = SEAT_ANKLE_Y - SEAT_PELVIS[1];
  const dz = SEAT_FOOT_Z - KNEES_TOGETHER_Z;
  return round(kneeX + Math.sqrt(SHIN ** 2 - dy * dy - dz * dz));
})();

/** Thigh turn (degrees) that keeps the shin exactly SHIN long with the foot planted. */
function turnFor(target: "together" | "open"): number {
  if (target === "together") return (Math.asin((KNEES_TOGETHER_Z - HIP_SIDE) / THIGH) * 180) / Math.PI;
  let [lo, hi] = [5, 60];
  for (let i = 0; i < 50; i += 1) {
    const mid = (lo + hi) / 2;
    if (shinGap(mid, SEAT_FOOT_X) < SHIN) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Seated tall on a bench, hands holding the seat edges; `open` pushes the knees apart. */
function seatedAbduction(open: boolean): Keyframe {
  const leg = seatedLeg(turnFor(open ? "open" : "together"), SEAT_FOOT_X);
  const chest = along(SEAT_PELVIS, -88, 80);
  const shoulder = along(SEAT_PELVIS, -88, 98);
  const hand: Point = [10, SEAT_TOP - 2];
  const handZ = 44;
  const reach = Math.hypot(hand[0] - shoulder[0], hand[1] - shoulder[1], handZ - SHOULDER_SIDE);
  if (reach > 125) throw new Error(`seated abduction: hand out of reach (${reach})`);
  return {
    hold: 0,
    pose: {
      pelvis: SEAT_PELVIS,
      chest,
      head: along(shoulder, -90, 38),
      hands: { near: hand, far: hand },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { at: leg.knee }, far: { at: leg.knee } },
      feet: { near: leg.foot, far: leg.foot },
      toes: { near: 0, far: 0 },
    },
    sideways: {
      hands: { near: -handZ, far: handZ },
      knees: { near: { at: -leg.kneeZ }, far: { at: leg.kneeZ } },
      feet: { near: -SEAT_FOOT_Z, far: SEAT_FOOT_Z },
    },
  };
}

// ---------------------------------------------------------------- butterfly superman (face down, head at +x)

const PRONE_PELVIS: Point = [-20, -14];
const PRONE_LEG = 173.9;
/** Fingers laced behind the head: each hand this far either side of the body line. */
const LACED_Z = 16;

/**
 * Face down, legs long on the floor, fingers laced behind the head. `lift` 0
 * rests with the elbows wide and low; 1 squeezes the shoulder blades, lifts the
 * elbows high and raises the head and chest a little.
 */
function butterflySuperman(lift: number): Keyframe {
  const pelvis = PRONE_PELVIS;
  const spine = -8 - 9 * lift;
  const chest = along(pelvis, spine, 80);
  const head = along(along(chest, spine, 20), spine + 8 + 14 * lift, 36);
  // Hands on the back of the head (up, away from the floor), beside it rather than through it.
  const hand = along(head, spine - 90, 16);
  const leg = 184;
  const foot = along(pelvis, leg, PRONE_LEG);
  const knee = along(pelvis, leg, THIGH);
  // Elbows wide: out to the side and a little down at rest, out and up when lifted.
  const out = round(112 - 58 * lift);
  return {
    hold: 0,
    pose: {
      pelvis,
      chest,
      head,
      hands: { near: hand, far: hand },
      elbows: { near: { bend: -1 }, far: { bend: -1 } },
      knees: { near: { at: knee }, far: { at: knee } },
      feet: { near: foot, far: foot },
      toes: { near: leg, far: leg },
    },
    sideways: {
      hands: { near: -LACED_Z, far: LACED_Z },
      elbows: { near: { out }, far: { out } },
      knees: { near: { at: -HIP_SIDE }, far: { at: HIP_SIDE } },
      feet: { near: -HIP_SIDE, far: HIP_SIDE },
    },
  };
}

// ---------------------------------------------------------------- incline crunch (sloped bench)

// Feet hooked under a roller at the high (right) end, head towards the low end.
const INCLINE_LOW: Point = [-250, -50];
const INCLINE_HIGH: Point = [90, -150];
const INCLINE_DEG = angle(INCLINE_HIGH, INCLINE_LOW);
/** Lying on the bench: the body line sits this far above the board. */
const LIE = 9;
const onLine = (a: Point, b: Point, x: number): Point => [x, round(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]))];
const INCLINE_PELVIS = along(onLine(INCLINE_LOW, INCLINE_HIGH, -80), INCLINE_DEG + 90, LIE);
const CRUNCH_ANKLE = along(onLine(INCLINE_LOW, INCLINE_HIGH, 52), INCLINE_DEG + 90, 10);
const ROLLER: Point = along(CRUNCH_ANKLE, INCLINE_DEG + 90, 20);
/** Hands lightly behind the head, beside it: this far either side of the body line. */
const CRUNCH_HAND_Z = 30;
/** Feet hooked under the roller, a little apart. */
const CRUNCH_FOOT_Z = 10;

/** `lift`: 0 lying back on the bench, 1 curled up with the chest towards the knees. Elbows wide throughout. */
function inclineCrunch(lift: number): Keyframe {
  const pelvis = INCLINE_PELVIS;
  // Torso swings up from the bench line towards the thighs; the upper back rounds as it comes up.
  const torso = INCLINE_DEG + lift * 124;
  const chest = along(pelvis, torso, 80);
  // Chin a little tucked off the bench, more so curled up.
  const head = along(chest, torso + 18 + lift * 10, 56);
  // Hands at the back of the head (towards the bench), either side of it.
  const hand = along(head, torso - 90, 6);
  return {
    hold: 0,
    pose: {
      pelvis,
      chest,
      head,
      hands: { near: hand, far: hand },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      feet: { near: CRUNCH_ANKLE, far: CRUNCH_ANKLE },
      toes: { near: INCLINE_DEG - 180 - 70, far: INCLINE_DEG - 180 - 70 },
    },
    sideways: {
      hands: { near: -CRUNCH_HAND_Z, far: CRUNCH_HAND_Z },
      elbows: { near: { out: 80 }, far: { out: 80 } },
      feet: { near: -CRUNCH_FOOT_Z, far: CRUNCH_FOOT_Z },
    },
  };
}

// ---------------------------------------------------------------- specs

export const BATCH_AK_SPECS: DoodleSpec[] = [
  {
    id: "ntc_fire_hydrant",
    slug: "fire-hydrant",
    title: "Fire hydrant",
    views: TWO_VIEWS,
    transition: 0.7,
    frames: [
      { ...allFoursKey(), hold: 0.3 },
      // The bent knee lifts out to the side to about hip height, hips level.
      { ...liftedKnee("near", HYDRANT_THIGH, HYDRANT_SHIN), hold: 0.4 },
    ],
  },
  {
    id: "wger_1956",
    slug: "fire-hydrant-circles",
    title: "Fire Hydrant Circles",
    views: TWO_VIEWS,
    transition: 0.45,
    frames: HYDRANT_CIRCLE,
  },
  {
    id: "wger_1672",
    slug: "seated-hip-abduction",
    title: "Seated Hip Abduction",
    views: TWO_VIEWS,
    props: [SEAT_BOX],
    transition: 0.9,
    frames: [
      { ...seatedAbduction(false), hold: 0.3 },
      { ...seatedAbduction(true), hold: 0.4 },
    ],
  },
  {
    id: "wger_1908",
    slug: "butterfly-superman",
    title: "Butterfly Superman",
    views: TWO_VIEWS,
    transition: 0.8,
    frames: [
      { ...butterflySuperman(0), hold: 0.3 },
      { ...butterflySuperman(1), hold: 0.5 },
    ],
  },
  {
    id: "wger_171",
    slug: "incline-crunches",
    title: "Incline Crunches",
    views: TWO_VIEWS,
    props: [{ kind: "board", from: INCLINE_LOW, to: INCLINE_HIGH }, { kind: "bar", y: ROLLER[1], x1: ROLLER[0], x2: ROLLER[0], grips: [ROLLER[0]] }],
    transition: 1,
    frames: [
      { ...inclineCrunch(0), hold: 0.4 },
      { ...inclineCrunch(0.5), hold: 0 },
      { ...inclineCrunch(1), hold: 0.4 },
      { ...inclineCrunch(0.5), hold: 0 },
    ],
  },
];
