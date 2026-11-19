import { SHOULDER_SIDE, solveJoint, type DoodleSpec, type Keyframe, type Point, type Pose, type Sideways } from "./rig";
import { TWO_VIEWS } from "./sideways";

/**
 * Batch AL (#174): moves no single view shows, drawn in two views from the
 * start (`views: ["side", "front"]`). Side view faces +x; `sideways` gives
 * absolute z (near side negative, on the front panel's left).
 *
 *   wger_994 / wger_995  arm circles: straight arms circle beside the head;
 *     the side panel shows which way round, the front panel the arms out to the sides.
 *   wger_1834  Trap-3 raise: hinged forward, the working arm rises from hanging
 *     on a diagonal out to the side, up to beside the ear.
 */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

/** Shoulder to fingertip, elbow locked (a hair short so the solver keeps it straight). */
const ARM = 125.9;

// ---------------------------------------------------------------- arm circles

const STAND_PELVIS: Point = [0, -173.4];
const STAND_CHEST: Point = [0, -253.4];
const STAND_SHOULDER: Point = [0, -271.4];
const FEET_Z = 10;

/**
 * Both straight arms at `theta` degrees round the shoulder in the side view
 * (0 hanging, 90 straight forward, 180 overhead, 270 straight back). The hands
 * drift out to the side as they rise, so the arms pass beside the head.
 */
function circlePose(theta: number): Keyframe {
  const r = (theta * Math.PI) / 180;
  const lift = (1 - Math.cos(r)) / 2;
  const wide = 30 + 22 * lift;
  const inPlane = Math.sqrt(ARM * ARM - wide * wide);
  const hand: Point = [round(STAND_SHOULDER[0] + inPlane * Math.sin(r)), round(STAND_SHOULDER[1] + inPlane * Math.cos(r))];
  const pose: Pose = {
    pelvis: STAND_PELVIS,
    chest: STAND_CHEST,
    hands: { near: hand, far: hand },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [2, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
  const z = round(SHOULDER_SIDE + wide);
  return { hold: 0, pose, sideways: { hands: { near: -z, far: z }, feet: { near: -FEET_Z, far: FEET_Z } } };
}

/** One full circle in steps of 45°: `dir` -1 runs back, up, forward, down (forward circles), +1 the other way. */
const circle = (dir: 1 | -1): Keyframe[] => Array.from({ length: 8 }, (_, i) => circlePose(dir * 45 * i));

// ---------------------------------------------------------------- Trap-3 raise

/** Hinged forward: feet under the hips, knees soft, flat back near level. */
const T3_PELVIS: Point = [-30, -160];
const T3_SPINE = -24;
const T3_FEET: Record<"near" | "far", Point> = { near: [4, 0], far: [0, 0] };
const T3_FEET_Z = 12;
/** How far the raised arm sits out from the line of the spine (degrees). */
const T3_OUT = 40;
/** The raised arm sits a little above the line of the spine (degrees). */
const T3_ABOVE = 10;

/** The working (near) arm at `t`: 0 hanging straight down, 1 up in line with the ear, out on a diagonal. */
function trap3(t: number): Keyframe {
  const chest = along(T3_PELVIS, T3_SPINE, 80);
  const shoulder = along(T3_PELVIS, T3_SPINE, 98);
  // Far (support) hand rests on the far knee.
  const farKnee = solveJoint(T3_PELVIS, T3_FEET.far, 88, 86, -1);
  const rest: Point = [round(farKnee[0] + 6), round(farKnee[1] - 8)];
  // Working arm: in the side plane it swings forward from straight down (90°)
  // to the line of the spine, while rolling out to the side (45° at the top).
  const inPlane = ((90 + t * (T3_SPINE - T3_ABOVE - 90)) * Math.PI) / 180;
  const out = (t * T3_OUT * Math.PI) / 180;
  const hand: Point = [
    round(shoulder[0] + ARM * Math.cos(out) * Math.cos(inPlane)),
    round(shoulder[1] + ARM * Math.cos(out) * Math.sin(inPlane)),
  ];
  const z = round(-SHOULDER_SIDE - ARM * Math.sin(out));
  const pose: Pose = {
    pelvis: T3_PELVIS,
    chest,
    head: along(shoulder, T3_SPINE + 6, 38),
    hands: { near: hand, far: rest },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: T3_FEET,
    toes: { near: 0, far: 0 },
  };
  const sideways: Sideways = { hands: { near: z, far: T3_FEET_Z + 4 }, feet: { near: -T3_FEET_Z, far: T3_FEET_Z } };
  return { hold: 0, pose, sideways };
}

export const BATCH_AL_SPECS: DoodleSpec[] = [
  {
    // Text: back behind, up overhead, forward and down.
    id: "wger_994",
    slug: "forward-arm-circles",
    title: "Forward arm circles",
    views: TWO_VIEWS,
    transition: 0.22,
    frames: circle(-1),
  },
  {
    // Text: forward and up overhead, back behind and down.
    id: "wger_995",
    slug: "backward-arm-circles",
    title: "Backward arm circles",
    views: TWO_VIEWS,
    transition: 0.22,
    frames: circle(1),
  },
  {
    id: "wger_1834",
    slug: "trap-3-raise",
    title: "Trap-3 Raise",
    views: TWO_VIEWS,
    transition: 0.9,
    frames: [
      { ...trap3(0), hold: 0.5 },
      { ...trap3(0.5), hold: 0 },
      { ...trap3(1), hold: 0.5 },
      { ...trap3(0.5), hold: 0 },
    ],
  },
];
