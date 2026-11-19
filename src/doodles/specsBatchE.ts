import type { DoodleSpec, Point, Pose } from "./rig";

/**
 * Batch E: animated replacements for the hand-drawn JPEG leg doodles (squat,
 * lunge, hinge and calf patterns). Each spec sets `replaces: true` so the
 * animation takes over from the JPEG. Floor at y = 0, up is negative, facing +x.
 */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

/** Shoulder of a straight spine (pelvis → chest is 80, shoulder 18 further). */
const shoulderAt = (pelvis: Point, spine: number): Point => along(pelvis, spine, 98);

/** Arms hanging by the sides from a straight spine. */
function hangingHands(pelvis: Point, spine: number): { near: Point; far: Point } {
  const s = shoulderAt(pelvis, spine);
  return { near: [s[0] + 6, s[1] + 124], far: [s[0] + 2, s[1] + 124] };
}

// ---------------------------------------------------------------- bodyweight squat

function squatStand(): Pose {
  const pelvis: Point = [0, -172];
  return {
    pelvis,
    chest: along(pelvis, -90, 80),
    hands: hangingHands(pelvis, -90),
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [6, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

function squatBottom(): Pose {
  // Hips back and down, chest up, arms reaching forward for balance, heels down.
  const pelvis: Point = [-54, -84];
  const spine = -62;
  const s = shoulderAt(pelvis, spine);
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    hands: { near: [s[0] + 122, s[1] - 8], far: [s[0] + 118, s[1] - 8] },
    feet: { near: [6, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- Bulgarian split squat

const BENCH = { kind: "box" as const, x: -200, y: -64, w: 84, h: 64 };
/** Rear ankle just past the bench edge, the top of the foot lying back along the bench. */
const BSS_REAR: Point = [-110, -68];

function bulgarian(pelvis: Point, rearKneeBend: 1 | -1): Pose {
  const s = shoulderAt(pelvis, -84);
  return {
    pelvis,
    chest: along(pelvis, -84, 80),
    // Hands clasped in front of the chest.
    hands: { near: [s[0] + 34, s[1] + 34], far: [s[0] + 30, s[1] + 34] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { far: { bend: rearKneeBend } },
    feet: { near: [64, 0], far: BSS_REAR },
    toes: { near: 0, far: 178 },
  };
}

// ---------------------------------------------------------------- calf raises

/** Calf raises on the edge of a step: the balls of the feet on the edge, heels free to drop. */
const CALF_STEP_TOP = -80;
const CALF_STEP = { kind: "box" as const, x: 0, y: CALF_STEP_TOP, w: 100, h: -CALF_STEP_TOP };
const CALF_WALL = { kind: "box" as const, x: 100, y: -420, w: 14, h: 420 };
/** Floor line, so the step reads as standing on the floor rather than floating. */

/**
 * Ankle and foot angle on the step edge: `raised` stands tall on the toes,
 * otherwise the heel sinks below the step with the ball of the foot on the edge.
 */
function calfFoot(raised: boolean): { ankle: Point; toe: number } {
  if (raised) {
    // Toe tip on the step top just past the edge, foot steep.
    return { ankle: along([6, CALF_STEP_TOP - 1.5], 252, 20), toe: 72 };
  }
  // Ball of the foot just above the edge, heel dropped, forefoot tilted up.
  return { ankle: along([0, CALF_STEP_TOP - 2], 142, 14), toe: -38 };
}

function calfRaise(raised: boolean): Pose {
  const { ankle, toe } = calfFoot(raised);
  // Knees soft: pelvis a touch under full leg length above the ankle.
  const pelvis: Point = [ankle[0], round(ankle[1] - 172.5)];
  return {
    pelvis,
    chest: along(pelvis, -90, 80),
    hands: hangingHands(pelvis, -90),
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: ankle, far: ankle },
    toes: { near: toe, far: toe },
  };
}

function singleCalfRaise(raised: boolean): Pose {
  const { ankle, toe } = calfFoot(raised);
  const pelvis: Point = [ankle[0], round(ankle[1] - 172.5)];
  const knee = along(pelvis, 98, 88);
  return {
    pelvis,
    chest: along(pelvis, -90, 80),
    // Fingertips resting lightly on the wall; the other hand by the side.
    hands: { near: [99, pelvis[1] - 70], far: hangingHands(pelvis, -90).far },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    // Free foot hooked behind, off the step.
    knees: { far: { at: knee } },
    feet: { near: ankle, far: along(knee, 150, 86) },
    toes: { near: toe, far: 120 },
  };
}

// ---------------------------------------------------------------- Cossack squat (front view)

function cossack(shift: -1 | 0 | 1): Pose {
  const pelvis: Point = shift === 0 ? [0, -128] : [shift * 50, -74];
  const chest: Point = [pelvis[0] - shift * 6, pelvis[1] - 80];
  // Front view: shoulders 18 up the spine and 22 either side of it.
  const len = Math.hypot(chest[0] - pelvis[0], chest[1] - pelvis[1]);
  const up: Point = [(chest[0] - pelvis[0]) / len, (chest[1] - pelvis[1]) / len];
  const shoulder = (side: -1 | 1): Point => [chest[0] + up[0] * 18 - up[1] * 22 * side, chest[1] + up[1] * 18 + up[0] * 22 * side];
  // Elbows hang under the shoulders; hands meet under the chin.
  const elbowNear = along(shoulder(-1), 96, 60);
  const elbowFar = along(shoulder(1), 84, 60);
  return {
    pelvis,
    chest,
    hands: { near: along(elbowNear, -62, 66), far: along(elbowFar, -118, 66) },
    elbows: { near: { at: elbowNear }, far: { at: elbowFar } },
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [-117, shift === 1 ? -4 : 0], far: [117, shift === -1 ? -4 : 0] },
    // The straight leg's toes point up.
    toes: { near: shift === 1 ? -90 : 180, far: shift === -1 ? -90 : 0 },
  };
}

// ---------------------------------------------------------------- pistol squat

function pistol(depth: 0 | 1): Pose {
  // Bottom: full depth, hip just behind and above the heel, chest well forward.
  const pelvis: Point = depth ? [-16, -38] : [-4, -172];
  const spine = depth ? -52 : -88;
  const s = shoulderAt(pelvis, spine);
  // Free leg: hanging slightly forward at the top, held straight out in front at the bottom.
  const leg = depth ? -6 : 66;
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    hands: depth
      ? { near: [s[0] + 124, s[1] + 4], far: [s[0] + 120, s[1] + 4] }
      : { near: [s[0] + 110, s[1] + 50], far: [s[0] + 106, s[1] + 50] },
    feet: { near: [8, 0], far: along(pelvis, leg, 172) },
    toes: { near: 0, far: leg - 80 },
  };
}

// ---------------------------------------------------------------- shrimp squat

function shrimp(depth: 0 | 1): Pose {
  const pelvis: Point = depth ? [-28, -90] : [0, -172];
  const spine = depth ? -64 : -88;
  const thigh = depth ? 105 : 100;
  const shin = depth ? 258 : 245;
  const knee = along(pelvis, thigh, 88);
  const foot = along(knee, shin, 86);
  const s = shoulderAt(pelvis, spine);
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    // Near arm reaches forward for balance; far hand holds the rear foot.
    hands: { near: [s[0] + 120, s[1] + (depth ? 10 : 30)], far: [foot[0] - 2, foot[1] + 2] },
    elbows: { far: { bend: 1 } },
    knees: { far: { at: knee } },
    feet: { near: [8, 0], far: foot },
    toes: { near: 0, far: 200 },
  };
}

// ---------------------------------------------------------------- step-up

const STEP_BOX = { kind: "box" as const, x: 40, y: -72, w: 150, h: 72 };

function stepStart(): Pose {
  // Whole lead foot on the box, trailing foot on the floor, chest leaning slightly forward.
  const pelvis: Point = [-6, -164];
  return {
    pelvis,
    chest: along(pelvis, -80, 80),
    hands: hangingHands(pelvis, -80),
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [62, -73], far: [-34, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Driving up through the lead foot; the trailing foot has just left the floor. */
function stepRise(): Pose {
  const pelvis: Point = [44, -226];
  return {
    pelvis,
    chest: along(pelvis, -84, 80),
    hands: hangingHands(pelvis, -84),
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { far: { bend: -1 } },
    feet: { near: [62, -73], far: [0, -96] },
    toes: { near: 0, far: 5 },
  };
}

function stepTop(): Pose {
  const pelvis: Point = [60, -245];
  return {
    pelvis,
    chest: along(pelvis, -90, 80),
    hands: hangingHands(pelvis, -90),
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [62, -73], far: [56, -73] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- reverse lunge

type LungeStage = "stand" | "step" | "down";

const LUNGE_PELVIS: Record<LungeStage, Point> = { stand: [0, -172], step: [-40, -166], down: [-50, -96] };

function lunge(stage: LungeStage): Pose {
  const pelvis = LUNGE_PELVIS[stage];
  const back = stage !== "stand";
  return {
    pelvis,
    chest: along(pelvis, -88, 80),
    // Hands on the hips, elbows back.
    hands: { near: [pelvis[0] + 4, pelvis[1] - 16], far: [pelvis[0], pelvis[1] - 16] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { far: { bend: -1 } },
    // The back foot lands on the ball of the foot, heel up.
    feet: { near: [6, 0], far: back ? [-126, -20] : [0, 0] },
    toes: { near: 0, far: back ? 78 : 0 },
  };
}

// ---------------------------------------------------------------- hip hinge

function hinge(down: boolean): Pose {
  const pelvis: Point = down ? [-44, -160] : [0, -172];
  const spine = down ? -24 : -90;
  const s = shoulderAt(pelvis, spine);
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    // Arms hang straight down from the shoulders.
    hands: down ? { near: [s[0] + 4, s[1] + 124], far: [s[0], s[1] + 124] } : hangingHands(pelvis, spine),
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [6, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

export const BATCH_E_SPECS: DoodleSpec[] = [
  {
    id: "bodyweight_squat",
    slug: "bodyweight-squat",
    title: "Bodyweight squat",
    replaces: true,
    transition: 1.1,
    frames: [
      { hold: 0.5, pose: squatStand() },
      { hold: 0.4, pose: squatBottom() },
    ],
  },
  {
    id: "bulgarian_split",
    slug: "bulgarian-split-squat",
    title: "Bulgarian split squat",
    replaces: true,
    props: [BENCH],
    transition: 1.1,
    frames: [
      { hold: 0.5, pose: bulgarian([-14, -150], -1) },
      { hold: 0.4, pose: bulgarian([-30, -96], -1) },
    ],
  },
  {
    id: "calf_raise",
    slug: "calf-raise",
    title: "Calf raise",
    replaces: true,
    props: [CALF_STEP, { kind: "floor" }],
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: calfRaise(false) },
      { hold: 0.6, pose: calfRaise(true) },
    ],
  },
  {
    id: "single_leg_calf_raise",
    slug: "single-leg-calf-raise",
    title: "Single-leg calf raise",
    replaces: true,
    props: [CALF_STEP, CALF_WALL, { kind: "floor" }],
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: singleCalfRaise(false) },
      { hold: 0.6, pose: singleCalfRaise(true) },
    ],
  },
  {
    id: "cossack_squat",
    slug: "cossack-squat",
    title: "Cossack squat",
    replaces: true,
    view: "front",
    transition: 1.1,
    frames: [
      { hold: 0.3, pose: cossack(0) },
      { hold: 0.5, pose: cossack(-1) },
      { hold: 0.3, pose: cossack(0) },
      { hold: 0.5, pose: cossack(1) },
    ],
  },
  {
    id: "pistol_squat",
    slug: "pistol-squat",
    title: "Pistol squat",
    replaces: true,
    transition: 1.3,
    frames: [
      { hold: 0.5, pose: pistol(0) },
      { hold: 0.4, pose: pistol(1) },
    ],
  },
  {
    id: "shrimp_squat",
    slug: "shrimp-squat",
    title: "Shrimp squat",
    replaces: true,
    transition: 1.3,
    frames: [
      { hold: 0.5, pose: shrimp(0) },
      { hold: 0.4, pose: shrimp(1) },
    ],
  },
  {
    id: "step_up",
    slug: "step-up",
    title: "Step-up",
    replaces: true,
    props: [STEP_BOX],
    transition: 0.6,
    frames: [
      { hold: 0.4, pose: stepStart() },
      { hold: 0, pose: stepRise() },
      { hold: 0.5, pose: stepTop() },
      { hold: 0, pose: stepRise() },
    ],
  },
  {
    id: "reverse_lunge",
    slug: "reverse-lunge",
    title: "Reverse lunge",
    replaces: true,
    transition: 0.6,
    frames: [
      { hold: 0.4, pose: lunge("stand") },
      { hold: 0, pose: lunge("step") },
      { hold: 0.5, pose: lunge("down") },
      { hold: 0, pose: lunge("step") },
    ],
  },
  {
    id: "hip_hinge",
    slug: "hip-hinge",
    title: "Hip hinge",
    replaces: true,
    transition: 1.2,
    frames: [
      { hold: 0.4, pose: hinge(false) },
      { hold: 0.5, pose: hinge(true) },
    ],
  },
];
