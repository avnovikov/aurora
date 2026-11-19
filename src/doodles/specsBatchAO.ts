import { kettlebellOnFloor, onStrap, solvePose } from "./rig";
import type { Pose } from "./rig";
import type { AuthoredPose, DoodleSpec, Keyframe, Point, Prop, Side, Sideways } from "./rig";
import { TWO_VIEWS } from "./sideways";
import { PLANK_FOOT, lockedShoulderY, rep, straightBody } from "./specsBatchC";

/**
 * Batch AO (#212): the most-scheduled moves that had no doodle. Inverted rows
 * under a low bar or on rings, ring push-up, kettlebell rows and lunge, and
 * a windshield wiper. Floor at y = 0, up is negative, the figure faces +x (rows are
 * face up with the head at -x). Far limbs pale behind, near limbs bright.
 *
 * Left out:
 *   hf_136               Japanese Handstand: the text asks for a handstand with the hands lowered
 *     to hip level, which no body position does.
 * ntc_plank_hip_dips is drawn in batch AW (side + top view, hips swinging under square shoulders).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}
const round = (value: number): number => Math.round(value * 10) / 10;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// ---------------------------------------------------------------- Australian pull-ups (low bar)

const ROW_BAR = -200;
const ROW_FOOT: Point = [170, -8];
/** Chest-to-bar shoulder height; the hands sit just ahead of the chest there. */
const ROW_TOP_Y = -185;
const ROW_HAND_X = round(straightBody(ROW_FOOT, ROW_TOP_Y, -1).shoulder[0] + 25);
const ROW_HANG_Y = lockedShoulderY(ROW_FOOT, [ROW_HAND_X, ROW_BAR], -1, true);

function barRow(shoulderY: number): Pose {
  const { pelvis, chest } = straightBody(ROW_FOOT, shoulderY, -1);
  return {
    pelvis,
    chest,
    hands: { near: [ROW_HAND_X, ROW_BAR], far: [ROW_HAND_X, ROW_BAR] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: ROW_FOOT, far: ROW_FOOT },
  };
}

const ROW_BAR_PROP: Prop = { kind: "bar", y: ROW_BAR, x1: ROW_HAND_X - 24, x2: ROW_HAND_X + 60, grips: [ROW_HAND_X - 1] };

// ---------------------------------------------------------------- ring row

const RING_LEN = 120;
const RING_ANCHOR: Point = [ROW_HAND_X, ROW_BAR - RING_LEN];

/** Ring row: `t` 0 is the hang with straight arms, 1 the chest pulled up between the rings. */
function ringRow(t: number): Pose {
  const hand = onStrap(RING_ANCHOR, RING_LEN, 9 * t);
  const hangY = lockedShoulderY(ROW_FOOT, onStrap(RING_ANCHOR, RING_LEN, 0), -1, true);
  const { pelvis, chest } = straightBody(ROW_FOOT, round(lerp(hangY, ROW_TOP_Y, t)), -1);
  return {
    pelvis,
    chest,
    hands: { near: hand, far: hand },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: ROW_FOOT, far: ROW_FOOT },
  };
}

const ringRowFrames = (hold: number, hangHold: number): Keyframe[] => [
  { hold: hangHold, pose: ringRow(0) },
  { hold: 0, pose: ringRow(0.5) },
  { hold, pose: ringRow(1) },
  { hold: 0, pose: ringRow(0.5) },
];

// ---------------------------------------------------------------- ring face pull (two views)

const FP_TOP_Y = -176;
/** The hands finish beside the face, level with the ears. */
const FP_FACE: Point = (() => {
  const { pelvis, chest } = straightBody(ROW_FOOT, FP_TOP_Y, -1);
  const head = solvePose({ pelvis, chest }).head;
  return [round(head[0] - 8), round(head[1] + 10)];
})();
/** The rings hang a little lower than the face and swing up to it. */
const FP_HANG: Point = [ROW_HAND_X, FP_FACE[1] + 16];
const FP_HANG_Y = lockedShoulderY(ROW_FOOT, FP_HANG, -1, true);
const FP_TOP = (() => {
  const hand = FP_FACE;
  const dx = hand[0] - FP_HANG[0];
  const dy = hand[1] - FP_HANG[1];
  const swing = 2 * Math.atan(-dy / dx);
  return { swing: (swing * 180) / Math.PI, length: dx / Math.sin(swing) };
})();
/** The rings hang from fixed anchors this far either side of the centre line: where the open hands are at the face. */
const FP_WIDTH = 34;
const FP_ANCHOR: Point = [FP_HANG[0], FP_HANG[1] - FP_TOP.length];

/** `t` 0: leaning back, straight arms; 1: rings at the face, elbows high and wide. */
function facePull(t: number): AuthoredPose {
  const { pelvis, chest } = straightBody(ROW_FOOT, round(lerp(FP_HANG_Y, FP_TOP_Y, t)), -1);
  // Each ring hangs from a fixed anchor at the open hands' z (FP_WIDTH); the hand's 2D strap shortens by its z offset from it.
  const across = FP_WIDTH - (22 + 12 * t);
  const hand = onStrap(FP_ANCHOR, Math.sqrt(FP_TOP.length ** 2 - across ** 2), FP_TOP.swing * t);
  return {
    pelvis,
    chest,
    hands: { near: hand, far: hand },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: ROW_FOOT, far: ROW_FOOT },
  };
}

/** The elbows roll straight out to the side as soon as the arms bend, so they stay high and wide (never tucked toward the hips like a row). */
const facePullSideways = (t: number): Sideways => ({
  hands: { near: -(22 + 12 * t), far: 22 + 12 * t },
  elbows: { near: { out: t > 0 ? 90 : 0 }, far: { out: t > 0 ? 90 : 0 } },
});

const STEPS = [0, 0.2, 0.4, 0.6, 0.8, 1];
const facePullFrame = (t: number, hold: number): Keyframe => ({ hold, pose: facePull(t), sideways: facePullSideways(t) });

// ---------------------------------------------------------------- floor windshield wiper (two views)

const SUPINE_CHORD = 77;
const WIPER_PELVIS: Point = [-12, -20];
const WIPER_LEG = 173.98;
/** Feet at rest: together, a little inside the hips (+-8). */
const WIPER_FOOT_Z = 4;

/** On the back, arms straight out to the sides (T) with the palms down: hands level with the shoulders and on the floor. */
function wiperBase(): { pose: AuthoredPose; handZ: number } {
  const dy = -18 - WIPER_PELVIS[1];
  const chest: Point = [round(WIPER_PELVIS[0] - Math.sqrt(SUPINE_CHORD ** 2 - dy * dy)), -18];
  const head: Point = [round(chest[0] - 55), -24];
  const base: AuthoredPose = { pelvis: WIPER_PELVIS, chest, head, spine: { bend: -1 } };
  const shoulder = solvePose(base as Pose).arms.near.root;
  const handY = -6;
  // Straight out sideways from the shoulder (z +-22): the arm's reach is all in z.
  const handZ = 22 + Math.sqrt(125.4 ** 2 - (shoulder[1] - handY) ** 2) - 0.3;
  const hand: Point = [round(shoulder[0]), handY];
  return { pose: { ...base, hands: { near: hand, far: hand }, elbows: { near: { bend: 1 }, far: { bend: 1 } } }, handZ: round(handZ) };
}

/** Legs together and straight, swung `sway` degrees sideways from vertical (towards the far side when positive). */
function wiper(sway: number, hold: number): Keyframe {
  const { pose, handZ } = wiperBase();
  const shift = WIPER_LEG * Math.sin((sway * Math.PI) / 180);
  const foot = (side: Side): { at: Point; z: number } => {
    const hipZ = side === "near" ? -8 : 8;
    const z = (side === "near" ? -WIPER_FOOT_Z : WIPER_FOOT_Z) + shift;
    return { at: [WIPER_PELVIS[0], round(WIPER_PELVIS[1] - Math.sqrt(WIPER_LEG ** 2 - (z - hipZ) ** 2))], z: round(z) };
  };
  const [near, far] = [foot("near"), foot("far")];
  return {
    hold,
    pose: { ...pose, feet: { near: near.at, far: far.at }, toes: { near: -90, far: -90 } },
    sideways: { hands: { near: -handZ, far: handZ }, feet: { near: near.z, far: far.z } },
  };
}

// ---------------------------------------------------------------- ring push-up

const PU_HAND_X = 62;
const PU_RING_Y = -30;
const PU_STRAP = 150;
const PU_ANCHOR: Point = [PU_HAND_X, PU_RING_Y - PU_STRAP];

function ringPushUp(shoulderY: number): Pose {
  const { pelvis, chest } = straightBody(PLANK_FOOT, shoulderY);
  const hand: Point = [PU_HAND_X, PU_RING_Y];
  return {
    pelvis,
    chest,
    hands: { near: hand, far: hand },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: PLANK_FOOT, far: PLANK_FOOT },
    toes: { near: 62, far: 62 },
  };
}
const PU_TOP = lockedShoulderY(PLANK_FOOT, [PU_HAND_X, PU_RING_Y]);

// ---------------------------------------------------------------- kettlebell rows

const BELL_HAND_Y = kettlebellOnFloor();

/** Shoulder of a pose, from its pelvis and chest. */
const shoulderOf = (pelvis: Point, chest: Point): Point => solvePose({ pelvis, chest }).arms.near.root;

/** Pelvis height (bisected) at which a straight-armed hand hangs at `handY` below the shoulder, torso at `spine` degrees. */
function hingePelvis(x: number, spine: number, handY: number): { pelvis: Point; chest: Point; shoulder: Point } {
  let lo = -260;
  let hi = -60;
  const at = (y: number): { pelvis: Point; chest: Point; shoulder: Point } => {
    const pelvis: Point = [x, y];
    const chest = along(pelvis, spine, 80);
    return { pelvis, chest, shoulder: shoulderOf(pelvis, chest) };
  };
  for (let i = 0; i < 50; i += 1) {
    const mid = (lo + hi) / 2;
    // The shoulder too high above the hand: lower the pelvis.
    if (handY - at(mid).shoulder[1] > 125.5) lo = mid;
    else hi = mid;
  }
  return at(round((lo + hi) / 2));
}

const HINGE = hingePelvis(-72, -18, BELL_HAND_Y);

/** Hinged, a bell on the floor in each hand; `row` lifts that hand's bell to the hip, elbow close. */
function bellRow(row: "near" | "far" | null): Pose {
  const { pelvis, chest, shoulder } = HINGE;
  const down: Point = [round(shoulder[0] + 3), BELL_HAND_Y];
  const elbow = along(shoulder, 172, 60);
  const up: Point = [round(elbow[0] + 7), round(elbow[1] + 65.6)];
  return {
    pelvis,
    chest,
    hands: { near: row === "near" ? up : down, far: row === "far" ? up : [down[0] - 2, down[1]] },
    elbows: { near: row === "near" ? { at: elbow } : { bend: 1 }, far: row === "far" ? { at: elbow } : { bend: 1 } },
    feet: { near: [-10, 0], far: [-16, 0] },
    toes: { near: 0, far: 0 },
  };
}

const RENEGADE_HAND_X = 62;
const RENEGADE_TOP = lockedShoulderY(PLANK_FOOT, [RENEGADE_HAND_X, BELL_HAND_Y]);

/** Plank on two bells; `row` pulls that hand's bell up to the ribs. */
function renegade(row: "near" | "far" | null): Pose {
  const { pelvis, chest, shoulder } = straightBody(PLANK_FOOT, RENEGADE_TOP);
  const down: Point = [RENEGADE_HAND_X, BELL_HAND_Y];
  const elbow = along(shoulder, 175, 60);
  const up: Point = [round(elbow[0] + 7), round(elbow[1] + 65.6)];
  return {
    pelvis,
    chest,
    hands: { near: row === "near" ? up : down, far: row === "far" ? up : [down[0] - 2, down[1]] },
    elbows: { near: row === "near" ? { at: elbow } : { bend: 1 }, far: row === "far" ? { at: elbow } : { bend: 1 } },
    feet: { near: PLANK_FOOT, far: PLANK_FOOT },
    toes: { near: 62, far: 62 },
  };
}

// ---------------------------------------------------------------- single-leg kettlebell lunge

const LUNGE_PELVIS: Record<"stand" | "step" | "down", Point> = { stand: [0, -172], step: [-40, -166], down: [-50, -96] };

/** Reverse lunge, the far foot stepping back; the bell held goblet-style at the chest in both hands. */
function gobletLunge(stage: "stand" | "step" | "down"): Pose {
  const pelvis: Point = LUNGE_PELVIS[stage];
  const chest = along(pelvis, -88, 80);
  // Elbows down, forearms rising to both hands on the bell's horns at the chest.
  const elbow = along(shoulderOf(pelvis, chest), 92, 60);
  const grip: Point = [round(elbow[0] + 36), round(elbow[1] - 55)];
  const back = stage !== "stand";
  return {
    pelvis,
    chest,
    hands: { near: grip, far: grip },
    elbows: { near: { at: elbow }, far: { at: elbow } },
    knees: { far: { bend: -1 } },
    feet: { near: [6, 0], far: back ? [-126, -20] : [0, 0] },
    toes: { near: 0, far: back ? 78 : 0 },
  };
}

export const BATCH_AO_SPECS: DoodleSpec[] = [
  {
    id: "ntc_australian_chin_up",
    slug: "australian-chin-up",
    title: "Australian chin-up",
    props: [ROW_BAR_PROP],
    transition: 0.5,
    frames: rep(barRow, ROW_HANG_Y, ROW_TOP_Y, 0.4, 0.4),
  },
  {
    id: "ntc_australian_pull_up_hold",
    slug: "australian-pull-up-hold",
    title: "Australian pull-up hold",
    props: [ROW_BAR_PROP],
    transition: 0.45,
    frames: rep(barRow, ROW_HANG_Y, ROW_TOP_Y, 0.2, 3),
  },
  {
    id: "hf_41",
    slug: "ring-row",
    title: "Ring row",
    straps: { anchor: RING_ANCHOR, end: "ring" },
    transition: 0.5,
    frames: ringRowFrames(0.4, 0.4),
  },
  {
    id: "hf_15",
    slug: "ring-push-up",
    title: "Ring push-up",
    straps: { anchor: PU_ANCHOR, end: "ring" },
    transition: 0.5,
    frames: rep(ringPushUp, PU_TOP, -72, 0.4, 0.3),
  },
  {
    id: "fedb_alternating_kettlebell_row",
    slug: "alternating-kettlebell-row",
    title: "Alternating Kettlebell Row",
    kettlebell: { hands: ["near", "far"] },
    transition: 0.6,
    frames: [
      { hold: 0.3, pose: bellRow(null) },
      { hold: 0.5, pose: bellRow("near") },
      { hold: 0.3, pose: bellRow(null) },
      { hold: 0.5, pose: bellRow("far") },
    ],
  },
  {
    id: "fedb_alternating_renegade_row",
    slug: "alternating-renegade-row",
    title: "Alternating Renegade Row",
    kettlebell: { hands: ["near", "far"] },
    transition: 0.6,
    frames: [
      { hold: 0.3, pose: renegade(null) },
      { hold: 0.5, pose: renegade("near") },
      { hold: 0.3, pose: renegade(null) },
      { hold: 0.5, pose: renegade("far") },
    ],
  },
  {
    id: "wger_1734",
    slug: "single-leg-lunge-with-kettlebell",
    title: "Single-Leg Lunge with Kettlebell",
    kettlebell: { hands: ["near"] },
    transition: 0.6,
    frames: [
      { hold: 0.4, pose: gobletLunge("stand") },
      { hold: 0, pose: gobletLunge("step") },
      { hold: 0.5, pose: gobletLunge("down") },
      { hold: 0, pose: gobletLunge("step") },
    ],
  },
  {
    id: "hf_67",
    slug: "ring-face-pull",
    title: "Ring Face Pull",
    views: TWO_VIEWS,
    straps: { anchor: FP_ANCHOR, end: "ring", width: FP_WIDTH },
    transition: 0.6,
    frames: [...STEPS.map((t) => facePullFrame(t, t === 0 ? 0.4 : 0)), ...[...STEPS].reverse().slice(1, -1).map((t) => facePullFrame(t, 0))].map((f, i) => (i === STEPS.length - 1 ? { ...f, hold: 0.5 } : f)),
  },
  {
    id: "ntc_floor_windshield_wiper",
    slug: "floor-windshield-wiper",
    title: "Floor windshield wiper",
    views: TWO_VIEWS,
    transition: 0.7,
    frames: [wiper(0, 0.3), wiper(-68, 0.4), wiper(0, 0.1), wiper(68, 0.4)],
  },
];
