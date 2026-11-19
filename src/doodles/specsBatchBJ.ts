import { kettlebellOnFloor, solvePose } from "./rig";
import type { BellMode, DoodleSpec, Keyframe, Point, Pose } from "./rig";
import { FLOOR_PROP, along, chestOf, round, shoulderOf } from "./geom";

/**
 * Batch BJ (#216): one-arm and two-arm kettlebell lifts: row, swing, snatches,
 * jerks, presses, cleans and the overhead squat. Side view, facing +x, floor
 * at y = 0 (the para press is face-on: the elbow goes out to the side).
 *
 * Gear: `hang` the bell below the grip, `swing` along the forearm (swing, snatch
 * pull, open-palm catch), `rack` on the back of the forearm (front rack, overhead).
 * A clean keeps the bell close (bent elbow by the ribs); a snatch has a backswing
 * (straight arm, bell behind the knees) and goes overhead without stopping in the
 * rack; a jerk re-dips under the bell.
 */

const BELL = 14;
const FLOOR_HAND = round(kettlebellOnFloor(BELL));
/** Arm reach (shoulder to fingertip), a hair short so a straight arm draws straight. */
const REACH = 125.4;

interface Stand {
  pelvis: Point;
  spine: number;
  /** Feet x (near, far) and heights. */
  feet?: [Point, Point];
  toes?: [number, number];
  /** Bend both knees forward (squat, hinge). */
  knees?: boolean;
}

const TALL: Stand = { pelvis: [2, -172], spine: -90 };
const HIKE: Stand = { pelvis: [-50, -148], spine: -32, feet: [[24, 0], [16, 0]], knees: true };
const DIP: Stand = { pelvis: [-26, -160], spine: -66, knees: true };
const DRIVE: Stand = { pelvis: [-6, -170], spine: -84 };
/** A short dip, torso upright. */
const QUARTER: Stand = { pelvis: [-6, -140], spine: -90, knees: true };
/** Bell set on the floor ahead of the toes, hips back, chest up. */
const FLOOR_STANCE: Stand = { pelvis: [-62, -116], spine: -30, feet: [[-18, 0], [-26, 0]], knees: true };

interface Arm {
  hand: Point;
  elbow?: Point;
}

const straight = (s: Point, deg: number): Arm => ({ hand: along(s, deg, REACH) });
const hanging = (s: Point, deg = 90): Arm => straight(s, deg);
/** Upper arm `up` degrees from the shoulder, forearm `low` degrees from the elbow; elbow and hand pinned. */
function bent(s: Point, up: number, low: number): Arm {
  const elbow = along(s, up, 60);
  return { hand: along(elbow, low, 66), elbow };
}
/** Overhead: locked out almost straight above the shoulder. */
const overhead = (s: Point, deg = -84): Arm => straight(s, deg);
/** Press path from the front rack (t = 0) to lockout (t = 1), hand relative to the shoulder. */
function press(s: Point, t: number): Arm {
  if (t <= 0) return bent(s, 75, -68);
  if (t >= 1) return overhead(s);
  const a: Point = [40, -3];
  const c: Point = [70, -80];
  const b: Point = [13, -124.7];
  const u = 1 - t;
  return { hand: [round(s[0] + u * u * a[0] + 2 * u * t * c[0] + t * t * b[0]), round(s[1] + u * u * a[1] + 2 * u * t * c[1] + t * t * b[1])] };
}

function figure(stand: Stand, near: Arm, far: Arm, extra: Partial<Pose> = {}): Pose {
  const { pelvis, spine, feet = [[4, 0], [-4, 0]], toes = [0, 0], knees } = stand;
  return {
    pelvis,
    chest: chestOf(pelvis, spine),
    hands: { near: near.hand, far: far.hand },
    elbows: { near: near.elbow ? { at: near.elbow } : { bend: 1 }, far: far.elbow ? { at: far.elbow } : { bend: 1 } },
    ...(knees ? { knees: { near: { bend: -1 as const }, far: { bend: -1 as const } } } : {}),
    feet: { near: feet[0], far: feet[1] },
    toes: { near: toes[0], far: toes[1] },
    ...extra,
  };
}

const sh = (stand: Stand): Point => shoulderOf(stand.pelvis, stand.spine);
/** The free (far) arm hanging by the side. */
const free = (stand: Stand, deg = 92): Arm => hanging(sh(stand), deg);

/** Head tipped back (eyes on the bell) so a locked arm passes clear of it. */
const lookUp = (stand: Stand, tilt = 18): Point => along(chestOf(stand.pelvis, stand.spine), stand.spine - tilt, 53);

const kf = (pose: Pose, hold: number, bell: BellMode = "hang"): Keyframe => ({ pose, hold, bell });

// ---------------------------------------------------------------- swing

/** Backswing / bottom: hinged, the arm straight and back between the thighs. */
const swingBack = (): Pose => figure(HIKE, hanging(sh(HIKE), 112), hanging(sh(HIKE), 100));
/** Hips driven through, the arm straight at `deg` below the horizontal. */
const swingMid = (): Pose => figure(DRIVE, straight(sh(DRIVE), 38), free(DRIVE));
/** Top: standing tall, the arm straight out at about shoulder height. */
const swingTop = (): Pose => figure(TALL, straight(sh(TALL), -6), free(TALL));

// ---------------------------------------------------------------- row

/** Hinged flat back, knees soft; the near arm long under the shoulder or pulled to the hip, the far hand on its knee. */
const ROW: Stand = { pelvis: [-46, -160], spine: -22, feet: [[4, 0], [-4, 0]], knees: true };
function row(pulled: boolean): Pose {
  const s = sh(ROW);
  const elbow = along(s, -158, 60);
  const near: Arm = pulled ? { hand: [elbow[0], round(elbow[1] + 66)], elbow } : hanging(s, 90);
  return figure(ROW, near, { hand: [round(s[0] + 4), round(s[1] + 96)] });
}

// ---------------------------------------------------------------- snatches

/** Pull / extension: hips through, up on the toes, the bell flying close up the body. */
const EXT: Stand = { pelvis: [-2, -190], spine: -90, feet: [[4, -20], [-4, -20]], toes: [75, 75] };
const extended = (): Pose => figure(EXT, straight(sh(EXT), 20), free(EXT));
const highPull = (): Pose => figure(EXT, bent(sh(EXT), -35, -112), free(EXT));
/** Lowering: the arm swings down in front, straight, the bell falling. */
const dropped = (): Pose => figure(DRIVE, straight(sh(DRIVE), 35), free(DRIVE));
const snatchTop = (stand: Stand = TALL): Pose => figure(stand, overhead(sh(stand)), free(stand), { head: lookUp(stand) });
const atFloor = (): Pose => {
  const s = sh(FLOOR_STANCE);
  return figure(FLOOR_STANCE, { hand: [round(s[0] + 4), FLOOR_HAND] }, { hand: [round(s[0] - 2), FLOOR_HAND] });
};

const SPLIT: Stand = { pelvis: [0, -142], spine: -90, feet: [[70, 0], [-82, -18]], toes: [0, 60], knees: true };
const splitCatch = (): Pose => figure(SPLIT, overhead(sh(SPLIT)), free(SPLIT, 100), { head: lookUp(SPLIT) });

// ---------------------------------------------------------------- overhead squat

function overheadSquat(deep: boolean): Pose {
  const stand: Stand = deep ? { pelvis: [-50, -66], spine: -76, feet: [[8, 0], [0, 0]], knees: true } : { ...TALL, feet: [[8, 0], [0, 0]] };
  const s = sh(stand);
  // The arm locked out with the bell over the mid-foot.
  const deg = -(Math.acos(Math.max(-1, Math.min(1, (6 - s[0]) / REACH))) * 180) / Math.PI;
  return figure(stand, straight(s, deg), hanging(s, 12), { head: lookUp(stand, deep ? 24 : 18) });
}


// ---------------------------------------------------------------- two-arm lifts

/** The far arm of a pair, a hair behind the near one. */
function press2(s: Point, t: number, far: boolean): Arm {
  if (!far) return press(s, t);
  if (t <= 0) return bent(s, 72, -67);
  if (t >= 1) return overhead(s, -87);
  const a = press(s, t);
  return { hand: [round(a.hand[0] - 4), a.hand[1]] };
}

/** Both arms on the press path (0 rack .. 1 lockout), the bells racked. */
const both = (stand: Stand, t: number, extra: Partial<Pose> = {}): Pose =>
  figure(stand, press2(sh(stand), t, false), press2(sh(stand), t, true), extra);

/** A clean keeps the bell close: `low` the elbow back beside the ribs, `high` elbow up and back, hand at the lower chest. */
type CleanState = "hang" | "between" | "low" | "high";
function cleanArm(state: CleanState, s: Point, far: boolean): Arm {
  const slight = far ? -2 : 0;
  switch (state) {
    case "hang":
      return hanging(s, 90 + slight);
    case "between":
      return hanging(s, far ? 100 : 110);
    case "low":
      return bent(s, 112 + slight, 40);
    case "high":
      return bent(s, 118 + slight, -16);
  }
}
const cleanPair = (stand: Stand, state: CleanState): Pose => figure(stand, cleanArm(state, sh(stand), false), cleanArm(state, sh(stand), true));
const rackPair = (): Pose => both(TALL, 0);

function atFloorPair(): Pose {
  const s = sh(FLOOR_STANCE);
  return figure(FLOOR_STANCE, { hand: [round(s[0] + 4), FLOOR_HAND] }, { hand: [round(s[0] - 2), FLOOR_HAND] });
}

// ---------------------------------------------------------------- open-palm cleans

/** Forearm vertical, the bell turned over to land on the open palm (bell standing on the hand). */
const palm = (stand: Stand, far = false): Arm => bent(sh(stand), far ? 58 : 55, -76);
/** Arm thrown out in front, level with the chest. */
const thrown = (stand: Stand, far = false): Arm => straight(sh(stand), far ? -12 : -8);

// ---------------------------------------------------------------- para press (face-on)

const FRONT = { view: "front" as const };
const FRONT_FEET = { near: [-30, 0] as Point, far: [30, 0] as Point };
const FRONT_BASE: Pose = { pelvis: [0, -170], chest: [0, -250] };

/** Bell in the far hand: elbow out to the side, then up and out to lockout (`t` 0, 1, 2). */
function paraPress(stage: 0 | 1 | 2): Pose {
  const solved = solvePose(FRONT_BASE, FRONT);
  const fs = solved.arms.far.root;
  const ns = solved.arms.near.root;
  const elbow = along(fs, [-4, -22, 0][stage], 60);
  const hand = stage === 2 ? along(fs, -72, REACH) : along(elbow, [-125, -98, 0][stage], 66);
  return {
    ...FRONT_BASE,
    hands: { near: along(ns, 92, REACH), far: hand },
    elbows: { far: stage === 2 ? { bend: 1 } : { at: elbow } },
    feet: FRONT_FEET,
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- specs

const SPECS: DoodleSpec[] = [
  {
    id: "fedb_one_arm_kettlebell_swings",
    slug: "one-arm-kettlebell-swings",
    title: "One-Arm Kettlebell Swings",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.45,
    frames: [kf(swingBack(), 0.1, "swing"), kf(swingMid(), 0, "swing"), kf(swingTop(), 0.1, "swing"), kf(swingMid(), 0, "swing")],
  },
  {
    id: "fedb_one_arm_kettlebell_row",
    slug: "one-arm-kettlebell-row",
    title: "One-Arm Kettlebell Row",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.7,
    frames: [kf(row(false), 0.3), kf(row(true), 0.4)],
  },
  {
    id: "fedb_one_arm_kettlebell_snatch",
    slug: "one-arm-kettlebell-snatch",
    title: "One-Arm Kettlebell Snatch",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.4,
    frames: [
      kf(atFloor(), 0.3),
      kf(figure(HIKE, hanging(sh(HIKE), 112), free(HIKE, 100)), 0.1, "swing"),
      kf(extended(), 0, "swing"),
      kf(highPull(), 0, "swing"),
      kf(snatchTop(), 0.5, "rack"),
      kf(dropped(), 0, "swing"),
      kf(figure(HIKE, hanging(sh(HIKE), 112), free(HIKE, 100)), 0.1, "swing"),
    ],
  },
  {
    id: "fedb_one_arm_kettlebell_split_snatch",
    slug: "one-arm-kettlebell-split-snatch",
    title: "One-Arm Kettlebell Split Snatch",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.4,
    frames: [
      kf(figure(HIKE, hanging(sh(HIKE), 112), free(HIKE, 100)), 0.2, "swing"),
      kf(extended(), 0, "swing"),
      kf(highPull(), 0, "swing"),
      kf(splitCatch(), 0.35, "rack"),
      kf(snatchTop(), 0.5, "rack"),
      kf(dropped(), 0, "swing"),
    ],
  },
  {
    id: "fedb_one_arm_kettlebell_push_press",
    slug: "one-arm-kettlebell-push-press",
    title: "One-Arm Kettlebell Push Press",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.4,
    frames: [
      kf(figure(TALL, press(sh(TALL), 0), free(TALL)), 0.4, "rack"),
      kf(figure(QUARTER, press(sh(QUARTER), 0), free(QUARTER)), 0.15, "rack"),
      kf(figure(TALL, press(sh(TALL), 0.5), free(TALL)), 0, "rack"),
      kf(figure(TALL, press(sh(TALL), 1), free(TALL), { head: lookUp(TALL) }), 0.5, "rack"),
      kf(figure(TALL, press(sh(TALL), 0.5), free(TALL)), 0, "rack"),
    ],
  },
  {
    id: "fedb_one_arm_kettlebell_split_jerk",
    slug: "one-arm-kettlebell-split-jerk",
    title: "One-Arm Kettlebell Split Jerk",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.4,
    frames: [
      kf(figure(TALL, press(sh(TALL), 0), free(TALL)), 0.4, "rack"),
      kf(figure(QUARTER, press(sh(QUARTER), 0), free(QUARTER)), 0.15, "rack"),
      kf(figure(EXT, press(sh(EXT), 0.5), free(EXT)), 0, "rack"),
      kf(splitCatch(), 0.35, "rack"),
      kf(snatchTop(), 0.5, "rack"),
      kf(figure(TALL, press(sh(TALL), 0.5), free(TALL)), 0, "rack"),
    ],
  },
  {
    id: "fedb_one_arm_overhead_kettlebell_squats",
    slug: "one-arm-overhead-kettlebell-squats",
    title: "One-Arm Overhead Kettlebell Squats",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 1.1,
    frames: [kf(overheadSquat(false), 0.4, "rack"), kf(overheadSquat(true), 0.5, "rack")],
  },
  {
    id: "fedb_one_arm_kettlebell_para_press",
    slug: "one-arm-kettlebell-para-press",
    title: "One-Arm Kettlebell Para Press",
    ...FRONT,
    props: [FLOOR_PROP],
    kettlebell: { hands: ["far"], size: BELL },
    transition: 0.7,
    frames: [kf(paraPress(0), 0.4, "rack"), kf(paraPress(1), 0, "rack"), kf(paraPress(2), 0.5, "rack"), kf(paraPress(1), 0, "rack")],
  },
  {
    id: "fedb_two_arm_kettlebell_clean",
    slug: "two-arm-kettlebell-clean",
    title: "Two-Arm Kettlebell Clean",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near", "far"], size: BELL },
    transition: 0.5,
    frames: [
      kf(atFloorPair(), 0.4),
      kf(cleanPair(DRIVE, "low"), 0),
      kf(cleanPair(TALL, "high"), 0),
      kf(rackPair(), 0.5, "rack"),
      kf(cleanPair(TALL, "low"), 0),
    ],
  },
  {
    id: "fedb_two_arm_kettlebell_jerk",
    slug: "two-arm-kettlebell-jerk",
    title: "Two-Arm Kettlebell Jerk",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near", "far"], size: BELL },
    transition: 0.4,
    frames: [
      kf(rackPair(), 0.4, "rack"),
      kf(both(QUARTER, 0), 0.15, "rack"),
      kf(both(EXT, 0.5), 0, "rack"),
      kf(both(QUARTER, 1, { head: lookUp(QUARTER) }), 0.2, "rack"),
      kf(both(TALL, 1, { head: lookUp(TALL) }), 0.5, "rack"),
      kf(both(TALL, 0.5), 0, "rack"),
    ],
  },
  {
    id: "fedb_two_arm_kettlebell_military_press",
    slug: "two-arm-kettlebell-military-press",
    title: "Two-Arm Kettlebell Military Press",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near", "far"], size: BELL },
    transition: 0.8,
    frames: [
      kf(rackPair(), 0.4, "rack"),
      kf(both(TALL, 0.5), 0, "rack"),
      kf(both(TALL, 1, { head: lookUp(TALL) }), 0.5, "rack"),
      kf(both(TALL, 0.5), 0, "rack"),
    ],
  },
  {
    id: "fedb_one_arm_open_palm_kettlebell_clean",
    slug: "one-arm-open-palm-kettlebell-clean",
    title: "One-Arm Open-Palm Kettlebell Clean",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.5,
    frames: [
      kf(atFloor(), 0.3),
      kf(figure(DRIVE, cleanArm("low", sh(DRIVE), false), free(DRIVE)), 0),
      kf(figure(TALL, cleanArm("high", sh(TALL), false), free(TALL)), 0),
      kf(figure(TALL, palm(TALL), free(TALL)), 0.45, "swing"),
      kf(figure(TALL, thrown(TALL), free(TALL)), 0.2, "swing"),
      kf(figure(DIP, hanging(sh(DIP), 108), free(DIP, 100)), 0),
    ],
  },
  {
    id: "fedb_open_palm_kettlebell_clean",
    slug: "open-palm-kettlebell-clean",
    title: "Open-Palm Kettlebell Clean",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.5,
    frames: [
      kf(atFloorPair(), 0.3),
      kf(cleanPair(DRIVE, "low"), 0),
      kf(cleanPair(TALL, "high"), 0),
      kf(figure(TALL, palm(TALL), palm(TALL, true)), 0.45, "swing"),
      kf(figure(TALL, thrown(TALL), thrown(TALL, true)), 0.2, "swing"),
      kf(cleanPair(DIP, "between"), 0),
    ],
  },
];

export const BATCH_BJ_SPECS: DoodleSpec[] = SPECS;
