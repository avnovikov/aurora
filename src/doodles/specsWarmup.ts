import type { DoodleSpec, Point, Pose, Prop } from "./rig";

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
const chestToward = (pelvis: Point, shoulder: Point): Point => along(pelvis, angle(pelvis, shoulder), 80);

// ---------------------------------------------------------------- jumping jacks (front)

function jack(open: boolean): Pose {
  if (!open) {
    return {
      pelvis: [0, -173],
      chest: [0, -253],
      hands: { near: [-30, -152], far: [30, -152] },
      feet: { near: [-12, 0], far: [12, 0] },
      toes: { near: 180, far: 0 },
    };
  }
  return {
    pelvis: [0, -152],
    chest: [0, -232],
    hands: { near: [-62, -366], far: [62, -366] },
    feet: { near: [-85, 0], far: [85, 0] },
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- 90/90 hip switch (front, seated)

/**
 * Seated, seen from the front and a little above: the floor in front of the
 * hips draws lower on screen, the floor behind them higher. Knees to one side:
 * the leg on the other side is the front leg (thigh forward, shin across the
 * front), the leg on that side is the side leg (thigh out, shin back).
 */
const SWITCH_HIP_NEAR: Point = [-8, -100];
const SWITCH_HIP_FAR: Point = [8, -100];

function hipSwitch(kneesRight: boolean): Pose {
  const mirror = (p: Point): Point => [-p[0], p[1]];
  // Knees to the right: near leg in front (shin across the front), far leg folded flat out to the side.
  const frontKnee = along(SWITCH_HIP_NEAR, 70, 88);
  const frontFoot = along(frontKnee, 2, 86);
  // Side leg folded flat: the shin lies back along the thigh (hidden behind it in a true front view).
  const sideKnee = along(SWITCH_HIP_FAR, 12, 88);
  const sideFoot = along(sideKnee, 171, 86);
  const legs: Pick<Pose, "knees" | "feet" | "toes"> = kneesRight
    ? {
        knees: { near: { at: frontKnee }, far: { at: sideKnee } },
        feet: { near: frontFoot, far: sideFoot },
        toes: { near: 0, far: -100 },
      }
    : {
        knees: { near: { at: mirror(sideKnee) }, far: { at: mirror(frontKnee) } },
        feet: { near: mirror(sideFoot), far: mirror(frontFoot) },
        toes: { near: -80, far: 180 },
      };
  return {
    pelvis: [0, -100],
    chest: [0, -180],
    // Hands on the floor behind the hips for support.
    hands: { near: [-80, -90], far: [80, -90] },
    elbows: { near: { bend: 1 }, far: { bend: -1 } },
    ...legs,
  };
}

// ---------------------------------------------------------------- deep squat hold

function deepSquat(pelvisY: number): Pose {
  const pelvis: Point = [-42, pelvisY];
  return {
    pelvis,
    chest: along(pelvis, -78, 80),
    hands: { near: [40, pelvisY - 62], far: [36, pelvisY - 62] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [0, 0], far: [-6, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- side lying (front view, head left)

/**
 * Lying on the side, seen from the front (belly towards the viewer, head left).
 * Front view spreads the sides perpendicular to the spine, so the shoulders and
 * hips stack vertically: near = bottom side on the floor, far = top side. The
 * camera sits a little above the floor, so the bent knees (forward, towards the
 * viewer) draw slightly below the hips and rest on the floor line.
 */
export const SIDE_LYING_FLOOR: Prop = { kind: "bar", y: 0, x1: -250, x2: 250 };
const SL_PELVIS: Point = [0, -30];
export const SL_HIP_BOTTOM: Point = [0, -22];
export const SL_HIP_TOP: Point = [0, -38];
const SL_SHOULDER_BOTTOM: Point = [-98, -8];
export const SL_SHOULDER_TOP: Point = [-98, -52];
/** Bottom knee forward on the floor; the shin runs back to the foot (higher on screen = further back). */
export const SL_KNEE_BOTTOM: Point = along(SL_HIP_BOTTOM, (Math.asin(18 / 88) * 180) / Math.PI, 88);
export const SL_FOOT_BOTTOM: Point = along(SL_KNEE_BOTTOM, -12, 86);
/** Top knee resting on the bottom knee, top foot on the bottom foot. */
export const SL_KNEE_TOP: Point = along(SL_HIP_TOP, (Math.asin(26 / 88) * 180) / Math.PI, 88);
export const SL_FOOT_TOP: Point = along(SL_KNEE_TOP, -12, 86);

/** Shared side-lying base: head resting on the bottom arm stretched overhead, top arm long along the top side, knees bent and stacked. */
export function sideLying(extra: Pose = {}): Pose {
  return {
    pelvis: SL_PELVIS,
    chest: [-80, SL_PELVIS[1]],
    head: along([-100, SL_PELVIS[1]], 200, 36),
    spine: { bend: -1 },
    hands: { near: along(SL_SHOULDER_BOTTOM, 181, 125), far: along(SL_SHOULDER_TOP, 4, 125) },
    elbows: { near: { bend: 1 }, far: { bend: -1 } },
    knees: { near: { at: SL_KNEE_BOTTOM }, far: { at: SL_KNEE_TOP } },
    feet: { near: SL_FOOT_BOTTOM, far: SL_FOOT_TOP },
    toes: { near: 0, far: 0 },
    ...extra,
  };
}

/** Straight top leg raised `deg` degrees from the floor line (negative = towards the ceiling). */
function hipAbduction(deg: number): Pose {
  return sideLying({
    knees: { near: { at: SL_KNEE_BOTTOM } },
    feet: { near: SL_FOOT_BOTTOM, far: along(SL_HIP_TOP, deg, 173.4) },
    toes: { near: 0, far: deg },
  });
}

// ---------------------------------------------------------------- single-leg balance

function balance(sway: 0 | 1): Pose {
  const pelvis: Point = sway ? [4, -166] : [0, -168];
  const knee = along(pelvis, sway ? 36 : 42, 88);
  return {
    pelvis,
    chest: [pelvis[0] + (sway ? 2 : 0), pelvis[1] - 80],
    hands: sway ? { near: [96, -236], far: [-84, -272] } : { near: [100, -262], far: [-90, -250] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { far: { at: knee } },
    feet: { near: [0, 0], far: along(knee, sway ? 96 : 102, 86) },
    toes: { near: 0, far: 70 },
  };
}

// ---------------------------------------------------------------- all fours

function allFours(): Pose {
  return {
    pelvis: [-50, -92],
    hands: { near: [48, 0], far: [44, 0] },
    feet: { near: [-136, -4], far: [-132, -4] },
    toes: { near: 180, far: 180 },
  };
}

function cat(): Pose {
  return {
    ...allFours(),
    pelvis: [-48, -90],
    chest: [28, -106],
    head: [74, -76],
    spine: { bend: -1 },
  };
}

function cow(): Pose {
  return {
    ...allFours(),
    pelvis: [-54, -100],
    chest: [22, -114],
    head: [56, -150],
    spine: { bend: 1 },
  };
}

function rockForward(): Pose {
  const pelvis: Point = [-22, -88];
  return {
    pelvis,
    chest: chestToward(pelvis, [70, -124]),
    hands: { near: [48, 0], far: [44, 0] },
    feet: { near: [-136, -4], far: [-132, -4] },
    toes: { near: 180, far: 180 },
  };
}

function rockBack(): Pose {
  const pelvis: Point = [-98, -78];
  return {
    pelvis,
    chest: chestToward(pelvis, [6, -100]),
    hands: { near: [48, 0], far: [44, 0] },
    knees: { near: { at: [-50, -4] }, far: { at: [-50, -4] } },
    feet: { near: [-136, -4], far: [-136, -4] },
    toes: { near: 180, far: 180 },
  };
}

// ---------------------------------------------------------------- side plank (head left, feet right)

function sidePlank(pelvisY: number): Pose {
  const foot: Point = [207.6, -19.3];
  const pelvis: Point = [round(foot[0] - Math.sqrt(173.9 ** 2 - (pelvisY - foot[1]) ** 2)), pelvisY];
  const dy = -64 - pelvisY;
  const shoulder: Point = [pelvis[0] - Math.sqrt(98 * 98 - dy * dy), -64];
  const chest = chestToward(pelvis, shoulder);
  const sx = round(shoulder[0]);
  return {
    pelvis,
    chest,
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    hands: { near: [sx + 66, -4], far: [sx + 6, -186] },
    feet: { near: foot, far: foot },
    toes: { near: 62, far: 62 },
  };
}

// ---------------------------------------------------------------- hollow body rock (head left, feet right)

function hollow(rockedBack: boolean): Pose {
  if (rockedBack) {
    const pelvis: Point = [-4, -18];
    return {
      pelvis,
      chest: [-82, -26],
      head: [-122, -62],
      spine: { bend: 1 },
      hands: { near: [-212, -20], far: [-210, -22] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      feet: { near: along(pelvis, -40, 173.9), far: along(pelvis, -41, 173.4) },
      toes: { near: -40, far: -40 },
    };
  }
  const pelvis: Point = [6, -14];
  return {
    pelvis,
    chest: [-66, -46],
    head: [-100, -82],
    spine: { bend: 1 },
    hands: { near: [-205, -34], far: [-203, -36] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: along(pelvis, -16, 173.9), far: along(pelvis, -17, 173.4) },
    toes: { near: -16, far: -16 },
  };
}

// ---------------------------------------------------------------- wall angel (side view, wall behind)

function wallAngel(up: boolean): Pose {
  return {
    pelvis: [0, -172],
    chest: [0, -252],
    hands: up ? { near: [-62, -386], far: [62, -386] } : { near: [-82, -336], far: [82, -336] },
    elbows: up
      ? { near: { bend: -1 }, far: { bend: 1 } }
      : { near: { at: [-82, -270] }, far: { at: [82, -270] } },
    feet: { near: [-16, 0], far: [16, 0] },
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- arm circles (front)

/** Arms straight out to the sides; the hands trace a small circle (offset in the frontal plane). */
function armCircle(reach: number, dy: number): Pose {
  return {
    pelvis: [0, -174],
    chest: [0, -254],
    hands: { near: [-22 - reach, -272 + dy], far: [22 + reach, -272 - dy] },
    feet: { near: [-14, 0], far: [14, 0] },
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- side-lying external rotation

/** Top elbow pinned at the ribs, bent 90°; the forearm turns from across the belly (`foreDeg` 40) up to the ceiling (-90). */
function externalRotation(foreDeg: number): Pose {
  const elbow = along(SL_SHOULDER_TOP, 8, 60);
  return sideLying({
    hands: { near: along([-98, -8], 181, 125), far: along(elbow, foreDeg, 66) },
    elbows: { near: { bend: 1 }, far: { at: elbow } },
  });
}

// ---------------------------------------------------------------- face down, seen from above

/**
 * Lying face down, seen from above (front view laid flat, head right): the
 * shoulders and hips spread across the body (near = upper side on screen), so
 * arms moving along or just off the floor keep their full length. Angles are
 * screen degrees from each shoulder: 180 = along the body towards the feet,
 * ∓90 = straight out to the side, 0 = overhead.
 */
const PRONE_PELVIS: Point = [-40, -150];
const PRONE_SHOULDER_NEAR: Point = [58, -172];
const PRONE_SHOULDER_FAR: Point = [58, -128];
const PRONE_HIP_NEAR: Point = [-40, -158];
const PRONE_HIP_FAR: Point = [-40, -142];

/** Straight arms at `deg` from each shoulder on the near (upper) side, mirrored on the far side. */
export function proneFromAbove(deg: number): Pose {
  return {
    pelvis: PRONE_PELVIS,
    chest: [40, -150],
    head: [96, -150],
    hands: { near: along(PRONE_SHOULDER_NEAR, -deg, 125.97), far: along(PRONE_SHOULDER_FAR, deg, 125.97) },
    elbows: { near: { bend: -1 }, far: { bend: 1 } },
    feet: { near: along(PRONE_HIP_NEAR, 186, 173.97), far: along(PRONE_HIP_FAR, 174, 173.97) },
    toes: { near: 186, far: 174 },
  };
}

/** W: upper arms angled back towards the hips, elbows bent, hands out level with the head. */
function proneW(): Pose {
  const elbowNear = along(PRONE_SHOULDER_NEAR, -140, 60);
  const elbowFar = along(PRONE_SHOULDER_FAR, 140, 60);
  return {
    ...proneFromAbove(170),
    hands: { near: along(elbowNear, -50, 66), far: along(elbowFar, 50, 66) },
    elbows: { near: { at: elbowNear }, far: { at: elbowFar } },
  };
}

// ---------------------------------------------------------------- incline push-up

const INCLINE_FOOT: Point = [-112, -19];
const INCLINE_REACH = 271.5;

function incline(shoulderY: number): Pose {
  const dx = Math.sqrt(INCLINE_REACH ** 2 - (shoulderY - INCLINE_FOOT[1]) ** 2);
  const shoulder: Point = [INCLINE_FOOT[0] + dx, shoulderY];
  const u: Point = [(shoulder[0] - INCLINE_FOOT[0]) / INCLINE_REACH, (shoulder[1] - INCLINE_FOOT[1]) / INCLINE_REACH];
  const pelvis: Point = [round(INCLINE_FOOT[0] + u[0] * 173.9), round(INCLINE_FOOT[1] + u[1] * 173.9)];
  return {
    pelvis,
    chest: [round(pelvis[0] + u[0] * 80), round(pelvis[1] + u[1] * 80)],
    hands: { near: [82, -92], far: [78, -92] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: INCLINE_FOOT, far: INCLINE_FOOT },
    toes: { near: 62, far: 62 },
  };
}

// ---------------------------------------------------------------- world's greatest stretch

function wgsLunge(): Pose {
  const pelvis: Point = [12, -90];
  return {
    pelvis,
    chest: along(pelvis, -12, 80),
    hands: { near: [76, 0], far: [70, 0] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: [100, -86] } },
    feet: { near: [100, 0], far: [-140, -20] },
    toes: { near: 0, far: 62 },
  };
}

function wgsReach(): Pose {
  const base = wgsLunge();
  const pelvis = base.pelvis as Point;
  const shoulder = along(pelvis, -12, 98);
  return {
    ...base,
    hands: { near: [76, 0], far: [round(shoulder[0] + 6), round(shoulder[1] - 112)] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

/** Rotating arm swings back over the hips on its way down, clear of the head. */
function wgsSwing(): Pose {
  const base = wgsLunge();
  const shoulder = along(base.pelvis as Point, -12, 98);
  return { ...base, hands: { near: [76, 0], far: along(shoulder, -150, 112) }, elbows: { near: { bend: 1 }, far: { bend: 1 } } };
}

function wgsHamstring(): Pose {
  const pelvis: Point = [-28, -116];
  return {
    pelvis,
    chest: along(pelvis, 0, 80),
    hands: { near: [80, 0], far: [74, 0] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [100, 0], far: [-140, -20] },
    toes: { near: -20, far: 62 },
  };
}

// ---------------------------------------------------------------- specs

/** Warm-up drills (RAMP raise / mobilise / activate / potentiate stations). Import only from ./rig — never from ./specs (that would be circular). */
// ---------------------------------------------------------------- toy soldiers

/** Walking straight-leg kick: the kicking leg stays straight toward hip height, the opposite hand reaches for the toes. */
function toySoldier(kick: "near" | "far" | null): Pose {
  const pelvis: Point = [0, -172];
  if (!kick) {
    return {
      pelvis,
      chest: [0, -252],
      feet: { near: [0, 0], far: [0, 0] },
      toes: { near: 0, far: 0 },
      hands: { near: [70, -214], far: [-30, -170] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
    };
  }
  const other = kick === "near" ? "far" : "near";
  return {
    pelvis,
    chest: along(pelvis, -65, 80),
    feet: { [kick]: along(pelvis, -25, 173.9), [other]: [0, 0] },
    toes: { [kick]: -30, [other]: 0 },
    hands: { [other]: [166, -252], [kick]: [-46, -192] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

// ---------------------------------------------------------------- reach and touch

/** Standing: arms overhead with a slight lean back, or hinged forward with the hands near the toes. */
function reachTouch(mode: "up" | "high" | "front" | "down"): Pose {
  if (mode === "high" || mode === "front") {
    const pelvis: Point = [-3, -172];
    return {
      pelvis,
      chest: [-3, -252],
      hands: mode === "high" ? { near: [70, -345], far: [66, -343] } : { near: [112, -258], far: [108, -256] },
      feet: { near: [0, 0], far: [0, 0] },
      toes: { near: 0, far: 0 },
    };
  }
  if (mode === "down") {
    const pelvis: Point = [-30, -170];
    return {
      pelvis,
      chest: along(pelvis, 10, 80),
      hands: { near: [78, -34], far: [74, -30] },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      feet: { near: [0, 0], far: [0, 0] },
      toes: { near: 0, far: 0 },
    };
  }
  const pelvis: Point = [-6, -172];
  return {
    pelvis,
    chest: along(pelvis, -100, 80),
    head: [-47, -298],
    hands: { near: [15.9, -388.6], far: [11.6, -389.6] },
    feet: { near: [0, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- downward dog / upward dog

const DOG_HANDS: Point = [70, 0];

/** Downward dog: hips high, arms and legs straight, heels toward the floor. */
function downDog(): Pose {
  return {
    pelvis: [-75, -164],
    chest: [-10, -118],
    head: [45.4, -110.1],
    hands: { near: DOG_HANDS, far: [DOG_HANDS[0] - 2, 0] },
    feet: { near: [-160, -20], far: [-160, -20] },
    toes: { near: 62, far: 62 },
  };
}

/** Between the dogs: high plank on straight arms, feet slid back. */
function dogPlank(): Pose {
  return {
    pelvis: [-19.4, -86.7],
    chest: [53, -120],
    head: [106, -134],
    hands: { near: DOG_HANDS, far: [DOG_HANDS[0] - 2, 0] },
    feet: { near: [-180, -19], far: [-180, -19] },
    toes: { near: 62, far: 62 },
  };
}

/** Upward dog: arms straight, chest up, hips near the floor, tops of the feet down. */
function upDog(): Pose {
  return {
    pelvis: [16, -42],
    chest: [58, -110],
    spine: { bend: 1 },
    head: [74, -163],
    hands: { near: DOG_HANDS, far: [DOG_HANDS[0] - 2, 0] },
    feet: { near: [-153, -4], far: [-153, -4] },
    toes: { near: 180, far: 180 },
  };
}

// ---------------------------------------------------------------- wall walk-up

const WALL_FEET_X = -194;

/** Plank with the feet on a wall behind them; `theta` is the shoulder-to-feet line above horizontal (-23 = plank). */
function wallWalk(theta: number): Pose {
  const t = (theta * Math.PI) / 180;
  const u: Point = [Math.cos(t), Math.sin(t)];
  const hx = WALL_FEET_X + 272 * u[0];
  const shoulder: Point = [hx, -126];
  const from = (back: number): Point => [round(shoulder[0] - back * u[0]), round(shoulder[1] - back * u[1])];
  const chest = from(18);
  const flat = theta < -20;
  return {
    pelvis: from(98),
    chest,
    head: along(chest, Math.min(theta + 10, 40), 56),
    hands: { near: [round(hx), 0], far: [round(hx - 1), 0] },
    feet: { near: flat ? [-193, -17.5] : from(272), far: flat ? [-193, -17.5] : from(272) },
    toes: { near: flat ? 62 : -90, far: flat ? 62 : -90 },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
  };
}

// ---------------------------------------------------------------- push-up plus

/** High plank, arms locked; the upper back rounds as the floor is pushed away, then the chest sinks between the blades. */
function pushUpPlus(plus: boolean): Pose {
  return {
    pelvis: [-30, -91.5],
    chest: plus ? [41, -123] : [43, -116],
    spine: { bend: plus ? -1 : 1 },
    head: plus ? [96, -119.5] : [96, -129.5],
    hands: { near: [60, 0], far: [59, 0] },
    feet: { near: [-189, -22], far: [-189, -22] },
    toes: { near: 62, far: 62 },
  };
}

// ---------------------------------------------------------------- assisted pistol

/** Standing on the near leg holding a post behind; the free leg stays straight out in front. */
function assistedPistol(depth: 0 | 1): Pose {
  const pelvis: Point = depth ? [-34, -112] : [-14, -172];
  const chest: Point = depth ? along(pelvis, -68, 80) : [pelvis[0] + 4, pelvis[1] - 80];
  return {
    pelvis,
    chest,
    hands: { near: [-106, -200], far: [depth ? 70 : 84, depth ? -150 : -226] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [10, 0], far: along(pelvis, depth ? -4 : 65, 172) },
    toes: { near: 0, far: -70 },
  };
}

// ---------------------------------------------------------------- chest-to-wall handstand

const CTW_WALL_X = 34;

/** Handstand facing the wall: hands 28 units off it, chest and toes lightly on its face. */
function chestToWall(sway: 0 | 1): Pose {
  const hand: Point = [6, 0];
  const shoulder: Point = sway ? [24, -124] : [26, -124];
  const dir = sway ? -89.2 : -89.6;
  const pelvis = along(shoulder, dir, 98);
  const chest = along(pelvis, dir + 180, 80);
  return {
    pelvis,
    chest,
    head: sway ? [-4, -96] : [-5, -98],
    hands: { near: hand, far: [hand[0] - 2, 0] },
    feet: { near: along(pelvis, dir, 174), far: along(pelvis, dir, 174) },
    toes: { near: -72, far: -72 },
  };
}

// ---------------------------------------------------------------- single-leg balance, eyes open

const BALANCE_STEPS = [
  { pelvis: [1, -168], thigh: 45, shin: 120, toe: 30, near: [120, -268], far: [-120, -268] },
  { pelvis: [-2, -169], thigh: 24, shin: 32, toe: 10, near: [118, -246], far: [-118, -286] },
  { pelvis: [1, -168], thigh: 100, shin: 150, toe: 120, near: [112, -296], far: [-122, -240] },
] as const;

function balanceOpen(step: 0 | 1 | 2): Pose {
  const { pelvis, thigh, shin, toe, near, far } = BALANCE_STEPS[step];
  const knee = along(pelvis, thigh, 88);
  return {
    pelvis,
    chest: [pelvis[0], pelvis[1] - 80],
    hands: { near, far },
    knees: { far: { at: knee } },
    feet: { near: [0, 0], far: along(knee, shin, 86) },
    toes: { near: 0, far: toe },
  };
}

export const WARMUP_DRILL_SPECS: DoodleSpec[] = [
  {
    id: "ntc_jumping_jacks",
    slug: "jumping-jacks",
    title: "Jumping jacks",
    view: "front",
    transition: 0.25,
    frames: [
      { hold: 0.15, pose: jack(false) },
      { hold: 0.15, pose: jack(true) },
    ],
  },
  {
    id: "hf_158",
    slug: "90-90-hip-switch",
    title: "90/90 Hip Switch",
    view: "front",
    transition: 1,
    frames: [
      { hold: 0.5, pose: hipSwitch(true) },
      { hold: 0.5, pose: hipSwitch(false) },
    ],
  },
  {
    id: "hf_157",
    slug: "deep-squat-hold",
    title: "Deep Squat Hold",
    transition: 0.7,
    frames: [
      { hold: 0.6, pose: deepSquat(-36) },
      { hold: 0.6, pose: deepSquat(-28) },
    ],
  },
  {
    id: "wger_1202",
    slug: "side-lying-hip-abduction",
    title: "Side Lying Hip Abduction",
    view: "front",
    props: [SIDE_LYING_FLOOR],
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: hipAbduction(4) },
      { hold: 0.5, pose: hipAbduction(-40) },
    ],
  },
  {
    id: "wger_2667",
    slug: "single-leg-balance-eyes-closed",
    title: "Single-Leg Balance with Eyes Closed",
    transition: 1.4,
    frames: [
      { hold: 0.6, pose: balance(0) },
      { hold: 0.6, pose: balance(1) },
    ],
  },
  {
    id: "hf_154",
    slug: "cat-cow",
    title: "Cat-Cow",
    transition: 1.2,
    frames: [
      { hold: 0.4, pose: cow() },
      { hold: 0.4, pose: cat() },
    ],
  },
  {
    id: "hf_100",
    slug: "side-plank",
    title: "Side Plank",
    transition: 1.6,
    frames: [
      { hold: 1.2, pose: sidePlank(-48) },
      { hold: 1.2, pose: sidePlank(-58) },
    ],
  },
  {
    id: "hf_103",
    slug: "hollow-body-rock",
    title: "Hollow Body Rock",
    transition: 0.8,
    frames: [
      { hold: 0.2, pose: hollow(true) },
      { hold: 0.2, pose: hollow(false) },
    ],
  },
  {
    id: "wger_2680",
    slug: "wrist-rocks",
    title: "Wrist rocks",
    transition: 1.2,
    frames: [
      { hold: 0.4, pose: rockBack() },
      { hold: 0.5, pose: rockForward() },
    ],
  },
  {
    id: "hf_152",
    slug: "wall-angel",
    title: "Wall Angel",
    view: "front",
    transition: 1.2,
    frames: [
      { hold: 0.4, pose: wallAngel(false) },
      { hold: 0.5, pose: wallAngel(true) },
    ],
  },
  {
    id: "ntc_arm_circles",
    slug: "arm-circles",
    title: "Arm circles",
    view: "front",
    transition: 0.25,
    frames: [
      { hold: 0.05, pose: armCircle(124, 0) },
      { hold: 0.05, pose: armCircle(118, -32) },
      { hold: 0.05, pose: armCircle(108, 0) },
      { hold: 0.05, pose: armCircle(118, 32) },
    ],
  },
  {
    id: "wger_578",
    slug: "side-lying-external-rotation",
    title: "Side-lying External Rotation",
    view: "front",
    props: [SIDE_LYING_FLOOR],
    transition: 1.1,
    frames: [
      { hold: 0.4, pose: externalRotation(40) },
      { hold: 0.5, pose: externalRotation(-90) },
    ],
  },
  {
    id: "ntc_prone_ytw",
    slug: "prone-y-t-w-raise",
    title: "Prone Y-T-W raise",
    view: "front",
    transition: 0.8,
    frames: [
      // Seen from above the lift itself is invisible, so the arms hold each letter in turn.
      { hold: 0.7, pose: proneFromAbove(35) },
      { hold: 0.7, pose: proneFromAbove(90) },
      { hold: 0.7, pose: proneW() },
    ],
  },
  {
    id: "fedb_incline_push_up",
    slug: "incline-push-up",
    title: "Incline Push-Up",
    props: [{ kind: "box", x: 60, y: -90, w: 90, h: 90 }],
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: incline(-216) },
      { hold: 0.4, pose: incline(-176) },
    ],
  },
  {
    id: "hf_169",
    slug: "worlds-greatest-stretch",
    title: "World's Greatest Stretch",
    transition: 1.1,
    frames: [
      { hold: 0.5, pose: wgsLunge() },
      { hold: 0.6, pose: wgsReach() },
      { hold: 0.05, pose: wgsSwing() },
      { hold: 0.5, pose: wgsHamstring() },
    ],
  },
  {
    id: "ntc_toy_soldiers",
    slug: "toy-soldiers",
    title: "Toy soldiers",
    transition: 0.35,
    frames: [
      { hold: 0.15, pose: toySoldier("far") },
      { hold: 0.05, pose: toySoldier(null) },
      { hold: 0.15, pose: toySoldier("near") },
      { hold: 0.05, pose: toySoldier(null) },
    ],
  },
  {
    id: "ntc_reach_and_touch",
    slug: "reach-and-touch",
    title: "Reach and touch",
    transition: 0.5,
    frames: [
      { hold: 0.1, pose: reachTouch("up") },
      { hold: 0, pose: reachTouch("high") },
      { hold: 0, pose: reachTouch("front") },
      { hold: 0.1, pose: reachTouch("down") },
      { hold: 0, pose: reachTouch("front") },
      { hold: 0, pose: reachTouch("high") },
    ],
  },
  {
    id: "ntc_downdog_updog_switch",
    slug: "downdog-updog-switch",
    title: "Downdog/updog switch",
    transition: 1.4,
    frames: [
      { hold: 0.5, pose: downDog() },
      { hold: 0, pose: dogPlank() },
      { hold: 0.5, pose: upDog() },
      { hold: 0, pose: dogPlank() },
    ],
  },
  {
    id: "ntc_wall_walk_up",
    slug: "wall-walk-up",
    title: "Wall walk-up",
    props: [{ kind: "box", x: -222, y: -470, w: 14, h: 470 }],
    transition: 1.1,
    frames: [
      { hold: 0.4, pose: wallWalk(-23) },
      { hold: 0.2, pose: wallWalk(20) },
      { hold: 0.6, pose: wallWalk(60) },
      { hold: 0.2, pose: wallWalk(20) },
    ],
  },
  {
    id: "ntc_push_up_plus",
    slug: "push-up-plus",
    title: "Push-up plus",
    transition: 0.8,
    frames: [
      { hold: 0.4, pose: pushUpPlus(true) },
      { hold: 0.4, pose: pushUpPlus(false) },
    ],
  },
  {
    id: "ntc_assisted_pistol",
    slug: "assisted-pistol",
    title: "Assisted pistol squat",
    props: [{ kind: "box", x: -126, y: -470, w: 14, h: 470 }],
    transition: 1.3,
    frames: [
      { hold: 0.4, pose: assistedPistol(0) },
      { hold: 0.5, pose: assistedPistol(1) },
    ],
  },
  {
    id: "ntc_chest_to_wall_handstand",
    slug: "chest-to-wall-handstand",
    title: "Chest-to-wall handstand",
    props: [{ kind: "box", x: CTW_WALL_X, y: -470, w: 14, h: 470 }],
    transition: 1.8,
    frames: [
      { hold: 1, pose: chestToWall(0) },
      { hold: 1, pose: chestToWall(1) },
    ],
  },
  {
    id: "ntc_single_leg_balance",
    slug: "single-leg-balance",
    title: "Single-leg balance",
    transition: 1,
    frames: [
      { hold: 0.4, pose: balanceOpen(0) },
      { hold: 0.4, pose: balanceOpen(1) },
      { hold: 0.4, pose: balanceOpen(0) },
      { hold: 0.4, pose: balanceOpen(2) },
    ],
  },
];

