import { BONES, solvePose, zOut } from "./rig";
import type { AuthoredPose, DoodleSpec, Keyframe, Point, Pose, Side, Sideways } from "./rig";
import { solveKeyframe3 } from "./rig3d";
import { TOP_VIEWS } from "./sideways";

/**
 * Batch AW (#212): moves that waited for the sideways torso lean, the top view
 * and the elbow band loop. Floor at y = 0, up is negative, the side-view figure
 * faces +x.
 *
 * Left out:
 *   hf_170   Side-Lying Thoracic Rotation: lying on the side puts the shoulders one above the
 *     other, but the rig's shoulders are always level (z +-22 at one height) and the torso
 *     can lean but not roll about the spine; swapping the axes (z as "up") would draw a
 *     supine figure with knees up in the side panel, so no pair of views shows it honestly.
 */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

// ---------------------------------------------------------------- forearm plank hip dips (side + top)

const LEG = BONES.thigh + BONES.shin;
const PD_PELVIS: Point = [-36.1, -48];
const PD_CHEST: Point = [42.8, -61.1];
const PD_FOOT: Point = [-207.6, -19.3];
const PD_FOOT_Z = 8;
const PD_DIP = 26;

const hipDipSideways = (z: number): Sideways => ({
  pelvis: z,
  chest: 0,
  pivot: "chest",
  feet: { near: -PD_FOOT_Z, far: PD_FOOT_Z },
});

/**
 * Forearm plank with the hips swung `z` sideways under square shoulders. The
 * side-view spine is the plank's own; the sideways lean turns it, so it draws
 * shorter in the side view. The straight legs are pinned just short of that, so
 * each foot sits where its leg (in 3D, from the swung hip) is straight.
 */
function hipDipPose(z: number): AuthoredPose {
  const base: AuthoredPose = {
    pelvis: PD_PELVIS,
    chest: PD_CHEST,
    elbows: { near: { at: [62.6, -4] }, far: { at: [58.6, -4] } },
    hands: { near: [128.6, -4], far: [124.6, -4] },
    toes: { near: 62, far: 62 },
  };
  const sw = hipDipSideways(z);
  const figure = solveKeyframe3(solvePose(base as Pose), base as Pose, sw);
  const foot = (side: Side): Point => {
    const hip = figure.legs[side].root;
    const dz = hip[2] - (sw.feet?.[side] ?? 0);
    const dy = PD_FOOT[1] - hip[1];
    return [round(hip[0] - Math.sqrt(Math.max(0, (LEG - 0.3) ** 2 - dz ** 2 - dy ** 2))), PD_FOOT[1]];
  };
  return { ...base, feet: { near: foot("near"), far: foot("far") } };
}

const hipDip = (z: number, hold: number): Keyframe => ({ hold, pose: hipDipPose(z), sideways: hipDipSideways(z) });

// ---------------------------------------------------------------- 90/90 hip switch (side + top)

const HS_PELVIS: Point = [0, -12];
const HS_THIGH = BONES.thigh - 0.5;
const HS_SHIN = BONES.shin - 0.5;
const HS_HIP = 8;

/** Seated tall, hands on the floor behind for support. */
const hipSwitchBase = (): AuthoredPose => ({
  pelvis: HS_PELVIS,
  chest: [-4, -91],
  hands: { near: [-52, -4], far: [-52, -4] },
  elbows: { near: { bend: 1 }, far: { bend: 1 } },
});

/**
 * Both legs bent 90 degrees on the floor: `front` is the side whose thigh points
 * forward with the shin across to the `toward` side; the other thigh points out
 * to that side with the shin back. `toward`: -1 near, 1 far.
 */
function hipSwitchSide(front: Side, toward: 1 | -1, hold: number): Keyframe {
  const rear = front === "near" ? "far" : "near";
  const frontHip = zOut(front) * HS_HIP;
  const rearHip = zOut(rear) * HS_HIP;
  const rearKneeZ = rearHip + toward * HS_THIGH;
  return {
    hold,
    pose: {
      ...hipSwitchBase(),
      knees: { [front]: { dir: 0 }, [rear]: { dir: 180 } },
      feet: { [front]: { dir: 0, length: BONES.shin }, [rear]: { dir: 180, length: BONES.shin } },
      toes: { near: -80, far: -80 },
    } as AuthoredPose,
    sideways: {
      knees: { [rear]: { at: rearKneeZ } },
      feet: { [front]: frontHip + toward * HS_SHIN, [rear]: rearKneeZ },
    },
  };
}

/** Halfway: both knees up in a tent, feet on the floor in front. */
function hipSwitchTent(hold: number, lean: number): Keyframe {
  return {
    hold,
    pose: {
      ...hipSwitchBase(),
      feet: { near: [106 - lean, -9], far: [106 - lean, -9] },
    },
    sideways: { feet: { near: -22 + lean * 0.5, far: 22 + lean * 0.5 } },
  };
}

// ---------------------------------------------------------------- single-arm band row (elbow loop)

const BR_PELVIS: Point = [0, -172];
const BR_CHEST: Point = [0, -252];
const BR_ANCHOR: Point = [210, -268];
const BR_FEET = { near: [10, 0] as Point, far: [-6, 0] as Point };
const BR_SHOULDER = solvePose({ pelvis: BR_PELVIS, chest: BR_CHEST }).arms.near.root;

/** Standing still, the far arm hanging; the near arm reaches to the band, or the elbow drives back just past the back line (upper arm down and back, never level behind the torso) with the forearm forward. */
function bandRow(back: boolean): Pose {
  const elbow = back ? along(BR_SHOULDER, 112, BONES.upperArm) : along(BR_SHOULDER, -2, BONES.upperArm);
  const hand = back ? along(elbow, 2, BONES.forearm + BONES.hand) : along(elbow, -2, BONES.forearm + BONES.hand);
  return {
    pelvis: BR_PELVIS,
    chest: BR_CHEST,
    hands: { near: hand, far: [10, -146] },
    elbows: { near: { at: elbow }, far: { bend: 1 } },
    feet: BR_FEET,
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- quad stretch on a bench (side + front)

const QS_TOP = -80;
const QS_BENCH = { kind: "box" as const, x: -170, y: QS_TOP, w: 360, h: -QS_TOP, frontHalf: 30 };
const QS_PELVIS: Point = [0, QS_TOP - 10];
const QS_Z = -22;
/** The near (outside) thigh hangs off the edge and out, the knee bent below the bench's top. */
const QS_KNEE_Z = -94;

type QuadStage = "rest" | "swing" | "held";

/** Near foot (shin direction, toe angle, z past the knee) and hand (2D, z) at each stage: foot on the floor, swinging up behind, held. */
const QS_STAGES: Record<QuadStage, { shin: number; toe: number; footDz: number; hand: Point; handZ: number; hold: number }> = {
  rest: { shin: 14, toe: 20, footDz: 0, hand: [-100, -10], handZ: -50, hold: 0.4 },
  swing: { shin: 172, toe: 172, footDz: 20, hand: [-92, -28], handZ: QS_KNEE_Z + 20, hold: 0 },
  held: { shin: 190, toe: 190, footDz: 40, hand: [-86, -44], handZ: QS_KNEE_Z + 40, hold: 1.2 },
};

/** Lying on the back near the near edge: the far leg straight on the bench, the near leg off the side. */
function quadStretch(stage: QuadStage): Keyframe {
  const at = QS_STAGES[stage];
  const pose: AuthoredPose = {
    pelvis: QS_PELVIS,
    chest: [-80, QS_TOP - 12],
    head: [-134, QS_TOP - 26],
    hands: { near: at.hand, far: [-30, QS_TOP - 20] },
    elbows: { near: { bend: 1 }, far: { bend: -1 } },
    knees: { near: { dir: 100 } },
    feet: { near: { dir: at.shin }, far: [173, QS_TOP - 12] },
    toes: { near: at.toe, far: -80 },
  };
  return {
    hold: at.hold,
    pose,
    sideways: {
      pelvis: QS_Z,
      knees: { near: { at: QS_KNEE_Z } },
      feet: { near: QS_KNEE_Z + at.footDz, far: QS_Z + HS_HIP },
      hands: { near: at.handZ, far: QS_Z + 6 },
    },
  };
}

export const BATCH_AW_SPECS: DoodleSpec[] = [
  {
    id: "ntc_plank_hip_dips",
    slug: "plank-hip-dips",
    title: "Plank hip dips",
    views: TOP_VIEWS,
    transition: 0.8,
    frames: [hipDip(0, 0.2), hipDip(-PD_DIP, 0.4), hipDip(0, 0.1), hipDip(PD_DIP, 0.4)],
  },
  {
    id: "hf_158",
    slug: "90-90-hip-switch",
    title: "90/90 Hip Switch",
    views: TOP_VIEWS,
    transition: 0.9,
    frames: [hipSwitchSide("far", -1, 0.5), hipSwitchTent(0, 0), hipSwitchSide("near", 1, 0.5), hipSwitchTent(0, 0)],
  },
  {
    id: "wger_1877",
    slug: "single-arm-band-row",
    title: "Banded Scapular Retraction",
    straps: { anchor: BR_ANCHOR, end: "band", to: "elbows", sides: ["near"] },
    transition: 0.9,
    frames: [{ hold: 0.4, pose: bandRow(false) }, { hold: 0.5, pose: bandRow(true) }],
  },
  {
    id: "fedb_on_your_back_quad_stretch",
    slug: "on-your-back-quad-stretch",
    title: "On-Your-Back Quad Stretch",
    views: TOP_VIEWS,
    props: [QS_BENCH],
    transition: 1,
    frames: [quadStretch("rest"), quadStretch("swing"), quadStretch("held"), quadStretch("swing")],
  },
];
