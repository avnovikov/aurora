import { dist, SHOULDER_SIDE, type DoodleSpec, type JointHint, type Point, type Pose, type Prop } from "./rig";

/**
 * Batch AD: bar and bench moves. Front view where the body travels between
 * the hands (commando, typewriter, side-to-side, towel); side view for the
 * leaning bar moves, the hanging knee drives and the bench work.
 * Floor at y = 0, up is negative, the side-view figure faces +x; lying face up
 * puts the head on the left.
 * Import only from ./rig — never from ./specs (that would be circular).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

const BAR_Y = -420;
/** Straight-arm reach from shoulder to fingertip (a hair short of locked). */
const REACH = 125.4;
/** Pelvis to ankle with the knee straight. */
const LEG = 173.6;
/** Pelvis to shoulder along a straight torso. */
const SHOULDER_REACH = 98;
const UPPER_ARM = 60;
/** Forearm plus hand: elbow to fingertip with the wrist straight. */
const LOWER_ARM = 66;

/** Where circles around `a` (radius ra) and `b` (radius rb) meet; `side` 1 or -1 picks the point left/right of a→b. */
function meet(a: Point, ra: number, b: Point, rb: number, side: 1 | -1): Point {
  const d = dist(a, b);
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  return [round(a[0] + ux * x - side * uy * h), round(a[1] + uy * x + side * ux * h)];
}

/** Elbow for a bent arm: UPPER_ARM from the shoulder, LOWER_ARM from the fingertip. */
function elbowBetween(shoulder: Point, hand: Point, pick: (a: Point, b: Point) => Point): Point {
  return pick(meet(shoulder, UPPER_ARM, hand, LOWER_ARM, 1), meet(shoulder, UPPER_ARM, hand, LOWER_ARM, -1));
}

const lower = (a: Point, b: Point): Point => (a[1] > b[1] ? a : b);
const leftmost = (a: Point, b: Point): Point => (a[0] < b[0] ? a : b);
const rightmost = (a: Point, b: Point): Point => (a[0] > b[0] ? a : b);

/** Straight arm (bend hint) or a pinned elbow when the hand is closer than an arm's length. */
function arm(shoulder: Point, hand: Point, pick: (a: Point, b: Point) => Point, bend: 1 | -1): JointHint {
  return dist(shoulder, hand) > REACH - 1 ? { bend } : { at: elbowBetween(shoulder, hand, pick) };
}

/** Knees pinned on the hip→ankle line, so straight legs never kink. */
function straightKnee(hip: Point, ankle: Point): { at: Point } {
  return { at: along(hip, angle(hip, ankle), 88) };
}

// ---------------------------------------------------------------- front view hangs

/**
 * Front-view hang or pull: chest at `cx`, shoulders at `shoulderY`, hands at
 * `hands`. Bent arms fold their elbows outward (or down with `elbowsDown`).
 */
function frontHang(
  cx: number,
  shoulderY: number,
  hands: { near: Point; far: Point },
  opts: { elbowsDown?: boolean; head?: Point; picks?: { near: (a: Point, b: Point) => Point; far: (a: Point, b: Point) => Point } } = {},
): Pose {
  const pelvis: Point = [cx, shoulderY + SHOULDER_REACH];
  const near: Point = [cx - SHOULDER_SIDE, shoulderY];
  const far: Point = [cx + SHOULDER_SIDE, shoulderY];
  return {
    pelvis,
    chest: [cx, shoulderY + 18],
    ...(opts.head ? { head: opts.head } : {}),
    hands,
    elbows: {
      near: arm(near, hands.near, opts.picks?.near ?? (opts.elbowsDown ? lower : leftmost), -1),
      far: arm(far, hands.far, opts.picks?.far ?? (opts.elbowsDown ? lower : rightmost), 1),
    },
    feet: { near: [cx - 14, pelvis[1] + 173.9], far: [cx + 14, pelvis[1] + 173.9] },
    toes: { near: 180, far: 0 },
  };
}

/** Shoulder height of a straight-arm hang with that shoulder `dx` across from its hand. */
const straightShoulderY = (dx: number, barY = BAR_Y): number => round(barY + Math.sqrt(REACH ** 2 - dx ** 2) - 0.4);

// Commando: side-on under the bar, so from the front the bar is end-on; hands close, one behind the other.
const COMMANDO_HANDS = { near: [-3, BAR_Y] as Point, far: [3, BAR_Y] as Point };
const COMMANDO_HANG = straightShoulderY(SHOULDER_SIDE - 3);
/** At the top the head passes beside the bar: the body sits off to that side. */
const COMMANDO_TOP_Y = -392;
const COMMANDO_SHIFT = 30;

const commandoHang = (): Pose => frontHang(0, COMMANDO_HANG, COMMANDO_HANDS, { elbowsDown: true });
/** The arm on the far side of the bar folds outward; the one beside the head folds down in front of the chest. */
const commandoTop = (side: -1 | 1): Pose =>
  frontHang(side * COMMANDO_SHIFT, COMMANDO_TOP_Y, COMMANDO_HANDS, {
    picks: side < 0 ? { near: lower, far: rightmost } : { near: leftmost, far: lower },
  });

// Wide grip: typewriter and side-to-side chins.
const WIDE = 100;
const WIDE_HANDS = { near: [-WIDE, BAR_Y] as Point, far: [WIDE, BAR_Y] as Point };
const WIDE_HANG = straightShoulderY(WIDE - SHOULDER_SIDE);

/** Typewriter: chin over the bar, chest centred. */
const TYPE_Y = -392;
/** Shifted to one side at bar height: the other arm straight. */
function typeAcross(side: -1 | 1): Pose {
  const straightDx = Math.sqrt(REACH ** 2 - (TYPE_Y - BAR_Y) ** 2) - 1;
  const cx = round(-side * (WIDE - straightDx) + side * SHOULDER_SIDE);
  return frontHang(cx, TYPE_Y, WIDE_HANDS, { head: [cx + side * 6, TYPE_Y - 38] });
}

/** Side-to-side chin: pulled up towards one hand, both elbows bent, bar at the upper chest. */
function sideChin(side: -1 | 1): Pose {
  const cx = side * 34;
  return frontHang(cx, -404, WIDE_HANDS, { head: [cx + side * 8, -441] });
}

// Towel pull-up: towels draped over the bar, the hands grip their ends.
const TOWEL_BAR = -500;
const TOWEL_GRIP = 56;
const TOWEL_W = 14;
const TOWEL_HANDS = { near: [-TOWEL_GRIP, BAR_Y] as Point, far: [TOWEL_GRIP, BAR_Y] as Point };
const towelStrip = (x: number): Prop => ({ kind: "box", x: x - TOWEL_W / 2, y: TOWEL_BAR, w: TOWEL_W, h: BAR_Y - TOWEL_BAR });

// ---------------------------------------------------------------- side view hangs

/** Side view: the bar end-on, both hands on it. */
const SIDE_HANDS = { near: [2, BAR_Y] as Point, far: [-2, BAR_Y] as Point };
const END_BAR: Prop = { kind: "bar", y: BAR_Y, x1: 0, x2: 0, grips: [0] };
const HANG_SHOULDER: Point = along(SIDE_HANDS.near, 96, REACH);
const HANG_PELVIS: Point = [HANG_SHOULDER[0] - 4, HANG_SHOULDER[1] + SHOULDER_REACH];

/** Hanging still; one knee driven up (`thigh` degrees, 90 = hanging), the other leg straight down. */
function windSprint(up: "near" | "far"): Pose {
  const pelvis = HANG_PELVIS;
  const knee = along(pelvis, -12, 88);
  const raised = { knee, foot: along(knee, 96, 86) };
  const hangingAnkle = along(pelvis, 92, LEG);
  const hanging = { knee: straightKnee(pelvis, hangingAnkle), foot: hangingAnkle };
  const leg = (side: "near" | "far") => (side === up ? { knee: { at: raised.knee }, foot: raised.foot } : hanging);
  const chest = along(pelvis, -92, 80);
  return {
    pelvis,
    chest,
    // Head forward of the arms (chest up, eyes ahead), as in the hanging knee raise.
    head: along(chest, -58, 56),
    hands: SIDE_HANDS,
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: leg("near").knee, far: leg("far").knee },
    feet: { near: leg("near").foot, far: leg("far").foot },
    toes: { near: up === "near" ? 60 : 80, far: up === "far" ? 60 : 80 },
  };
}

// Extreme lat stretch: feet on a box under a pull-up bar. Standing tall holding the bar, then the hips sit
// back and down until the arms are long overhead, in one line with the trunk (the lats stretched).
const LAT_BOX_TOP = -85;
const LAT_BOX: Prop = { kind: "box", x: -130, y: LAT_BOX_TOP, w: 130, h: -LAT_BOX_TOP };
const LAT_ANKLE: Point = [-50, LAT_BOX_TOP - 8];
/** Sitting back: pelvis, shoulder and hands on one line rising at this angle. */
const LAT_LINE = -57;

/** `sit`: 0 hanging under the bar on straight arms, knees bent, feet on the box; 1 sat back into the stretch. */
function latStretch(sit: number): Pose {
  const hand = SIDE_HANDS.near;
  const shoulder = along(hand, 93 + sit * (LAT_LINE + 180 - 93), REACH);
  const lean = -88 + sit * (LAT_LINE + 88);
  const pelvis = along(shoulder, lean + 180, SHOULDER_REACH);
  const chest = along(pelvis, lean, 80);
  return {
    pelvis,
    chest,
    // Chin tucked, so the head stays forward of the arms.
    head: along(chest, lean + 34, 56),
    hands: SIDE_HANDS,
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: LAT_ANKLE, far: LAT_ANKLE },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- leaning on a low bar (side view)

/**
 * Body straight from the ankle (on the floor) to the head. Finds the body angle
 * that puts a point `a` along the body and `h` across it (positive: the floor
 * side of the line when face down, the bar side when face up) on the bar.
 */
function bodyAngleFor(bar: Point, ankleY: number, a: number, h: number, sweep: [number, number]): number {
  let best = sweep[0];
  let bestError = Infinity;
  for (let d = sweep[0]; d <= sweep[1]; d += 0.05) {
    const p = along(along([0, ankleY], d, a), d + 90, h);
    const error = Math.abs(p[1] - bar[1]);
    if (error < bestError) {
      bestError = error;
      best = d;
    }
  }
  return best;
}

interface Lean {
  ankle: Point;
  /** Body direction (ankle → head), degrees. */
  deg: number;
}

/** Ankle and body angle for a bar at `bar` touched by the point (`a` along, `h` across). */
function leanOn(bar: Point, ankleY: number, a: number, h: number, sweep: [number, number]): Lean {
  const deg = bodyAngleFor(bar, ankleY, a, h, sweep);
  const p = along(along([0, ankleY], deg, a), deg + 90, h);
  return { ankle: [round(bar[0] - p[0]), ankleY], deg };
}

/**
 * Leaning moves keep the body one rigid line pivoting at the ankles. The legs
 * are straight from knee pins alone (no ankle pin), so in-betweens blend the
 * thigh and shin angles and the legs stay straight; the in-between keyframes
 * keep the pelvis on the arc round the ankles.
 */
const LEAN_LEG = 173.98;
const LEAN_REACH = LEAN_LEG + SHOULDER_REACH;
/** Body-angle steps per half rep. */
const LEAN_STEPS = 2;

/** Like `along` but unrounded, so pinned bones keep their exact lengths (no kink). */
function exactly(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [from[0] + Math.cos(r) * length, from[1] + Math.sin(r) * length];
}

/** A straight body from `ankle` at `deg`; arms to `hand`. */
function leaning(ankle: Point, deg: number, hand: Point, elbow: JointHint, toes: number, headTilt = 0): Pose {
  const pelvis = exactly(ankle, deg, LEAN_LEG);
  const chest = exactly(pelvis, deg, 80);
  const knee = { at: exactly(pelvis, deg + 180, 88) };
  return {
    pelvis,
    chest,
    head: exactly(chest, deg + headTilt, 56),
    hands: { near: hand, far: hand },
    elbows: { near: elbow, far: elbow },
    knees: { near: knee, far: knee },
    toes: { near: toes, far: toes },
  };
}

/**
 * A rep of a leaning move: `pose(f)` from the straight-arm end (f = 0) to the
 * bent-arm end (f = 1), with in-between keyframes every 1/LEAN_STEPS.
 */
function leanRep(pose: (f: number) => Pose, holdStraight: number, holdBent: number): DoodleSpec["frames"] {
  const steps = Array.from({ length: LEAN_STEPS - 1 }, (_, i) => (i + 1) / LEAN_STEPS);
  return [
    { hold: holdStraight, pose: pose(0) },
    ...steps.map((f) => ({ hold: 0, pose: pose(f) })),
    { hold: holdBent, pose: pose(1) },
    ...[...steps].reverse().map((f) => ({ hold: 0, pose: pose(f) })),
  ];
}

/** Body angle `f` of the way from straight arms on the bar (f = 0) to the bent end (`lean`, f = 1). */
function leanDeg(lean: Lean, hand: Point, f: number): number {
  // Arms locked at the straight end (a hair under the full 126).
  const straight = angle(lean.ankle, meet(lean.ankle, LEAN_REACH, hand, 125.9, -1));
  return straight + (lean.deg - straight) * f;
}

/** Arm for a body at `deg`: locked when the hand is an arm's length away, else the elbow `pick` chooses. */
function leanArm(lean: Lean, deg: number, hand: Point, pick: (a: Point, b: Point) => Point): JointHint {
  return arm(exactly(lean.ankle, deg, LEAN_REACH), hand, pick, 1);
}

// Body tricep press: face down on a chest-high bar; the elbows fold forward and the forehead goes to the bar.
const TRI_BAR: Point = [0, -236];
const TRI_ANKLE_Y = -19;
/** Bottom: the bar just in front of and below the forehead. */
const TRI_LEAN = leanOn(TRI_BAR, TRI_ANKLE_Y, LEAN_REACH + 46, 26, [-80, -10]);

/** `f` 0 arms straight, 1 at the bottom. Elbows point forward and down, ahead of the head. */
function tricepPress(f: number): Pose {
  const hand: Point = [TRI_BAR[0] - 2, TRI_BAR[1]];
  const deg = leanDeg(TRI_LEAN, hand, f);
  return leaning(TRI_LEAN.ankle, deg, hand, leanArm(TRI_LEAN, deg, hand, lower), 62);
}

// Reverse-grip incline push-up: the chest comes down to the bar, elbows tucked back along the ribs.
const REV_BAR: Point = [0, -196];
const REV_LEAN = leanOn(REV_BAR, -19, LEAN_REACH - 8, 24, [-80, -10]);

/** `f` 0 arms straight, 1 at the bottom. Tucked: the upper arm runs back along the ribs towards the hips. */
function reverseIncline(f: number): Pose {
  const hand: Point = [REV_BAR[0] - 2, REV_BAR[1]];
  const deg = leanDeg(REV_LEAN, hand, f);
  const ankle = REV_LEAN.ankle;
  const tucked = (a: Point, b: Point): Point => (dist(a, ankle) < dist(b, ankle) ? a : b);
  return leaning(ankle, deg, hand, leanArm(REV_LEAN, deg, hand, tucked), 62);
}

// Bodyweight biceps curl: face up, leaning back from a chest-high bar, heels on the floor ahead of it.
const CURL_BAR: Point = [0, -300];
const CURL_ANKLE_Y = -10;
/** Top: the forehead comes up to the bar (bar just in front of the head). */
const CURL_LEAN = leanOn(CURL_BAR, CURL_ANKLE_Y, LEAN_REACH + 44, 30, [-170, -100]);

/** `f` 0 hanging back on straight arms, 1 at the top. Elbows stay high: the upper arm points forward at the bar. */
function bicepsCurl(f: number): Pose {
  const hand: Point = [CURL_BAR[0] + 2, CURL_BAR[1]];
  const deg = leanDeg(CURL_LEAN, hand, f);
  return leaning(CURL_LEAN.ankle, deg, hand, leanArm(CURL_LEAN, deg, hand, rightmost), -100);
}

// ---------------------------------------------------------------- sloped benches

/** Point on the line a→b at x. */
const onLine = (a: Point, b: Point, x: number): Point => [x, round(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]))];

// Decline leg raise: head at the high (left) end, hands gripping the bench behind the head.
const DECLINE_HIGH: Point = [-240, -130];
const DECLINE_LOW: Point = [60, -54];
const DECLINE_DEG = angle(DECLINE_HIGH, DECLINE_LOW);
/** Lying on the bench: the body line sits this far above the board. */
const LIE = 22;
const DECLINE_PELVIS = along(onLine(DECLINE_HIGH, DECLINE_LOW, -40), DECLINE_DEG - 90, LIE);

function declineLegRaise(legDeg: number): Pose {
  const pelvis = DECLINE_PELVIS;
  const up = DECLINE_DEG + 180;
  const chest = along(pelvis, up, 80);
  const head = along(chest, up, 56);
  const grip = along(onLine(DECLINE_HIGH, DECLINE_LOW, -234), DECLINE_DEG - 90, LIE - 5);
  const ankle = along(pelvis, legDeg, LEG);
  return {
    pelvis,
    chest,
    head,
    hands: { near: grip, far: [grip[0] + 2, grip[1]] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: straightKnee(pelvis, ankle), far: straightKnee(pelvis, ankle) },
    feet: { near: ankle, far: ankle },
    toes: { near: legDeg - 90, far: legDeg - 90 },
  };
}

export const BATCH_AD_SPECS: DoodleSpec[] = [
  {
    id: "hf_48",
    slug: "commando-pull-up",
    title: "Commando Pull-Up",
    view: "front",
    props: [{ kind: "bar", y: BAR_Y, x1: 0, x2: 0, grips: [0] }],
    transition: 1,
    frames: [
      { hold: 0.4, pose: commandoHang() },
      { hold: 0.4, pose: commandoTop(-1) },
      { hold: 0.4, pose: commandoHang() },
      { hold: 0.4, pose: commandoTop(1) },
    ],
  },
  {
    id: "hf_51",
    slug: "typewriter-pull-up",
    title: "Typewriter Pull-Up",
    view: "front",
    props: [{ kind: "bar", y: BAR_Y, x1: -170, x2: 170, grips: [-WIDE, WIDE] }],
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: frontHang(0, WIDE_HANG, WIDE_HANDS) },
      { hold: 0.1, pose: frontHang(0, TYPE_Y, WIDE_HANDS) },
      { hold: 0.4, pose: typeAcross(-1) },
      { hold: 0.4, pose: typeAcross(1) },
      { hold: 0.1, pose: frontHang(0, TYPE_Y, WIDE_HANDS) },
    ],
  },
  {
    id: "hf_53",
    slug: "towel-pull-up",
    title: "Towel Pull-Up",
    view: "front",
    props: [{ kind: "bar", y: TOWEL_BAR, x1: -150, x2: 150 }, towelStrip(-TOWEL_GRIP), towelStrip(TOWEL_GRIP)],
    transition: 1,
    frames: [
      { hold: 0.5, pose: frontHang(0, straightShoulderY(TOWEL_GRIP - SHOULDER_SIDE), TOWEL_HANDS) },
      { hold: 0.4, pose: frontHang(0, -404, TOWEL_HANDS, { elbowsDown: true }) },
    ],
  },
  {
    id: "fedb_side_to_side_chins",
    slug: "side-to-side-chins",
    title: "Side To Side Chins",
    view: "front",
    props: [{ kind: "bar", y: BAR_Y, x1: -170, x2: 170, grips: [-WIDE, WIDE] }],
    transition: 1,
    frames: [
      { hold: 0.4, pose: frontHang(0, WIDE_HANG, WIDE_HANDS) },
      { hold: 0.4, pose: sideChin(-1) },
      { hold: 0.4, pose: frontHang(0, WIDE_HANG, WIDE_HANDS) },
      { hold: 0.4, pose: sideChin(1) },
    ],
  },
  {
    id: "fedb_wind_sprints",
    slug: "wind-sprints",
    title: "Wind Sprints",
    props: [END_BAR],
    transition: 0.45,
    frames: [
      { hold: 0.1, pose: windSprint("near") },
      { hold: 0.1, pose: windSprint("far") },
    ],
  },
  {
    id: "wger_1608",
    slug: "bodyweight-biceps-curl",
    title: "Bodyweight Biceps Curl",
    props: [{ kind: "bar", y: CURL_BAR[1], x1: CURL_BAR[0] - 6, x2: CURL_BAR[0] + 6, grips: [CURL_BAR[0]] }],
    transition: 1 / LEAN_STEPS,
    frames: leanRep(bicepsCurl, 0.5, 0.4),
  },
  {
    id: "wger_1921",
    slug: "extreme-lat-stretch",
    title: "Extreme Lat Stretch",
    props: [END_BAR, LAT_BOX],
    transition: 0.8,
    frames: [
      { hold: 0.6, pose: latStretch(0) },
      { hold: 0, pose: latStretch(0.5) },
      { hold: 2.4, pose: latStretch(1) },
      { hold: 0, pose: latStretch(0.5) },
    ],
  },
  {
    id: "fedb_body_tricep_press",
    slug: "body-tricep-press",
    title: "Body Tricep Press",
    props: [{ kind: "bar", y: TRI_BAR[1], x1: TRI_BAR[0] - 6, x2: TRI_BAR[0] + 6, grips: [TRI_BAR[0]] }],
    transition: 1 / LEAN_STEPS,
    frames: leanRep(tricepPress, 0.4, 0.4),
  },
  {
    id: "fedb_incline_push_up_reverse_grip",
    slug: "incline-push-up-reverse-grip",
    title: "Incline Push-Up Reverse Grip",
    props: [{ kind: "bar", y: REV_BAR[1], x1: REV_BAR[0] - 6, x2: REV_BAR[0] + 6, grips: [REV_BAR[0]] }],
    transition: 1 / LEAN_STEPS,
    frames: leanRep(reverseIncline, 0.4, 0.4),
  },
  {
    id: "wger_1889",
    slug: "decline-bench-leg-raise",
    title: "Decline Bench Leg Raise",
    props: [{ kind: "board", from: DECLINE_HIGH, to: DECLINE_LOW }],
    transition: 1.1,
    frames: [
      { hold: 0.4, pose: declineLegRaise(DECLINE_DEG - 8) },
      { hold: 0.4, pose: declineLegRaise(-88) },
    ],
  },

];
