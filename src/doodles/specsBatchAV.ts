import { solvePose } from "./rig";
import type { BellMode, DoodleSpec, Keyframe, Point, Pose, Side, Sideways } from "./rig";
import { solveKeyframe3 } from "./rig3d";
import { LOCKED_REACH, TWO_VIEWS } from "./sideways";
import { FLOOR_PROP, along, chestOf, freeHand, round, shoulderOf } from "./geom";

/**
 * Batch AV (#212): kettlebell moves that were blocked on gear and rig gaps:
 * the alternating hang cleans (a bell per hand, each with its own mode), the
 * pass-throughs (one bell changing hands: figure 8, between the legs, lunge
 * pass-through), the halos and overhead triceps extension (one bell held by
 * the horns) and the bent press (the torso leans sideways).
 *
 * Floor at y = 0, up is negative, the side-view figure faces +x; in the front
 * panel the near side (z < 0) is on the viewer's left. Never import ./specs
 * (circular).
 */

const BELL = 14;
/** Arm reach (shoulder to fingertip), a hair short so a straight arm draws straight. */
const REACH = 125.4;

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
/** Hips nearly through as the bell starts up. */
const DRIVE: Stand = { pelvis: [-6, -170], spine: -84 };

/**
 * A clean keeps the bell close: `low` the elbow bends back beside the ribs and the
 * hand floats up in front of the hips; `high` the elbow is up and back, the hand
 * at the lower chest close to the body; `rack` the elbow drops in front of the ribs.
 */
type ArmState = "hang" | "between" | "low" | "high" | "rack";

/** One arm in a clean: hand pin and (for a bent arm) elbow pin, from its shoulder. */
function cleanArm(state: ArmState, shoulder: Point, side: Side): { hand: Point; elbow?: Point } {
  const slight = side === "near" ? 0 : -2;
  const bent = (upper: number, lower: number): { hand: Point; elbow: Point } => {
    const elbow = along(shoulder, upper + slight, 60);
    return { hand: along(elbow, lower, 66), elbow };
  };
  switch (state) {
    case "hang":
      return { hand: along(shoulder, 90 + slight, REACH) };
    case "between":
      return { hand: along(shoulder, (side === "near" ? 110 : 100), REACH) };
    case "low":
      return bent(112, 40);
    case "high":
      return bent(118, -16);
    case "rack":
      return bent(75, -68);
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
const modeOf = (state: ArmState): BellMode => (state === "rack" ? "rack" : "hang");
const cleanFrame = (stand: Stand, near: ArmState, far: ArmState, hold: number): Keyframe => ({
  pose: cleanPose(stand, near, far),
  hold,
  bell: bells(modeOf(near), modeOf(far)),
});

/** One clean with `side`'s bell (the other hangs): up the body to the rack, held, back down between the legs. */
function oneClean(side: Side): Keyframe[] {
  const arms = (state: ArmState): [ArmState, ArmState] => (side === "near" ? [state, "hang"] : ["hang", state]);
  const frame = (stand: Stand, state: ArmState, hold: number): Keyframe => cleanFrame(stand, ...arms(state), hold);
  return [
    cleanFrame(HINGE, "between", "between", 0.3),
    frame(DRIVE, "low", 0),
    frame(TALL, "high", 0),
    frame(TALL, "rack", 0.45),
    frame(TALL, "low", 0),
  ];
}

/** Double alternating: one bell comes down while the other comes up the body. */
function swapClean(down: Side): Keyframe[] {
  const pair = (d: ArmState, u: ArmState): [ArmState, ArmState] => (down === "near" ? [d, u] : [u, d]);
  return [
    cleanFrame(TALL, ...pair("rack", "hang"), 0.4),
    cleanFrame(DIP, ...pair("low", "between"), 0),
    cleanFrame(DRIVE, ...pair("hang", "low"), 0),
    cleanFrame(TALL, ...pair("hang", "high"), 0),
  ];
}

const CLEAN_SPECS: DoodleSpec[] = [
  {
    id: "fedb_alternating_hang_clean",
    slug: "alternating-hang-clean",
    title: "Alternating Hang Clean",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near", "far"], size: BELL },
    transition: 0.32,
    frames: [...oneClean("near"), ...oneClean("far")],
  },
  {
    id: "fedb_double_kettlebell_alternating_hang_clean",
    slug: "double-kettlebell-alternating-hang-clean",
    title: "Double Kettlebell Alternating Hang Clean",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near", "far"], size: BELL },
    transition: 0.32,
    frames: [...swapClean("near"), ...swapClean("far")],
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
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.5,
    frames: FIGURE_8,
  },
  {
    id: "fedb_kettlebell_pass_between_the_legs",
    slug: "kettlebell-pass-between-the-legs",
    title: "Kettlebell Pass Between the Legs",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.55,
    frames: BETWEEN_LEGS,
  },
  {
    id: "fedb_lunge_pass_through",
    slug: "lunge-pass-through",
    title: "Lunge Pass-Through",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
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

type V3 = [number, number, number];
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit3 = (a: V3): V3 => {
  const n = Math.hypot(...a);
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** The elbow (upper arm 60, forearm and hand 66) from shoulder to hand tip that is nearest `want`. */
function elbowToward(shoulder: V3, hand: V3, want: V3): V3 {
  const d = Math.hypot(...sub3(hand, shoulder));
  const u = unit3(sub3(hand, shoulder));
  const a = (d * d + 60 * 60 - 66 * 66) / (2 * d);
  const h = Math.sqrt(Math.max(0, 60 * 60 - a * a));
  const c: V3 = [shoulder[0] + u[0] * a, shoulder[1] + u[1] * a, shoulder[2] + u[2] * a];
  const off = sub3(want, c);
  const along = dot3(off, u);
  const dir = unit3([off[0] - u[0] * along, off[1] - u[1] * along, off[2] - u[2] * along]);
  return [c[0] + dir[0] * h, c[1] + dir[1] * h, c[2] + dir[2] * h];
}

/**
 * Where the near elbow aims as the bell goes round (degrees, 0 in front, -90 by
 * the near ear, -180 behind, -270 by the far ear): down in front; forward at
 * chin height by its own ear; out to the side at chin-to-forehead height while
 * the hands are behind the head; then it sweeps under, past the chest, and
 * crosses in front of the face at chin height as the bell passes the far ear.
 * The far elbow mirrors it.
 */
const NEAR_ELBOW: [theta: number, at: V3][] = [
  [0, [31, -223, -45]],
  [-45, [48, -262, -40]],
  [-90, [55, -288, -36]],
  [-135, [25, -302, -64]],
  [-180, [-28, -302, -63]],
  [-225, [-51, -298, -28]],
  [-245, [-10, -232, 5]],
  [-270, [50, -292, 0]],
  [-315, [50, -262, -20]],
  [-360, [31, -223, -45]],
];

function nearElbowAim(theta: number): V3 {
  const t = -(((-theta % 360) + 360) % 360);
  for (let k = 0; k + 1 < NEAR_ELBOW.length; k += 1) {
    const [a, pa] = NEAR_ELBOW[k];
    const [b, pb] = NEAR_ELBOW[k + 1];
    if (t <= a && t >= b) {
      const f = (a - t) / (a - b);
      return [0, 1, 2].map((i) => pa[i] + (pb[i] - pa[i]) * f) as V3;
    }
  }
  return NEAR_ELBOW[0][1];
}

/** Shoulders of the standing figure (x, y, z). */
const HORNS_SHOULDERS = ((): Record<Side, V3> => {
  const pose: Pose = { ...HORNS_BASE, hands: { near: [2, -150], far: [2, -150] } };
  const arms = solveKeyframe3(solvePose(pose), pose, {}).arms;
  return { near: arms.near.root as V3, far: arms.far.root as V3 };
})();

/**
 * Halo kept close: the hands on the horns circle the head `theta` degrees round
 * (0 = in front of the chest, -90 = by the near ear, 180 = behind the head),
 * just clear of it: at the collarbones in front, the bell standing above the
 * hands, and at ear height round the back, so the bell passes just behind the
 * ear and the back of the head. The elbows follow `NEAR_ELBOW`: never overhead.
 */
function closeHaloFrame(theta: number, hold: number): Keyframe {
  const r = (theta * Math.PI) / 180;
  const low = Math.max(0, Math.cos(r)) ** 1.5;
  const radius = 36 + 2 * low;
  const centre = 2 - 10 * (1 - low);
  const hand: V3 = [round(centre + Math.cos(r) * radius), round(-302 + 32 * low), round(Math.sin(r) * radius)];
  const elbows = {} as Record<Side, V3>;
  const near = nearElbowAim(theta);
  const far = nearElbowAim(-theta);
  elbows.near = elbowToward(HORNS_SHOULDERS.near, hand, near).map(round) as V3;
  elbows.far = elbowToward(HORNS_SHOULDERS.far, hand, [far[0], far[1], -far[2]]).map(round) as V3;
  return {
    hold,
    bell: "horns",
    sideways: { hands: { near: hand[2], far: hand[2] }, elbows: { near: { at: elbows.near[2] }, far: { at: elbows.far[2] } } },
    pose: {
      ...HORNS_BASE,
      hands: { near: [hand[0], hand[1]], far: [hand[0], hand[1]] },
      elbows: { near: { at: [elbows.near[0], elbows.near[1]] }, far: { at: [elbows.far[0], elbows.far[1]] } },
    },
  };
}

const HALO_KEYS = 24;
const closeHaloFrames: Keyframe[] = Array.from({ length: HALO_KEYS }, (_, k) => closeHaloFrame(-(360 / HALO_KEYS) * k, 0));

const HORN_SPECS: DoodleSpec[] = [
  {
    id: "fedb_kettlebell_halo",
    slug: "kettlebell-halo",
    title: "Kettlebell Halo",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.18,
    frames: closeHaloFrames,
  },
  {
    id: "fedb_kettlebell_halo_with_overhead_extension",
    slug: "kettlebell-halo-with-overhead-extension",
    title: "Kettlebell Halo with Overhead Extension",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
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
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 0.9,
    frames: [tricepsFrame("lock", 0.5), tricepsFrame("bottom", 0.4)],
  },
];

// ---------------------------------------------------------------- bent press (two views, sideways torso lean)

/**
 * Bent press: the bell is cleaned to the rack and then barely moves. The hips
 * push out under the bell side and the torso leans away from it (about the
 * pelvis) and drops, so the shoulder sinks away under a bell that stays at
 * about rack height: the elbow opens as the shoulder drops, the forearm
 * upright under the bell, and the arm is only locked at the bottom, the free
 * (near) hand on the floor. It stays locked while the figure stands up under
 * it, the bell rising overhead. Side panel: the drop; front panel: the lean.
 */
const PRESS_FEET: Record<Side, readonly [x: number, z: number]> = { near: [10, -50], far: [10, 66] };

interface PressBody {
  pelvis: Point;
  /** Pelvis z: the hips push out towards the bell (far) side. */
  pz: number;
  /** Spine angle in the side view (-90: upright). */
  pitch: number;
  /** Degrees the spine leans sideways, towards the near side (away from the bell). */
  lean: number;
}

/** Where the bell hand is: in the rack, held at a point in space (elbow under it), or locked out along `dir` from the shoulder. */
type PressArm = { kind: "rack" } | { kind: "hold"; at: V3 } | { kind: "lock"; dir: V3 };

function pressSolve(body: PressBody): { base: Pose; sideways: Sideways; shoulders: Record<Side, V3> } {
  const { pelvis, pz, pitch, lean } = body;
  const base: Pose = {
    pelvis,
    chest: along(pelvis, pitch, 80),
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [PRESS_FEET.near[0], 0], far: [PRESS_FEET.far[0], 0] },
    toes: { near: 0, far: 0 },
  };
  const sideways: Sideways = {
    pelvis: pz,
    chest: round(pz - 80 * Math.sin((lean * Math.PI) / 180)),
    pivot: "pelvis",
    feet: { near: PRESS_FEET.near[1], far: PRESS_FEET.far[1] },
  };
  const arms = solveKeyframe3(solvePose(base), base, sideways).arms;
  return { base, sideways, shoulders: { near: arms.near.root as V3, far: arms.far.root as V3 } };
}

function pressFrame(body: PressBody, arm: PressArm, hold: number, floor = false): Keyframe {
  const { base, sideways, shoulders } = pressSolve(body);
  const fs = shoulders.far;
  let hand: V3;
  let elbow: V3;
  if (arm.kind === "rack") {
    const e = along([fs[0], fs[1]], 75, 60);
    const h = along(e, -68, 66);
    elbow = [e[0], e[1], fs[2]];
    hand = [h[0], h[1], fs[2] - 8];
  } else if (arm.kind === "hold") {
    hand = arm.at;
    elbow = elbowToward(fs, hand, [hand[0], hand[1] + 66, hand[2]]);
  } else {
    const d = unit3(arm.dir);
    hand = [fs[0] + d[0] * LOCKED_REACH, fs[1] + d[1] * LOCKED_REACH, fs[2] + d[2] * LOCKED_REACH];
    elbow = [fs[0] + d[0] * 60, fs[1] + d[1] * 60, fs[2] + d[2] * 60];
  }
  // The free hand: on the floor beside the lead foot, or hanging by the side.
  const { hand: nearHand, z: nearZ } = freeHand(shoulders.near, floor, LOCKED_REACH);
  const r3 = (p: V3): V3 => p.map(round) as V3;
  const [hx, hy, hz] = r3(hand);
  const [ex, ey, ez] = r3(elbow);
  return {
    hold,
    bell: "rack",
    pose: { ...base, hands: { near: nearHand, far: [hx, hy] }, elbows: { near: { bend: 1 }, far: { at: [ex, ey] } } },
    sideways: { ...sideways, hands: { near: nearZ, far: hz }, elbows: { far: { at: ez } } },
  };
}

const PRESS_TALL: PressBody = { pelvis: [0, -158], pz: 0, pitch: -90, lean: 0 };
const PRESS_SINK: PressBody = { pelvis: [-4, -150], pz: 14, pitch: -84, lean: 30 };
const PRESS_LOW: PressBody = { pelvis: [2, -135], pz: 38, pitch: -76, lean: 62 };
const PRESS_DEEP: PressBody = { pelvis: [10, -120], pz: 60, pitch: -70, lean: 88 };

/** The racked bell's hand, where it stays while the body drops away under it. */
const PRESS_BELL: V3 = (() => {
  const frame = pressFrame(PRESS_TALL, { kind: "rack" }, 0);
  const hand = (frame.pose as Pose).hands!.far!;
  return [hand[0], hand[1], frame.sideways!.hands!.far!];
})();

/** The bell drifts a little towards the middle as the body goes under it. */
const PRESS_BELL_LOW: V3 = [PRESS_BELL[0], PRESS_BELL[1], PRESS_BELL[2] - 10];
const PRESS_BELL_DEEP: V3 = [PRESS_BELL[0], PRESS_BELL[1] - 4, PRESS_BELL[2] - 20];

/** At the bottom the arm points from the shoulder to the bell. */
const PRESS_LOCK: V3 = sub3(PRESS_BELL_DEEP, pressSolve(PRESS_DEEP).shoulders.far);

const BENT_PRESS: DoodleSpec = {
  id: "fedb_bent_press",
  slug: "bent-press",
  title: "Bent Press",
  views: TWO_VIEWS,
  props: [FLOOR_PROP],
  kettlebell: { hands: ["far"], size: BELL },
  transition: 0.9,
  frames: [
    pressFrame(PRESS_TALL, { kind: "rack" }, 0.5),
    pressFrame(PRESS_SINK, { kind: "hold", at: PRESS_BELL }, 0),
    pressFrame(PRESS_LOW, { kind: "hold", at: PRESS_BELL_LOW }, 0),
    pressFrame(PRESS_DEEP, { kind: "lock", dir: PRESS_LOCK }, 0.6, true),
    pressFrame(PRESS_LOW, { kind: "lock", dir: PRESS_LOCK }, 0),
    pressFrame(PRESS_TALL, { kind: "lock", dir: [0, -1, 0] }, 0.6),
  ],
};

export const BATCH_AV_SPECS: DoodleSpec[] = [...CLEAN_SPECS, ...PASS_SPECS, ...HORN_SPECS, BENT_PRESS];
