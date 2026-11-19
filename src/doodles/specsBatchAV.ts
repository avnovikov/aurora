import { solvePose } from "./rig";
import type { BellMode, DoodleSpec, Keyframe, Point, Pose, Side, Sideways } from "./rig";
import { solveKeyframe3 } from "./rig3d";
import { LOCKED_REACH, TWO_VIEWS } from "./sideways";

/**
 * Batch AV (#212): kettlebell moves that were blocked on gear and rig gaps:
 * the alternating hang cleans (a bell per hand, each with its own mode), the
 * pass-throughs (one bell changing hands: figure 8, between the legs, lunge
 * pass-through), the halos and overhead triceps extension (one bell held by
 * the horns) and the bent press (the torso leans sideways).
 *
 * Floor at y = 0, up is negative, the side-view figure faces +x; in the front
 * panel the near side (z < 0) is on the viewer's left. Import only from ./rig
 * and ./sideways, never ./specs.
 */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const BELL = 14;
const FLOOR: DoodleSpec["props"] = [{ kind: "floor" }];
/** Arm reach (shoulder to fingertip), a hair short so a straight arm draws straight. */
const REACH = 125.4;
const shoulderOf = (pelvis: Point, spine: number): Point => along(pelvis, spine, 98);
const chestOf = (pelvis: Point, spine: number): Point => along(pelvis, spine, 80);

// ---------------------------------------------------------------- alternating hang cleans (side view)

interface Stand {
  pelvis: Point;
  spine: number;
}
const TALL: Stand = { pelvis: [2, -172], spine: -90 };
/** Hinged, the bells hanging between the knees. */
const HINGE: Stand = { pelvis: [-52, -150], spine: -38 };
/** The shallow hinge at the changeover of the double clean. */
const DIP: Stand = { pelvis: [-26, -160], spine: -66 };

type ArmState = "hang" | "between" | "pull" | "rack";

/** One arm in a clean: hand pin and (for a bent arm) elbow pin, from its shoulder. */
function cleanArm(state: ArmState, shoulder: Point, side: Side): { hand: Point; elbow?: Point } {
  const slight = side === "near" ? 0 : -2;
  switch (state) {
    case "hang":
      return { hand: along(shoulder, 90 + slight, REACH) };
    case "between":
      return { hand: along(shoulder, (side === "near" ? 110 : 100), REACH) };
    case "pull": {
      const elbow = along(shoulder, 105, 60);
      return { hand: along(elbow, -50, 66), elbow };
    }
    case "rack": {
      const elbow = along(shoulder, 75, 60);
      return { hand: along(elbow, -68, 66), elbow };
    }
  }
}

function cleanPose(stand: Stand, near: ArmState, far: ArmState): Pose {
  const shoulder = shoulderOf(stand.pelvis, stand.spine);
  const a = cleanArm(near, shoulder, "near");
  const b = cleanArm(far, shoulder, "far");
  return {
    pelvis: stand.pelvis,
    chest: chestOf(stand.pelvis, stand.spine),
    hands: { near: a.hand, far: b.hand },
    elbows: { near: a.elbow ? { at: a.elbow } : { bend: 1 }, far: b.elbow ? { at: b.elbow } : { bend: 1 } },
    feet: { near: [4, 0], far: [-4, 0] },
    toes: { near: 0, far: 0 },
  };
}

const bells = (near: BellMode, far: BellMode): Keyframe["bell"] => ({ near, far });
const cleanFrame = (stand: Stand, near: ArmState, far: ArmState, hold: number, bell: Keyframe["bell"]): Keyframe => ({
  pose: cleanPose(stand, near, far),
  hold,
  bell,
});

const CLEAN_SPECS: DoodleSpec[] = [
  {
    id: "fedb_alternating_hang_clean",
    slug: "alternating-hang-clean",
    title: "Alternating Hang Clean",
    props: FLOOR,
    kettlebell: { hands: ["near", "far"], size: BELL },
    transition: 0.5,
    frames: [
      cleanFrame(HINGE, "between", "between", 0.3, bells("hang", "hang")),
      cleanFrame(TALL, "pull", "hang", 0, bells("swing", "hang")),
      cleanFrame(TALL, "rack", "hang", 0.45, bells("rack", "hang")),
      cleanFrame(HINGE, "between", "between", 0.3, bells("hang", "hang")),
      cleanFrame(TALL, "hang", "pull", 0, bells("hang", "swing")),
      cleanFrame(TALL, "hang", "rack", 0.45, bells("hang", "rack")),
    ],
  },
  {
    id: "fedb_double_kettlebell_alternating_hang_clean",
    slug: "double-kettlebell-alternating-hang-clean",
    title: "Double Kettlebell Alternating Hang Clean",
    props: FLOOR,
    kettlebell: { hands: ["near", "far"], size: BELL },
    transition: 0.5,
    frames: [
      cleanFrame(TALL, "rack", "hang", 0.4, bells("rack", "hang")),
      cleanFrame(DIP, "between", "pull", 0, bells("hang", "swing")),
      cleanFrame(TALL, "hang", "rack", 0.4, bells("hang", "rack")),
      cleanFrame(DIP, "pull", "between", 0, bells("swing", "hang")),
    ],
  },
];


// ---------------------------------------------------------------- passing the bell between the hands (two views)

/** Bent over, back flat, the feet wider than the shoulders: the stance of the figure 8 and the pass between the legs. */
const PASS_PELVIS: Point = [-62, -128];
const PASS_SPINE = -28;
const PASS_FEET_Z = 46;
type Hand3 = readonly [x: number, y: number, z: number];

/** One keyframe of a pass: where the near and far hands are (x, y in the side view, z sideways). */
function passFrame(near: Hand3, far: Hand3, hold: number, bellIn?: Side): Keyframe {
  const sideways: Sideways = {
    hands: { near: near[2], far: far[2] },
    feet: { near: -PASS_FEET_Z, far: PASS_FEET_Z },
    knees: { near: { out: 20 }, far: { out: 20 } },
    elbows: { near: { out: 55 }, far: { out: 55 } },
  };
  return {
    hold,
    ...(bellIn ? { bellIn } : {}),
    sideways,
    pose: {
      pelvis: PASS_PELVIS,
      chest: chestOf(PASS_PELVIS, PASS_SPINE),
      hands: { near: [near[0], near[1]], far: [far[0], far[1]] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      feet: { near: [14, 0], far: [14, 0] },
      toes: { near: 0, far: 0 },
    },
  };
}

/** Figure 8: the bell passes between the legs, front to back, then swings round the outside of the receiving hand's leg to the front. */
const FIGURE_8: Keyframe[] = [
  passFrame([14, -92, 0], [2, -92, 0], 0.1, "far"),
  passFrame([-6, -96, -14], [-26, -84, 58], 0, undefined),
  passFrame([-16, -96, -10], [40, -78, 40], 0, undefined),
  passFrame([-2, -92, 0], [12, -92, 0], 0.1, "near"),
  passFrame([-26, -84, -58], [-6, -96, 14], 0, undefined),
  passFrame([40, -78, -40], [-16, -96, 10], 0, undefined),
];

/** Pass between the legs: the bell swings in from one side, down between the legs to the hand behind, and out to the other side. */
const BETWEEN_LEGS: Keyframe[] = [
  passFrame([10, -112, -52], [-18, -96, 6], 0.1),
  passFrame([14, -84, 0], [2, -84, 0], 0.1, "far"),
  passFrame([-18, -96, -6], [10, -112, 52], 0.1),
  passFrame([2, -84, 0], [14, -84, 0], 0.1, "near"),
];

// ---------------------------------------------------------------- lunge pass-through (two views)

const LUNGE_PELVIS: Point = [0, -94];
const LUNGE_SPINE = -80;

function lungePose(front: Side | null): Pose {
  if (!front) {
    return {
      pelvis: TALL.pelvis,
      chest: chestOf(TALL.pelvis, TALL.spine),
      hands: { near: [12, -146], far: [-6, -146] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      feet: { near: [4, 0], far: [-4, 0] },
      toes: { near: 0, far: 0 },
    };
  }
  const back: Side = front === "near" ? "far" : "near";
  return {
    pelvis: LUNGE_PELVIS,
    chest: chestOf(LUNGE_PELVIS, LUNGE_SPINE),
    hands: { near: [40, -72], far: [36, -72] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    // The back knee hovers just off the floor, the heel up, the toes on the floor.
    knees: { [back]: { at: [-28, -10.6] } } as Pose["knees"],
    feet: { [front]: [80, 0], [back]: [-113.5, -20] } as Pose["feet"],
    toes: { [front]: 0, [back]: 78 } as Pose["toes"],
  };
}

/** The hands meet under the front thigh at z (the front hip's side). */
const lungeFrame = (front: Side | null, hold: number, bellIn: Side): Keyframe => {
  const z = front === "near" ? -8 : 8;
  return {
    pose: lungePose(front),
    hold,
    bellIn,
    ...(front === null ? {} : { sideways: { hands: { near: z, far: z } } }),
  };
};

const PASS_SPECS: DoodleSpec[] = [
  {
    id: "fedb_kettlebell_figure_8",
    slug: "kettlebell-figure-8",
    title: "Kettlebell Figure 8",
    views: TWO_VIEWS,
    props: FLOOR,
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.5,
    frames: FIGURE_8,
  },
  {
    id: "fedb_kettlebell_pass_between_the_legs",
    slug: "kettlebell-pass-between-the-legs",
    title: "Kettlebell Pass Between the Legs",
    views: TWO_VIEWS,
    props: FLOOR,
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.55,
    frames: BETWEEN_LEGS,
  },
  {
    id: "fedb_lunge_pass_through",
    slug: "lunge-pass-through",
    title: "Lunge Pass-Through",
    views: TWO_VIEWS,
    props: FLOOR,
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.7,
    frames: [lungeFrame(null, 0.3, "near"), lungeFrame("far", 0.25, "far"), lungeFrame(null, 0.3, "far"), lungeFrame("near", 0.25, "near")],
  },
];


// ---------------------------------------------------------------- by the horns: halos and overhead triceps extension (two views)

/** Standing tall, feet together; only the arms move. */
const HORNS_BASE: Pose = {
  pelvis: TALL.pelvis,
  chest: chestOf(TALL.pelvis, TALL.spine),
  feet: { near: [4, 0], far: [-4, 0] },
  toes: { near: 0, far: 0 },
};
/** The head's centre: x = 0, z = 0 (the halo circles it). */
const HALO_RADIUS = 54;

/**
 * Halo: both hands on the horns on a circle round the head, `theta` degrees
 * round it (0 = in front of the face, -90 = past the near ear, 180 = behind
 * the head), at about chin height, the elbows out.
 */
function haloFrame(theta: number, hold: number): Keyframe {
  const r = (theta * Math.PI) / 180;
  const front = (1 + Math.cos(r)) / 2;
  const radius = HALO_RADIUS - 12 * front;
  const x = round(Math.cos(r) * radius);
  const y = round(-270 + 14 * front);
  const z = round(Math.sin(r) * radius);
  const elbowOut = round(35 + 65 * (1 - front));
  return {
    hold,
    bell: "horns",
    sideways: { hands: { near: z, far: z }, elbows: { near: { out: elbowOut }, far: { out: elbowOut } } },
    pose: {
      ...HORNS_BASE,
      hands: { near: [x, y], far: [x, y] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
    },
  };
}

/**
 * Overhead triceps extension: the upper arms stay vertical beside the head
 * (elbows pinned over the shoulders), the head pushed a little forward to
 * clear them; only the forearms move. `lock`: arms straight up, hands together
 * over the head. `bottom`: the forearms folded down behind the head, the hands
 * at the back of the neck, the bell hanging behind them.
 */
const TRICEPS_ELBOW: Point = [-3, -329.5];
const TRICEPS_ELBOW_Z = 18;
function tricepsFrame(stage: "lock" | "bottom", hold: number): Keyframe {
  const hand: Point = stage === "lock" ? [-10, -395.2] : [-26, -268];
  const z = 10;
  return {
    hold,
    bell: "horns",
    sideways: {
      hands: { near: -z, far: z },
      elbows: { near: { at: -TRICEPS_ELBOW_Z }, far: { at: TRICEPS_ELBOW_Z } },
    },
    pose: {
      ...HORNS_BASE,
      head: along([0, -272], -78, 36),
      hands: { near: hand, far: hand },
      elbows: { near: { at: TRICEPS_ELBOW }, far: { at: TRICEPS_ELBOW } },
    },
  };
}

const HALO_STEPS = 12;
const haloFrames: Keyframe[] = Array.from({ length: HALO_STEPS }, (_, k) => haloFrame(-(360 / HALO_STEPS) * k, 0));

const HORN_SPECS: DoodleSpec[] = [
  {
    id: "fedb_kettlebell_halo",
    slug: "kettlebell-halo",
    title: "Kettlebell Halo",
    views: TWO_VIEWS,
    props: FLOOR,
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.35,
    frames: haloFrames,
  },
  {
    id: "fedb_kettlebell_halo_with_overhead_extension",
    slug: "kettlebell-halo-with-overhead-extension",
    title: "Kettlebell Halo with Overhead Extension",
    views: TWO_VIEWS,
    props: FLOOR,
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.4,
    frames: [
      haloFrame(0, 0.2),
      haloFrame(-45, 0),
      haloFrame(-90, 0),
      haloFrame(-135, 0),
      tricepsFrame("bottom", 0.3),
      tricepsFrame("lock", 0.4),
      tricepsFrame("bottom", 0.1),
      haloFrame(-225, 0),
      haloFrame(-270, 0),
      haloFrame(-315, 0),
    ],
  },
  {
    id: "fedb_kettlebell_overhead_triceps_extension",
    slug: "kettlebell-overhead-triceps-extension",
    title: "Kettlebell Overhead Triceps Extension",
    views: TWO_VIEWS,
    props: FLOOR,
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.9,
    frames: [tricepsFrame("lock", 0.5), tricepsFrame("bottom", 0.4)],
  },
];


// ---------------------------------------------------------------- bent press (two views, sideways torso lean)

/**
 * The bell-side (far) leg stays straight and the lead (near) knee soft; the hips push back and the torso
 * leans sideways away from the bell (about the pelvis) until the free (near) hand is on the floor,
 * the bell arm locked out straight up over its shoulder. Side panel: the hip hinge; front panel: the lean.
 */
const LEAN_FAR_LEG = 173.4;
const LEAN_NEAR_LEG = 168;
const LEAN_FEET_Z = { near: -89, far: 81 } as const;
const LEAN_PELVIS_Z = -10;
const HIP_Z = 8;

type LeanBody = Pick<LeanStage, "pelvis" | "pitch" | "lean">;

interface LeanStage {
  pelvis: Point;
  /** Spine angle in the side view (-90: upright). */
  pitch: number;
  /** Degrees the spine leans sideways, towards the near side (away from the bell). */
  lean: number;
  /** The bell arm: racked at the shoulder, half pressed, or locked out straight up. */
  arm: "rack" | "mid" | "lock";
  /** The free (near) hand is on the floor (otherwise it hangs by the side). */
  floor?: boolean;
}

function leanFrame(stage: LeanStage, hold: number, bell: BellMode): Keyframe {
  const { pelvis, pitch, lean, arm } = stage;
  const sideways: Sideways = {
    pelvis: LEAN_PELVIS_Z,
    chest: round(LEAN_PELVIS_Z - 80 * Math.sin((lean * Math.PI) / 180)),
    pivot: "pelvis",
    feet: LEAN_FEET_Z,
  };
  const footX = (leg: number, hipZ: number, footZ: number): number =>
    round(pelvis[0] + Math.sqrt(leg ** 2 - pelvis[1] ** 2 - (footZ - hipZ) ** 2));
  const feet: Pose["feet"] = {
    near: [footX(LEAN_NEAR_LEG, LEAN_PELVIS_Z - HIP_Z, LEAN_FEET_Z.near), 0],
    far: [footX(LEAN_FAR_LEG, LEAN_PELVIS_Z + HIP_Z, LEAN_FEET_Z.far), 0],
  };
  const base: Pose = { pelvis, chest: along(pelvis, pitch, 80), feet, toes: { near: 0, far: 0 } };
  const figure = solveKeyframe3(solvePose(base), base, sideways);
  const [fx, fy, fz] = figure.arms.far.root;
  const [nx, ny, nz] = figure.arms.near.root;
  // The bell arm.
  let farHand: Point;
  let farElbow: { at: Point } | { bend: 1 } = { bend: 1 };
  let farZ = fz;
  let farElbowZ: number | undefined;
  if (arm === "lock") farHand = [round(fx), round(fy - LOCKED_REACH)];
  else if (arm === "mid") {
    farHand = [round(fx + 14), round(fy - 78)];
    farZ = fz - 4;
  } else {
    const elbow = along([fx, fy], 75, 60);
    farElbow = { at: elbow };
    farElbowZ = fz;
    farHand = along(elbow, -68, 66);
    farZ = fz - 8;
  }
  // The free hand: on the floor beside the lead foot, or hanging by the side.
  let nearHand: Point;
  let nearZ: number;
  if (stage.floor) {
    nearZ = round(nz - 12);
    const dy = -4 - ny;
    nearHand = [round(nx + Math.sqrt(Math.max(0, (LOCKED_REACH - 0.6) ** 2 - dy ** 2 - 12 ** 2))), -4];
  } else {
    nearZ = round(nz - 6);
    nearHand = [round(nx), round(ny + Math.sqrt((LOCKED_REACH - 4) ** 2 - 36))];
  }
  return {
    hold,
    bell,
    pose: { ...base, hands: { near: nearHand, far: farHand }, elbows: { near: { bend: 1 }, far: farElbow } },
    sideways: {
      ...sideways,
      hands: { near: nearZ, far: round(farZ) },
      ...(farElbowZ === undefined ? {} : { elbows: { far: { at: round(farElbowZ) } } }),
    },
  };
}

const PRESS_TALL: LeanBody = { pelvis: [0, -152], pitch: -90, lean: 0 };
const PRESS_BEND: LeanBody = { pelvis: [-30, -146], pitch: -80, lean: 42 };
const PRESS_DEEP: LeanBody = { pelvis: [-60, -140], pitch: -70, lean: 85 };

const BENT_PRESS: DoodleSpec = {
  id: "fedb_bent_press",
  slug: "bent-press",
  title: "Bent Press",
  views: TWO_VIEWS,
  props: FLOOR,
  kettlebell: { hands: ["far"], size: BELL },
  transition: 0.9,
  frames: [
    leanFrame({ ...PRESS_TALL, arm: "rack" }, 0.5, "rack"),
    leanFrame({ pelvis: [-15, -149], pitch: -85, lean: 20, arm: "mid" }, 0, "rack"),
    leanFrame({ ...PRESS_BEND, arm: "lock" }, 0, "rack"),
    leanFrame({ ...PRESS_DEEP, arm: "lock", floor: true }, 0.6, "rack"),
    leanFrame({ ...PRESS_BEND, arm: "lock" }, 0, "rack"),
    leanFrame({ ...PRESS_TALL, arm: "lock" }, 0.6, "rack"),
  ],
};

export const BATCH_AV_SPECS: DoodleSpec[] = [...CLEAN_SPECS, ...PASS_SPECS, ...HORN_SPECS, BENT_PRESS];
