import { solvePose } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose } from "./rig";
import { LOCKED, PLANK_FOOT, lockedShoulderY, pushUp, pushUpTop, straightBody } from "./specsBatchC";

/**
 * Batch M: push-ups and planks. Floor at y = 0, up is negative, the figure
 * faces +x (a plank has the head at +x).
 *
 * Left out, because their defining motion runs across the body and a
 * fixed-length rig can only show it from the side (where it is invisible) or
 * from the front (where a horizontal body cannot be foreshortened):
 *   hf_6 Archer Push-Up            the shift over one hand is sideways
 *   ntc_lateral_plank_walk         the plank travels sideways
 *   ntc_plank_hip_dips             the hips rotate about the long axis; from the side it reads as sagging
 *
 * Also left out: hf_13 Spiderman Push-Up and ntc_spiderman_plank. The knee
 * travels out to the side, which only a foreshortened thigh could show; from
 * the side the plank version reads as a slow mountain climber, and at the
 * bottom of the push-up the knee either crosses the support arm or lands under
 * the chest (reads as kneeling).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

type Side = "near" | "far";
const other = (side: Side): Side => (side === "near" ? "far" : "near");

/** Eased in-between values from `a` to `b` (exclusive), `count` of them. */
function steps(a: number, b: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => (1 - Math.cos((Math.PI * (i + 1)) / (count + 1))) / 2).map((f) =>
    round(a + (b - a) * f),
  );
}

/** Top → bottom → top through eased steps, so a straight body stays straight. */
function smoothRep(at: (y: number) => Pose, top: number, bottom: number, holdTop: number, holdBottom: number): Keyframe[] {
  const down = steps(top, bottom, 6);
  return [
    { hold: holdTop, pose: at(top) },
    ...down.map((y) => ({ hold: 0, pose: at(y) })),
    { hold: holdBottom, pose: at(bottom) },
    ...[...down].reverse().map((y) => ({ hold: 0, pose: at(y) })),
  ];
}

const HAND_X = 62;

// ---------------------------------------------------------------- push-up with feet elevated

/** Bench under the feet, toes on its top. */
const FE_BENCH = { kind: "box" as const, x: -252, y: -62, w: 84, h: 62 };
const FE_FOOT: Point = [-208, -81];
const FE_HAND_X = 60;
const FE_TOP = pushUpTop(FE_HAND_X, FE_FOOT);
const FE_BOTTOM = -46;

const feetElevated = (shoulderY: number): Pose => pushUp(shoulderY, FE_HAND_X, FE_FOOT);

// ---------------------------------------------------------------- freestanding handstand push-up

const HS_HAND: Point = [52, -1];
const HS_TOP: Point = [HS_HAND[0], round(HS_HAND[1] - LOCKED)];
/** Bottom: shoulders forward of the hands, head just above the floor in front of them. */
const HS_BOTTOM: Point = [HS_HAND[0] + 40, -72];

/**
 * Free handstand push-up, `depth` 0 (arms locked, body stacked) to 1 (bottom).
 * As the shoulders travel forward the straight body tips back a little, so
 * the legs counterbalance over the hands. No wall.
 */
function freeHspu(depth: number): Pose {
  const shoulder: Point = [
    round(HS_TOP[0] + (HS_BOTTOM[0] - HS_TOP[0]) * Math.sqrt(depth)),
    round(HS_TOP[1] + (HS_BOTTOM[1] - HS_TOP[1]) * depth),
  ];
  const dir = -88 - 14 * depth;
  const pelvis = along(shoulder, dir, 98);
  return {
    pelvis,
    chest: along(shoulder, dir, 18),
    head: along(shoulder, dir + 180 - 48 * (1 - depth), 38),
    hands: { near: HS_HAND, far: [HS_HAND[0] - 2, HS_HAND[1]] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: along(pelvis, dir, 174), far: along(pelvis, dir + 1, 174) },
    toes: { near: dir, far: dir },
  };
}

// ---------------------------------------------------------------- plank reach

/** High plank; `reach` lifts that arm straight forward, just above shoulder height. */
function plankReach(reach: Side | null, lift = 1): Pose {
  const base = pushUp("top", HAND_X);
  if (!reach) return base;
  const solved = solvePose(base);
  const shoulder = solved.arms[reach].root;
  // One hand is off the floor: pin the chest where both arms left it.
  const hand = along(shoulder, 12 + 50 * (1 - lift), 125.5);
  return {
    ...base,
    chest: solved.chest,
    hands: { [reach]: hand, [other(reach)]: [reach === "near" ? HAND_X - 2 : HAND_X, 0] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

// ---------------------------------------------------------------- plank with alternating leg lift

/** High plank; `lift` raises that straight leg about 18° from the hip. */
function legLift(lift: Side | null): Pose {
  const base = pushUp("top", HAND_X);
  if (!lift) return base;
  const pelvis = base.pelvis as Point;
  const deg = angle(pelvis, PLANK_FOOT) + 18;
  return {
    ...base,
    feet: { [lift]: along(pelvis, deg, 173.9), [other(lift)]: PLANK_FOOT },
    toes: { [lift]: 80, [other(lift)]: 62 },
  };
}

// ---------------------------------------------------------------- plank-to-elbow extension (up-down)

const UD_FOOT: Point = [-200, -18];
const UD_LOW = straightBody(UD_FOOT, -64);
const UD_ELBOW_X = round(UD_LOW.shoulder[0]);
const UD_TOP_Y = lockedShoulderY(UD_FOOT, [UD_ELBOW_X, 0]);

type Arm = "forearm" | "hand" | "palm";

/** Plank on the forearms or hands; "palm" is a hand placed while the shoulder is still low. */
function upDown(near: Arm, far: Arm): Pose {
  const high = near === "hand" && far === "hand";
  const { pelvis, chest } = high ? straightBody(UD_FOOT, UD_TOP_Y) : UD_LOW;
  const arm = (side: Side, kind: Arm) => {
    const dx = side === "near" ? 0 : -2;
    if (kind === "forearm") {
      return { hand: [UD_ELBOW_X + 66 + dx, -4] as Point, elbow: { at: [UD_ELBOW_X + dx, -4] as Point } };
    }
    return { hand: [UD_ELBOW_X + dx, 0] as Point, elbow: { bend: 1 as const } };
  };
  const n = arm("near", near);
  const f = arm("far", far);
  return {
    pelvis,
    chest,
    hands: { near: n.hand, far: f.hand },
    elbows: { near: n.elbow, far: f.elbow },
    feet: { near: UD_FOOT, far: UD_FOOT },
    toes: { near: 62, far: 62 },
  };
}

// ---------------------------------------------------------------- incline plank with alternate floor touch

/** Bench under the feet; the tapping foot comes down to the floor just in front of it. */
const FT_FOOT: Point = [-212, -73];
/** Toes rest on the front edge, so the floor in front of the bench stays clear for the tap. */
const FT_BENCH = { kind: "box" as const, x: FT_FOOT[0] - 50, y: -54, w: 58, h: 54 };
const FT_TOP = pushUpTop(HAND_X, FT_FOOT);

/** Feet-elevated high plank; `tap` lowers that foot to the floor (`depth` 1) and back. */
function floorTouch(tap: Side | null, depth = 1): Pose {
  const base = pushUp(FT_TOP, HAND_X, FT_FOOT);
  if (!tap) return base;
  // Off the bench forwards first, then down to the floor, so the foot never passes through the bench.
  const target: Point = depth < 1 ? [FT_FOOT[0] + 22, -52] : [FT_FOOT[0] + 25, -18];
  return {
    ...base,
    feet: { [tap]: target, [other(tap)]: FT_FOOT },
    knees: { [tap]: { bend: -1 } },
    toes: { [tap]: 62, [other(tap)]: 62 },
  };
}

// ---------------------------------------------------------------- specs

export const BATCH_M_SPECS: DoodleSpec[] = [
  {
    id: "fedb_push_ups_with_feet_elevated",
    slug: "push-ups-with-feet-elevated",
    title: "Push-Ups With Feet Elevated",
    props: [FE_BENCH],
    transition: 0.1,
    frames: smoothRep(feetElevated, FE_TOP, FE_BOTTOM, 0.4, 0.3),
  },
  {
    id: "hf_22",
    slug: "freestanding-handstand-push-up",
    title: "Freestanding Handstand Push-Up",
    transition: 0.7,
    frames: [
      { hold: 0.5, pose: freeHspu(0) },
      { hold: 0, pose: freeHspu(0.5) },
      { hold: 0.3, pose: freeHspu(1) },
      { hold: 0, pose: freeHspu(0.5) },
    ],
  },
  {
    id: "wger_1766",
    slug: "plank-reach",
    title: "Plank Reach",
    transition: 0.6,
    frames: [
      { hold: 0.3, pose: plankReach(null) },
      { hold: 0.6, pose: plankReach("near") },
      { hold: 0.3, pose: plankReach(null) },
      { hold: 0.6, pose: plankReach("far") },
    ],
  },
  {
    id: "wger_1410",
    slug: "plank-with-alternating-leg-lift",
    title: "Plank with Alternating Leg Lift",
    transition: 0.6,
    frames: [
      { hold: 0.3, pose: legLift(null) },
      { hold: 0.5, pose: legLift("near") },
      { hold: 0.3, pose: legLift(null) },
      { hold: 0.5, pose: legLift("far") },
    ],
  },
  {
    id: "wger_1406",
    slug: "plank-to-elbow-extension",
    title: "Plank-to-Elbow Extension",
    transition: 0.5,
    frames: [
      { hold: 0.4, pose: upDown("forearm", "forearm") },
      { hold: 0.1, pose: upDown("palm", "forearm") },
      { hold: 0.4, pose: upDown("hand", "hand") },
      { hold: 0.1, pose: upDown("forearm", "palm") },
      { hold: 0.4, pose: upDown("forearm", "forearm") },
      { hold: 0.1, pose: upDown("forearm", "palm") },
      { hold: 0.4, pose: upDown("hand", "hand") },
      { hold: 0.1, pose: upDown("palm", "forearm") },
    ],
  },
  {
    id: "wger_312",
    slug: "incline-plank-with-alternate-floor-touch",
    title: "Incline Plank With Alternate Floor Touch",
    props: [FT_BENCH],
    transition: 0.6,
    frames: [
      { hold: 0.3, pose: floorTouch(null) },
      { hold: 0, pose: floorTouch("near", 0.5) },
      { hold: 0.4, pose: floorTouch("near") },
      { hold: 0, pose: floorTouch("near", 0.5) },
      { hold: 0.3, pose: floorTouch(null) },
      { hold: 0, pose: floorTouch("far", 0.5) },
      { hold: 0.4, pose: floorTouch("far") },
      { hold: 0, pose: floorTouch("far", 0.5) },
    ],
  },
];
