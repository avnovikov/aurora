import { solvePose } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose } from "./rig";
import { BODY, LOCKED, PLANK_FOOT, lockedShoulderY, pushUp, pushUpTop, rep, shoulderTap, straightBody } from "./specsBatchC";

/**
 * Batch G: floor pressing, plank and planche moves (push-up family, plank
 * flows, downward dog, planche lean / tuck planche, bench dip). Floor at y = 0,
 * up is negative, the figure faces +x (a plank has the head at +x).
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
  const along = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - along * along));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  const mid: Point = [a[0] + ux * along, a[1] + uy * along];
  const p1: Point = [mid[0] - uy * h, mid[1] + ux * h];
  const p2: Point = [mid[0] + uy * h, mid[1] - ux * h];
  const best = p1[1] < p2[1] ? p1 : p2;
  return [round(best[0]), round(best[1])];
}

/**
 * Chest for `pose` (pelvis pinned) at `chord` from the pelvis, turned between
 * `lo` and `hi` degrees until the near shoulder is a locked arm from `hand`.
 */
function lockChest(pose: Pose, chord: number, hand: Point, lo: number, hi: number): Point {
  const pelvis = pose.pelvis as Point;
  // Unrounded: a 0.1 step in the chest moves the shoulder enough to kink a locked elbow.
  const at = (deg: number): Point => {
    const r = (deg * Math.PI) / 180;
    return [pelvis[0] + Math.cos(r) * chord, pelvis[1] + Math.sin(r) * chord];
  };
  const gap = (deg: number): number => dist(solvePose({ ...pose, chest: at(deg) }).arms.near.root, hand) - LOCKED;
  const rising = gap(hi) > gap(lo);
  let a = lo;
  let b = hi;
  for (let i = 0; i < 50; i += 1) {
    const mid = (a + b) / 2;
    if (gap(mid) > 0 === rising) b = mid;
    else a = mid;
  }
  const [x, y] = at((a + b) / 2);
  return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
}

const BENT = { near: { bend: 1 as const }, far: { bend: 1 as const } };

// ---------------------------------------------------------------- standard push-up

const HAND_X = 62;
const PUSH_BOTTOM = -48;

// ---------------------------------------------------------------- knee push-up

/** Knee on the floor; knee to shoulder is thigh 88 + pelvis-to-shoulder 98. */
const KNEE: Point = [-83, -7];
const KNEE_BODY = 186;

function kneeBody(shoulderY: number): { pelvis: Point; chest: Point; shoulder: Point } {
  const dx = Math.sqrt(KNEE_BODY ** 2 - (shoulderY - KNEE[1]) ** 2);
  const shoulder: Point = [KNEE[0] + dx, shoulderY];
  const deg = angle(KNEE, shoulder);
  return { pelvis: along(KNEE, deg, 88), chest: along(KNEE, deg, 168), shoulder };
}

function kneePushUp(shoulderY: number): Pose {
  const { pelvis, chest } = kneeBody(shoulderY);
  return {
    pelvis,
    chest,
    hands: { near: [HAND_X, 0], far: [HAND_X - 2, 0] },
    elbows: BENT,
    knees: { near: { at: KNEE }, far: { at: KNEE } },
    // Shins down on the floor behind the knees, tops of the feet flat.
    feet: { near: along(KNEE, 179, 86), far: along(KNEE, 179, 86) },
    toes: { near: 180, far: 180 },
  };
}

function kneeTopY(): number {
  let lo = -KNEE_BODY;
  let hi = -60;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (dist(kneeBody(mid).shoulder, [HAND_X, 0]) > LOCKED) lo = mid;
    else hi = mid;
  }
  return round((lo + hi) / 2);
}

// ---------------------------------------------------------------- hand-release push-up

/** Lying flat, chest on the floor; `lift` raises both hands off the floor. */
function handRelease(lift: boolean): Pose {
  const base = pushUp(-26, HAND_X);
  const chest = base.chest as Point;
  // Head lifted a little, looking just ahead of the hands.
  const head = along(chest, angle(base.pelvis as Point, chest) - 14, 56);
  if (!lift) return { ...base, head };
  return {
    ...base,
    head,
    hands: { near: [HAND_X - 18, -38], far: [HAND_X - 20, -38] },
  };
}

// ---------------------------------------------------------------- high plank

/** Static high plank: arms locked under the shoulders, one straight line ankle to head. */
const highPlank = (): Pose => pushUp("top", HAND_X);

// ---------------------------------------------------------------- plank up-down

const UD_FOOT: Point = [-200, -18];
const UD_LOW = straightBody(UD_FOOT, -64);
const UD_ELBOW_X = round(UD_LOW.shoulder[0]);
/** Hands go down where the elbows were. */
const UD_HAND_X = UD_ELBOW_X;
const UD_TOP_Y = lockedShoulderY(UD_FOOT, [UD_HAND_X, 0]);

type Arm = "forearm" | "hand" | "palm";

/** Plank on the forearms or hands; "palm" is a hand placed while the shoulder is still low. */
function upDown(near: Arm, far: Arm): Pose {
  const high = near === "hand" && far === "hand";
  const { pelvis, chest } = high ? straightBody(UD_FOOT, UD_TOP_Y) : UD_LOW;
  const arm = (side: "near" | "far", kind: Arm) => {
    const dx = side === "near" ? 0 : -2;
    if (kind === "forearm") {
      return { hand: [UD_ELBOW_X + 66 + dx, -4] as Point, elbow: { at: [UD_ELBOW_X + dx, -4] as Point } };
    }
    return { hand: [UD_HAND_X + dx, 0] as Point, elbow: { bend: 1 as const } };
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

// ---------------------------------------------------------------- downward dog

const DOG_HAND: Point = [HAND_X, 0];
/** Hands to hips along straight arms and spine (126 + 98), a hair short. */
const ARM_SPINE = 223.6;
const LEG = 173.6;

/** Inverted V: arms, spine and legs straight; `foot` is the ankle, `toe` the foot angle. */
function downDog(foot: Point, toe: number, hand: Point = DOG_HAND): Pose {
  const pelvis = apex(hand, ARM_SPINE, foot, LEG);
  const deg = angle(pelvis, hand);
  const base: Pose = {
    pelvis,
    hands: { near: hand, far: [hand[0] - 2, hand[1]] },
    feet: { near: foot, far: foot },
    toes: { near: toe, far: toe },
  };
  const chest = lockChest(base, 80, hand, deg - 10, deg + 10);
  // Head down beside the arms (drawn just in front of them), eyes to the floor.
  return { ...base, chest, head: along(chest, deg - 28, 56) };
}

/** Downward-dog ankles: just behind the plank feet, heels lowered towards the floor. */
const DOG_FOOT: Point = [-186, -10];
const DOG_TOE = 22;

/**
 * Part way from high plank (0) to downward dog (1): the hips swing up on
 * straight arms and spine, the heels sink as the ankles slide back.
 */
function dogWay(t: number): Pose {
  const plank = solvePose(pushUp("top", HAND_X));
  const dog = solvePose(downDog(DOG_FOOT, DOG_TOE));
  // Arm angle at the hands and spine angle at the shoulders, each blended plank → dog.
  const arm = mixAngle(angle(DOG_HAND, plank.arms.near.root), angle(DOG_HAND, dog.arms.near.root), t);
  const back = mixAngle(angle(plank.arms.near.root, plank.pelvis), angle(dog.arms.near.root, dog.pelvis), t);
  const shoulder = along(DOG_HAND, arm, LOCKED);
  const pelvis = along(shoulder, back, 98);
  const foot: Point = [round(mix(PLANK_FOOT[0], DOG_FOOT[0], t)), round(mix(PLANK_FOOT[1], DOG_FOOT[1], t))];
  const toe = round(mix(62, DOG_TOE, t));
  const base: Pose = {
    pelvis,
    hands: { near: DOG_HAND, far: [DOG_HAND[0] - 2, 0] },
    feet: { near: foot, far: foot },
    toes: { near: toe, far: toe },
  };
  const deg = back + 180;
  const chest = lockChest(base, 80, DOG_HAND, deg - 10, deg + 10);
  return { ...base, chest, head: along(chest, deg - 28 * Math.min(1, t * 2), 56) };
}

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Blend two angles (degrees) the short way round. */
function mixAngle(a: number, b: number, t: number): number {
  const delta = ((((b - a) % 360) + 540) % 360) - 180;
  return a + delta * t;
}

/** In-between steps that keep the arms locked on the way up and down. */
const DOG_WAY = [0.1, 0.2, 0.3, 0.42, 0.54, 0.66, 0.78, 0.89];

/** Downward dog hold, pedalling: `pedal` lifts that heel by bending the knee. */
function dogPedal(pedal: "near" | "far" | null): Pose {
  const base = downDog(DOG_FOOT, DOG_TOE);
  if (!pedal) return base;
  const other = pedal === "near" ? "far" : "near";
  return {
    ...base,
    feet: { [pedal]: [DOG_FOOT[0] + 14, -24], [other]: DOG_FOOT },
    toes: { [pedal]: 62, [other]: DOG_TOE },
  };
}

// ---------------------------------------------------------------- Hindu push-up

const HINDU_FOOT: Point = [-158, -19];

function hinduPike(): Pose {
  return downDog(HINDU_FOOT, 40);
}

/** Chest diving down towards the hands, hips still high, elbows bent. */
function hinduDive(): Pose {
  const pelvisX = -40;
  const pelvis: Point = [pelvisX, round(HINDU_FOOT[1] - Math.sqrt(LEG ** 2 - (HINDU_FOOT[0] - pelvisX) ** 2))];
  return {
    pelvis,
    chest: along(pelvis, 30, 78),
    head: along(along(pelvis, 30, 78), 40, 56),
    hands: { near: DOG_HAND, far: [DOG_HAND[0] - 2, 0] },
    elbows: BENT,
    feet: { near: HINDU_FOOT, far: HINDU_FOOT },
    toes: { near: 55, far: 55 },
  };
}

/** Chest skimming forward low between the hands. */
function hinduSkim(): Pose {
  const pelvisX = -8;
  const pelvis: Point = [pelvisX, round(HINDU_FOOT[1] - Math.sqrt(LEG ** 2 - (HINDU_FOOT[0] - pelvisX) ** 2))];
  return {
    pelvis,
    chest: along(pelvis, 20, 78),
    head: along(along(pelvis, 20, 78), 5, 56),
    hands: { near: DOG_HAND, far: [DOG_HAND[0] - 2, 0] },
    elbows: BENT,
    feet: { near: HINDU_FOOT, far: HINDU_FOOT },
    toes: { near: 62, far: 62 },
  };
}

/** Upward-facing arch: arms straight, hips low, chest up. */
function hinduArch(): Pose {
  const pelvisY = -46;
  const pelvis: Point = [round(HINDU_FOOT[0] + Math.sqrt(LEG ** 2 - (pelvisY - HINDU_FOOT[1]) ** 2)), pelvisY];
  const base: Pose = {
    pelvis,
    spine: { bend: 1 },
    hands: { near: DOG_HAND, far: [DOG_HAND[0] - 2, 0] },
    feet: { near: HINDU_FOOT, far: HINDU_FOOT },
    toes: { near: 62, far: 62 },
  };
  const chest = lockChest(base, 77.5, DOG_HAND, -80, -30);
  return { ...base, chest, head: along(chest, -70, 56) };
}

// ---------------------------------------------------------------- pseudo planche push-up

/** Hands back by the waist: the shoulders sit well ahead of the wrists. */
const PSEUDO_HAND_X = 24;
const PSEUDO_FOOT: Point = [-190, -19];

function pseudo(shoulderY: number): Pose {
  const base = pushUp(shoulderY, PSEUDO_HAND_X, PSEUDO_FOOT);
  return { ...base, toes: { near: 80, far: 80 } };
}

// ---------------------------------------------------------------- planche lean

/** Tips of the toes stay put; the ankles roll forward over them as the body leans. */
const LEAN_TOE: Point = [-180.6, -0.3];

function lean(footDeg: number): Pose {
  const foot = along(LEAN_TOE, footDeg + 180, 20);
  const deg = angle(foot, apex(DOG_HAND, LOCKED, foot, BODY));
  const base: Pose = {
    pelvis: along(foot, deg, 173.9),
    hands: { near: DOG_HAND, far: DOG_HAND },
    feet: { near: foot, far: foot },
    toes: { near: footDeg, far: footDeg },
  };
  // Straight body; the chest is fine-tuned so the arms lock exactly.
  return { ...base, chest: lockChest(base, 80, DOG_HAND, deg - 5, deg + 5) };
}

/** Foot angles between plank and full lean, so the arms stay locked throughout. */
const LEAN_STEPS = [70, 78, 86, 94, 102, 110, 118];

// ---------------------------------------------------------------- tuck planche

const TUCK_HAND: Point = [10, 0];
/** Far hand a touch forward so both locked arms reach the same shoulder. */
const TUCK_HANDS = { near: TUCK_HAND, far: [TUCK_HAND[0] + 2, 0] as Point };

/** Crouched on the balls of the feet, leaning forward over straight arms until the feet go light. */
function tuckLean(): Pose {
  const base: Pose = {
    pelvis: [-40, -78],
    spine: { bend: -1 },
    hands: TUCK_HANDS,
    feet: { near: [-44, -18], far: [-46, -18] },
    toes: { near: 70, far: 70 },
  };
  const chest = lockChest(base, 77.5, TUCK_HAND, -60, 10);
  return { ...base, chest, head: along(chest, 14, 56) };
}

/** Feet off the floor, knees pulled in under the chest, hips level with the shoulders. */
function tuckHold(): Pose {
  const pelvis: Point = [-30, -108];
  // Thighs angled down towards the hands, shins folded tight back under them.
  const knee = along(pelvis, 50, 88);
  const base: Pose = {
    pelvis,
    spine: { bend: -1 },
    hands: TUCK_HANDS,
    knees: { near: { at: knee }, far: { at: knee } },
    feet: { near: along(knee, 208, 86), far: along(knee, 208, 86) },
    toes: { near: 200, far: 200 },
  };
  const chest = lockChest(base, 77, TUCK_HAND, -40, 30);
  return { ...base, chest, head: along(chest, 25, 56) };
}

// ---------------------------------------------------------------- bench dip

const BENCH = { x: -150, y: -96, w: 104, h: 96 };
const DIP_HAND: Point = [-42, -97];
const DIP_HEEL: Point = [126, -9];

/** Hands on the bench edge behind, legs straight out to the heels; `lock` straightens the arms at the top. */
function benchDip(pelvisY: number, lock: boolean): Pose {
  const dy = pelvisY - DIP_HEEL[1];
  const pelvis: Point = [round(DIP_HEEL[0] - Math.sqrt(LEG ** 2 - dy * dy)), pelvisY];
  const base: Pose = {
    pelvis,
    hands: { near: DIP_HAND, far: [DIP_HAND[0] - 2, DIP_HAND[1]] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: DIP_HEEL, far: [DIP_HEEL[0] - 2, DIP_HEEL[1]] },
    toes: { near: -60, far: -60 },
  };
  return { ...base, chest: lock ? lockChest(base, 80, DIP_HAND, -130, -80) : along(pelvis, -96, 80) };
}

// ---------------------------------------------------------------- specs

const pushUpRep = (handX: number): Keyframe[] => rep((y) => pushUp(y, handX), pushUpTop(handX), PUSH_BOTTOM, 0.4, 0.3);

export const BATCH_G_SPECS: DoodleSpec[] = [
  {
    id: "hf_2",
    slug: "standard-push-up",
    title: "Standard Push-Up",
    transition: 0.5,
    frames: pushUpRep(HAND_X),
  },
  {
    id: "ntc_knee_push_up",
    slug: "knee-push-up",
    title: "Knee push-up",
    transition: 0.5,
    frames: rep(kneePushUp, kneeTopY(), PUSH_BOTTOM, 0.4, 0.3),
  },
  {
    id: "ntc_hand_release_push_up",
    slug: "hand-release-push-up",
    title: "Hand-release push-up",
    transition: 0.5,
    frames: [
      { hold: 0.4, pose: pushUp("top", HAND_X) },
      { hold: 0, pose: pushUp(round((pushUpTop(HAND_X) - 22) / 2), HAND_X) },
      { hold: 0.2, pose: handRelease(false) },
      { hold: 0.4, pose: handRelease(true) },
      { hold: 0.1, pose: handRelease(false) },
      { hold: 0, pose: pushUp(round((pushUpTop(HAND_X) - 22) / 2), HAND_X) },
    ],
  },
  {
    id: "ntc_push_up_shoulder_tap",
    slug: "push-up-shoulder-tap",
    title: "Push-up with shoulder tap",
    transition: 0.5,
    frames: [
      ...pushUpRep(HAND_X),
      { hold: 0.3, pose: shoulderTap("near") },
      { hold: 0.1, pose: shoulderTap(null) },
      { hold: 0.3, pose: shoulderTap("far") },
      { hold: 0.1, pose: shoulderTap(null) },
    ],
  },
  {
    id: "ntc_high_plank",
    slug: "high-plank",
    title: "High plank hold",
    transition: 1.6,
    frames: [
      { hold: 1.2, pose: highPlank() },
      { hold: 1.2, pose: highPlank() },
    ],
  },
  {
    id: "ntc_plank_up_down",
    slug: "plank-up-down",
    title: "Plank up-down",
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
    id: "ntc_plank_to_down_dog",
    slug: "plank-to-down-dog",
    title: "Plank to downward dog",
    transition: 0.16,
    frames: [
      { hold: 0.6, pose: pushUp("top", HAND_X) },
      ...DOG_WAY.map((t) => ({ hold: 0, pose: dogWay(t) })),
      { hold: 0.9, pose: downDog(DOG_FOOT, DOG_TOE) },
      ...[...DOG_WAY].reverse().map((t) => ({ hold: 0, pose: dogWay(t) })),
    ],
  },
  {
    id: "hf_10",
    slug: "hindu-push-up",
    title: "Hindu Push-Up",
    transition: 0.6,
    frames: [
      { hold: 0.4, pose: hinduPike() },
      { hold: 0, pose: hinduDive() },
      { hold: 0, pose: hinduSkim() },
      { hold: 0.5, pose: hinduArch() },
    ],
  },
  {
    id: "hf_9",
    slug: "pseudo-planche-push-up",
    title: "Pseudo Planche Push-Up",
    transition: 0.6,
    frames: rep(pseudo, lockedShoulderY(PSEUDO_FOOT, [PSEUDO_HAND_X, 0]), -52, 0.4, 0.3),
  },
  {
    id: "hf_31",
    slug: "planche-lean",
    title: "Planche Lean",
    transition: 0.2,
    frames: [
      { hold: 0.6, pose: lean(62) },
      ...LEAN_STEPS.map((deg) => ({ hold: 0, pose: lean(deg) })),
      { hold: 1.6, pose: lean(125) },
      ...[...LEAN_STEPS].reverse().map((deg) => ({ hold: 0, pose: lean(deg) })),
    ],
  },
  {
    id: "hf_32",
    slug: "tuck-planche",
    title: "Tuck Planche",
    transition: 0.8,
    frames: [
      { hold: 0.5, pose: tuckLean() },
      { hold: 1.6, pose: tuckHold() },
    ],
  },
  {
    id: "ntc_downward_dog",
    slug: "downward-dog",
    title: "Downward dog",
    transition: 0.8,
    frames: [
      { hold: 0.6, pose: dogPedal(null) },
      { hold: 0.4, pose: dogPedal("near") },
      { hold: 0.6, pose: dogPedal(null) },
      { hold: 0.4, pose: dogPedal("far") },
    ],
  },
  {
    id: "hf_24",
    slug: "bench-dip",
    title: "Bench Dip",
    props: [{ kind: "box", ...BENCH }],
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: benchDip(-110, true) },
      { hold: 0.3, pose: benchDip(-50, false) },
    ],
  },
];
