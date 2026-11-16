import type { DoodleSpec, Point, Pose } from "./rig";

/** Cool-down and mobility stretches (static holds). Import only from ./rig — never from ./specs (that would be circular). */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [
    round(from[0] + Math.cos(r) * length),
    round(from[1] + Math.sin(r) * length),
  ];
}

const WALL: { kind: "box"; x: number; y: number; w: number; h: number } = {
  kind: "box",
  x: 156,
  y: -340,
  w: 14,
  h: 340,
};

/** Staggered stance, hands on the wall, back leg straight with the heel down; `lean` is the body line's angle from the floor. */
function wallLean(lean: number, frontFoot: number, handY: number): Pose {
  const backAnkle: Point = [-112, 0];
  const pelvis = along(backAnkle, -lean, 172);
  return {
    pelvis,
    chest: along(pelvis, -lean, 80),
    hands: { near: [153, handY], far: [153, handY + 6] },
    feet: { near: [frontFoot, 0], far: backAnkle },
    toes: { near: 0, far: 0 },
  };
}

/** Half-kneeling lunge: back knee and shin on the floor, front foot flat, hips drifting forward with a tucked pelvis. */
function hipFlexor(pelvisX: number): Pose {
  const pelvis: Point = [
    pelvisX,
    -(round(Math.sqrt(88 * 88 - (pelvisX + 30) ** 2)) + 3),
  ];
  return {
    pelvis,
    chest: [pelvis[0] - 4, pelvis[1] - 80],
    hands: {
      near: [pelvis[0] + 50, pelvis[1] - 40],
      far: [pelvis[0] + 44, pelvis[1] - 40],
    },
    knees: { near: { bend: -1 }, far: { at: [-30, -3] } },
    feet: { near: [pelvis[0] + 86, 0], far: [-116, -3] },
    toes: { near: 0, far: 180 },
  };
}

/** Face down, legs straight; hands under the shoulders and the chest pressed up. */
function cobra(shoulderY: number, dx: number): Pose {
  const pelvis: Point = [-20, -12];
  const chest = along(
    pelvis,
    Math.atan2(shoulderY + 12, 98) * (180 / Math.PI) * 1,
    78,
  );
  const shoulder = along(
    pelvis,
    Math.atan2(shoulderY + 12, 98) * (180 / Math.PI),
    98,
  );
  return {
    pelvis,
    chest,
    spine: { bend: 1 },
    hands: {
      near: [round(shoulder[0] + dx), -2],
      far: [round(shoulder[0] + dx - 3), -2],
    },
    feet: { near: [-194, -6], far: [-194, -6] },
    toes: { near: 180, far: 180 },
  };
}

/** Kneeling with the hips on the heels, forehead down and arms long on the floor. */
function childsPose(breathe: number): Pose {
  // Straight arms pivot about the shoulder: the hands lift a little off the floor and come back.
  const shoulder: Point = [44.9, -67.8];
  const angle = ((30.5 - breathe * 6) * Math.PI) / 180;
  const elbow: Point = [
    round(shoulder[0] + Math.cos(angle) * 59.7),
    round(shoulder[1] + Math.sin(angle) * 59.7),
  ];
  const hand: Point = breathe
    ? [
        round(shoulder[0] + Math.cos(angle) * 125.6),
        round(shoulder[1] + Math.sin(angle) * 125.6),
      ]
    : [153.1, -4];
  return {
    pelvis: [-48, -43],
    chest: [27, -66],
    head: [56, -24],
    hands: { near: hand, far: hand },
    elbows: {
      near: { at: breathe ? elbow : [96.6, -37.3] },
      far: { at: breathe ? elbow : [96.6, -37.3] },
    },
    knees: { near: { at: [30, -3] }, far: { at: [30, -3] } },
    feet: { near: [-56, -3], far: [-56, -3] },
    toes: { near: 180, far: 180 },
  };
}

/**
 * Standing, the near arm straight out at shoulder height; the wrist bends so
 * the fingers point `wrist` degrees (0 = in line, 90 = straight down, more =
 * drawn back towards the body) and the other hand holds the fingers.
 */
function wristStretch(wrist: number): Pose {
  const pelvis: Point = [0, -170];
  // Shoulder at [0, -268]; forearm end (wrist) 118 straight ahead of it.
  const wristJoint: Point = [117.9, -268];
  const r = (wrist * Math.PI) / 180;
  const fingers: Point = [round(wristJoint[0] + 8 * Math.cos(r)), round(wristJoint[1] + 8 * Math.sin(r))];
  // The other hand cups the fingers from in front (kept within an arm's reach of its shoulder).
  const grip: Point = [fingers[0] + 3, fingers[1] + 2];
  const reach = Math.hypot(grip[0], grip[1] + 268);
  const far: Point = reach > 121 ? [round((grip[0] * 121) / reach), round(-268 + ((grip[1] + 268) * 121) / reach)] : grip;
  return {
    pelvis,
    chest: [0, -250],
    hands: { near: wristJoint, far },
    wrists: { near: wrist },
    feet: { near: [0, 0], far: [-4, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Kneeling, palms flat with the fingers turned back, then the hips sit back over the heels. */
function forearmStretch(back: number): Pose {
  const pelvisX = -35 - back;
  const pelvis: Point = [
    pelvisX,
    -(round(Math.sqrt(88 * 88 - (pelvisX + 30) ** 2)) + 3),
  ];
  return {
    pelvis,
    hands: { near: [30, 0], far: [26, 0] },
    knees: { near: { at: [-30, -3] }, far: { at: [-30, -3] } },
    feet: { near: [-116, -3], far: [-116, -3] },
    toes: { near: 180, far: 180 },
  };
}

/**
 * Doorway seen from the front: the figure stands in it, already stepped
 * through, so the frame is behind and beside the shoulders. A side view can't
 * show this: a forearm up the frame behind the shoulder draws as an elbow
 * bending backwards.
 */
const DOOR: { kind: "box"; x: number; y: number; w: number; h: number } = {
  kind: "box",
  x: -88,
  y: -430,
  w: 176,
  h: 430,
};

/** Near forearm vertical on the frame, elbow at shoulder height; the free arm hangs (`sway` drifts it a little while holding). */
function doorwayPec(sway: number): Pose {
  const shoulderY = -272;
  const elbow: Point = [-82, shoulderY];
  return {
    pelvis: [0, -174],
    chest: [0, -254],
    hands: { near: [elbow[0], shoulderY - 66], far: [36 + sway, -150] },
    elbows: { near: { at: elbow }, far: { bend: -1 } },
    feet: { near: [-16, 0], far: [16, 0] },
    toes: { near: 180, far: 0 },
  };
}

export const STRETCH_SPECS: DoodleSpec[] = [
  {
    id: "fedb_calf_stretch_hands_against_wall",
    slug: "calf-stretch-hands-against-wall",
    title: "Calf stretch hands against wall",
    props: [WALL],
    transition: 1.4,
    frames: [
      { hold: 0.5, pose: wallLean(56, 30, -215) },
      { hold: 1.2, pose: wallLean(50, 30, -215) },
      { hold: 1.2, pose: wallLean(53, 30, -215) },
    ],
  },
  {
    id: "wger_1239",
    slug: "standing-calf-stretch",
    title: "Standing calf stretch",
    props: [WALL],
    transition: 1.4,
    frames: [
      { hold: 0.5, pose: wallLean(55, 56, -235) },
      { hold: 1.2, pose: wallLean(49, 56, -235) },
      { hold: 1.2, pose: wallLean(55, 56, -235) },
    ],
  },
  {
    id: "fedb_kneeling_hip_flexor",
    slug: "kneeling-hip-flexor",
    title: "Kneeling hip flexor",
    transition: 1.5,
    frames: [
      { hold: 0.5, pose: hipFlexor(-24) },
      { hold: 1.2, pose: hipFlexor(10) },
      { hold: 1.2, pose: hipFlexor(2) },
    ],
  },
  {
    id: "hf_165",
    slug: "cobra-stretch",
    title: "Cobra stretch",
    transition: 1.5,
    frames: [
      { hold: 0.5, pose: cobra(-30, 117) },
      { hold: 1.2, pose: cobra(-102, 14) },
      { hold: 1.2, pose: cobra(-92, 14) },
    ],
  },
  {
    id: "fedb_childs_pose",
    slug: "childs-pose",
    title: "Child's pose",
    transition: 1.8,
    frames: [
      { hold: 0.5, pose: childsPose(0) },
      { hold: 1.2, pose: childsPose(0) },
      { hold: 1.2, pose: childsPose(1) },
    ],
  },
  {
    id: "wger_2686",
    slug: "wrist-stretch",
    title: "Wrist stretch",
    transition: 1.2,
    frames: [
      { hold: 0.6, pose: wristStretch(10) },
      { hold: 1.8, pose: wristStretch(112) },
    ],
  },
  {
    id: "fedb_kneeling_forearm_stretch",
    slug: "kneeling-forearm-stretch",
    title: "Kneeling forearm stretch",
    transition: 1.6,
    frames: [
      { hold: 0.5, pose: forearmStretch(0) },
      { hold: 1.2, pose: forearmStretch(52) },
      { hold: 1.2, pose: forearmStretch(44) },
    ],
  },
  {
    id: "wger_1713",
    slug: "doorway-pectoral-stretch",
    title: "Doorway pectoral stretch",
    view: "front",
    props: [DOOR],
    transition: 1.2,
    frames: [
      { hold: 1.2, pose: doorwayPec(0) },
      { hold: 1.2, pose: doorwayPec(-4) },
    ],
  },
];
