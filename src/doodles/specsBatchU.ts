import { solvePose } from "./rig";
import type { DoodleSpec, Point, Pose, Prop } from "./rig";
import { PLANK_FOOT, pushUp, straightBody } from "./specsBatchC";

/**
 * Batch U: dips, bridges, handstand presses and explosive push-ups. Floor at
 * y = 0, up is negative, the side-view figure faces +x. Import only from ./rig
 * and other batches, never from ./specs (that would be circular).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

/** Shoulder to fingertip with the elbow locked (a hair short of 126). */
const REACH = 125.9;
const LEG = 173.9;

// ---------------------------------------------------------------- box handstand push-up

/** A tall box: the straight legs run down to it from hips stacked over the hands. */
const HS_BOX: Prop = { kind: "box", x: -150, y: -150, w: 70, h: 150 };
const HS_BOX_ANKLE: Point = [-110, -158];
const BOX_HANDS = { near: [60, 0] as Point, far: [56, 0] as Point };

/** Where two circles meet (the upper intersection): centre a radius ra, centre b radius rb. */
function meetUp(a: Point, ra: number, b: Point, rb: number): Point {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const x = (d * d + ra * ra - rb * rb) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  const p1: Point = [a[0] + ux * x - uy * h, a[1] + uy * x + ux * h];
  const p2: Point = [a[0] + ux * x + uy * h, a[1] + uy * x - ux * h];
  return (p1[1] < p2[1] ? p1 : p2).map(round) as unknown as Point;
}

const BOX_TOP = along(BOX_HANDS.near, -88, REACH);
const BOX_BOTTOM: Point = [94, -54];

/**
 * Box pike handstand push-up, `depth` 0 (arms locked) to 1 (the top of the head just off the
 * floor in front of the hands). The legs stay straight on the box throughout.
 */
function boxHspu(depth: number): Pose {
  const feet = { near: HS_BOX_ANKLE, far: [HS_BOX_ANKLE[0] + 3, HS_BOX_ANKLE[1]] as Point };
  // Tops of the feet on the box, toes pointing back.
  const toes = { near: 180, far: 180 };
  const shoulder: Point = [
    round(BOX_TOP[0] + (BOX_BOTTOM[0] - BOX_TOP[0]) * depth),
    round(BOX_TOP[1] + (BOX_BOTTOM[1] - BOX_TOP[1]) * depth),
  ];
  // Straight legs: the hips sit a leg's length from the ankles and a torso's length from the shoulders.
  const pelvis = meetUp(HS_BOX_ANKLE, LEG - 0.5, shoulder, 98);
  const chest = along(pelvis, angle(pelvis, shoulder), 80);
  // Eyes on the floor ahead of the hands; at the bottom the top of the head is just off the floor.
  const head = along(shoulder, 40 - 10 * depth, 38);
  const elbows = depth > 0 ? { near: { bend: 1 as const }, far: { bend: 1 as const } } : undefined;
  return { pelvis, chest, head, hands: BOX_HANDS, elbows, feet, toes };
}

// ---------------------------------------------------------------- dips on parallel bars

const DIP_Y = -216;
const DIP_HANDS = { near: [46, DIP_Y] as Point, far: [42, DIP_Y] as Point };
const DIP_BARS: Prop = { kind: "parallelBars", y: DIP_Y, x1: -190, x2: 190 };

/** Dip: shoulder at `shoulder`, torso leaning `lean` degrees forward, knees bent with the feet behind. */
function dip(shoulder: Point, lean: number, hands: Pose["hands"] = DIP_HANDS, elbow?: Point): Pose {
  const pelvis = along(shoulder, 90 + lean, 98);
  const chest = along(pelvis, -90 + lean, 80);
  const knee = along(pelvis, 96, 88);
  return {
    pelvis,
    chest,
    hands,
    elbows: elbow ? { near: { at: elbow }, far: { bend: 1 } } : { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: knee }, far: { at: [knee[0] - 3, knee[1]] } },
    feet: { near: along(knee, 170, 86), far: along([knee[0] - 3, knee[1]], 172, 86) },
    toes: { near: 100, far: 100 },
  };
}

const DIP_TOP = (): Pose => dip(along(DIP_HANDS.near, -91, REACH), 14);

/** Bottom of a full dip: forearm near vertical, elbows pointing back, shoulders a little below the elbows. */
function dipDeep(): Pose {
  const elbow = along(DIP_HANDS.near, -106, 65.9);
  const shoulder = along(elbow, 10, 59.6);
  return dip(shoulder, 32, DIP_HANDS, elbow);
}

/** Plyo dip airborne: arms locked under the shoulders, hands a hand-span above the bars. */
function dipAir(lift: number): Pose {
  const hand: Point = [DIP_HANDS.near[0], DIP_Y - lift];
  const shoulder = along(hand, -91, REACH);
  return dip(shoulder, 12, { near: hand, far: [hand[0] - 4, hand[1]] });
}

// ---------------------------------------------------------------- feet-assisted straight-bar support

const SUPPORT_BAR_Y = -140;
/** The bar seen end-on, just in front of the hips. */
const SUPPORT_BAR: Prop = { kind: "bar", y: SUPPORT_BAR_Y, x1: 14, x2: 14, grips: [14] };
const SUPPORT_HANDS = { near: [14, SUPPORT_BAR_Y] as Point, far: [12, SUPPORT_BAR_Y] as Point };

/** Crouched behind the bar, hands on it, elbows bent, ready to jump up. */
function supportSet(): Pose {
  const pelvis: Point = [-34, -138];
  return {
    pelvis,
    chest: along(pelvis, -76, 80),
    hands: SUPPORT_HANDS,
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [-30, -4], far: [-27, -4] },
    toes: { near: 0, far: 0 },
  };
}

/** On the bar: arms locked, shoulders leaning ahead of it, bar in front of the hips, toes resting on the floor behind. */
function supportHold(): Pose {
  const shoulder = along(SUPPORT_HANDS.near, -72, REACH);
  const pelvis = along(shoulder, 118, 98);
  return {
    pelvis,
    chest: along(pelvis, angle(pelvis, shoulder), 80),
    hands: SUPPORT_HANDS,
    feet: { near: [-46, -20], far: [-42, -20] },
    toes: { near: 70, far: 70 },
  };
}

// ---------------------------------------------------------------- floor dip

const FLOOR_HANDS = { near: [-70, 0] as Point, far: [-72, 0] as Point };
const FLOOR_FEET = { near: [112, -4] as Point, far: [108, -4] as Point };

/** Seated floor dip: shoulder at `shoulder`, torso running `deg` down toward the hips, elbows bending back. */
function floorDip(shoulder: Point, deg: number): Pose {
  const pelvis = along(shoulder, deg, 98);
  return {
    pelvis,
    chest: along(pelvis, deg + 180, 80),
    // Chest up: the head stays over the shoulders.
    head: along(shoulder, -78, 38),
    hands: FLOOR_HANDS,
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: FLOOR_FEET,
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- bridges (lying face up: head at -x)

/** Feet stay planted close to the hips; hands stay planted, fingers toward the feet. */
const BRIDGE_FEET = { near: [60, -4] as Point, far: [56, -4] as Point };
const BRIDGE_WRISTS = { near: [-100, -8] as Point, far: [-96, -8] as Point };
const BRIDGE_PALMS = { near: 0, far: 0 };
const BRIDGE_TOES = { near: 0, far: 0 };

/**
 * Full back bridge, arms locked: `push` 0 has the shoulders short of the hands, 1 pushes the
 * chest toward the wall behind, shoulders past the hands, hips a touch lower and legs longer.
 */
function bridgeFull(push: 0 | 1): Pose {
  return {
    pelvis: push ? [-22, -146] : [-6, -150],
    chest: push ? [-98, -132] : [-82, -133],
    spine: { bend: 1 },
    // Head hangs back behind the arms, eyes on the floor.
    head: push ? [-142, -104] : [-128, -103],
    hands: BRIDGE_WRISTS,
    wrists: BRIDGE_PALMS,
    feet: BRIDGE_FEET,
    toes: BRIDGE_TOES,
  };
}

/**
 * Neck bridge on the top of the head, back arched; `high` lifts the hips further. The hands are
 * planted beside the head, palms just past its crown and fingers toward the shoulders, elbows
 * bent and lifted out past the head, ready to take weight. (In side view a wrist right at the
 * ear would draw the forearm through the head circle; just past its edge is the closest that
 * stays clear of it.)
 */
function neckBridge(high: boolean): Pose {
  const head: Point = high ? [-121, -26] : [-128, -26];
  const base: Pose = {
    pelvis: high ? [-18, -104] : [-22, -94],
    chest: high ? [-90, -72] : [-94, -64],
    spine: { bend: 1 },
    head,
    feet: BRIDGE_FEET,
    toes: BRIDGE_TOES,
  };
  const shoulder = solvePose(base).arms.near.root;
  const wrist: Point = [head[0] - 22, -8];
  const elbow = meetUp(shoulder, 60, wrist, 58);
  return {
    ...base,
    hands: { near: wrist, far: wrist },
    wrists: BRIDGE_PALMS,
    elbows: { near: { at: elbow }, far: { at: elbow } },
  };
}

// ---------------------------------------------------------------- straight-arm press (planche to handstand)

const PRESS_HANDS = { near: [52, -1] as Point, far: [50, -1.5] as Point };

/**
 * Locked arms; the body pivots about the shoulders. `armDeg` is the arm angle from
 * the hand (-90 = vertical, more negative leans the shoulders forward past the hands),
 * `bodyDeg` the shoulder→pelvis direction and `legDeg` pelvis→ankle (a pike when they differ).
 */
function straightArm(armDeg: number, bodyDeg: number, legDeg: number, head: number): Pose {
  const shoulder = along(PRESS_HANDS.near, armDeg, REACH);
  const pelvis = along(shoulder, bodyDeg, 98);
  const ankle = along(pelvis, legDeg, LEG);
  return {
    pelvis,
    chest: along(shoulder, bodyDeg, 18),
    head: along(shoulder, bodyDeg + 180 + head, 38),
    hands: PRESS_HANDS,
    feet: { near: ankle, far: ankle },
    toes: { near: legDeg, far: legDeg },
  };
}

// ---------------------------------------------------------------- tiger bend

const TIGER_HAND: Point = [52, -1];

/** `forearmDeg` hand→elbow (−90 vertical, 180 flat on the floor), `upperDeg` elbow→shoulder, body lean from the shoulder. */
function tiger(forearmDeg: number, upperDeg: number, bodyDeg: number, legDeg: number): Pose {
  const elbow = along(TIGER_HAND, forearmDeg, 66);
  const shoulder = along(elbow, upperDeg, 60);
  const pelvis = along(shoulder, bodyDeg, 98);
  const ankle = along(pelvis, legDeg, LEG);
  return {
    pelvis,
    chest: along(shoulder, bodyDeg, 18),
    // Head forward of the arms, eyes on the floor between the hands.
    head: along(shoulder, bodyDeg + 180 - 40, 40),
    hands: { near: TIGER_HAND, far: [TIGER_HAND[0] - 2, TIGER_HAND[1]] },
    elbows: { near: { at: elbow }, far: { at: [elbow[0] - 2, elbow[1]] } },
    feet: { near: ankle, far: [ankle[0] - 3, ankle[1]] },
    toes: { near: legDeg, far: legDeg },
  };
}

// ---------------------------------------------------------------- aztec push-up

const AZTEC_HAND_X = 62;

/** Airborne pike: hips high, torso and legs hanging below them, hands touching the ankles. */
function aztecPike(): Pose {
  const pelvis: Point = [-10, -320];
  const ankle = along(pelvis, 110, LEG);
  const shoulder = along(pelvis, 58, 98);
  return {
    pelvis,
    chest: along(pelvis, 58, 80),
    hands: { near: [ankle[0] + 14, ankle[1] - 10], far: [ankle[0] + 14, ankle[1] - 12] },
    feet: { near: ankle, far: [ankle[0] + 3, ankle[1]] },
    toes: { near: 30, far: 30 },
    head: along(shoulder, 70, 38),
  };
}

/** Body launched off the floor, still straight and level-ish, hands just off the floor. */
function aztecLaunch(): Pose {
  const foot: Point = [PLANK_FOOT[0], PLANK_FOOT[1] - 70];
  const { shoulder } = straightBody(foot, -200);
  const hand = along(shoulder, 88, REACH);
  return { ...pushUp(-200, AZTEC_HAND_X, foot), hands: { near: hand, far: [hand[0] - 2, hand[1]] }, toes: { near: 30, far: 30 } };
}

// ---------------------------------------------------------------- specs

export const BATCH_U_SPECS: DoodleSpec[] = [
  {
    id: "wger_2621",
    slug: "box-handstand-push-up",
    title: "Box Handstand Push-up",
    props: [HS_BOX],
    transition: 0.5,
    frames: [
      { hold: 0.5, pose: boxHspu(0) },
      { hold: 0, pose: boxHspu(0.5) },
      { hold: 0.3, pose: boxHspu(1) },
      { hold: 0, pose: boxHspu(0.5) },
    ],
  },
  {
    id: "wger_2706",
    slug: "dips",
    title: "Dips",
    props: [DIP_BARS],
    transition: 1,
    frames: [
      { hold: 0.5, pose: DIP_TOP() },
      { hold: 0.3, pose: dipDeep() },
    ],
  },
  {
    id: "wger_2694",
    slug: "feet-assisted-straight-bar-support",
    title: "Feet-assisted Straight-bar Support",
    props: [SUPPORT_BAR],
    transition: 0.8,
    frames: [
      { hold: 0.5, pose: supportSet() },
      { hold: 1.6, pose: supportHold() },
    ],
  },
  {
    id: "wger_1000",
    slug: "floor-dips",
    title: "Floor dips",
    transition: 0.8,
    frames: [
      { hold: 0.4, pose: floorDip(along(FLOOR_HANDS.near, -80, REACH), 64) },
      { hold: 0.3, pose: floorDip([-60, -82], 46) },
    ],
  },
  {
    id: "hf_134",
    slug: "back-bridge",
    title: "Back Bridge",
    transition: 1,
    frames: [
      { hold: 0.8, pose: bridgeFull(0) },
      { hold: 1.4, pose: bridgeFull(1) },
    ],
  },
  {
    id: "hf_135",
    slug: "neck-bridge",
    title: "Neck Bridge",
    transition: 1,
    frames: [
      { hold: 0.8, pose: neckBridge(false) },
      { hold: 1.4, pose: neckBridge(true) },
    ],
  },
  {
    id: "hf_137",
    slug: "straight-arm-press",
    title: "Straight-Arm Press",
    transition: 1,
    frames: [
      { hold: 0.8, pose: straightArm(-72, 180, 180, -10) },
      { hold: 0, pose: straightArm(-72, 210, 178, -10) },
      { hold: 0, pose: straightArm(-76, 245, 200, -20) },
      // Eyes on the floor: the head sits on the back side of the arms, as in the other handstands.
      { hold: 1, pose: straightArm(-90, 272, 268, -45) },
      { hold: 0, pose: straightArm(-76, 245, 200, -20) },
      { hold: 0, pose: straightArm(-72, 210, 178, -10) },
    ],
  },
  {
    id: "hf_138",
    slug: "tiger-bend-handstand-push-up",
    title: "Tiger Bend Handstand Push-Up",
    transition: 0.9,
    frames: [
      { hold: 0.6, pose: tiger(-90, -90, -90, -88) },
      { hold: 0, pose: tiger(-140, -96, -92, -84) },
      { hold: 0.6, pose: tiger(180, -90, -94, -78) },
      { hold: 0, pose: tiger(-140, -96, -92, -84) },
    ],
  },
  {
    id: "hf_146",
    slug: "plyo-dip",
    title: "Plyo Dip",
    props: [DIP_BARS],
    transition: 0.45,
    frames: [
      { hold: 0.3, pose: DIP_TOP() },
      { hold: 0.15, pose: dipDeep() },
      { hold: 0, pose: DIP_TOP() },
      { hold: 0.2, pose: dipAir(48) },
      // Catch on soft elbows and sink into the next rep.
      { hold: 0.1, pose: dip(along(DIP_HANDS.near, -78, 112), 20) },
    ],
  },
  {
    id: "hf_145",
    slug: "aztec-push-up",
    title: "Aztec Push-Up",
    transition: 0.45,
    frames: [
      { hold: 0.4, pose: pushUp("top", AZTEC_HAND_X) },
      { hold: 0.15, pose: pushUp(-50, AZTEC_HAND_X) },
      { hold: 0, pose: aztecLaunch() },
      { hold: 0.3, pose: aztecPike() },
      { hold: 0, pose: aztecLaunch() },
      // Land on soft elbows.
      { hold: 0.15, pose: pushUp(-90, AZTEC_HAND_X) },
    ],
  },
];
