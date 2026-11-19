import type { Bend, DoodleSpec, Keyframe, Point, Pose, Prop, Side, Sideways } from "./rig";
import { kettlebellOnFloor } from "./rig";
import { TWO_VIEWS } from "./sideways";

/**
 * Batch AS (#212): kettlebell presses, jerks, snatches and halos. Floor at
 * y = 0, up is negative, the side-view figure faces +x; in the front panel the
 * near side is on the viewer's left. Bells use the spec-level `kettlebell`
 * gear and the per-keyframe `bell` mode (rack: on the back of the forearm).
 * Import only from ./rig and ./sideways, never ./specs.
 */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const FLOOR: Prop = { kind: "floor" };

// ---------------------------------------------------------------- standing figure

const SHOULDER_Z = 24;

/** Where a hand is on the press path: `t` 0 = front rack by the chin, 1 = locked out overhead (curves round the face). */
const RACK: Point = [28, -278];
const OVERHEAD: Point = [4, -394];
function pressHand(t: number): Point {
  const c: Point = [52, -342];
  const u = 1 - t;
  return [round(u * u * RACK[0] + 2 * u * t * c[0] + t * t * OVERHEAD[0]), round(u * u * RACK[1] + 2 * u * t * c[1] + t * t * OVERHEAD[1])];
}

const bends = (bend: Bend): Pose["elbows"] => ({ near: { bend }, far: { bend } });

/** Standing with the feet together; `dip` (0..1) sinks the hips with the torso upright. */
function stand(hands: Pose["hands"], opts: { dip?: number; bend?: Bend } = {}): Pose {
  const drop = (opts.dip ?? 0) * 30;
  return {
    pelvis: [0, -173.4 + drop],
    chest: [0, -253.4 + drop],
    hands,
    elbows: bends(opts.bend ?? 1),
    knees: drop ? { near: { bend: -1 }, far: { bend: -1 } } : undefined,
    feet: { near: [0, 0], far: [-8, 0] },
    toes: { near: 0, far: 0 },
  };
}

const both = (p: Point): Pose["hands"] => ({ near: p, far: [round(p[0] - 4), p[1]] });
const sw = (near: number, far: number): Sideways => ({ hands: { near, far } });
/** Hands straight in front of the shoulders: both bells at the same height in the front panel. */
const IN_LINE = sw(-SHOULDER_Z, SHOULDER_Z);

// ---------------------------------------------------------------- alternating / seesaw presses (two views)

/** One arm at press height `a`, the other at `b` (0 rack, 1 overhead). */
function twoArms(a: number, b: number): Keyframe {
  return {
    hold: 0,
    bell: "rack",
    pose: stand({ near: pressHand(a), far: pressHand(b) }),
    sideways: IN_LINE,
  };
}

const withHold = (frame: Keyframe, hold: number): Keyframe => ({ ...frame, hold });

// ---------------------------------------------------------------- floor presses (lying on the back)

const LY_PELVIS: Point = [0, -22];
const LY_CHEST: Point = [-77, -18];
const LY_HEAD: Point = [-132, -24];
/** Elbow on the floor, forearm upright over it; the upper arm runs out to the side (z) at about 45 degrees. */
const FLOOR_ELBOW: Point = [-85, -8];
const FLOOR_ELBOW_Z = 79.6;
const FLOOR_BOTTOM: Point = [-85, -74];
const FLOOR_TOP: Point = [-94.6, -147.2];

/** Lying on the back, knees up and feet flat; `far` pass-through poses for the arms. */
function lying(extra: Partial<Pose>): Pose {
  return {
    pelvis: LY_PELVIS,
    chest: LY_CHEST,
    head: LY_HEAD,
    spine: { bend: -1 },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [78, 0], far: [84, 0] },
    toes: { near: 0, far: 0 },
    ...extra,
  };
}

/** Alternating floor press: `up` is the arm locked out, the other rests with the elbow on the floor. */
function altFloor(up: Side): Keyframe {
  const down: Side = up === "near" ? "far" : "near";
  const z = (side: Side, v: number): number => (side === "near" ? -v : v);
  return {
    hold: 0.3,
    bell: "rack",
    pose: lying({
      hands: { [up]: FLOOR_TOP, [down]: FLOOR_BOTTOM },
      elbows: { [up]: { bend: 1 }, [down]: { at: FLOOR_ELBOW } },
    }),
    sideways: {
      hands: { [up]: z(up, SHOULDER_Z), [down]: z(down, FLOOR_ELBOW_Z) },
      elbows: { [down]: { at: z(down, FLOOR_ELBOW_Z) } },
    },
  };
}

/** One-arm floor press with the near arm: `t` 0 = upper arm on the floor, 1 = locked out above the shoulder. */
function oneArmFloor(t: number): Pose {
  const elbow: Point = [-36.2, -8];
  const bottom: Point = [-36.2, -74];
  const hand: Point = [round(bottom[0] + (FLOOR_TOP[0] - bottom[0]) * t), round(bottom[1] + (FLOOR_TOP[1] - bottom[1]) * t)];
  return {
    pelvis: LY_PELVIS,
    chest: LY_CHEST,
    head: LY_HEAD,
    spine: { bend: -1 },
    hands: { near: hand, far: [28, -6] },
    elbows: { near: t === 0 ? { at: elbow } : { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 } },
    feet: { near: [74, 0], far: [172, -6] },
    toes: { near: 0, far: -75 },
  };
}

// ---------------------------------------------------------------- seated press

const SEAT_PELVIS: Point = [0, -12];
const SEAT_CHEST: Point = [0, -92];
const SEAT_RACK: Point = [28, -118];
const SEAT_TOP: Point = [4, -234];

/** Sitting tall on the floor with the legs spread (feet wide), the free hand down on the floor. */
function seated(hand: Point): Keyframe {
  return {
    hold: 0.3,
    bell: "rack",
    pose: {
      pelvis: SEAT_PELVIS,
      chest: SEAT_CHEST,
      hands: { near: hand, far: [34, -4] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      feet: { near: { dir: 2.5 }, far: { dir: 2.5 } },
      toes: { near: -75, far: -75 },
    },
    sideways: { hands: { near: -SHOULDER_Z, far: 52 }, feet: { near: -70, far: 70 } },
  };
}

function seatedHand(t: number): Point {
  const c: Point = [52, -162];
  const u = 1 - t;
  return [round(u * u * SEAT_RACK[0] + 2 * u * t * c[0] + t * t * SEAT_TOP[0]), round(u * u * SEAT_RACK[1] + 2 * u * t * c[1] + t * t * SEAT_TOP[1])];
}


// ---------------------------------------------------------------- arnold press (two views)

/** One-arm Arnold press: palm in at the shoulder, elbow swings out in the middle, palm forward at the top. */
function arnold(t: number, hold = 0): Keyframe {
  const hand = pressHand(t);
  // Hand starts in front of the sternum (palm facing in), swings out wide, then stacks over the shoulder.
  const stage = Math.min(2, Math.round(t * 2));
  const z = [-14, -48, -SHOULDER_Z][stage];
  const out = [0, 70, 10][stage];
  return {
    hold,
    bell: "rack",
    pose: stand({ near: hand, far: [0, -146.5] }, { bend: 1 }),
    sideways: { hands: { near: z, far: SHOULDER_Z }, elbows: { near: { out } } },
  };
}

// ---------------------------------------------------------------- two-bell standing lifts (side view)

/** Both hands on the press path (the far hand a hair behind the near). */
const pressBoth = (t: number): Pose["hands"] => both(pressHand(t));

/** Both arms in line with the shoulders in the front panel. */
const inLine = (frame: Keyframe): Keyframe => ({ ...frame, sideways: IN_LINE });

/** Push press: dip, drive, lockout, lower. */
function pushPressFrames(): Keyframe[] {
  return [
    { hold: 0.4, bell: "rack", pose: stand(pressBoth(0)) },
    { hold: 0.2, bell: "rack", pose: stand(pressBoth(0), { dip: 0.5 }) },
    { hold: 0, bell: "rack", pose: stand(pressBoth(0.5)) },
    { hold: 0.5, bell: "rack", pose: stand(pressBoth(1)) },
    { hold: 0, bell: "rack", pose: stand(pressBoth(0.5)) },
  ];
}

/** Split-stance catch: front (near) foot forward, back (far) foot back on its toes, hips low, arms locked overhead. */
function splitCatch(): Pose {
  return {
    pelvis: [0, -152],
    chest: [0, -232],
    hands: both([4, -374]),
    elbows: bends(1),
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [66, 0], far: [-76, -18] },
    toes: { near: 0, far: 60 },
  };
}

/** Mid-air drive: legs extended, up on the toes, feet just off the floor, bells on their way up. */
function jerkDrive(): Pose {
  return {
    ...stand(pressBoth(0.4)),
    feet: { near: [0, -26], far: [-8, -26] },
    toes: { near: 75, far: 75 },
  };
}

function jerkFrames(): Keyframe[] {
  return [
    { hold: 0.4, bell: "rack", pose: stand(pressBoth(0)) },
    { hold: 0.15, bell: "rack", pose: stand(pressBoth(0), { dip: 0.6 }) },
    { hold: 0, bell: "rack", pose: jerkDrive() },
    { hold: 0.35, bell: "rack", pose: splitCatch() },
    { hold: 0.4, bell: "rack", pose: stand(both(OVERHEAD)) },
    { hold: 0, bell: "rack", pose: stand(pressBoth(0.5)) },
  ];
}

// snatch
const FLOOR_HAND = kettlebellOnFloor();
/** Hinge with the shins near upright, bells down on the floor behind the feet. */
function snatchHinge(handX: number, handY: number): Pose {
  const pelvis: Point = [-92, -104];
  return {
    pelvis,
    chest: along(pelvis, -38, 80),
    hands: { near: [handX, handY], far: [handX - 4, handY] },
    elbows: bends(1),
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [24, 0], far: [16, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Standing tall, hips driven through, arms hanging or flung out in front at `hand`. */
function snatchStand(hand: Point, extra: Partial<Pose> = {}): Pose {
  return { ...stand(both(hand), { bend: 1 }), ...extra };
}

function snatchFrames(): Keyframe[] {
  return [
    { hold: 0.35, bell: "hang", pose: snatchHinge(-14, FLOOR_HAND) },
    { hold: 0, bell: "swing", pose: snatchHinge(-70, -104) },
    { hold: 0, bell: "swing", pose: { ...snatchStand([62, -204], { pelvis: [-8, -168], chest: [-4, -248] }), toes: { near: 0, far: 0 } } },
    { hold: 0, bell: "swing", pose: { ...stand(both([34, -318]), { bend: 1 }), feet: { near: [0, -18], far: [-8, -18] }, toes: { near: 75, far: 75 } } },
    { hold: 0.5, bell: "rack", pose: stand(pressBoth(1)) },
    { hold: 0, bell: "swing", pose: snatchStand([56, -196]) },
    { hold: 0, bell: "hang", pose: snatchStand([10, -150], { elbows: bends(1) }) },
  ];
}

// ---------------------------------------------------------------- specs


export const BATCH_AS_SPECS: DoodleSpec[] = [
  {
    id: "fedb_alternating_floor_press",
    slug: "alternating-floor-press",
    title: "Alternating Floor Press",
    views: TWO_VIEWS,
    props: [FLOOR],
    kettlebell: { hands: ["near", "far"] },
    transition: 0.8,
    frames: [altFloor("near"), altFloor("far")],
  },
  {
    id: "fedb_alternating_kettlebell_press",
    slug: "alternating-kettlebell-press",
    title: "Alternating Kettlebell Press",
    views: TWO_VIEWS,
    props: [FLOOR],
    kettlebell: { hands: ["near", "far"] },
    transition: 0.7,
    frames: [
      withHold(twoArms(0, 0), 0.4),
      twoArms(0.5, 0),
      withHold(twoArms(1, 0), 0.4),
      twoArms(0.5, 0),
      withHold(twoArms(0, 0), 0.4),
      twoArms(0, 0.5),
      withHold(twoArms(0, 1), 0.4),
      twoArms(0, 0.5),
    ],
  },
  {
    id: "fedb_kettlebell_seesaw_press",
    slug: "kettlebell-seesaw-press",
    title: "Kettlebell Seesaw Press",
    views: TWO_VIEWS,
    props: [FLOOR],
    kettlebell: { hands: ["near", "far"] },
    transition: 0.6,
    frames: [withHold(twoArms(1, 0), 0.3), twoArms(0.5, 0.5), withHold(twoArms(0, 1), 0.3), twoArms(0.5, 0.5)],
  },
  {
    id: "fedb_extended_range_one_arm_kettlebell_floor_press",
    slug: "extended-range-one-arm-kettlebell-floor-press",
    title: "Extended Range One Arm Kettlebell Floor Press",
    props: [FLOOR],
    kettlebell: { hands: ["near"] },
    transition: 0.8,
    frames: [
      { hold: 0.4, bell: "rack", pose: oneArmFloor(0) },
      { hold: 0.4, bell: "rack", pose: oneArmFloor(1) },
    ],
  },
  {
    id: "fedb_kettlebell_seated_press",
    slug: "kettlebell-seated-press",
    title: "Kettlebell Seated Press",
    views: TWO_VIEWS,
    props: [FLOOR],
    kettlebell: { hands: ["near"] },
    transition: 0.7,
    frames: [
      seated(seatedHand(0)),
      { ...seated(seatedHand(0.5)), hold: 0 },
      seated(seatedHand(1)),
      { ...seated(seatedHand(0.5)), hold: 0 },
    ],
  },
  {
    id: "fedb_kettlebell_arnold_press",
    slug: "kettlebell-arnold-press",
    title: "Kettlebell Arnold Press",
    views: TWO_VIEWS,
    props: [FLOOR],
    kettlebell: { hands: ["near"] },
    transition: 0.7,
    frames: [arnold(0, 0.4), arnold(0.5), arnold(1, 0.4), arnold(0.5)],
  },
  {
    id: "fedb_double_kettlebell_push_press",
    slug: "double-kettlebell-push-press",
    views: TWO_VIEWS,
    title: "Double Kettlebell Push Press",
    props: [FLOOR],
    kettlebell: { hands: ["near", "far"] },
    transition: 0.35,
    frames: pushPressFrames().map(inLine),
  },
  {
    id: "fedb_double_kettlebell_jerk",
    slug: "double-kettlebell-jerk",
    views: TWO_VIEWS,
    title: "Double Kettlebell Jerk",
    props: [FLOOR],
    kettlebell: { hands: ["near", "far"] },
    transition: 0.35,
    frames: jerkFrames().map(inLine),
  },
  {
    id: "fedb_double_kettlebell_snatch",
    slug: "double-kettlebell-snatch",
    views: TWO_VIEWS,
    title: "Double Kettlebell Snatch",
    props: [FLOOR],
    kettlebell: { hands: ["near", "far"] },
    transition: 0.4,
    frames: snatchFrames().map(inLine),
  },
];
