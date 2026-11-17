import type { DoodleSpec, Point, Pose, Prop } from "./rig";

/**
 * Batch Q: bar and parallette holds (pull-up hold, front lever pull-up,
 * hanging leg raise with hip lift, L hold, foot-supported L-sit, parallel bar
 * hold). Floor at y = 0, up is negative, the side-view figure faces +x.
 * Import only from ./rig — never from ./specs (that would be circular).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

/** Knees pinned on the hip→ankle line (side view, hip = pelvis), so straight legs never kink. */
function straightKnees(pelvis: Point, near: Point, far: Point): Pose["knees"] {
  const knee = (ankle: Point): Point => along(pelvis, angle(pelvis, ankle), 88);
  return { near: { at: knee(near) }, far: { at: knee(far) } };
}

/** Straight-arm reach from shoulder to fingertip (a hair short of locked). */
const REACH = 125.4;
/** Pelvis to ankle with the knee straight. */
const LEG = 173.6;

// ---------------------------------------------------------------- pull-up isometric hold (front view)

const PULL_GRIP = 90;
/** Pelvis height of a straight-arm hang (shoulders 22 either side of the chest, 98 above the pelvis). */
const PULL_HANG_Y = round(-420 + Math.sqrt(REACH * REACH - (PULL_GRIP - 22) ** 2) + 98);

/** Front-view hang from a bar at y = -420 with hands at ±`grip`. */
function frontBarHang(pelvisY: number, grip: number, elbows?: Pose["elbows"]): Pose {
  return {
    pelvis: [0, pelvisY],
    chest: [0, pelvisY - 80],
    hands: { near: [-grip, -420], far: [grip, -420] },
    elbows,
    feet: { near: [-14, pelvisY + 173.9], far: [14, pelvisY + 173.9] },
    toes: { near: 180, far: 0 },
  };
}

/**
 * Held halfway up: elbows bent to a right angle, upper arms level out to the
 * sides, forearms vertical under the hands; the head stays just under the bar.
 */
function pullUpHold(): Pose {
  const shoulderY = -420 + 66;
  const pelvisY = shoulderY + 98;
  return frontBarHang(pelvisY, PULL_GRIP, {
    near: { at: [-(PULL_GRIP - 8), shoulderY] },
    far: { at: [PULL_GRIP - 8, shoulderY] },
  });
}

// ---------------------------------------------------------------- side-view bar work

const SIDE_BAR: Prop = { kind: "bar", y: -420, x1: -110, x2: 110, grips: [0] };
/** Rings (or the bar) seen end-on: just the grip, so the raised legs can pass beside it. */
const RINGS: Prop[] = [{ kind: "bar", y: -420, x1: 0, x2: 0, grips: [0] }];
const HAND: Point = [2, -420];

/**
 * Front lever, side view: body one straight horizontal line at `shoulder`
 * height, face up, head towards -x and legs towards +x. Arms straight up to the
 * bar for the lever; for the pull the elbows fold and travel towards the hips.
 */
function frontLever(shoulder: Point, pulled = false): Pose {
  const pelvis = along(shoulder, 0, 98);
  const chest = along(pelvis, 180, 80);
  return {
    pelvis,
    chest,
    // Head in line with the body (neutral neck).
    head: along(shoulder, 180, 38),
    hands: { near: [HAND[0] + 2, HAND[1]], far: [HAND[0] - 2, HAND[1]] },
    elbows: pulled
      ? { near: { at: pullElbow(shoulder, [HAND[0] + 2, HAND[1]]) }, far: { at: pullElbow(shoulder, [HAND[0] - 2, HAND[1]]) } }
      : undefined,
    knees: straightKnees(pelvis, along(pelvis, 0, LEG), along(pelvis, 0.4, LEG)),
    feet: { near: along(pelvis, 0, LEG), far: along(pelvis, 0.4, LEG) },
    toes: { near: 0, far: 0 },
  };
}

/** Straight-arm lever: arms vertical, shoulder right under the bar. */
const LEVER_SHOULDER: Point = along(HAND, 92, REACH);
/** Top of the pull: shoulders just past the bar, so the bar meets the chest. */
const PULL_SHOULDER: Point = [-28, -396];

/** Elbow for the top of the pull: 60 from the shoulder, 66 from the fingertips, on the hip side. */
function pullElbow(shoulder: Point, hand: Point): Point {
  const d = Math.hypot(hand[0] - shoulder[0], hand[1] - shoulder[1]);
  const a = (60 ** 2 - 66 ** 2 + d ** 2) / (2 * d);
  const h = Math.sqrt(Math.max(0, 60 ** 2 - a ** 2));
  const u: Point = [(hand[0] - shoulder[0]) / d, (hand[1] - shoulder[1]) / d];
  const base: Point = [shoulder[0] + u[0] * a, shoulder[1] + u[1] * a];
  const options: Point[] = [
    [round(base[0] - u[1] * h), round(base[1] + u[0] * h)],
    [round(base[0] + u[1] * h), round(base[1] - u[0] * h)],
  ];
  // The elbow drives back towards the hips (+x).
  return options[0][0] > options[1][0] ? options[0] : options[1];
}

/**
 * Hanging from straight arms; the spine leans from the hands so the shoulder
 * stays an arm's length below the bar. Straight legs run from the hips to `ankle`.
 */
function hangLegs(pelvis: Point, ankle: Point, toe?: number): Pose {
  // Shoulder 98 from the pelvis and an arm's length (125.6) from the bar: the solution in front, under the bar.
  const d = Math.hypot(HAND[0] - pelvis[0], HAND[1] - pelvis[1]);
  const along1 = (98 ** 2 - 125.6 ** 2 + d ** 2) / (2 * d);
  const h = Math.sqrt(Math.max(0, 98 ** 2 - along1 ** 2));
  const u: Point = [(HAND[0] - pelvis[0]) / d, (HAND[1] - pelvis[1]) / d];
  const shoulder: Point = [pelvis[0] + u[0] * along1 - u[1] * h, pelvis[1] + u[1] * along1 + u[0] * h];
  const spine = angle(pelvis, shoulder);
  const chest = along(pelvis, spine, 80);
  const legDeg = angle(pelvis, ankle);
  const farAnkle = along(pelvis, legDeg - 1, Math.min(173.85, Math.hypot(ankle[0] - pelvis[0], ankle[1] - pelvis[1])));
  return {
    pelvis,
    chest,
    head: along(chest, Math.min(spine + 40, -40), 54),
    hands: { near: [HAND[0] + 2, HAND[1]], far: [HAND[0] - 2, HAND[1]] },
    knees: straightKnees(pelvis, ankle, farAnkle),
    feet: { near: ankle, far: farAnkle },
    toes: { near: toe ?? legDeg, far: toe ?? legDeg },
  };
}

// ---------------------------------------------------------------- parallettes (side view, both stacked)

/** Low parallettes: handle height and position; the hands rest on the handle. */
const PT_Y = -34;
const PT_X = 0;
const PARALLETTES: Prop = { kind: "parallettes", y: PT_Y, xs: [PT_X] };
const PT_HANDS = { near: [PT_X + 2, PT_Y] as Point, far: [PT_X - 2, PT_Y] as Point };

/** L hold: arms locked on the handles, hips lifted, straight legs level; `lift` raises the legs a touch. */
function lHold(lift: number): Pose {
  const pelvis: Point = [-8, -64 - lift];
  return {
    pelvis,
    hands: PT_HANDS,
    knees: straightKnees(pelvis, along(pelvis, -lift, LEG), along(pelvis, -lift - 0.6, LEG)),
    feet: { near: along(pelvis, -lift, LEG), far: along(pelvis, -lift - 0.6, LEG) },
    toes: { near: -lift + 5, far: -lift + 5 },
  };
}

/** Foot-supported L-sit: arms locked, hips lifted off the floor, straight legs sloping to the heels on the floor. */
function lSitHeels(lift: number): Pose {
  const pelvis: Point = [-8, -64 - lift];
  const heelY = -6;
  const ankle: Point = [round(pelvis[0] + Math.sqrt(LEG ** 2 - (heelY - pelvis[1]) ** 2)), heelY];
  return {
    pelvis,
    hands: PT_HANDS,
    knees: straightKnees(pelvis, ankle, ankle),
    feet: { near: ankle, far: ankle },
    toes: { near: -70, far: -70 },
  };
}

// ---------------------------------------------------------------- parallel bar hold

/** Rail height: the straight body hangs between the rails with the feet well clear of the floor. */
const PB_RAIL = -236;
const PB_BARS: Prop = { kind: "parallelBars", y: PB_RAIL, x1: -110, x2: 190 };

/** Straight-arm support between the rails: arms locked, shoulders down, body straight and still, feet off the floor. */
function barSupport(): Pose {
  const hand: Point = [48, PB_RAIL];
  const shoulder: Point = [44, PB_RAIL - 125.8];
  // Spine leaning a touch forward of the hands so the locked arms read apart from the torso.
  const chest = along(shoulder, 104, 18);
  const pelvis = along(chest, 104, 80);
  return {
    pelvis,
    chest,
    hands: { near: hand, far: [hand[0] - 3, hand[1]] },
    knees: straightKnees(pelvis, along(pelvis, 94, LEG), along(pelvis, 95, LEG)),
    feet: { near: along(pelvis, 94, LEG), far: along(pelvis, 95, LEG) },
    toes: { near: 70, far: 70 },
  };
}

export const BATCH_Q_SPECS: DoodleSpec[] = [
  {
    id: "wger_1537",
    slug: "pull-up-isometric-hold",
    title: "Pull-up Isometric Hold",
    view: "front",
    props: [{ kind: "bar", y: -420, x1: -170, x2: 170, grips: [-PULL_GRIP, PULL_GRIP] }],
    transition: 1,
    frames: [
      { hold: 0.4, pose: frontBarHang(PULL_HANG_Y, PULL_GRIP, { near: { bend: -1 }, far: { bend: 1 } }) },
      { hold: 2.6, pose: pullUpHold() },
    ],
  },
  {
    id: "wger_1252",
    slug: "front-lever-pull-up",
    title: "Front lever pull-up",
    props: [SIDE_BAR],
    transition: 1,
    frames: [
      { hold: 0.6, pose: frontLever(LEVER_SHOULDER) },
      { hold: 0.5, pose: frontLever(PULL_SHOULDER, true) },
    ],
  },
  {
    id: "wger_2756",
    slug: "hanging-leg-raise-hip-lift",
    title: "Hanging Leg Raise with Hip Lift on Rings",
    props: RINGS,
    transition: 0.6,
    frames: [
      { hold: 0.4, pose: hangLegs([0, -196], along([0, -196], 89, 173.85)) },
      { hold: 0.05, pose: hangLegs([-4, -198], along([-4, -198], 40, 173.85)) },
      { hold: 0.2, pose: hangLegs([-8, -200], along([-8, -200], 0, 173.85)) },
      { hold: 0.6, pose: hangLegs([-55, -326], along([-55, -326], -84, 173.85), -84) },
      { hold: 0.2, pose: hangLegs([-8, -200], along([-8, -200], 0, 173.85)) },
      { hold: 0.05, pose: hangLegs([-4, -198], along([-4, -198], 40, 173.85)) },
    ],
  },
  {
    id: "wger_382",
    slug: "l-hold",
    title: "L Hold",
    props: [PARALLETTES],
    transition: 1,
    frames: [
      { hold: 1.2, pose: lHold(0) },
      { hold: 1.2, pose: lHold(2) },
    ],
  },
  {
    id: "wger_1853",
    slug: "l-sit-foot-supported",
    title: "L-Sit (Foot Supported)",
    props: [PARALLETTES],
    transition: 1,
    frames: [
      { hold: 1.2, pose: lSitHeels(0) },
      { hold: 1.2, pose: lSitHeels(3) },
    ],
  },
  {
    id: "wger_1808",
    slug: "parallel-bar-hold",
    title: "Parallel Bar Hold",
    props: [PB_BARS],
    transition: 1.4,
    frames: [
      { hold: 2.4, pose: barSupport() },
    ],
  },
];
