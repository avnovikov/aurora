import { solvePose } from "./rig";
import type { DoodleSpec, Point, Pose } from "./rig";

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

function hipSwitch(kneesRight: boolean): Pose {
  // Feet slide across the floor so both knees fall from one side to the other.
  return {
    pelvis: [0, -12],
    chest: [0, -92],
    hands: { near: [-48, -4], far: [48, -4] },
    feet: kneesRight ? { near: [-50, -4], far: [95, -4] } : { near: [-95, -4], far: [50, -4] },
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    toes: { near: 0, far: 0 },
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

// ---------------------------------------------------------------- side lying (head left, legs right)

function sideLying(extra: Pose): Pose {
  return {
    pelvis: [0, -18],
    chest: [-80, -18],
    head: [-134, -30],
    spine: { bend: -1 },
    ...extra,
  };
}

/** Bottom leg bent for support: thigh up and forward, shin back down to the floor. */
const BENT_KNEE: Point = along([0, -18], -28, 88);
const BENT_FOOT: Point = along(BENT_KNEE, 42, 86);
const BENT_KNEE_FAR: Point = along([0, -18], -31, 88);
const BENT_FOOT_FAR: Point = along(BENT_KNEE_FAR, 40, 86);

function hipAbduction(deg: number): Pose {
  const pelvis: Point = [0, -18];
  return sideLying({
    hands: { near: [-44, -76], far: [-48, -72] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: BENT_KNEE } },
    feet: { near: BENT_FOOT, far: along(pelvis, deg, 173.9) },
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

// ---------------------------------------------------------------- open book / external rotation

function openBook(stage: 0 | 1 | 2): Pose {
  const nearHands: Point[] = [
    [-44, -76],
    [-95, -142],
    [-150, -100],
  ];
  const hands: Pose["hands"] = { near: nearHands[stage], far: [-48, -72] };
  return sideLying({
    chest: stage === 2 ? [-78, -26] : [-80, -18],
    hands,
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: BENT_KNEE }, far: { at: BENT_KNEE_FAR } },
    feet: { near: BENT_FOOT, far: BENT_FOOT_FAR },
    toes: { near: 0, far: 0 },
  });
}

function externalRotation(foreDeg: number): Pose {
  const shoulder: Point = [-98, -18];
  const elbow = along(shoulder, 12, 60);
  return sideLying({
    hands: { near: along(elbow, foreDeg, 66), far: [-48, -72] },
    elbows: { near: { at: elbow }, far: { bend: 1 } },
    knees: { near: { at: BENT_KNEE }, far: { at: BENT_KNEE_FAR } },
    feet: { near: BENT_FOOT, far: BENT_FOOT_FAR },
    toes: { near: 0, far: 0 },
  });
}

// ---------------------------------------------------------------- prone Y-T-W

function proneBase(): Pose {
  const pelvis: Point = [-20, -12];
  return {
    pelvis,
    chest: chestToward(pelvis, [78, -12]),
    head: [114, -24],
    feet: { near: [-194, -6], far: [-194, -6] },
    toes: { near: 180, far: 180 },
  };
}

function proneShoulder(): Point {
  return solvePose(proneBase()).arms.near.root;
}

function proneY(): Pose {
  const s = proneShoulder();
  return {
    ...proneBase(),
    hands: { near: along(s, -58, 126), far: [141, -121.1] },
    elbows: { near: { at: [109.8, -62.9] }, far: { at: [108, -64] } },
  };
}

function proneT(): Pose {
  const s = proneShoulder();
  return {
    ...proneBase(),
    hands: { near: along(s, -125, 124), far: along(s, -127, 124) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

function proneW(): Pose {
  const s = proneShoulder();
  const elbow = along(s, -70, 60);
  const hand = along(elbow, -160, 66);
  return {
    ...proneBase(),
    hands: { near: hand, far: hand },
    elbows: { near: { at: elbow }, far: { at: elbow } },
  };
}

function proneRest(): Pose {
  const s = proneShoulder();
  return {
    ...proneBase(),
    hands: { near: [round(s[0] - 120), -8], far: [round(s[0] - 122), -8] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
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
    transition: 1.4,
    frames: [
      { hold: 0.6, pose: deepSquat(-36) },
      { hold: 0.6, pose: deepSquat(-28) },
    ],
  },
  {
    id: "wger_1202",
    slug: "side-lying-hip-abduction",
    title: "Side Lying Hip Abduction",
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: hipAbduction(-4) },
      { hold: 0.5, pose: hipAbduction(-38) },
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
    id: "hf_167",
    slug: "wrist-circles",
    title: "Wrist Circles",
    transition: 0.9,
    frames: [
      { hold: 0.2, pose: allFours() },
      { hold: 0.3, pose: rockForward() },
      { hold: 0.2, pose: allFours() },
      { hold: 0.3, pose: rockBack() },
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
    id: "wger_1822",
    slug: "open-book",
    title: "Open Book",
    transition: 1,
    frames: [
      { hold: 0.4, pose: openBook(0) },
      { hold: 0.2, pose: openBook(1) },
      { hold: 0.5, pose: openBook(2) },
    ],
  },
  {
    id: "wger_578",
    slug: "side-lying-external-rotation",
    title: "Side-lying External Rotation",
    transition: 1.1,
    frames: [
      { hold: 0.4, pose: externalRotation(0) },
      { hold: 0.5, pose: externalRotation(-80) },
    ],
  },
  {
    id: "ntc_prone_ytw",
    slug: "prone-y-t-w-raise",
    title: "Prone Y-T-W raise",
    transition: 0.8,
    frames: [
      { hold: 0.3, pose: proneRest() },
      { hold: 0.4, pose: proneY() },
      { hold: 0.3, pose: proneRest() },
      { hold: 0.4, pose: proneT() },
      { hold: 0.3, pose: proneRest() },
      { hold: 0.4, pose: proneW() },
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
];
