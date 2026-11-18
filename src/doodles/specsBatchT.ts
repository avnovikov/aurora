import { solvePose } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose, Prop } from "./rig";
import { BODY, LOCKED, PLANK_FOOT, pushUp, pushUpTop, rep, straightBody } from "./specsBatchC";

/**
 * Batch T: planche holds and planche push-up, push-up variations (rotations,
 * Russian, three-point, triceps, Tyson, V push-up, plank jump-ins) and dips
 * (forward lean, straight bar, Korean, L-sit). Floor at y = 0, up is
 * negative, the side-view figure faces +x (a plank has the head at +x).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Upper (smaller y) intersection of the circles around `a` (radius ra) and `b` (radius rb). */
function apex(a: Point, ra: number, b: Point, rb: number): Point {
  const d = dist(a, b);
  const t = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - t * t));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  const mid: Point = [a[0] + ux * t, a[1] + uy * t];
  const p1: Point = [mid[0] - uy * h, mid[1] + ux * h];
  const p2: Point = [mid[0] + uy * h, mid[1] - ux * h];
  const best = p1[1] < p2[1] ? p1 : p2;
  return [round(best[0]), round(best[1])];
}

/** Lower (larger y) intersection of the circles around `a` (radius ra) and `b` (radius rb). */
function low(a: Point, ra: number, b: Point, rb: number): Point {
  const d = dist(a, b);
  const t = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - t * t));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  const mid: Point = [a[0] + ux * t, a[1] + uy * t];
  const p1: Point = [mid[0] - uy * h, mid[1] + ux * h];
  const p2: Point = [mid[0] + uy * h, mid[1] - ux * h];
  const best = p1[1] > p2[1] ? p1 : p2;
  return [round(best[0]), round(best[1])];
}

/** Pelvis → shoulder along a straight spine. */
const SPINE = 98;
/** Hip → ankle with the knee straight (a hair short so it never kinks). */
const LEG = 173.6;

/** Straight torso: pelvis and chest for a shoulder at `shoulder`, spine pointing `deg` from pelvis to shoulder. */
function torso(shoulder: Point, deg: number): { pelvis: Point; chest: Point } {
  const pelvis = along(shoulder, deg + 180, SPINE);
  return { pelvis, chest: along(pelvis, deg, 80) };
}

const BENT = { near: { bend: 1 as const }, far: { bend: 1 as const } };

// ---------------------------------------------------------------- planche

const PL_HAND: Point = [0, 0];
const PL_HANDS = { near: PL_HAND, far: PL_HAND };
/** Full planche: locked arms leaning this far forward of vertical, shoulders well ahead of the wrists. */
const PL_LEAN = 32;

/** Body tilted `tilt` degrees: 0 is level; negative lifts the feet a touch above the shoulders. */
function planche(shoulder: Point, tilt: number, elbows?: Pose["elbows"]): Pose {
  const deg = -tilt;
  const { pelvis, chest } = torso(shoulder, deg);
  const foot = along(pelvis, deg + 180, LEG);
  return {
    pelvis,
    chest,
    // Eyes to the floor a little ahead of the hands.
    head: along(along(chest, deg, 20), deg + 30, 36),
    hands: PL_HANDS,
    elbows,
    feet: { near: foot, far: foot },
    toes: { near: deg + 180, far: deg + 180 },
  };
}

const PL_TOP = along(PL_HAND, -90 + PL_LEAN, LOCKED);

/** Planche lean: toes on the floor, straight body, locked arms leaning forward over the hands. */
function plancheLean(): Pose {
  const foot: Point = [-196, -18];
  const shoulder = apex(foot, BODY, PL_HAND, LOCKED);
  const deg = angle(foot, shoulder);
  return {
    pelvis: along(foot, deg, 173.9),
    chest: along(foot, deg, 253.9),
    head: along(along(foot, deg, 273.9), deg + 30, 36),
    hands: PL_HANDS,
    feet: { near: foot, far: foot },
    toes: { near: 75, far: 75 },
  };
}

/** Bottom of the planche push-up: body still level, shoulders further forward, elbows bent back by the ribs. */
const PL_BOTTOM: Point = [68, -58];
/** Elbows tucked back beside the ribs, almost straight above the hands. */
const PL_ELBOW = apex(PL_BOTTOM, 60, PL_HAND, 65.9);

// ---------------------------------------------------------------- floor push-ups

const HAND_X = 62;
const HANDS = { near: [HAND_X, 0] as Point, far: [HAND_X - 2, 0] as Point };
const PUSH_BOTTOM = -46;

/** Plank jump-in: crouched on the balls of the feet near the hands, hips high, shoulders still over the hands. */
function jumpCrouch(): Pose {
  return {
    pelvis: [-44, -112],
    hands: HANDS,
    feet: { near: [-72, -18], far: [-74, -18] },
    toes: { near: 70, far: 70 },
  };
}

/** Feet in the air, half way in (or out). */
function jumpAir(): Pose {
  return {
    pelvis: [-82, -122],
    hands: HANDS,
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [-150, -44], far: [-152, -44] },
    toes: { near: 60, far: 60 },
  };
}

/** Side plank on one hand with the other arm reaching to the ceiling (seen from the front or the back). */
function sidePlank(up: "near" | "far", tuck = false): Pose {
  const base = pushUp("top", HAND_X);
  const shoulder = solvePose(base).arms.near.root;
  const support = up === "near" ? "far" : "near";
  if (tuck) {
    // On the way up the straight arm sweeps back past the hip, then on up to the ceiling.
    return {
      ...base,
      hands: { [up]: along(shoulder, 182, 125.5), [support]: HANDS[support] },
      elbows: { [up]: { bend: 1 }, [support]: { bend: 1 } },
    };
  }
  const reach: Point = [round(shoulder[0] - 2), round(shoulder[1] - 125.5)];
  return {
    ...base,
    hands: { [up]: reach, [support]: HANDS[support] },
    elbows: { [up]: { bend: 1 }, [support]: { bend: 1 } },
  };
}

// ---------------------------------------------------------------- Russian push-up

const RU_HAND: Point = [80, 0];
const RU_FOOT: Point = [-205, -18];
/** Tip of the toes: it stays put while the ankles roll back for the forearm position. */
const RU_TOE_TIP = along(RU_FOOT, 62, 20);

const russian = (shoulderY: number | "top"): Pose =>
  pushUp(shoulderY === "top" ? pushUpTop(RU_HAND[0], RU_FOOT) : shoulderY, RU_HAND[0], RU_FOOT);

/** Forearms down on the floor behind the hands, body still straight, toes rolled back. */
function russianForearms(): Pose {
  const toe = 44;
  const foot = along(RU_TOE_TIP, toe + 180, 20);
  const elbow: Point = [RU_HAND[0] - 66, -4];
  const shoulder = apex(foot, BODY, elbow, 60);
  const deg = angle(foot, shoulder);
  return {
    pelvis: along(foot, deg, 173.9),
    chest: along(foot, deg, 253.9),
    hands: { near: [RU_HAND[0], -4], far: [RU_HAND[0], -4] },
    elbows: { near: { at: elbow }, far: { at: elbow } },
    feet: { near: foot, far: foot },
    toes: { near: toe, far: toe },
  };
}

// ---------------------------------------------------------------- three-point push-up

/** Push-up with the `lifted` foot raised just off the floor, leg straight in line with the body. */
function threePoint(lifted: "near" | "far") {
  return (shoulderY: number): Pose => {
    const base = pushUp(shoulderY, HAND_X);
    const pelvis = base.pelvis as Point;
    const up = along(pelvis, angle(pelvis, PLANK_FOOT) + 8, 173.9);
    const down = lifted === "near" ? "far" : "near";
    return { ...base, feet: { [lifted]: up, [down]: PLANK_FOOT }, toes: { [lifted]: 70, [down]: 62 } };
  };
}

// ---------------------------------------------------------------- triceps push-up

/** Hands straight under the shoulders at the top. */
const TRI_HAND_X = round(straightBody(PLANK_FOOT, -LOCKED).shoulder[0]);

function triceps(shoulderY: number): Pose {
  const base = pushUp(shoulderY, TRI_HAND_X);
  return { ...base, hands: { near: [TRI_HAND_X, 0], far: [TRI_HAND_X, 0] } };
}

/** Bottom: chest a fist off the floor, upper arms pinned back along the ribs. */
function tricepsBottom(): Pose {
  const base = triceps(-40);
  const { shoulder } = straightBody(PLANK_FOOT, -40);
  // Upper arm runs back along the body line, the elbow just above the ribs.
  const hand: Point = [TRI_HAND_X, 0];
  const elbow = apex(shoulder, 60, hand, 66);
  return { ...base, elbows: { near: { at: elbow }, far: { at: elbow } } };
}

// ---------------------------------------------------------------- Tyson push-up

/**
 * Rocked back: a low crouch on the toes, feet where the plank's were. Hips pushed
 * back as far as the long arms allow, knees bent ahead of the hips and hovering
 * well off the floor.
 */
function tysonRock(pelvis: Point = [-128, -114]): Pose {
  // The upper of the two thigh/shin meeting points is behind the feet; take the lower, in front of the hips.
  const knee = low(pelvis, 88, PLANK_FOOT, 85.9);
  const base: Pose = {
    pelvis,
    hands: { near: HANDS.near, far: HANDS.near },
    knees: { near: { at: knee }, far: { at: knee } },
    feet: { near: PLANK_FOOT, far: PLANK_FOOT },
    toes: { near: 84, far: 84 },
  };
  // Head in line with the long arms, eyes to the floor ahead of the hands.
  const solved = solvePose(base);
  const spine = angle(solved.chest, solved.neck);
  return { ...base, chest: solved.chest, head: along(solved.neck, spine - 20, 36) };
}

// ---------------------------------------------------------------- V push-up

const V_HANDS = { near: [66, 0] as Point, far: [60, 0] as Point };
const V_FEET = { near: [-78, 0] as Point, far: [-74, 0] as Point };

function vTop(): Pose {
  return { pelvis: [-28, -166], hands: V_HANDS, feet: V_FEET, toes: { near: 0, far: 0 } };
}

function vBottom(): Pose {
  const pelvis: Point = [-12, -152];
  return {
    pelvis,
    // Hips stay high; the elbows bend and the head drops in front of the hands.
    chest: along(pelvis, angle(pelvis, [62, -82]), 80),
    head: [86, -59],
    hands: V_HANDS,
    feet: V_FEET,
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- dips on dip bars

const DIP_Y = -216;
const DIP_HANDS = { near: [46, DIP_Y] as Point, far: [42, DIP_Y] as Point };
const DIP_BARS: Prop = { kind: "parallelBars", y: DIP_Y, x1: -190, x2: 190 };

/** Forward lean dip: torso `lean` degrees forward of vertical, straight legs drifting `legs` degrees behind. */
function leanDip(shoulder: Point, lean: number, legs: number, elbow?: Point): Pose {
  const { pelvis, chest } = torso(shoulder, -90 + lean);
  const foot = along(pelvis, 90 + legs, LEG);
  return {
    pelvis,
    chest,
    hands: DIP_HANDS,
    elbows: elbow ? { near: { at: elbow }, far: { bend: 1 } } : undefined,
    feet: { near: foot, far: foot },
    toes: { near: 90 + legs + 10, far: 90 + legs + 10 },
  };
}

/** Bottom of the forward lean dip: upper arm level, shoulders well ahead of the hands. */
function leanDipBottom(): Pose {
  const elbow = along(DIP_HANDS.near, -106, 65.9);
  const shoulder: Point = [round(elbow[0] + 59.4), round(elbow[1] + 8)];
  return leanDip(shoulder, 46, 36, elbow);
}

const LDIP_HANDS = { near: [-30, DIP_Y] as Point, far: [-30, DIP_Y] as Point };
/**
 * Dip-station rails ending just past the hands, so the level legs reach out
 * into the air instead of lying along a rail; one upright behind.
 */
const LDIP_RAIL: Prop = { kind: "bar", y: DIP_Y, x1: -200, x2: -6, grips: [] };
const LDIP_POST: Prop = { kind: "box", x: -190, y: DIP_Y, w: 1, h: -DIP_Y };

/** L-sit dip: torso `lean` degrees forward of vertical, straight legs level in front. */
function lDip(shoulder: Point, lean: number, elbow?: Point): Pose {
  const { pelvis, chest } = torso(shoulder, -90 + lean);
  const foot = along(pelvis, -2, LEG);
  return {
    pelvis,
    chest,
    hands: LDIP_HANDS,
    elbows: elbow ? { near: { at: elbow }, far: { bend: 1 } } : undefined,
    feet: { near: foot, far: [foot[0] - 1, foot[1]] },
    toes: { near: 8, far: 8 },
  };
}

function lDipTop(): Pose {
  return lDip(along(LDIP_HANDS.near, -88, 125.4), -4);
}

function lDipBottom(): Pose {
  const elbow = along(LDIP_HANDS.near, -108, 65.9);
  const shoulder: Point = [round(elbow[0] + 58.6), round(elbow[1] + 12)];
  return lDip(shoulder, 22, elbow);
}

// ---------------------------------------------------------------- straight bar dip

const SB_Y = -232;
const SB_HAND: Point = [0, SB_Y];
const SB_BAR: Prop = { kind: "bar", y: SB_Y, x1: -6, x2: 6, grips: [0] };

/** Straight bar dip: hands on the bar in front of the hips, legs angled a little forward under it. */
function barDip(shoulder: Point, lean: number, legs: number, elbow?: Point): Pose {
  const { pelvis, chest } = torso(shoulder, -90 + lean);
  const foot = along(pelvis, 90 - legs, LEG);
  return {
    pelvis,
    chest,
    hands: { near: SB_HAND, far: SB_HAND },
    elbows: elbow ? { near: { at: elbow }, far: { at: elbow } } : BENT,
    feet: { near: foot, far: [foot[0] - 2, foot[1]] },
    toes: { near: 90 - legs + 30, far: 90 - legs + 30 },
  };
}

function barDipTop(): Pose {
  return barDip(along(SB_HAND, -96, 125.4), 12, 12);
}

function barDipBottom(): Pose {
  const elbow = along(SB_HAND, -120, 65.9);
  const shoulder: Point = [round(elbow[0] + 58), round(elbow[1] + 15)];
  return barDip(shoulder, 44, 34, elbow);
}

// ---------------------------------------------------------------- Korean dip

const KD_Y = -240;
const KD_HAND: Point = [0, KD_Y];
const KD_BAR: Prop = { kind: "bar", y: KD_Y, x1: -6, x2: 6, grips: [0] };
/** A floor line, so the feet read as off the ground. */
const FLOOR: Prop = { kind: "box", x: -120, y: -1, w: 260, h: 1 };

/** Korean dip: bar behind the hips, arms straight back to it, straight legs angled down in front so the feet stay clear. */
function korean(shoulder: Point, lean: number, elbow?: Point): Pose {
  const { pelvis, chest } = torso(shoulder, -90 + lean);
  const foot = along(pelvis, 52, LEG);
  return {
    pelvis,
    chest,
    hands: { near: KD_HAND, far: KD_HAND },
    elbows: elbow ? { near: { at: elbow }, far: { at: elbow } } : BENT,
    feet: { near: foot, far: foot },
    toes: { near: 30, far: 30 },
  };
}

function koreanTop(): Pose {
  return korean(along(KD_HAND, -78, 125.4), 4);
}

/** Bottom: shoulders sink toward the bar (it rides up the back), elbows point back and up like a bench dip. */
function koreanBottom(): Pose {
  const shoulder: Point = [28, KD_Y - 45];
  return korean(shoulder, 6, apex(shoulder, 60, KD_HAND, 65.9));
}

// ---------------------------------------------------------------- specs

const pushUpRep = (at: (y: number) => Pose, top: number, bottom = PUSH_BOTTOM): Keyframe[] => rep(at, top, bottom, 0.3, 0.2);

export const BATCH_T_SPECS: DoodleSpec[] = [
  {
    id: "hf_34",
    slug: "full-planche",
    title: "Full Planche",
    transition: 0.9,
    frames: [
      { hold: 0.5, pose: plancheLean() },
      { hold: 1.8, pose: planche(PL_TOP, -2) },
    ],
  },
  {
    id: "hf_35",
    slug: "planche-push-up",
    title: "Planche Push-Up",
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: planche(PL_TOP, -2) },
      { hold: 0.3, pose: planche(PL_BOTTOM, -1, { near: { at: PL_ELBOW }, far: { at: PL_ELBOW } }) },
    ],
  },
  {
    id: "wger_1286",
    slug: "plank-jump-in",
    title: "Plank Jump-In",
    transition: 0.25,
    frames: [
      { hold: 0.35, pose: pushUp("top", HAND_X) },
      { hold: 0, pose: jumpAir() },
      { hold: 0.25, pose: jumpCrouch() },
      { hold: 0, pose: jumpAir() },
    ],
  },
  {
    id: "wger_985",
    slug: "push-up-rotation",
    title: "Push-up rotations",
    transition: 0.55,
    frames: [
      ...pushUpRep((y) => pushUp(y, HAND_X), pushUpTop(HAND_X)),
      { hold: 0, pose: sidePlank("near", true) },
      { hold: 0.6, pose: sidePlank("near") },
      { hold: 0, pose: sidePlank("near", true) },
      ...pushUpRep((y) => pushUp(y, HAND_X), pushUpTop(HAND_X)),
      { hold: 0, pose: sidePlank("far", true) },
      { hold: 0.6, pose: sidePlank("far") },
      { hold: 0, pose: sidePlank("far", true) },
    ],
  },
  {
    id: "wger_2530",
    slug: "russian-push-up",
    title: "Russian Push Ups",
    transition: 0.55,
    frames: [
      { hold: 0.3, pose: russian("top") },
      { hold: 0, pose: russian(round((pushUpTop(RU_HAND[0], RU_FOOT) + PUSH_BOTTOM) / 2)) },
      { hold: 0.1, pose: russian(PUSH_BOTTOM) },
      { hold: 0.4, pose: russianForearms() },
      { hold: 0.1, pose: russian(PUSH_BOTTOM) },
      { hold: 0, pose: russian(round((pushUpTop(RU_HAND[0], RU_FOOT) + PUSH_BOTTOM) / 2)) },
    ],
  },
  {
    id: "wger_1209",
    slug: "three-point-push-up",
    title: "Shoulder width three-point push-up",
    transition: 0.5,
    frames: [...pushUpRep(threePoint("near"), pushUpTop(HAND_X)), ...pushUpRep(threePoint("far"), pushUpTop(HAND_X))],
  },
  {
    id: "wger_2684",
    slug: "triceps-push-up",
    title: "Triceps push up",
    transition: 0.55,
    frames: [
      { hold: 0.3, pose: triceps(pushUpTop(TRI_HAND_X)) },
      { hold: 0, pose: triceps(round((pushUpTop(TRI_HAND_X) - 40) / 2)) },
      { hold: 0.25, pose: tricepsBottom() },
      { hold: 0, pose: triceps(round((pushUpTop(TRI_HAND_X) - 40) / 2)) },
    ],
  },
  {
    id: "wger_2679",
    slug: "tyson-push-up",
    title: "Tyson push-ups",
    transition: 0.55,
    frames: [
      { hold: 0.3, pose: pushUp("top", HAND_X) },
      { hold: 0, pose: pushUp(round((pushUpTop(HAND_X) + PUSH_BOTTOM) / 2), HAND_X) },
      { hold: 0.15, pose: pushUp(PUSH_BOTTOM, HAND_X) },
      // On the way back the hips rise first, so the knees stay off the floor.
      { hold: 0, pose: tysonRock([-40, -105]) },
      { hold: 0.3, pose: tysonRock() },
    ],
  },
  {
    id: "wger_1090",
    slug: "v-push-up",
    title: "Vpushup",
    transition: 0.9,
    frames: [
      { hold: 0.5, pose: vTop() },
      { hold: 0.3, pose: vBottom() },
    ],
  },
  {
    id: "hf_26",
    slug: "forward-lean-dip",
    title: "Forward Lean Dip",
    props: [DIP_BARS],
    transition: 1,
    frames: [
      { hold: 0.5, pose: leanDip(along(DIP_HANDS.near, -84, 125.4), 26, 24) },
      { hold: 0.3, pose: leanDipBottom() },
    ],
  },
  {
    id: "hf_27",
    slug: "straight-bar-dip",
    title: "Straight Bar Dip",
    props: [SB_BAR, FLOOR],
    transition: 1,
    frames: [
      { hold: 0.5, pose: barDipTop() },
      { hold: 0.3, pose: barDipBottom() },
    ],
  },
  {
    id: "hf_28",
    slug: "korean-dip",
    title: "Korean Dip",
    props: [KD_BAR, FLOOR],
    transition: 1,
    frames: [
      { hold: 0.5, pose: koreanTop() },
      { hold: 0.3, pose: koreanBottom() },
    ],
  },
  {
    id: "hf_30",
    slug: "l-sit-dip",
    title: "L-Sit Dip",
    props: [LDIP_RAIL, LDIP_POST],
    transition: 1,
    frames: [
      { hold: 0.5, pose: lDipTop() },
      { hold: 0.3, pose: lDipBottom() },
    ],
  },
];
