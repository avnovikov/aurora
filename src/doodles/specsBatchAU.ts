import { BONES, HIP_SIDE, other, solvePose, zOut } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose, Prop, Side, Sideways } from "./rig";
import { lockedY3, TWO_VIEWS } from "./sideways";
import { LOCKED } from "./specsBatchC";

/**
 * Batch AU (#212): band drills (pull-apart, external rotation, wood chop,
 * terminal knee extension, seated band row), Australian pull-ups, archer
 * inverted row, archer dips and a push-up chest stretch on parallettes.
 * Floor at y = 0, up is negative, the side-view figure faces +x.
 */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const LEG = BONES.thigh + BONES.shin - 0.1;

/** Near shoulder of a solved pose. */
const shoulderOf = (pose: Pose): Point => solvePose(pose).arms.near.root;

// ---------------------------------------------------------------- standing base

const STAND_FEET = { near: [6, 0] as Point, far: [0, 0] as Point };

function standing(extra: Partial<Pose>): Pose {
  return {
    pelvis: [0, -172],
    chest: [0, -252],
    feet: STAND_FEET,
    toes: { near: 0, far: 0 },
    ...extra,
  };
}

// ---------------------------------------------------------------- band pull-apart (two views)

/** Straight-ish arms at shoulder height: hands together in front, then drawn apart out to the sides. */
function pullApart(forward: number, z: number): Keyframe {
  const y = -270;
  return {
    hold: 0.1,
    pose: standing({
      hands: { near: [forward, y], far: [forward, y] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
    }),
    sideways: { hands: { near: -z, far: z } },
  };
}

const PULL_APART: Keyframe[] = [
  { ...pullApart(118, 10), hold: 0.5 },
  { ...pullApart(106, 72), hold: 0 },
  { ...pullApart(40, 135), hold: 0.7 },
  { ...pullApart(106, 72), hold: 0 },
];

// ---------------------------------------------------------------- band external rotation (two views)

const ROT_SHOULDER = shoulderOf(standing({}));
const ROT_ELBOW: Point = [round(ROT_SHOULDER[0] + 4), round(ROT_SHOULDER[1] + 59.87)];

/** Elbows pinned to the ribs, forearms forward; `open` is how far the hands have rotated outward. */
function rotation(open: number, hold: number): Keyframe {
  const forearm = 66;
  const forward = Math.sqrt(forearm * forearm - open * open);
  const hand: Point = [round(ROT_ELBOW[0] + forward), ROT_ELBOW[1]];
  return {
    hold,
    pose: standing({
      hands: { near: hand, far: hand },
      elbows: { near: { at: ROT_ELBOW }, far: { at: ROT_ELBOW } },
    }),
    sideways: { hands: { near: -22 - open, far: 22 + open } },
  };
}

const EXTERNAL_ROTATION: Keyframe[] = [rotation(8, 0.5), rotation(30, 0), rotation(52, 0.9), rotation(30, 0)];

// ---------------------------------------------------------------- low-to-high band chop (two views)

function chop(hand: Point, z: number, hold: number): Keyframe {
  return {
    hold,
    pose: standing({
      pelvis: [0, -166],
      chest: [0, -246],
      hands: { near: hand, far: hand },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      feet: { near: [10, 0], far: [2, 0] },
    }),
    sideways: { hands: { near: z - 6, far: z + 6 } },
  };
}

const CHOP: Keyframe[] = [
  chop([20, -150], -30, 0.5),
  chop([110, -262], 0, 0),
  chop([40, -360], 40, 0.7),
  chop([110, -262], 0, 0),
];

// ---------------------------------------------------------------- terminal knee extension

const TKE_FOOT: Point = [62, -8];

function terminalKnee(pelvis: Point, hold: number): Keyframe {
  return {
    hold,
    pose: {
      pelvis,
      chest: [pelvis[0], pelvis[1] - 80],
      hands: { near: [pelvis[0] + 26, pelvis[1] - 8], far: [pelvis[0] + 20, pelvis[1] - 8] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      feet: { near: TKE_FOOT, far: [-62, -20] },
      toes: { near: 0, far: 55 },
    },
  };
}

// ---------------------------------------------------------------- seated band row

const ROW_ANKLE: Point = [171, -14];

function seatedRow(hand: Point, chest: Point, hold: number): Keyframe {
  return {
    hold,
    pose: {
      pelvis: [0, -12],
      chest,
      hands: { near: hand, far: [hand[0] - 2, hand[1]] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      feet: { near: ROW_ANKLE, far: [ROW_ANKLE[0] - 2, ROW_ANKLE[1]] },
      toes: { near: -80, far: -80 },
    },
  };
}

// ---------------------------------------------------------------- Australian pull-ups

/** Lowest shoulder height (hand above) at which `shoulderAt` reaches `hand` with a locked arm. */
function lockedBelow(shoulderAt: (y: number) => Point, hand: Point, reach = LOCKED - 2): number {
  let lo = hand[1] + LOCKED;
  let hi = hand[1] + 1;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const s = shoulderAt(mid);
    if (Math.hypot(s[0] - hand[0], s[1] - hand[1]) > reach) lo = mid;
    else hi = mid;
  }
  return round((lo + hi) / 2);
}

/** Point on the circle of `radius` round `pivot` at height `y`, on the head side (-x). */
function onCircle(pivot: Point, radius: number, y: number): Point {
  return [pivot[0] - Math.sqrt(Math.max(0, radius * radius - (y - pivot[1]) ** 2)), y];
}

/** Bent-knee version: knees fixed 86 above the flat feet, the body one line from the knees to the head. */
const BK_KNEE: Point = [190, -94];
const BK_RADIUS = BONES.thigh + 98;
const bkShoulder = (y: number): Point => onCircle(BK_KNEE, BK_RADIUS, y);
/** Body angle above the floor at the top (chest on the bar): steep enough that the long-arm bottom is still near 40°. */
const BK_TOP_DEG = 72;
const BK_TOP = round(BK_KNEE[1] - BK_RADIUS * Math.sin((BK_TOP_DEG * Math.PI) / 180));
/**
 * The bar sits on the sternum at the top: a little down the body from the shoulder and out
 * on the chest side, so the hands are just ahead of the chest and the elbows fold down
 * behind the torso toward the floor (like the Australian pull-up hold).
 */
const BK_HAND: Point = (() => {
  const s = bkShoulder(BK_TOP);
  const r = (BK_TOP_DEG * Math.PI) / 180;
  const down: Point = [Math.cos(r), Math.sin(r)];
  const front: Point = [Math.sin(r), -Math.cos(r)];
  return [round(s[0] + down[0] * 18 + front[0] * 20), round(s[1] + down[1] * 18 + front[1] * 20)];
})();
const BK_BAR_Y = BK_HAND[1];
const BK_BOTTOM = lockedBelow(bkShoulder, BK_HAND);

function bentKneeRow(shoulderY: number): Pose {
  const shoulder = bkShoulder(shoulderY);
  const u: Point = [(shoulder[0] - BK_KNEE[0]) / BK_RADIUS, (shoulder[1] - BK_KNEE[1]) / BK_RADIUS];
  const pelvis: Point = [round(BK_KNEE[0] + u[0] * BONES.thigh), round(BK_KNEE[1] + u[1] * BONES.thigh)];
  const chest: Point = [round(BK_KNEE[0] + u[0] * (BONES.thigh + 80)), round(BK_KNEE[1] + u[1] * (BONES.thigh + 80))];
  const ankle: Point = [BK_KNEE[0], BK_KNEE[1] + BONES.shin];
  return {
    pelvis,
    chest,
    hands: { near: BK_HAND, far: [BK_HAND[0] + 1, BK_HAND[1]] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: BK_KNEE }, far: { at: BK_KNEE } },
    feet: { near: ankle, far: ankle },
    toes: { near: 0, far: 0 },
  };
}

/** Feet-elevated version: heels on a box level with the bar, a straight body from the heels to the head. */
const FE_BAR_Y = -176;
const FE_ANKLE: Point = [210, FE_BAR_Y - 8];
const FE_BODY = LEG + 98;
const feShoulder = (y: number): Point => onCircle(FE_ANKLE, FE_BODY, y);
const FE_TOP = FE_BAR_Y + 22;
const FE_HAND: Point = [round(feShoulder(FE_TOP)[0] + 20), FE_BAR_Y];
const FE_BOTTOM = lockedBelow(feShoulder, FE_HAND);

function feetElevatedRow(shoulderY: number): Pose {
  const shoulder = feShoulder(shoulderY);
  const u: Point = [(shoulder[0] - FE_ANKLE[0]) / FE_BODY, (shoulder[1] - FE_ANKLE[1]) / FE_BODY];
  return {
    pelvis: [round(FE_ANKLE[0] + u[0] * LEG), round(FE_ANKLE[1] + u[1] * LEG)],
    chest: [round(FE_ANKLE[0] + u[0] * (LEG + 80)), round(FE_ANKLE[1] + u[1] * (LEG + 80))],
    hands: { near: FE_HAND, far: [FE_HAND[0] + 1, FE_HAND[1]] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: FE_ANKLE, far: [FE_ANKLE[0] - 2, FE_ANKLE[1]] },
    toes: { near: -110, far: -110 },
  };
}

function twoStepRep(at: (y: number) => Pose, top: number, bottom: number, holdTop: number, holdBottom: number): Keyframe[] {
  const mid = at(round((top + bottom) / 2));
  return [
    { hold: holdBottom, pose: at(bottom) },
    { hold: 0, pose: mid },
    { hold: holdTop, pose: at(top) },
    { hold: 0, pose: mid },
  ];
}

// ---------------------------------------------------------------- archer inverted row (two views)

const AR_BAR_Y = -200;
const AR_FOOT: Point = [170, -8];
const AR_BODY = LEG + 98;
const arShoulder = (y: number): Point => onCircle(AR_FOOT, AR_BODY, y);
const AR_HAND_X = round(arShoulder(-185)[0] + 25);
/** Wide grip, and how far the chest shifts to the working (near) hand at the top. */
const AR_HAND_Z = 85;
const AR_SHIFT = -45;
const AR_FOOT_Z = 12;
const AR_ELBOW_OUT = 30;

/** Planted straight legs: when the hips shift sideways each foot slides in so the leg keeps its 3D length. */
function archFoot(shift: number, side: Side): Point {
  const hipZ = shift + zOut(side) * HIP_SIDE;
  const across = Math.abs(hipZ - zOut(side) * AR_FOOT_Z);
  const square = Math.abs(HIP_SIDE - AR_FOOT_Z);
  const closer = Math.sqrt(LEG * LEG - square * square) - Math.sqrt(LEG * LEG - across * across);
  return [round(AR_FOOT[0] - closer - 1.5), AR_FOOT[1]];
}

function archerRowPose(y: number, shift: number): Pose {
  const shoulder = arShoulder(y);
  const u: Point = [(shoulder[0] - AR_FOOT[0]) / AR_BODY, (shoulder[1] - AR_FOOT[1]) / AR_BODY];
  return {
    pelvis: [round(AR_FOOT[0] + u[0] * LEG), round(AR_FOOT[1] + u[1] * LEG)],
    chest: [round(AR_FOOT[0] + u[0] * (LEG + 80)), round(AR_FOOT[1] + u[1] * (LEG + 80))],
    hands: { near: [AR_HAND_X, AR_BAR_Y], far: [AR_HAND_X, AR_BAR_Y] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: archFoot(shift, "near"), far: archFoot(shift, "far") },
    toes: { near: -110, far: -110 },
  };
}

const archerRowSideways = (shift: number, bentNear: boolean): Sideways => ({
  pelvis: shift,
  hands: { near: -AR_HAND_Z, far: AR_HAND_Z },
  feet: { near: -AR_FOOT_Z, far: AR_FOOT_Z },
  ...(bentNear ? { elbows: { near: { out: AR_ELBOW_OUT } } } : {}),
});

/**
 * Shoulder height (below the bar) at which each arm in `sides` just reaches its
 * wide hand in 3D with the elbow locked; the arm that is further out decides.
 */
function lockedRowY(shift: number, sides: Side[]): number {
  let lo = AR_BAR_Y + 1;
  let hi = AR_BAR_Y + LOCKED;
  const over = (y: number): boolean => {
    const s = arShoulder(y);
    return sides.some((side) => {
      const dz = AR_HAND_Z * zOut(side) - (shift + zOut(side) * 22);
      return Math.hypot(s[0] - AR_HAND_X, s[1] - AR_BAR_Y, dz) > LOCKED;
    });
  };
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (over(mid)) hi = mid;
    else lo = mid;
  }
  return round((lo + hi) / 2);
}

function archerRow(): Keyframe[] {
  const hang = lockedRowY(0, ["near", "far"]);
  const top = lockedRowY(AR_SHIFT, ["far"]);
  const mid = round((hang + top) / 2);
  return [
    { hold: 0.4, pose: archerRowPose(hang, 0), sideways: archerRowSideways(0, false) },
    { hold: 0, pose: archerRowPose(mid, AR_SHIFT / 2), sideways: archerRowSideways(AR_SHIFT / 2, true) },
    { hold: 0.5, pose: archerRowPose(top, AR_SHIFT), sideways: archerRowSideways(AR_SHIFT, true) },
    { hold: 0, pose: archerRowPose(mid, AR_SHIFT / 2), sideways: archerRowSideways(AR_SHIFT / 2, true) },
  ];
}

// ---------------------------------------------------------------- archer dip on a straight bar (two views)

const SD_Y = -256;
const SD_HAND_X = 0;
const SD_HAND_Z = 95;
const SD_SHIFT = -45;
const SD_ELBOW_OUT = 30;

/** Torso leaning forward as the dip deepens; legs hang under the hips, angled a little forward. */
const barDepth = (y: number): number => Math.min(1, Math.max(0, (SD_Y - 60 - y) / 60));
const barShoulder = (y: number): Point => [round(SD_HAND_X - 13 + 30 * barDepth(y)), y];

function barDipPose(y: number): Pose {
  const depth = barDepth(y);
  const shoulder = barShoulder(y);
  const lean = 12 + 30 * depth;
  const legs = 12 + 22 * depth;
  const pelvis = along(shoulder, 90 + lean, 98);
  const chest = along(pelvis, -90 + lean, 80);
  const foot = along(pelvis, 90 - legs, LEG);
  return {
    pelvis,
    chest,
    hands: { near: [SD_HAND_X, SD_Y], far: [SD_HAND_X, SD_Y] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: foot, far: [foot[0] - 2, foot[1]] },
    toes: { near: 90 - legs + 30, far: 90 - legs + 30 },
  };
}

const barDipSideways = (shift: number, bentNear: boolean): Sideways => ({
  pelvis: shift,
  hands: { near: -SD_HAND_Z, far: SD_HAND_Z },
  ...(bentNear ? { elbows: { near: { out: SD_ELBOW_OUT } } } : {}),
});

/** Shoulder height above the bar at which each arm in `sides` reaches its wide hand with the elbow locked. */
function lockedBarDipY(shift: number, sides: Side[]): number {
  let lo = SD_Y - LOCKED;
  let hi = SD_Y - 1;
  const over = (y: number): boolean => {
    const shoulderX = barShoulder(y)[0];
    return sides.some((side) => {
      const dz = SD_HAND_Z * zOut(side) - (shift + zOut(side) * 22);
      return Math.hypot(shoulderX - SD_HAND_X, y - SD_Y, dz) > LOCKED;
    });
  };
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (over(mid)) lo = mid;
    else hi = mid;
  }
  return round((lo + hi) / 2);
}

function archerBarDip(): Keyframe[] {
  const top = lockedBarDipY(0, ["near", "far"]);
  const bottom = lockedBarDipY(SD_SHIFT, ["far"]);
  const mid = round((top + bottom) / 2);
  return [
    { hold: 0.4, pose: barDipPose(top), sideways: barDipSideways(0, false) },
    { hold: 0, pose: barDipPose(mid), sideways: barDipSideways(SD_SHIFT / 2, true) },
    { hold: 0.5, pose: barDipPose(bottom), sideways: barDipSideways(SD_SHIFT, true) },
    { hold: 0, pose: barDipPose(mid), sideways: barDipSideways(SD_SHIFT / 2, true) },
  ];
}

// ---------------------------------------------------------------- archer dip on parallel bars (two views)

const AD_Y = -216;
const AD_HAND_X = 6;
/** The rails: each hand on its own rail, in the front panel. */
const AD_RAIL = 34;
/** How far the chest shifts towards the working rail at the bottom. */
const AD_SHIFT = 22;
const AD_PARALLEL_BARS: Prop = { kind: "parallelBars", y: AD_Y, x1: -190, x2: 190, frontHalf: AD_RAIL };

/** Shoulder height of the dip at `depth` (0 top, 1 bottom) and the lean that goes with it. */
const adDepthY = (top: number, depth: number): number => round(top + (AD_BOTTOM - top) * depth);
const AD_BOTTOM = AD_Y - 74;

/** Dip: torso leaning forward as the dip deepens, legs hanging under the hips, angled a little forward. */
function archerDipPose(shoulderY: number, depth: number, work: Side): Pose {
  const shoulder: Point = [round(AD_HAND_X - 12 + 22 * depth), shoulderY];
  const lean = 8 + 30 * depth;
  const pelvis = along(shoulder, 90 + lean, 98);
  const chest = along(pelvis, -90 + lean, 80);
  const legs = 8 + 22 * depth;
  const foot = along(pelvis, 90 - legs, LEG);
  return {
    pelvis,
    chest,
    hands: { near: [AD_HAND_X, AD_Y], far: [AD_HAND_X, AD_Y] },
    elbows: { [work]: { bend: 1 }, [other(work)]: { bend: 1 } } as Pose["elbows"],
    feet: { near: foot, far: [round(foot[0] - 2), foot[1]] },
    toes: { near: 90 - legs + 30, far: 90 - legs + 30 },
  };
}

function archerDipSideways(depth: number, work: Side): Sideways {
  const shift = zOut(work) * AD_SHIFT * depth;
  return {
    pelvis: round(shift * 0.35),
    chest: round(shift),
    pivot: "pelvis",
    hands: { near: -AD_RAIL, far: AD_RAIL },
  };
}

function archerDip(): Keyframe[] {
  const topY = lockedY3((y) => archerDipPose(y, 0, "near"), archerDipSideways(0, "near"), ["near", "far"], AD_Y - 150, AD_Y - 20);
  const frames: Keyframe[] = [];
  for (const work of ["near", "far"] as Side[]) {
    for (const [hold, depth] of [[work === "near" ? 0.4 : 0.2, 0], [0, 0.5], [0.5, 1], [0, 0.5]] as const) {
      frames.push({ hold, pose: archerDipPose(adDepthY(topY, depth), depth, work), sideways: archerDipSideways(depth, work) });
    }
  }
  return frames;
}

// ---------------------------------------------------------------- push-up chest stretch on parallettes

const PT_Y = -36;
const PT_X = 56;
const PT_FOOT: Point = [-190, -18];
const PT_TOP = (() => {
  // Arms locked on the handles, the straight body pivoting on the toes.
  let lo = PT_Y - LOCKED;
  let hi = PT_Y - 1;
  const reach = LOCKED - 2;
  const body = LEG + 98;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const sx = PT_FOOT[0] + Math.sqrt(body * body - (mid - PT_FOOT[1]) ** 2);
    if (Math.hypot(sx - PT_X, mid - PT_Y) > reach) lo = mid;
    else hi = mid;
  }
  return round((lo + hi) / 2);
})();
const PT_BOTTOM = -30;

function chestStretch(y: number): Pose {
  const body = LEG + 98;
  const sx = PT_FOOT[0] + Math.sqrt(body * body - (y - PT_FOOT[1]) ** 2);
  const u: Point = [(sx - PT_FOOT[0]) / body, (y - PT_FOOT[1]) / body];
  return {
    pelvis: [round(PT_FOOT[0] + u[0] * LEG), round(PT_FOOT[1] + u[1] * LEG)],
    chest: [round(PT_FOOT[0] + u[0] * (LEG + 80)), round(PT_FOOT[1] + u[1] * (LEG + 80))],
    hands: { near: [PT_X + 2, PT_Y], far: [PT_X - 2, PT_Y] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: PT_FOOT, far: PT_FOOT },
    toes: { near: 62, far: 62 },
  };
}

// ---------------------------------------------------------------- specs

export const BATCH_AU_SPECS: DoodleSpec[] = [
  {
    id: "wger_1380",
    slug: "band-pull-apart",
    title: "Band Pull-Apart",
    views: TWO_VIEWS,
    handBand: true,
    transition: 0.7,
    frames: PULL_APART,
  },
  {
    id: "wger_1826",
    slug: "band-external-rotation",
    title: "Band External Rotation",
    views: TWO_VIEWS,
    handBand: true,
    transition: 0.7,
    frames: EXTERNAL_ROTATION,
  },
  {
    id: "wger_1433",
    slug: "band-low-to-high-chop",
    title: "Band Low-to-High Chop",
    views: TWO_VIEWS,
    straps: { anchor: [30, -40], end: "band", sides: ["near"] },
    transition: 0.8,
    frames: CHOP,
  },
  {
    id: "wger_2494",
    slug: "terminal-knee-extension",
    title: "Terminal Knee Extension",
    straps: { anchor: [190, -84], end: "band", to: "knees", sides: ["near"] },
    transition: 0.9,
    frames: [terminalKnee([6, -152], 0.5), terminalKnee([-38, -148], 1.2)],
  },
  {
    id: "wger_2635",
    slug: "seated-band-row",
    title: "Seated Band Row",
    straps: { anchor: [176, -12], end: "band" },
    transition: 0.9,
    frames: [seatedRow([124, -98], [0, -92], 0.5), seatedRow([34, -62], [-6, -92], 0.5)],
  },
  {
    id: "ntc_bent_knee_australian_pull_up",
    slug: "bent-knee-australian-pull-up",
    title: "Bent-Knee Australian Pull-Up",
    props: [{ kind: "bar", y: BK_BAR_Y, x1: BK_HAND[0] - 24, x2: BK_HAND[0] + 60, grips: [BK_HAND[0] - 1] }],
    transition: 0.6,
    frames: twoStepRep(bentKneeRow, BK_TOP, BK_BOTTOM, 0.4, 0.4),
  },
  {
    id: "ntc_feet_elevated_australian_pull_up",
    slug: "feet-elevated-australian-pull-up",
    title: "Feet-Elevated Australian Pull-Up",
    props: [
      { kind: "bar", y: FE_BAR_Y, x1: FE_HAND[0] - 24, x2: FE_HAND[0] + 60, grips: [FE_HAND[0] - 1] },
      { kind: "box", x: FE_ANKLE[0] - 8, y: FE_BAR_Y, w: 70, h: -FE_BAR_Y },
    ],
    transition: 0.6,
    frames: twoStepRep(feetElevatedRow, FE_TOP, FE_BOTTOM, 0.4, 0.4),
  },
  {
    id: "ntc_archer_inverted_row",
    slug: "archer-inverted-row",
    title: "Archer Inverted Row",
    views: TWO_VIEWS,
    props: [{ kind: "bar", y: AR_BAR_Y, x1: AR_HAND_X - 24, x2: AR_HAND_X + 60, grips: [AR_HAND_X - 1] }],
    transition: 0.6,
    frames: archerRow(),
  },
  {
    id: "ntc_archer_straight_bar_dip",
    slug: "archer-straight-bar-dip",
    title: "Archer Straight-Bar Dip",
    views: TWO_VIEWS,
    props: [{ kind: "bar", y: SD_Y, x1: -6, x2: 6, grips: [SD_HAND_X] }],
    transition: 0.6,
    frames: archerBarDip(),
  },
  {
    id: "ntc_archer_dip",
    slug: "archer-dip",
    title: "Archer Dip",
    views: TWO_VIEWS,
    props: [AD_PARALLEL_BARS],
    transition: 0.7,
    frames: archerDip(),
  },
  {
    id: "wger_1919",
    slug: "push-up-chest-stretch",
    title: "Push-Up Chest Stretch",
    props: [{ kind: "parallettes", y: PT_Y, xs: [PT_X] }],
    transition: 1,
    frames: [
      { hold: 0.4, pose: chestStretch(PT_TOP) },
      { hold: 0, pose: chestStretch(round((PT_TOP + PT_BOTTOM) / 2)) },
      { hold: 1.6, pose: chestStretch(PT_BOTTOM) },
      { hold: 0, pose: chestStretch(round((PT_TOP + PT_BOTTOM) / 2)) },
    ],
  },
];
