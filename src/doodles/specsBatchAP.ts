import { onStrap, solveJoint } from "./rig";
import type { AuthoredPose, DoodleSpec, Keyframe, Point, Pose, Sideways } from "./rig";
import { TWO_VIEWS } from "./sideways";
import { CAT_SHOULDER, tuckedAround } from "./specsBatchJ";
import { LOCKED, lockedShoulderY, rep, straightBody } from "./specsBatchC";

/**
 * Batch AP (#212): gymnastic-ring moves. Rings hang from `straps` (a fixed
 * anchor), hands are pinned with `onStrap` so the straps keep their length.
 * Floor at y = 0, up is negative, the side-view figure faces +x.
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}
const round = (value: number): number => Math.round(value * 10) / 10;
const roundPoint = (p: Point): Point => [round(p[0]), round(p[1])];

// ---------------------------------------------------------------- muscle-ups (hang to support, body rising past fixed rings)

const MU_ANCHOR: Point = [0, -660];
const MU_STRAP = 235;
/** Rings hang here: a full hang puts the toes just off the floor. */
const MU_HAND: Point = onStrap(MU_ANCHOR, MU_STRAP, 0);

/**
 * Elbow for a shoulder and hand: an upper arm (60) from the shoulder and a forearm
 * (66, with the hand) from the hand. Of the two places it can sit, the one further
 * back (-x) when `behind`, else further forward. A reach at or past the arm's length gives the straight arm.
 */
function elbowFor(shoulder: Point, hand: Point, behind = true): Point {
  const upper = 60;
  const lower = 66;
  const d = Math.hypot(hand[0] - shoulder[0], hand[1] - shoulder[1]);
  const ux = (hand[0] - shoulder[0]) / d;
  const uy = (hand[1] - shoulder[1]) / d;
  const a = Math.min(upper, Math.max(0, (d * d + upper * upper - lower * lower) / (2 * d)));
  const h = d >= upper + lower ? 0 : Math.sqrt(Math.max(0, upper * upper - a * a));
  const one: Point = [shoulder[0] + ux * a - uy * h, shoulder[1] + uy * a + ux * h];
  const two: Point = [shoulder[0] + ux * a + uy * h, shoulder[1] + uy * a - ux * h];
  // The elbow hinge folds one way only: the same turn from upper arm to forearm as a dip's bottom.
  const turn = (e: Point): number => (e[0] - shoulder[0]) * (hand[1] - e[1]) - (e[1] - shoulder[1]) * (hand[0] - e[0]);
  const folds = turn(one) < turn(two) ? one : two;
  const other = folds === one ? two : one;
  const pick = behind ? folds : other;
  return [round(pick[0]), round(pick[1])];
}

interface Rise {
  /** Shoulder position. */
  shoulder: Point;
  /** Torso lean from vertical, degrees (+ forward: the hips trail behind the shoulder). */
  lean: number;
  /** Straight legs hang this many degrees from the hips (90 straight down, > 90 trailing behind). */
  legs: number;
  /** Elbows: pin the near elbow, or let the solver fold it. */
  elbow?: Point;
  /** Ring swing (degrees from straight down, + forward). */
  swing?: number;
  /** Head tipped forward of the spine line, degrees. */
  tilt?: number;
}

function rise({ shoulder, lean, legs, elbow, swing = 0, tilt = 20 }: Rise): Pose {
  const hand = onStrap(MU_ANCHOR, MU_STRAP, swing);
  const pelvis = along(shoulder, 90 + lean, 98);
  const chest = along(pelvis, -90 + lean, 80);
  const head = along(along(pelvis, -90 + lean, 100), -90 + lean + tilt, 36);
  const foot = along(pelvis, legs, 173.4);
  const other = along(pelvis, legs - 1.5, 173.2);
  const elbows: Pose["elbows"] = {
    near: { at: elbow ?? elbowFor(shoulder, hand) },
    far: { at: elbowFor(shoulder, [hand[0] - 2, hand[1]]) },
  };
  return {
    pelvis,
    chest,
    head,
    hands: { near: hand, far: [hand[0] - 2, hand[1]] },
    elbows,
    feet: { near: foot, far: other },
    toes: { near: legs - 10, far: legs - 10 },
  };
}

/** Shoulder a locked arm from the ring, `deg` from straight below it (negative: behind). */
const hangShoulder = (deg: number, swing = 0): Point => along(onStrap(MU_ANCHOR, MU_STRAP, swing), 90 + deg, LOCKED);

const MU_STRAPS = { anchor: MU_ANCHOR, end: "ring" } as const;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerpPoint = (a: Point, b: Point, t: number): Point => [round(lerp(a[0], b[0], t)), round(lerp(a[1], b[1], t))];

/** `t` of the way from one rise to another (shoulder, lean, legs, tilt, swing). */
function between(a: Rise, b: Rise, t: number): Rise {
  return {
    shoulder: lerpPoint(a.shoulder, b.shoulder, t),
    lean: lerp(a.lean, b.lean, t),
    legs: lerp(a.legs, b.legs, t),
    tilt: lerp(a.tilt ?? 20, b.tilt ?? 20, t),
    swing: lerp(a.swing ?? 0, b.swing ?? 0, t),
  };
}

const HANG: Rise = { shoulder: hangShoulder(22), lean: 0, legs: 91, tilt: -14 };
/** Pulling: the body leans back, the head goes back so the rings pass in front of the face. */
const MID: Rise = { shoulder: [-52, -395], lean: -10, legs: 84, tilt: -20 };
const PULL: Rise = { shoulder: [-40, -470], lean: 6, legs: 92, tilt: -10 };
const TRANSITION_ELBOW = along(MU_HAND, -106, 65.9);
const TRANSITION: Rise = { shoulder: along(TRANSITION_ELBOW, 10, 59.6), lean: 34, legs: 98, elbow: TRANSITION_ELBOW, tilt: 20 };
const SUPPORT: Rise = { shoulder: hangShoulder(-181), lean: 8, legs: 94, tilt: 20 };

const at = (a: Rise, b: Rise, t: number, hold = 0): Keyframe => ({ hold, pose: rise(between(a, b, t)) });
const key = (r: Rise, hold = 0): Keyframe => ({ hold, pose: rise(r) });

/** Keyframes from `a` to `b` (exclusive of `a`), `steps` of them, the last landing on `b`. */
function run(a: Rise, b: Rise, steps: number, holdEnd = 0): Keyframe[] {
  return Array.from({ length: steps }, (_, i) => at(a, b, (i + 1) / steps, i === steps - 1 ? holdEnd : 0));
}

/** Strict ring muscle-up: hang, pull to the chest, roll over, press out, and back down the same way. */
const strictMuscleUp = (): Keyframe[] => [
  key(HANG, 0.4),
  ...run(HANG, MID, 2, 0.05),
  ...run(MID, PULL, 2, 0.1),
  ...run(PULL, TRANSITION, 3, 0.1),
  ...run(TRANSITION, SUPPORT, 3, 0.6),
  ...run(SUPPORT, TRANSITION, 3, 0.1),
  ...run(TRANSITION, PULL, 3, 0.1),
  ...run(PULL, MID, 2, 0.05),
  ...run(MID, HANG, 1),
];

/** Kipping muscle-up: legs swing back, then drive forward and up so the hips carry the pull. */
const KIP_BACK: Rise = { shoulder: hangShoulder(30), lean: 14, legs: 118, tilt: -14, swing: -4 };
const KIP_DRIVE: Rise = { shoulder: [-50, -340], lean: -22, legs: 40, tilt: -18 };
const KIP_PULL: Rise = { shoulder: [-52, -420], lean: -6, legs: 66, tilt: -20 };

const kippingMuscleUp = (): Keyframe[] => [
  key(HANG, 0.3),
  ...run(HANG, KIP_BACK, 2, 0.05),
  ...run(KIP_BACK, KIP_DRIVE, 3, 0),
  ...run(KIP_DRIVE, KIP_PULL, 2, 0),
  ...run(KIP_PULL, PULL, 2, 0.05),
  ...run(PULL, TRANSITION, 3, 0.05),
  ...run(TRANSITION, SUPPORT, 3, 0.6),
  ...run(SUPPORT, TRANSITION, 3, 0.05),
  ...run(TRANSITION, PULL, 3, 0.05),
  ...run(PULL, MID, 2, 0.05),
  ...run(MID, HANG, 1),
];

/** Ring dip: locked support, rings by the ribs, down until the upper arms are about level, and back up. */
const DIP_SUPPORT: Rise = { shoulder: hangShoulder(-181), lean: 4, legs: 92, tilt: 15 };
const DIP_BOTTOM: Rise = { shoulder: [14, -478], lean: 18, legs: 98, tilt: 12 };

const ringDip = (): Keyframe[] => [
  key(DIP_SUPPORT, 0.5),
  ...run(DIP_SUPPORT, DIP_BOTTOM, 3, 0.3),
  ...run(DIP_BOTTOM, DIP_SUPPORT, 3, 0),
];

// ---------------------------------------------------------------- two views: support and the crosses

/** Locked arm, shoulder to fingertip, a little short so the pins always reach. */
const ARM = 125.2;
const SHOULDER_Z = 22;
const FOOT_Z = 10;

/** Arm reach split into height: the shoulder is this far above a hand `dz` out to the side (and `dx` ahead or behind). */
const armRise = (dz: number, dx = 0, reach = ARM): number => Math.sqrt(Math.max(0, reach * reach - dz * dz - dx * dx));

const wideHands = (z: number): Sideways => ({ hands: { near: -z, far: z }, feet: { near: -FOOT_Z, far: FOOT_Z } });

/** A vertical body hanging from the shoulder `shoulderY` at x = 0, hands at `hand` (x = 0), `z` out. */
function hangingBody(shoulderY: number, handY: number, z: number): Keyframe {
  const pelvis: Point = [0, round(shoulderY + 98)];
  const pose: AuthoredPose = {
    pelvis,
    chest: [0, round(shoulderY + 18)],
    hands: { near: [0, round(handY)], far: [0, round(handY)] },
    feet: { near: [0, round(pelvis[1] + 173.4)], far: [0, round(pelvis[1] + 173.4)] },
    toes: { near: 85, far: 85 },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
  return { hold: 0, pose, sideways: wideHands(z) };
}

// Ring support hold: rings by the hips, then turned out (the hands move apart).
const SUP_ANCHOR: Point = [0, -560];
const SUP_STRAP = 300;
const supportFrame = (z: number, hold: number): Keyframe => {
  const handY = SUP_ANCHOR[1] + Math.sqrt(SUP_STRAP ** 2 - (z - 24) ** 2);
  return { ...hangingBody(handY - armRise(z - SHOULDER_Z), handY, z), hold };
};

// Iron cross: from support (arms down, rings by the hips) the arms open out level with the shoulders.
const CROSS_ANCHOR: Point = [0, -474];
const CROSS_STRAP = 220;
const CROSS_Z = 146;
const crossFrame = (z: number, hold: number): Keyframe => {
  const handY = CROSS_ANCHOR[1] + Math.sqrt(CROSS_STRAP ** 2 - (z - 26) ** 2);
  return { ...hangingBody(handY - armRise(z - SHOULDER_Z), handY, z), hold };
};

/**
 * A body lying level (`dir` +1 head ahead at +x, face down; -1 head behind, face up), pelvis at x = 0 and
 * height `bodyY`, arms out to the sides: hands at x = `handX`, `handY`, `z` out each side.
 */
function levelBody(dir: 1 | -1, bodyY: number, handX: number, handY: number, z: number): Keyframe {
  const pelvis: Point = [0, round(bodyY)];
  const foot: Point = [round(-dir * 173.7), round(bodyY)];
  const pose: AuthoredPose = {
    pelvis,
    chest: [dir * 80, round(bodyY)],
    hands: { near: [handX, round(handY)], far: [handX, round(handY)] },
    feet: { near: foot, far: foot },
    toes: { near: dir === 1 ? 180 : 0, far: dir === 1 ? 180 : 0 },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
  return { hold: 0, pose, sideways: wideHands(z) };
}

// Maltese cross: planche on the rings, then the arms open out wide and the body lowers to the hands.
const MAL_HAND_X = 20;
const MAL_ANCHOR: Point = [MAL_HAND_X, -420];
const MAL_STRAP = 220;
const MAL_Z = 118;
const malteseFrame = (z: number, hold: number): Keyframe => {
  const handY = MAL_ANCHOR[1] + Math.sqrt(MAL_STRAP ** 2 - (z - 26) ** 2);
  const bodyY = handY - armRise(z - SHOULDER_Z, 98 - MAL_HAND_X);
  return { ...levelBody(1, bodyY, MAL_HAND_X, handY, z), hold };
};

// Victorian cross: face up under the rings, arms straight up, then wide and level.
const VIC_HAND_X = -20;
const VIC_STRAP = 200;
const VIC_BODY_Y = -100;
const VIC_ANCHOR: Point = [VIC_HAND_X, VIC_BODY_Y - armRise(4, 98 + VIC_HAND_X) - VIC_STRAP];
const victorianFrame = (z: number, hold: number): Keyframe => {
  const handY = VIC_ANCHOR[1] + Math.sqrt(VIC_STRAP ** 2 - (z - 26) ** 2);
  const bodyY = handY + armRise(z - SHOULDER_Z, 98 + VIC_HAND_X);
  return { ...levelBody(-1, bodyY, VIC_HAND_X, handY, z), hold };
};

// ---------------------------------------------------------------- ring fly (incline plank, two views)

const FLY_FOOT: Point = [-170, -19];
const FLY_ANCHOR: Point = [-6, -330];
const FLY_STRAP = 225;
const FLY_REACH = 120;

/** Shoulder height at which the straight-bodied figure on `FLY_FOOT` has its hand a `reach` away in 3D (hand `dz` beside the shoulder). */
function flyShoulderY(hand: Point, dz: number): number {
  let lo = hand[1] - FLY_REACH - 40;
  let hi = hand[1];
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const { shoulder } = straightBody(FLY_FOOT, mid);
    if (Math.hypot(shoulder[0] - hand[0], shoulder[1] - hand[1], dz) > FLY_REACH) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const flyFrame = (z: number, hold: number): Keyframe => {
  const handY = FLY_ANCHOR[1] + Math.sqrt(FLY_STRAP ** 2 - (z - 26) ** 2);
  const hand: Point = [FLY_ANCHOR[0], round(handY)];
  const { pelvis, chest } = straightBody(FLY_FOOT, flyShoulderY(hand, z - SHOULDER_Z));
  const pose: AuthoredPose = {
    pelvis,
    chest,
    hands: { near: hand, far: hand },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: FLY_FOOT, far: FLY_FOOT },
    toes: { near: 62, far: 62 },
    spreadFeet: true,
  };
  return { hold, pose, sideways: { ...wideHands(z), elbows: { near: { out: 25 }, far: { out: 25 } } } };
};

// ---------------------------------------------------------------- inclined rows and curls under the rings (head at -x, face up)

const ROW_FOOT: Point = [170, -8];
const ROW_TOP_Y = -185;

/** Straight body from the heels on its back; both hands on the rings, elbows folding the way a dip's do. */
function underRings(shoulderY: number, hand: Point): Pose {
  const { pelvis, shoulder } = straightBody(ROW_FOOT, shoulderY, -1);
  // The chest exactly one spine length from the pelvis (the solver bows a spine that is pinned short).
  const spine = Math.hypot(shoulder[0] - pelvis[0], shoulder[1] - pelvis[1]);
  const chest: Point = [pelvis[0] + ((shoulder[0] - pelvis[0]) * 80) / spine, pelvis[1] + ((shoulder[1] - pelvis[1]) * 80) / spine];
  const elbow = elbowFor(shoulder, hand);
  return {
    pelvis,
    chest,
    hands: { near: hand, far: hand },
    elbows: { near: { at: elbow }, far: { at: elbow } },
    feet: { near: ROW_FOOT, far: ROW_FOOT },
  };
}

// Incline row: rings at chest height above the body, pulled to the chest.
const ROW_HAND: Point = [round(straightBody(ROW_FOOT, ROW_TOP_Y, -1).shoulder[0] + 25), -200];
const ROW_ANCHOR: Point = [ROW_HAND[0], -380];
const ROW_HANG_Y = lockedShoulderY(ROW_FOOT, ROW_HAND, -1, true);
const inclineRow = (shoulderY: number): Pose => underRings(shoulderY, ROW_HAND);

// Ring curl: the rings come to the forehead, elbows staying high.
const CURL_TOP_Y = -200;
const CURL_HAND: Point = [round(straightBody(ROW_FOOT, CURL_TOP_Y, -1).shoulder[0] - 31), -262];
const CURL_ANCHOR: Point = [CURL_HAND[0], -380];
const CURL_HANG_Y = lockedShoulderY(ROW_FOOT, CURL_HAND, -1, true);
const ringCurl = (shoulderY: number): Pose => underRings(shoulderY, CURL_HAND);

// ---------------------------------------------------------------- pelican curl (leaning forward on straps behind)

const PEL_FOOT: Point = [0, 0];
const PEL_HAND: Point = [23, -183];
const PEL_ANCHOR: Point = [-120, -430];
const PEL_UP_Y = -268;
/** Leaning furthest: the shoulder height at which the arms behind are locked straight. */
function pelicanLeanY(): number {
  let lo = PEL_UP_Y;
  let hi = -150;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const { shoulder } = straightBody(PEL_FOOT, mid, 1);
    if (Math.hypot(shoulder[0] - PEL_HAND[0], shoulder[1] - PEL_HAND[1]) > LOCKED) hi = mid;
    else lo = mid;
  }
  return round((lo + hi) / 2);
}
const PEL_LEAN_Y = pelicanLeanY();

/** Straight body on planted feet leaning forward; both hands hold the rings behind the hips. */
function pelican(shoulderY: number): Pose {
  const { pelvis, shoulder } = straightBody(PEL_FOOT, shoulderY, 1);
  const spine = Math.hypot(shoulder[0] - pelvis[0], shoulder[1] - pelvis[1]);
  const chest: Point = [pelvis[0] + ((shoulder[0] - pelvis[0]) * 80) / spine, pelvis[1] + ((shoulder[1] - pelvis[1]) * 80) / spine];
  const hand = onStrap(PEL_ANCHOR, Math.hypot(PEL_HAND[0] - PEL_ANCHOR[0], PEL_HAND[1] - PEL_ANCHOR[1]), (Math.atan2(PEL_HAND[0] - PEL_ANCHOR[0], PEL_HAND[1] - PEL_ANCHOR[1]) * 180) / Math.PI);
  const elbow = elbowFor(shoulder, hand);
  return {
    pelvis,
    chest,
    hands: { near: hand, far: hand },
    elbows: { near: { at: elbow }, far: { at: elbow } },
    feet: { near: PEL_FOOT, far: PEL_FOOT },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- german hang (skin the cat to the bottom, feet back on the floor)

/** The skin-the-cat poses of batch J, lowered so the legs reach the floor at the bottom. */
const GH_DROP = 55;
function lowered(pose: Pose): Pose {
  const down = (p: Point): Point => [p[0], round(p[1] + GH_DROP)];
  const both = <T extends Partial<Record<"near" | "far", Point>>>(pair: T | undefined): T | undefined =>
    pair ? ({ near: pair.near && down(pair.near), far: pair.far && down(pair.far) } as T) : undefined;
  const knees = pose.knees && {
    near: pose.knees.near?.at ? { ...pose.knees.near, at: down(pose.knees.near.at) } : pose.knees.near,
    far: pose.knees.far?.at ? { ...pose.knees.far, at: down(pose.knees.far.at) } : pose.knees.far,
  };
  return {
    ...pose,
    pelvis: pose.pelvis && down(pose.pelvis),
    chest: pose.chest && down(pose.chest),
    head: pose.head && down(pose.head),
    hands: both(pose.hands),
    feet: both(pose.feet),
    ...(knees ? { knees } : {}),
  };
}
const GH_SHOULDER = CAT_SHOULDER;
const around = (theta: number, legs?: "tuck" | number, headInLine = false): Pose => lowered(tuckedAround(theta, GH_SHOULDER, legs, headInLine));

/** Standing under low rings, arms up, knees soft, feet flat. */
function ghStart(): Pose {
  const base = around(90, 94);
  const pelvis = base.pelvis as Point;
  const near: Point = [-4, -8];
  const far: Point = [-8, -8];
  return {
    ...base,
    knees: { near: { at: roundPoint(solveJoint(pelvis, near, 88, 86, -1)) }, far: { at: roundPoint(solveJoint(pelvis, far, 88, 86, -1)) } },
    feet: { near, far },
    toes: { near: 0, far: 0 },
  };
}

export const BATCH_AP_SPECS: DoodleSpec[] = [
  {
    id: "hf_64",
    slug: "pelican-curl",
    title: "Pelican Curl",
    straps: { anchor: PEL_ANCHOR, end: "ring" },
    transition: 0.6,
    frames: rep(pelican, PEL_UP_Y, PEL_LEAN_Y, 0.5, 0.6),
  },
  {
    id: "hf_153",
    slug: "german-hang",
    title: "German Hang",
    straps: { anchor: [2, -450], end: "ring" },
    transition: 0.6,
    frames: [
      { hold: 0.5, pose: ghStart() },
      { hold: 0.05, pose: around(90) },
      { hold: 0.05, pose: around(45) },
      { hold: 0.05, pose: around(0) },
      { hold: 0.05, pose: around(-45) },
      { hold: 0.05, pose: around(-90) },
      { hold: 0.05, pose: around(-135) },
      { hold: 0.05, pose: around(180) },
      { hold: 1.2, pose: around(150, 100) },
      { hold: 0.05, pose: around(180) },
      { hold: 0.05, pose: around(-135) },
      { hold: 0.05, pose: around(-90) },
      { hold: 0.05, pose: around(-45) },
      { hold: 0.05, pose: around(0) },
      { hold: 0.05, pose: around(45) },
    ],
  },
  {
    id: "wger_2678",
    slug: "incline-row-rings",
    title: "Incline Row - Rings",
    straps: { anchor: ROW_ANCHOR, end: "ring" },
    transition: 0.5,
    frames: rep(inclineRow, ROW_HANG_Y, ROW_TOP_Y, 0.4, 0.4),
  },
  {
    id: "hf_65",
    slug: "ring-bicep-curl",
    title: "Ring Bicep Curl",
    straps: { anchor: CURL_ANCHOR, end: "ring" },
    transition: 0.5,
    frames: rep(ringCurl, CURL_HANG_Y, CURL_TOP_Y, 0.4, 0.5),
  },
  {
    id: "hf_36",
    slug: "ring-fly",
    title: "Ring Fly",
    views: TWO_VIEWS,
    straps: { anchor: FLY_ANCHOR, end: "ring" },
    transition: 0.5,
    frames: [flyFrame(26, 0.4), flyFrame(66, 0), flyFrame(108, 0.5), flyFrame(66, 0)],
  },
  {
    id: "hf_131",
    slug: "maltese-cross",
    title: "Maltese Cross",
    views: TWO_VIEWS,
    straps: { anchor: MAL_ANCHOR, end: "ring" },
    transition: 0.8,
    frames: [malteseFrame(26, 0.4), malteseFrame(72, 0), malteseFrame(MAL_Z, 1.2), malteseFrame(72, 0)],
  },
  {
    id: "hf_132",
    slug: "victorian-cross",
    title: "Victorian Cross",
    views: TWO_VIEWS,
    straps: { anchor: VIC_ANCHOR, end: "ring" },
    transition: 0.8,
    frames: [victorianFrame(26, 0.4), victorianFrame(86, 0), victorianFrame(118, 1.2), victorianFrame(86, 0)],
  },
  {
    id: "hf_133",
    slug: "ring-support-hold",
    title: "Ring Support Hold",
    views: TWO_VIEWS,
    straps: { anchor: SUP_ANCHOR, end: "ring" },
    transition: 0.8,
    frames: [supportFrame(26, 0.6), supportFrame(26, 1.2)],
  },
  {
    id: "hf_130",
    slug: "iron-cross",
    title: "Iron Cross",
    views: TWO_VIEWS,
    straps: { anchor: CROSS_ANCHOR, end: "ring" },
    transition: 0.7,
    frames: [crossFrame(26, 0.4), crossFrame(86, 0), crossFrame(CROSS_Z, 1.2), crossFrame(86, 0)],
  },
  {
    id: "hf_29",
    slug: "ring-dip",
    title: "Ring Dip",
    straps: MU_STRAPS,
    transition: 0.5,
    frames: ringDip(),
  },
  {
    id: "fedb_kipping_muscle_up",
    slug: "kipping-muscle-up",
    title: "Kipping Muscle Up",
    straps: MU_STRAPS,
    transition: 0.4,
    frames: kippingMuscleUp(),
  },
  {
    id: "hf_56",
    slug: "ring-muscle-up",
    title: "Ring Muscle-Up",
    straps: MU_STRAPS,
    transition: 0.5,
    frames: strictMuscleUp(),
  },
];
