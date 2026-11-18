import { solvePose } from "./rig";
import type { DoodleSpec, Point, Pose, Prop } from "./rig";

/**
 * Batch F: animated replacements for the hand-drawn core-move JPEGs (bar work,
 * handstand line, core and Nordic curl). Each spec sets `replaces: true` so the
 * palette-aware SVG takes over from the JPEG. Floor at y = 0, up is negative,
 * the figure faces +x.
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
const chestToward = (pelvis: Point, shoulder: Point): Point => along(pelvis, angle(pelvis, shoulder), 80);

/** Shoulder of a solved pose (near side). */
const shoulderOf = (pose: Pose): Point => solvePose(pose).arms.near.root;

const SIDE_BAR: Prop = { kind: "bar", y: -420, x1: -110, x2: 110, grips: [0] };
const SIDE_HANDS = { near: [4, -420] as Point, far: [0, -420] as Point };

// ---------------------------------------------------------------- Nordic curl

const NORDIC_KNEE: Point = [0, -5];

/** Kneeling, ankles anchored; the straight knee-to-head line leans `lean` degrees forward of vertical. */
function nordic(lean: number, catchFloor = false): Pose {
  const dir = -90 + lean;
  const pelvis = along(NORDIC_KNEE, dir, 88);
  const chest = along(pelvis, dir, 80);
  const shoulder = along(pelvis, dir, 98);
  // Hands held in front of the chest, ready to catch; at the end they catch the floor under the shoulders.
  const ready = along(along(shoulder, dir + 180, 40), dir + 90, 22);
  const hands = catchFloor
    ? { near: [round(shoulder[0] + 14), -2] as Point, far: [round(shoulder[0] + 10), -2] as Point }
    : { near: ready, far: [ready[0] - 3, ready[1]] as Point };
  return {
    pelvis,
    chest,
    head: along(chest, dir - 6, 56),
    hands,
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: NORDIC_KNEE }, far: { at: NORDIC_KNEE } },
    feet: { near: [-86, -5], far: [-86, -5] },
    toes: { near: 180, far: 180 },
  };
}

// ---------------------------------------------------------------- lying (dead bug, hollow)

const BUG_PELVIS: Point = [-12, -20];
/** Flat on the back: low back, upper back and head all down on the floor. */
const BUG_BASE: Pose = { pelvis: BUG_PELVIS, chest: [-92, -20], head: [-147, -24] };
const BUG_SHOULDER = shoulderOf(BUG_BASE);
const BUG_KNEE: Point = along(BUG_PELVIS, -90, 88);
/** Overhead reach: as low behind the head as the side view allows without crossing it. */
const BUG_OVERHEAD = 222;

/** Dead bug: arms up and knees over hips; `reach` extends one arm overhead and the opposite leg. */
function deadBug(reach: "none" | "nearArm" | "farArm"): Pose {
  const up = (dx: number): Point => [round(BUG_SHOULDER[0] + dx), round(BUG_SHOULDER[1] - 125.4)];
  const overhead = along(BUG_SHOULDER, BUG_OVERHEAD, 125.4);
  const tableKnee = (dx: number): Point => [BUG_KNEE[0] + dx, BUG_KNEE[1]];
  const tableFoot = (dx: number): Point => [round(BUG_KNEE[0] + 86 + dx), BUG_KNEE[1]];
  const long = (deg: number): Point => along(BUG_PELVIS, deg, 173.6);
  const nearLong = reach === "farArm";
  const farLong = reach === "nearArm";
  return {
    ...BUG_BASE,
    hands: {
      near: reach === "nearArm" ? overhead : up(2),
      far: reach === "farArm" ? [overhead[0] + 2, overhead[1]] : up(-2),
    },
    knees: {
      near: nearLong ? { bend: -1 } : { at: tableKnee(2) },
      far: farLong ? { bend: -1 } : { at: tableKnee(-2) },
    },
    feet: { near: nearLong ? long(-12) : tableFoot(2), far: farLong ? long(-13) : tableFoot(-2) },
    toes: { near: nearLong ? -12 : -20, far: farLong ? -13 : -20 },
  };
}

const HOLLOW_PELVIS: Point = [0, -21];

/** Hollow body: low back down, shoulders curled up, arms long behind the head, legs low; `legs` is the leg angle. */
function hollow(legs: number, arms: number, lift: number): Pose {
  const chest: Point = [-77, -30 - lift];
  const head: Point = [-104, -78 - lift];
  const base: Pose = { pelvis: HOLLOW_PELVIS, chest, head, spine: { bend: -1 } };
  const shoulder = shoulderOf(base);
  return {
    ...base,
    hands: { near: along(shoulder, arms, 125.4), far: along(shoulder, arms + 1, 125.4) },
    feet: { near: along(HOLLOW_PELVIS, legs, 173.6), far: along(HOLLOW_PELVIS, legs - 1, 173.4) },
    toes: { near: legs, far: legs - 1 },
  };
}

// ---------------------------------------------------------------- elevated pike

const PIKE_ANKLE: Point = [-107, -123];

/** The upper of the two points `ra` from `a` and `rb` from `b`. */
function meetUp(a: Point, ra: number, b: Point, rb: number): Point {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  const candidates: Point[] = [
    [round(a[0] + ux * x + uy * h), round(a[1] + uy * x - ux * h)],
    [round(a[0] + ux * x - uy * h), round(a[1] + uy * x + ux * h)],
  ];
  return candidates[0][1] < candidates[1][1] ? candidates[0] : candidates[1];
}

function elevatedPike(bottom: boolean): Pose {
  const hands = { near: [66, 0] as Point, far: [60, 0] as Point };
  const feet = { near: PIKE_ANKLE, far: [PIKE_ANKLE[0] + 3, PIKE_ANKLE[1]] as Point };
  const toes = { near: 0, far: 0 };
  // Hips stacked high over the shoulders, legs straight back to the box.
  if (!bottom) return { pelvis: [40, -217], chest: [68, -142], head: along([68, -142], 48, 54), hands, feet, toes };
  // Elbows bend back, the top of the head lowers to just above the floor ahead of the hands.
  const shoulder: Point = [90, -54];
  const pelvis = meetUp(PIKE_ANKLE, 173.9, shoulder, 98);
  const chest = chestToward(pelvis, shoulder);
  return { pelvis, chest, head: [114, -27], hands, feet, toes, elbows: { near: { bend: 1 }, far: { bend: 1 } } };
}

// ---------------------------------------------------------------- bar hangs

/** Front-view hang from a bar at y = -420 with hands at ±`grip`. */
function frontBarHang(pelvisY: number, grip: number, elbows?: Pose["elbows"]): Pose {
  return {
    pelvis: [0, pelvisY],
    chest: [0, pelvisY - 80],
    hands: { near: [-grip, -420], far: [grip, -420] },
    elbows,
    // Legs straight: hips sit 8 either side of the pelvis in front view.
    feet: { near: [-14, pelvisY + 173.9], far: [14, pelvisY + 173.9] },
    toes: { near: 180, far: 0 },
  };
}

/** Side-view hang; `thigh` is the thigh angle (90 = straight down), shins hanging from the knees. */
function kneeRaise(thigh: number): Pose {
  if (thigh >= 60) {
    const pelvis: Point = [0, -196];
    return {
      pelvis,
      head: [34, -318],
      hands: SIDE_HANDS,
      feet: { near: along(pelvis, 89, 173.6), far: along(pelvis, 88, 173.4) },
      toes: { near: 80, far: 80 },
    };
  }
  // Chest and head stay where the hang left them; the pelvis tucks forward under them.
  const hang = solvePose(kneeRaise(90));
  const pelvis = along(hang.chest, 83, 80);
  const kneeNear = along(pelvis, thigh, 88);
  const kneeFar = along(pelvis, thigh + 2, 88);
  return {
    pelvis,
    chest: hang.chest,
    head: hang.head,
    hands: SIDE_HANDS,
    knees: { near: { at: kneeNear }, far: { at: kneeFar } },
    feet: { near: along(kneeNear, 98, 86), far: along(kneeFar, 100, 86) },
    toes: { near: 70, far: 70 },
  };
}

// ---------------------------------------------------------------- freestanding handstand (kick-up)

const HS_HANDS = { near: [52, -1] as Point, far: [50, -1.5] as Point };
const HS_PELVIS: Point = [54, -223.5];
const HS_CHEST: Point = [60.5, -143.6];
/** Head pushed forward of the arm line (looking at the floor between the hands). */
const HS_HEAD: Point = [92, -104];

/** Lunge with the arms reaching up and forward, ready to tip into the kick. */
function kickLunge(): Pose {
  const pelvis: Point = [-40, -150];
  const chest = along(pelvis, -72, 80);
  const shoulder = along(pelvis, -72, 98);
  return {
    pelvis,
    chest,
    hands: { near: along(shoulder, -38, 125), far: along(shoulder, -36, 125) },
    feet: { near: [22, 0], far: [-128, -12] },
    toes: { near: 0, far: 36 },
  };
}

/** Hands down in front of the front foot; the back leg starts to kick up behind. */
function kickHandsDown(): Pose {
  const pelvis: Point = [-22, -168];
  return {
    pelvis,
    chest: [50, -134],
    head: [101, -110],
    hands: HS_HANDS,
    feet: { near: [-36, 0], far: along(pelvis, 200, 173.6) },
    toes: { near: 0, far: 200 },
  };
}

/** Hips over the hands, legs in a split: kicking leg nearly vertical, push leg trailing. */
function kickScissor(): Pose {
  return {
    pelvis: HS_PELVIS,
    chest: HS_CHEST,
    head: HS_HEAD,
    hands: HS_HANDS,
    feet: { near: along(HS_PELVIS, -168, 173.6), far: along(HS_PELVIS, -104, 173.6) },
    toes: { near: -168, far: -104 },
  };
}

/** Straight handstand, legs together over the hands. */
function handstandHold(sway: number): Pose {
  return {
    pelvis: HS_PELVIS,
    chest: HS_CHEST,
    head: HS_HEAD,
    hands: HS_HANDS,
    feet: { near: [46 + sway, -397], far: [42 + sway, -397] },
    toes: { near: -90, far: -90 },
  };
}

export const BATCH_F_SPECS: DoodleSpec[] = [
  {
    id: "nordic_curl",
    slug: "nordic-curl",
    title: "Nordic curl",
    replaces: true,
    // Pad holding the heels down.
    props: [{ kind: "box", x: -100, y: -22, w: 30, h: 12 }],
    transition: 1,
    frames: [
      { hold: 0.6, pose: nordic(0) },
      // Slow lower: three transitions down, one back up.
      { hold: 0.05, pose: nordic(24) },
      { hold: 0.05, pose: nordic(46) },
      { hold: 0.5, pose: nordic(66, true) },
    ],
  },
  {
    id: "dead_bug",
    slug: "dead-bug",
    title: "Dead bug",
    replaces: true,
    transition: 1.1,
    frames: [
      { hold: 0.4, pose: deadBug("none") },
      { hold: 0.6, pose: deadBug("nearArm") },
      { hold: 0.4, pose: deadBug("none") },
      { hold: 0.6, pose: deadBug("farArm") },
    ],
  },
  {
    id: "hollow_hold",
    slug: "hollow-hold",
    title: "Hollow body hold",
    replaces: true,
    transition: 1.6,
    frames: [
      { hold: 1.4, pose: hollow(-20, 196, 0) },
      { hold: 1.4, pose: hollow(-16, 194, -2) },
    ],
  },
  {
    id: "elevated_pike",
    slug: "elevated-pike",
    title: "Elevated pike push-up",
    replaces: true,
    props: [{ kind: "box", x: -150, y: -120, w: 90, h: 120 }],
    transition: 1,
    frames: [
      { hold: 0.5, pose: elevatedPike(false) },
      { hold: 0.3, pose: elevatedPike(true) },
    ],
  },
  {
    id: "hanging_knee_raise",
    slug: "hanging-knee-raise",
    title: "Hanging knee raise",
    replaces: true,
    props: [SIDE_BAR],
    transition: 1,
    frames: [
      { hold: 0.6, pose: kneeRaise(90) },
      { hold: 0.5, pose: kneeRaise(-24) },
    ],
  },
  {
    id: "pullup_dead_hang",
    slug: "dead-hang",
    title: "Dead hang",
    replaces: true,
    view: "front",
    props: [{ kind: "bar", y: -420, x1: -150, x2: 150, grips: [-56, 56] }],
    transition: 1.8,
    frames: [
      { hold: 1.6, pose: frontBarHang(-201, 56) },
      { hold: 1.6, pose: { ...frontBarHang(-201, 56), feet: { near: [-12, -28], far: [12, -28] } } },
    ],
  },
  {
    id: "scapular_pull",
    slug: "scapular-pull",
    title: "Scapular pull-up",
    replaces: true,
    view: "front",
    props: [{ kind: "bar", y: -420, x1: -150, x2: 150, grips: [-56, 56] }],
    transition: 1.1,
    frames: [
      // Passive: shoulders shrugged up to the ears, head sunk between the arms.
      { hold: 0.5, pose: { ...frontBarHang(-201, 56), head: [0, -332] } },
      {
        hold: 0.8,
        // Shoulder blades pulled down: head rises out of the shoulders, hips and legs lift; arms stay straight.
        pose: frontBarHang(-201, 56),
      },
    ],
  },
  {
    id: "pullup",
    slug: "pullup",
    title: "Pull-up",
    replaces: true,
    view: "front",
    props: [{ kind: "bar", y: -420, x1: -160, x2: 160, grips: [-90, 90] }],
    transition: 1,
    frames: [
      { hold: 0.5, pose: frontBarHang(-216.5, 90, { near: { bend: -1 }, far: { bend: 1 } }) },
      { hold: 0.4, pose: frontBarHang(-310, 90, { near: { bend: -1 }, far: { bend: 1 } }) },
    ],
  },
  {
    id: "freestanding_hs",
    slug: "freestanding-hs",
    title: "Freestanding handstand attempt",
    replaces: true,
    transition: 0.8,
    frames: [
      { hold: 0.4, pose: kickLunge() },
      { hold: 0.05, pose: kickHandsDown() },
      { hold: 0.05, pose: kickScissor() },
      { hold: 0.7, pose: handstandHold(0) },
      { hold: 0.7, pose: handstandHold(4) },
      // Exit: step the push leg back down the way it came.
      { hold: 0.05, pose: kickScissor() },
      { hold: 0.05, pose: kickHandsDown() },
    ],
  },
];
