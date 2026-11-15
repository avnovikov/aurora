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

/** Standing, one arm straight out at shoulder height, fingers drawn back by the other hand. */
function wristStretch(pull: number, breathe: number): Pose {
  const pelvis: Point = [0, -170];
  return {
    pelvis,
    chest: [0 + breathe, -250],
    hands: { near: [122, -262], far: [round(124 - pull), -258] },
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

const ALL_FOURS_PELVIS: Point = [-50, -92];
const ALL_FOURS_LEGS = {
  feet: { near: [-136, -4], far: [-132, -4] } as Pose["feet"],
  toes: { near: 180, far: 180 } as Pose["toes"],
};

const DOOR: { kind: "box"; x: number; y: number; w: number; h: number } = {
  kind: "box",
  x: 62,
  y: -400,
  w: 14,
  h: 400,
};

/** Forearm up the door frame, elbow at shoulder height, stepping through. */
function doorwayPec(sx: number, sy: number): Pose {
  const pelvis: Point = [sx, sy + 98];
  return {
    pelvis,
    chest: [sx, sy + 18],
    hands: { near: [52, -334], far: [52, -334] },
    elbows: { near: { at: [52, -268] }, far: { at: [52, -268] } },
    feet: { near: [34, 0], far: [-50, 0] },
    toes: { near: 0, far: 0 },
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
      { hold: 0.5, pose: wristStretch(0, 0) },
      { hold: 1.2, pose: wristStretch(10, 4) },
      { hold: 1.2, pose: wristStretch(14, -2) },
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
    id: "ntc_thread_the_needle",
    slug: "thread-the-needle",
    title: "Thread the needle",
    transition: 1.4,
    frames: [
      {
        hold: 0.4,
        pose: {
          pelvis: ALL_FOURS_PELVIS,
          hands: { near: [48, 0], far: [44, 0] },
          ...ALL_FOURS_LEGS,
        },
      },
      {
        hold: 0.6,
        pose: {
          pelvis: ALL_FOURS_PELVIS,
          chest: [26, -66],
          hands: { near: [-25, -4], far: [44, 0] },
          ...ALL_FOURS_LEGS,
        },
      },
      {
        hold: 0.3,
        pose: {
          pelvis: ALL_FOURS_PELVIS,
          chest: [28, -84],
          hands: { near: [-70, -100], far: [44, 0] },
          elbows: { near: { bend: 1 } },
          ...ALL_FOURS_LEGS,
        },
      },
      {
        hold: 0.3,
        pose: {
          pelvis: ALL_FOURS_PELVIS,
          chest: [30, -94],
          hands: { near: [-40, -180], far: [44, 0] },
          elbows: { near: { bend: 1 } },
          ...ALL_FOURS_LEGS,
        },
      },
      {
        hold: 0.8,
        pose: {
          pelvis: ALL_FOURS_PELVIS,
          chest: [30, -100],
          hands: { near: [40, -226], far: [44, 0] },
          elbows: { near: { bend: 1 } },
          ...ALL_FOURS_LEGS,
        },
      },
      {
        hold: 0.1,
        pose: {
          pelvis: ALL_FOURS_PELVIS,
          chest: [30, -94],
          hands: { near: [-40, -180], far: [44, 0] },
          elbows: { near: { bend: 1 } },
          ...ALL_FOURS_LEGS,
        },
      },
      {
        hold: 0.1,
        pose: {
          pelvis: ALL_FOURS_PELVIS,
          chest: [28, -84],
          hands: { near: [-70, -100], far: [44, 0] },
          elbows: { near: { bend: 1 } },
          ...ALL_FOURS_LEGS,
        },
      },
    ],
  },
  {
    id: "wger_1713",
    slug: "doorway-pectoral-stretch",
    title: "Doorway pectoral stretch",
    props: [DOOR],
    transition: 1.4,
    frames: [
      { hold: 0.5, pose: doorwayPec(-8, -266) },
      { hold: 1.2, pose: doorwayPec(-6.8, -256) },
      { hold: 1.2, pose: doorwayPec(-7.6, -261) },
    ],
  },
];
