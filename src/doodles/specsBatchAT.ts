import { BONES, solvePose, type DoodleSpec, type Keyframe, type Point, type Pose } from "./rig";

/**
 * Batch AT (#212): kettlebell squats, presses, windmills, floor presses and the
 * Turkish get-up. Floor at y = 0, up is negative, side view faces +x.
 *
 *   goblet squat, front squat (two bells), thruster, pistol, jerk   side view
 *   windmills, side press                                           front view
 *     (the torso leans sideways, which the 3D rig's straight spine can't show,
 *     so the lean is drawn face-on)
 *   floor presses, Turkish get-up                                   side view, lying
 */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const kf = (pose: Pose, hold: number, extra: Partial<Keyframe> = {}): Keyframe => ({ pose, hold, ...extra });
const BENT = { near: { bend: 1 }, far: { bend: 1 } } as const;
const FLAT = { near: 0, far: 0 } as const;
const FEET: Pose["feet"] = { near: [6, 0], far: [0, 0] };

/** Straight spine from `pelvis` pointing `spine` degrees: the chest and the shoulder. */
function torso(pelvis: Point, spine: number): { chest: Point; shoulder: Point } {
  return { chest: along(pelvis, spine, 80), shoulder: along(pelvis, spine, 98) };
}

const off = (p: Point, dx: number, dy: number): Point => [round(p[0] + dx), round(p[1] + dy)];

// ---------------------------------------------------------------- squats, thruster, jerk (side view)

const STAND: Point = [0, -172];

/** A squat-family pose: pelvis, spine angle, hands relative to the shoulder (near, far). */
function squatPose(pelvis: Point, spine: number, near: Point, far: Point, extra: Partial<Pose> = {}): Pose {
  const { chest, shoulder } = torso(pelvis, spine);
  return {
    pelvis,
    chest,
    hands: { near: off(shoulder, near[0], near[1]), far: off(shoulder, far[0], far[1]) },
    elbows: BENT,
    feet: FEET,
    toes: FLAT,
    ...extra,
  };
}

/** Goblet: both hands on the horns in front of the chest. */
const GOBLET_HAND: Point = [34, 24];
const gobletStand = (): Pose => squatPose(STAND, -90, GOBLET_HAND, [GOBLET_HAND[0] - 2, GOBLET_HAND[1]]);
const gobletDeep = (): Pose => squatPose([-48, -66], -74, GOBLET_HAND, [GOBLET_HAND[0] - 2, GOBLET_HAND[1]]);

/** Two bells racked at the shoulders, elbows forward. */
const RACK_NEAR: Point = [32, -10];
const RACK_FAR: Point = [28, -6];
const rackStand = (): Pose => squatPose(STAND, -90, RACK_NEAR, RACK_FAR);
const rackDeep = (): Pose => squatPose([-48, -66], -78, RACK_NEAR, RACK_FAR);
/** Bells locked out overhead. */
const OVERHEAD_NEAR: Point = [4, -125.3];
const OVERHEAD_FAR: Point = [0, -125.3];
/** Eyes up at the bell: the head tips back so the locked arms stay clear of it. */
const WINDOW_HEAD: Point = [-22, -300];
/** Mid-press: the bells travel up in front of the face. */
const pressMid = (pelvis: Point = STAND): Pose => squatPose(pelvis, -90, [62, -88], [58, -84]);
const overheadStand = (): Pose => squatPose(STAND, -90, OVERHEAD_NEAR, OVERHEAD_FAR, { head: WINDOW_HEAD });

// One-arm jerk: bell in the near hand at the shoulder, far hand free.
const jerk = (pelvis: Point, near: Point, extra: Partial<Pose> = {}): Pose => squatPose(pelvis, -90, near, [4, 124], extra);

// ---------------------------------------------------------------- pistol with a bell

function pistol(depth: 0 | 1): Pose {
  const pelvis: Point = depth ? [-16, -38] : [-4, -172];
  const spine = depth ? -52 : -88;
  const { chest, shoulder } = torso(pelvis, spine);
  const leg = depth ? -6 : 66;
  return {
    pelvis,
    chest,
    hands: depth
      ? { near: off(shoulder, 80, -6), far: off(shoulder, 76, -6) }
      : { near: off(shoulder, 34, 24), far: off(shoulder, 32, 24) },
    elbows: BENT,
    feet: { near: [8, 0], far: along(pelvis, leg, 172) },
    toes: { near: 0, far: leg - 80 },
  };
}



// ---------------------------------------------------------------- floor presses (lying, side view)

const LYING_PELVIS: Point = [0, -20];
const LYING_CHEST: Point = [-77, -18];
const LYING_HEAD: Point = [-132, -24];

/**
 * Lying on the back, bell in the near hand, the far arm resting on the floor
 * beside the body. Down: the elbow on the floor with the forearm vertical
 * above it (the bell over the elbow); up: the arm locked out over the shoulder.
 * `legOver`: the working leg straight, crossed over the bent other leg.
 */
function floorPress(down: boolean, legOver: boolean): Pose {
  const base: Pose = { pelvis: LYING_PELVIS, chest: LYING_CHEST, head: LYING_HEAD, spine: { bend: -1 } };
  const [sx, sy] = solvePose(base).arms.near.root;
  const forearm = BONES.forearm + BONES.hand - 0.4;
  // Elbow on the floor, the upper arm lying along it towards the feet.
  const elbow: Point = [round(sx + Math.sqrt(BONES.upperArm ** 2 - (sy + 5) ** 2)), -5];
  const hand: Point = down ? [elbow[0], round(elbow[1] - forearm)] : [round(sx), round(sy - BONES.upperArm - forearm)];
  return {
    ...base,
    hands: { near: hand, far: [round(sx + Math.sqrt(125.3 ** 2 - (sy + 7) ** 2)), -7] },
    elbows: down ? { near: { at: elbow }, far: { bend: 1 } } : { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: legOver ? along(LYING_PELVIS, -9, 173.8) : [100, 0], far: [104, 0] },
    toes: legOver ? { far: 0 } : { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- Turkish get-up, lunge style (side view)

/** Bell arm straight, `tilt` degrees forward of vertical, from the near shoulder of `base`. */
function bellArm(base: Pose, tilt: number): Point {
  const [sx, sy] = solvePose(base).arms.near.root;
  return along([sx, sy], -90 + tilt, BONES.upperArm + BONES.forearm + BONES.hand - 0.4);
}

/** Far hand on the floor `reach` away from the far shoulder, arm straight (a post). */
function postHand(base: Pose, side: "behind" | "ahead"): Point {
  const [sx, sy] = solvePose(base).arms.far.root;
  const dx = Math.sqrt((BONES.upperArm + BONES.forearm + BONES.hand - 0.6) ** 2 - (sy + 4) ** 2);
  return [round(side === "behind" ? sx - dx : sx + dx), -4];
}

/** Lying on the back, bell arm vertical, near knee bent foot flat, far leg straight. */
function tguLying(): Pose {
  const base: Pose = { pelvis: LYING_PELVIS, chest: LYING_CHEST, head: LYING_HEAD, spine: { bend: -1 } };
  const [sx, sy] = solvePose(base).arms.near.root;
  return {
    ...base,
    hands: { near: bellArm(base, 0), far: [round(sx + Math.sqrt(125.3 ** 2 - (sy + 7) ** 2)), -7] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [86, 0], far: [172, -7] },
    toes: { near: 0, far: -80 },
  };
}

/** Up on the straight posting arm behind, torso reclined, bell arm vertical. */
function tguPost(): Pose {
  const pelvis: Point = [0, -20];
  const chest = along(pelvis, -112, 80);
  const base: Pose = { pelvis, chest };
  return {
    ...base,
    hands: { near: bellArm(base, 12), far: postHand(base, "behind") },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [66, 0], far: [172, -7] },
    toes: { near: 0, far: -80 },
  };
}

/** Hips lifted on the near foot and the post hand, free leg straight. */
function tguBridge(): Pose {
  const pelvis: Point = [10, -84];
  const chest = along(pelvis, -156, 80);
  const base: Pose = { pelvis, chest };
  return {
    ...base,
    hands: { near: bellArm(base, 14), far: postHand(base, "behind") },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [66, 0], far: [158, -7] },
    toes: { near: 0, far: -80 },
  };
}

/** Free leg swept back under the hips to a low lunge: far knee down, near foot forward, torso upright, post hand lifted. */
function tguLunge(): Pose {
  const pelvis: Point = [-8, -92];
  const chest = along(pelvis, -90, 80);
  const base: Pose = { pelvis, chest, head: off(chest, -22, -48) };
  return {
    ...base,
    hands: { near: bellArm(base, 16), far: [round(pelvis[0] + 34), round(pelvis[1] + 16)] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { far: { at: [-26, -6] } },
    feet: { near: [66, 0], far: [-112, -4] },
    toes: { near: 0, far: 180 },
  };
}

/** Standing, feet together, bell locked out overhead. */
function tguStand(): Pose {
  const chest = along(STAND, -90, 80);
  const base: Pose = { pelvis: STAND, chest, head: off(chest, -22, -48) };
  return {
    ...base,
    hands: { near: bellArm(base, 16), far: [4, -150] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: FEET,
    toes: FLAT,
  };
}

// ---------------------------------------------------------------- windmills and side press (front view)

const FRONT = { view: "front" as const };
const ARM_REACH = 125.4;

/** Unit vector up the spine when it leans `lean` degrees towards -x (the near side). */
const leanUp = (lean: number): Point => [-Math.sin((lean * Math.PI) / 180), -Math.cos((lean * Math.PI) / 180)];

interface WindmillSpec {
  pelvis: Point;
  /** Degrees the spine leans from upright, towards the near (-x) side. */
  lean: number;
  feet: { near: Point; far: Point };
  /** Free (near) hand: how far down the leg it reaches (null: hangs by the side). */
  reach: Point | null;
  /** Head tilt back towards the bell, degrees from the spine. */
  look?: number;
  /** Bell arm's elbow relative to the far shoulder (default: whichever way the solver folds it). */
  bellElbow?: Point;
  /** Bell hand relative to the far shoulder (default: straight up, locked out). */
  bellHand?: Point;
}

/** Overhead bell in the far hand, held straight up over the far shoulder; the near hand slides down the leg. */
function windmill(w: WindmillSpec): Pose {
  const up = leanUp(w.lean);
  const chest: Point = [round(w.pelvis[0] + up[0] * 80), round(w.pelvis[1] + up[1] * 80)];
  const base: Pose = { pelvis: w.pelvis, chest };
  const solved = solvePose(base, FRONT);
  const farShoulder = solved.arms.far.root;
  const nearShoulder = solved.arms.near.root;
  // The free arm stays straight, hanging or sliding down towards its target.
  const aim = w.reach ?? [round(nearShoulder[0] - 4), round(nearShoulder[1] + 124)];
  const gap = Math.hypot(aim[0] - nearShoulder[0], aim[1] - nearShoulder[1]);
  const k = Math.min(1, ARM_REACH / gap);
  const nearHand: Point = [round(nearShoulder[0] + (aim[0] - nearShoulder[0]) * k), round(nearShoulder[1] + (aim[1] - nearShoulder[1]) * k)];
  const neck: Point = [round(chest[0] + up[0] * 20), round(chest[1] + up[1] * 20)];
  const headAngle = (Math.atan2(up[1], up[0]) * 180) / Math.PI + (w.look ?? 0);
  return {
    pelvis: w.pelvis,
    chest,
    head: w.look === undefined ? undefined : along(neck, headAngle, 36),
    hands: { near: nearHand, far: off(farShoulder, ...(w.bellHand ?? [1, -ARM_REACH])) },
    feet: w.feet,
    toes: { near: 180, far: 0 },
    ...(w.bellElbow ? { elbows: { far: { at: off(farShoulder, ...w.bellElbow) } } } : {}),
  };
}

const WIDE_FEET = { near: [-40, 0] as Point, far: [56, 0] as Point };
const windmillTop = (): Pose =>
  windmill({ pelvis: [8, -168], lean: 0, feet: WIDE_FEET, reach: null });
const windmillMid = (): Pose =>
  windmill({ pelvis: [22, -166], lean: 34, feet: WIDE_FEET, reach: null, look: 28 });
const windmillLow = (): Pose =>
  windmill({ pelvis: [32, -160], lean: 56, feet: WIDE_FEET, reach: [-44, -20], look: 40 });

/**
 * Deep-windmill stance (double and advanced): the bell-side (far) leg is planted straight, so the hips
 * stay over it (pelvis a leg's length from the far foot) and the lead (near) knee is only soft. The
 * depth comes from the sideways lean, not from bending either knee.
 */
const DEEP_FEET = { near: [-62, 0] as Point, far: [116, 0] as Point };
const deepTop = (): Pose => windmill({ pelvis: [19, -140], lean: 0, feet: DEEP_FEET, reach: null });
const deepMid = (): Pose => windmill({ pelvis: [23, -143], lean: 36, feet: DEEP_FEET, reach: null, look: 28 });
const deepBottom = (reach: Point): Pose => windmill({ pelvis: [31, -144], lean: 82, feet: DEEP_FEET, reach, look: 50 });

const SIDE_FEET = { near: [-26, 0] as Point, far: [30, 0] as Point };
/** Side press: bell racked on the shoulder, then up and out to lockout with the torso tilting away. */
const PRESS_PELVIS: Point[] = [[0, -170], [0, -170], [4, -170], [9, -169]];
const PRESS_HAND: Point[] = [[-22, -8], [24, -4], [40, -80], [20, -123.5]];
const PRESS_ELBOW: Point[] = [[-16, 58], [7, 60], [58, -16], [18, -57]];
const sidePress = (stage: 0 | 1 | 2 | 3): Pose =>
  windmill({
    pelvis: PRESS_PELVIS[stage],
    lean: [0, 0, 5, 11][stage],
    feet: SIDE_FEET,
    reach: null,
    look: stage < 2 ? undefined : [0, 0, 6, 10][stage],
    bellHand: PRESS_HAND[stage],
    bellElbow: PRESS_ELBOW[stage],
  });

const FRONT_SPECS: DoodleSpec[] = [
  {
    id: "fedb_kettlebell_windmill",
    slug: "kettlebell-windmill",
    title: "Kettlebell Windmill",
    ...FRONT,
    kettlebell: { hands: ["far"], size: 14 },
    transition: 1.1,
    frames: [
      kf(windmillTop(), 0.5, { bell: "rack" }),
      kf(windmillMid(), 0, { bell: "rack" }),
      kf(windmillLow(), 0.5, { bell: "rack" }),
      kf(windmillMid(), 0, { bell: "rack" }),
    ],
  },
  {
    id: "fedb_double_kettlebell_windmill",
    slug: "double-kettlebell-windmill",
    title: "Double Kettlebell Windmill",
    ...FRONT,
    kettlebell: { hands: ["near", "far"], size: 14 },
    transition: 1.2,
    frames: [
      kf(deepTop(), 0.5, { bell: "rack" }),
      kf(deepMid(), 0, { bell: "rack" }),
      kf(deepBottom([-50, -4]), 0.6, { bell: "rack" }),
      kf(deepMid(), 0, { bell: "rack" }),
    ],
  },
  {
    id: "fedb_one_arm_kettlebell_military_press_to_the_side",
    slug: "one-arm-kettlebell-military-press-to-the-side",
    title: "One-Arm Kettlebell Military Press to the Side",
    ...FRONT,
    kettlebell: { hands: ["far"], size: 14 },
    transition: 0.8,
    frames: [
      kf(sidePress(1), 0.4, { bell: "rack" }),
      kf(sidePress(2), 0, { bell: "rack" }),
      kf(sidePress(3), 0.5, { bell: "rack" }),
      kf(sidePress(2), 0, { bell: "rack" }),
    ],
  },
  {
    id: "fedb_one_arm_kettlebell_floor_press",
    slug: "one-arm-kettlebell-floor-press",
    title: "One-Arm Kettlebell Floor Press",
    props: [{ kind: "floor" }],
    kettlebell: { hands: ["near"], size: 14 },
    transition: 0.9,
    frames: [kf(floorPress(true, false), 0.4, { bell: "rack" }), kf(floorPress(false, false), 0.5, { bell: "rack" })],
  },
  {
    id: "fedb_leg_over_floor_press",
    slug: "leg-over-floor-press",
    title: "Leg-Over Floor Press",
    props: [{ kind: "floor" }],
    kettlebell: { hands: ["near"], size: 14 },
    transition: 0.9,
    frames: [kf(floorPress(true, true), 0.4, { bell: "rack" }), kf(floorPress(false, true), 0.5, { bell: "rack" })],
  },
  {
    id: "fedb_kettlebell_turkish_get_up_lunge_style",
    slug: "kettlebell-turkish-get-up-lunge-style",
    title: "Kettlebell Turkish Get-Up (Lunge Style)",
    props: [{ kind: "floor" }],
    kettlebell: { hands: ["near"], size: 14 },
    transition: 0.8,
    frames: [
      kf(tguLying(), 0.5, { bell: "rack" }),
      kf(tguPost(), 0.3, { bell: "rack" }),
      kf(tguBridge(), 0.3, { bell: "rack" }),
      kf(tguLunge(), 0.4, { bell: "rack" }),
      kf(tguStand(), 0.6, { bell: "rack" }),
    ],
  },
  {
    id: "fedb_advanced_kettlebell_windmill",
    slug: "advanced-kettlebell-windmill",
    title: "Advanced Kettlebell Windmill",
    ...FRONT,
    kettlebell: { hands: ["far"], size: 14 },
    transition: 1.2,
    frames: [
      kf(deepTop(), 0.5, { bell: "rack" }),
      kf(deepMid(), 0, { bell: "rack" }),
      kf(deepBottom([-52, -2]), 0.6, { bell: "rack" }),
      kf(deepMid(), 0, { bell: "rack" }),
    ],
  },
];

export const BATCH_AT_SPECS: DoodleSpec[] = [
  {
    id: "fedb_goblet_squat",
    slug: "goblet-squat",
    title: "Goblet Squat",
    kettlebell: { hands: ["near"], size: 16 },
    transition: 1.1,
    frames: [kf(gobletStand(), 0.4), kf(gobletDeep(), 0.5)],
  },
  {
    id: "fedb_front_squats_with_two_kettlebells",
    slug: "front-squats-with-two-kettlebells",
    title: "Front Squats with Two Kettlebells",
    kettlebell: { hands: ["near", "far"], size: 14 },
    transition: 1.1,
    frames: [kf(rackStand(), 0.4, { bell: "rack" }), kf(rackDeep(), 0.5, { bell: "rack" })],
  },
  {
    id: "fedb_kettlebell_thruster",
    slug: "kettlebell-thruster",
    title: "Kettlebell Thruster",
    kettlebell: { hands: ["near", "far"], size: 14 },
    transition: 0.9,
    frames: [
      kf(rackStand(), 0.3, { bell: "rack" }),
      kf(rackDeep(), 0.4, { bell: "rack" }),
      kf(pressMid(), 0, { bell: "rack" }),
      kf(overheadStand(), 0.4, { bell: "rack" }),
    ],
  },
  {
    id: "fedb_kettlebell_pistol_squat",
    slug: "kettlebell-pistol-squat",
    title: "Kettlebell Pistol Squat",
    kettlebell: { hands: ["near"], size: 14 },
    transition: 1.3,
    frames: [kf(pistol(0), 0.4), kf(pistol(1), 0.5)],
  },
  {
    id: "fedb_one_arm_kettlebell_jerk",
    slug: "one-arm-kettlebell-jerk",
    title: "One-Arm Kettlebell Jerk",
    kettlebell: { hands: ["near"], size: 14 },
    transition: 0.5,
    frames: [
      kf(jerk(STAND, RACK_NEAR), 0.4, { bell: "rack" }),
      kf(jerk([-6, -138], RACK_NEAR), 0.15, { bell: "rack" }),
      kf(jerk(STAND, [62, -88]), 0, { bell: "rack" }),
      kf(jerk([-6, -138], OVERHEAD_NEAR, { head: [-28, -266] }), 0.2, { bell: "rack" }),
      kf(jerk(STAND, OVERHEAD_NEAR, { head: WINDOW_HEAD }), 0.5, { bell: "rack" }),
    ],
  },
  ...FRONT_SPECS,
];
