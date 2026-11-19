import { BATCH_A_SPECS } from "./specsBatchA";
import { BATCH_B_SPECS } from "./specsBatchB";
import { BATCH_C_SPECS } from "./specsBatchC";
import { BATCH_D_SPECS } from "./specsBatchD";
import { BATCH_E_SPECS } from "./specsBatchE";
import { BATCH_F_SPECS } from "./specsBatchF";
import { BATCH_G_SPECS } from "./specsBatchG";
import { BATCH_H_SPECS } from "./specsBatchH";
import { BATCH_I_SPECS } from "./specsBatchI";
import { BATCH_J_SPECS } from "./specsBatchJ";
import { BATCH_M_SPECS } from "./specsBatchM";
import { BATCH_N_SPECS } from "./specsBatchN";
import { BATCH_O_SPECS } from "./specsBatchO";
import { BATCH_P_SPECS } from "./specsBatchP";
import { BATCH_Q_SPECS } from "./specsBatchQ";
import { BATCH_R_SPECS } from "./specsBatchR";
import { BATCH_S_SPECS } from "./specsBatchS";
import { BATCH_T_SPECS } from "./specsBatchT";
import { BATCH_U_SPECS } from "./specsBatchU";
import { BATCH_V_SPECS } from "./specsBatchV";
import { BATCH_W_SPECS } from "./specsBatchW";
import { BATCH_X_SPECS } from "./specsBatchX";
import { BATCH_Y_SPECS } from "./specsBatchY";
import { BATCH_Z_SPECS } from "./specsBatchZ";
import { BATCH_AA_SPECS } from "./specsBatchAA";
import { BATCH_AB_SPECS } from "./specsBatchAB";
import { BATCH_AC_SPECS } from "./specsBatchAC";
import { BATCH_AE_SPECS } from "./specsBatchAE";
import { BATCH_AF_SPECS } from "./specsBatchAF";
import { BATCH_AG_SPECS } from "./specsBatchAG";
import { BATCH_AH_SPECS } from "./specsBatchAH";
import { BATCH_AI_SPECS } from "./specsBatchAI";
import { BATCH_AD_SPECS } from "./specsBatchAD";
import { BATCH_AJ_SPECS } from "./specsBatchAJ";
import { BATCH_AL_SPECS } from "./specsBatchAL";
import { BATCH_AK_SPECS } from "./specsBatchAK";
import { BATCH_AM_SPECS } from "./specsBatchAM";
import { BATCH_AN_SPECS } from "./specsBatchAN";
import { BATCH_AO_SPECS } from "./specsBatchAO";
import { BATCH_AP_SPECS } from "./specsBatchAP";
import { BATCH_AQ_SPECS } from "./specsBatchAQ";
import { BATCH_AR_SPECS } from "./specsBatchAR";
import { BATCH_AS_SPECS } from "./specsBatchAS";
import { BATCH_AT_SPECS } from "./specsBatchAT";
import { BATCH_AU_SPECS } from "./specsBatchAU";
import { BATCH_AW_SPECS } from "./specsBatchAW";
import { BATCH_AV_SPECS } from "./specsBatchAV";
import { BATCH_BI_SPECS } from "./specsBatchBI";
import { STRETCH_SPECS } from "./specsStretch";
import { proneFromAbove, WARMUP_DRILL_SPECS } from "./specsWarmup";
import { solvePose } from "./rig";
import type { DoodleSpec, Point, Pose, Prop } from "./rig";

/**
 * Poses for the most-scheduled Library moves without a doodle, written from
 * their curated descriptions. Floor at y = 0, up is negative, facing +x.
 * Rig v2: each keyframe pins only the joints that define the move; the rest
 * is solved with every bone at its fixed length.
 *
 * Joints pinned per spec (every keyframe pins `pelvis`; "spine from hands"
 * means the chest is left unpinned and solved so the support arms are straight):
 *   pike-pushup-floor          hands, feet, toes; spine from hands, chest pinned at the bottom
 *   bird-dog                   hands, feet, toes; spine from hands, chest pinned when a hand lifts
 *   box-squat                  chest, hands, feet, toes
 *   chin-up (front)            chest, hands, feet, toes; elbow bend at the top
 *   single-leg-rdl             chest, hands, feet, toes
 *   glute-bridge-march         chest, head, hands, elbow bend, feet, toes
 *   sliding-leg-curl           chest, head, hands, elbow bend, feet, toes
 *   parallel-bar-knee-raise    chest, hands, knees, feet, toes; mid-span, legs hanging, knees raised
 *   donkey-kick                hands, feet, toes; spine from hands; near knee when kicking
 *   forearm-plank              chest, elbows, hands, feet, toes
 *   prone-scapular-retraction  chest, hands, elbows, feet, toes; straight arms lift 18° off the floor
 *   elbow-lever                chest, elbows, hands, feet, toes
 *   reverse-snow-angel (front) seen from above: chest, head, hands, feet, toes (proneFromAbove)
 *   arch-hang                  head, hands, feet, toes; spine from hands, then chest + arch bend
 *   active-hang (front)        chest, head, hands, elbows, knees, feet, toes; only the head/shoulders move
 *   tuck-l-sit                 hands, chest, knees, feet; static hold with the knees tucked
 *   press-to-handstand         hands, feet, toes; spine from hands, chest pinned once inverted; legs move together
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

/** Chest for a straight spine pointing from the pelvis towards `shoulder` (pelvis→chest is 80). */
const chestToward = (pelvis: Point, shoulder: Point): Point => along(pelvis, angle(pelvis, shoulder), 80);

/** Shoulder of a straight spine (chest + 18 along the spine). */
const shoulderOf = (pelvis: Point, chest: Point): Point => along(pelvis, angle(pelvis, chest), 98);

/** Hands and knees: hands under the shoulders, knees under the hips, tops of the feet flat. */
function allFours(): Pose {
  const pelvis: Point = [-50, -92];
  return {
    pelvis,
    // Spine solved from the hands (arms straight).
    hands: { near: [48, 0], far: [44, 0] },
    feet: { near: [-136, -4], far: [-132, -4] },
    toes: { near: 180, far: 180 },
  };
}

const SUPINE_CHORD = 77;
const SUPINE_BEND: 1 | -1 = -1;

/** The upright a supported split squat holds for balance. */
const SPLIT_POST_X = 98;

/** Points around the hip circle, an eighth of a turn apart, starting hips-forward. */
const HIP_CIRCLE_STEPS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i * Math.PI) / 4);
/** Forward/back reach of the hips and how far they drop at the sides of the circle. */
const HIP_CIRCLE_REACH = 32;
const HIP_CIRCLE_DIP = 5;

/** Mat top; the hands rest on it. */
const TUCK_MAT_Y = -4;
/** Shoulder to fingertips with the elbow locked (upper arm + forearm + hand). */
const LOCKED_ARM = 126;
/** A thin mat under the hands, so the gap under the seat and feet reads. */
const TUCK_MAT: Prop = { kind: "box", x: -90, y: TUCK_MAT_Y, w: 170, h: 4 };

/**
 * Tuck L-sit hold, side view: torso upright, locked arms straight down beside
 * the hips, seat lifted just off the mat, thighs pulled up toward the chest
 * and shins hanging so the feet stay clear. `squeeze` draws the knees higher.
 */
function tuckLSit(squeeze: 0 | 1): Pose {
  const pelvis: Point = [0, -26];
  const knee = along(pelvis, squeeze ? -66 : -60, 88);
  const ankle = along(knee, 85, 86);
  const base: Pose = {
    pelvis,
    // Torso leans back a touch, so the arm angles forward to the hands.
    chest: [-8, -105],
    knees: { near: { at: knee }, far: { at: knee } },
    feet: { near: ankle, far: ankle },
    toes: { near: 20, far: 20 },
  };
  // A locked arm from the shoulder lands on the mat just ahead of the hips; the elbow sits on that line.
  const shoulder = solvePose(base).arms.near.root;
  const drop = TUCK_MAT_Y - shoulder[1];
  const hand: Point = [round(shoulder[0] + Math.sqrt(LOCKED_ARM ** 2 - drop ** 2)), TUCK_MAT_Y];
  const elbow = along(shoulder, angle(shoulder, hand), 60);
  // Side view: both arms and both legs stack.
  return { ...base, hands: { near: hand, far: hand }, elbows: { near: { at: elbow }, far: { at: elbow } } };
}

/** Head pushed through between the arms, forward of the arm line. */
const PRESS_HEAD: Point = [92, -104];
const PRESS_CHEST: Point = [60.5, -143.6];

/** Front-view hang with elbows and knees pinned on their straight lines, so nothing kinks. */
const ACTIVE_HANG: Pose = {
  ...frontBarHang(-201, 56, 174.75),
  elbows: { near: { at: [-38.2, -356.8] }, far: { at: [38.2, -356.8] } },
  knees: { near: { at: [-11, -113] }, far: { at: [11, -113] } },
};

/** Parallel-bar rail height for the knee raise: hanging feet stay well clear of the floor. */
const KR_RAIL = -236;

const SESSION_MOVE_SPECS: DoodleSpec[] = [
  {
    id: "hf_19",
    slug: "pike-pushup-floor",
    title: "Pike push-up",
    frames: [
      {
        hold: 0.5,
        // Minimal: pelvis, hands and feet; the spine is solved from the hands.
        pose: {
          pelvis: [-28, -166],
          hands: { near: [66, 0], far: [60, 0] },
          feet: { near: [-78, 0], far: [-74, 0] },
          toes: { near: 0, far: 0 },
        },
      },
      {
        hold: 0.3,
        pose: {
          // Hips stay put; only the elbows bend and the head drops between the hands.
          pelvis: [-12, -152],
          chest: chestToward([-12, -152], [62, -82]),
          head: [86, -59],
          hands: { near: [66, 0], far: [60, 0] },
          feet: { near: [-78, 0], far: [-74, 0] },
          toes: { near: 0, far: 0 },
        },
      },
    ],
  },
  {
    id: "hf_116",
    slug: "bird-dog",
    title: "Bird dog",
    transition: 1.1,
    frames: [
      { hold: 0.5, pose: allFours() },
      {
        hold: 0.8,
        pose: {
          ...allFours(),
          // One hand leaves the floor, so pin the chest where the support arm left it.
          chest: along([-50, -92], -20.5, 80),
          // Forward arm aimed 20° below level so it passes under the head.
          hands: { near: along(shoulderOf([-50, -92], along([-50, -92], -20.5, 80)), 20, 125), far: [44, 0] },
          // Leg straight back at hip height; foot flexed, toes down.
          feet: { near: [-136, -4], far: [-220, -98] },
          toes: { near: 180, far: 95 },
        },
      },
    ],
  },
  {
    id: "wger_977",
    slug: "box-squat",
    title: "Box squat",
    props: [{ kind: "box", x: -130, y: -84, w: 90, h: 84 }],
    frames: [
      {
        hold: 0.5,
        pose: {
          pelvis: [0, -172],
          chest: [0, -252],
          hands: { near: [122, -262], far: [116, -262] },
          feet: { near: [12, 0], far: [6, 0] },
          toes: { near: 0, far: 0 },
        },
      },
      {
        hold: 0.5,
        pose: {
          // Sitting back onto the box, chest leaning forward, arms out for balance.
          pelvis: [-52, -94],
          chest: along([-52, -94], -62, 80),
          hands: { near: [112, -180], far: [106, -180] },
          feet: { near: [12, 0], far: [6, 0] },
          toes: { near: 0, far: 0 },
        },
      },
    ],
  },
  {
    id: "hf_44",
    slug: "chin-up",
    title: "Chin-up",
    view: "front",
    props: [{ kind: "bar", y: -420, x1: -150, x2: 150, grips: [-80, 80] }],
    transition: 1,
    frames: [
      { hold: 0.5, pose: frontBarHang(-210.7, 80, 172, { near: { bend: -1 }, far: { bend: 1 } }) },
      {
        hold: 0.4,
        pose: {
          // Chin over the bar, elbows folded down and out.
          ...frontBarHang(-310, 80, 172),
          elbows: { near: { bend: -1 }, far: { bend: 1 } },
        },
      },
    ],
  },
  {
    id: "hf_85",
    slug: "single-leg-rdl",
    title: "Single-leg Romanian deadlift",
    transition: 1.2,
    frames: [
      {
        hold: 0.5,
        pose: {
          pelvis: [0, -172],
          chest: [0, -252],
          hands: { near: [8, -150], far: [2, -150] },
          feet: { near: [0, 0], far: [-10, -30] },
          toes: { near: 0, far: 60 },
        },
      },
      {
        hold: 0.6,
        pose: {
          // Hinge: chest forward and level, free leg straight back in line with it.
          pelvis: [-4, -168],
          chest: along([-4, -168], -10, 80),
          hands: { near: [100, -66], far: [94, -66] },
          feet: { near: [0, 0], far: [-174, -178] },
          toes: { near: 0, far: 95 },
        },
      },
    ],
  },
  {
    id: "ntc_glute_bridge_march",
    slug: "glute-bridge-march",
    title: "Glute bridge march",
    transition: 0.7,
    frames: [
      { hold: 0.3, pose: bridge() },
      { hold: 0.5, pose: { ...bridge(), feet: { near: [76, -56], far: [78, 0] }, toes: { near: 20, far: 0 } } },
      { hold: 0.3, pose: bridge() },
      { hold: 0.5, pose: { ...bridge(), feet: { near: [82, 0], far: [72, -56] }, toes: { near: 0, far: 20 } } },
    ],
  },
  {
    id: "hf_84",
    slug: "sliding-leg-curl",
    title: "Sliding leg curl",
    transition: 1.2,
    frames: [
      {
        hold: 0.5,
        pose: {
          ...lyingFaceUp([-12, -80]),
          feet: { near: [62, -4], far: [58, -4] },
          toes: { near: -60, far: -60 },
        },
      },
      {
        hold: 0.5,
        pose: {
          ...lyingFaceUp([-12, -76]),
          feet: { near: [142, -4], far: [138, -4] },
          toes: { near: -70, far: -70 },
        },
      },
    ],
  },
  {
    id: "fedb_knee_hip_raise_on_parallel_bars",
    slug: "parallel-bar-knee-raise",
    title: "Knee raise on parallel bars",
    // Figure in the middle of the span; uprights well clear of the hanging legs and the knee raise.
    props: [{ kind: "parallelBars", y: KR_RAIL, x1: -130, x2: 230 }],
    transition: 0.9,
    frames: [
      // Straight-arm support, legs hanging straight down in the air.
      { hold: 0.5, pose: kneeRaise(false) },
      // Knees up past hip height, shins hanging, pelvis curling up (back rounds a little).
      { hold: 0.5, pose: kneeRaise(true) },
    ],
  },
  {
    id: "hf_88",
    slug: "donkey-kick",
    title: "Donkey kick",
    frames: [
      { hold: 0.4, pose: allFours() },
      {
        hold: 0.5,
        pose: {
          ...allFours(),
          // Knee bent 90°, thigh back level with the hip, sole to the ceiling.
          knees: { near: { at: along([-50, -92], 180, 88) } },
          feet: { near: along(along([-50, -92], 180, 88), -90, 86), far: [-132, -4] },
        },
      },
    ],
  },
  {
    id: "hf_99",
    slug: "forearm-plank",
    title: "Forearm plank",
    transition: 1.6,
    frames: [
      { hold: 1.2, pose: forearmPlank(-48) },
      { hold: 1.2, pose: forearmPlank(-52) },
    ],
  },
  {
    id: "wger_468",
    slug: "prone-scapular-retraction",
    title: "Prone scapular retraction",
    frames: [
      // Arms long by the sides, hands on the floor; with the squeeze the straight arms lift ~18°.
      { hold: 0.5, pose: proneRetraction(0) },
      { hold: 0.7, pose: proneRetraction(1) },
    ],
  },
  {
    id: "hf_128",
    slug: "elbow-lever",
    title: "Elbow lever",
    transition: 1.3,
    frames: [
      { hold: 0.5, pose: elbowLever(-70, -1) },
      { hold: 1, pose: elbowLever(-78, -2) },
    ],
  },
  {
    id: "ntc_reverse_snow_angel",
    slug: "reverse-snow-angel",
    title: "Reverse snow angel",
    // Seen from above: straight arms sweep just off the floor from the hips, out through a T, to overhead.
    view: "front",
    transition: 0.6,
    frames: [
      { hold: 0.4, pose: proneFromAbove(172) },
      { hold: 0.05, pose: proneFromAbove(90) },
      { hold: 0.5, pose: proneFromAbove(22) },
      { hold: 0.05, pose: proneFromAbove(90) },
    ],
  },
  {
    id: "wger_2533",
    slug: "arch-hang",
    title: "Arch hang",
    props: [{ kind: "bar", y: -420, x1: -110, x2: 110, grips: [0] }],
    transition: 1.4,
    frames: [
      {
        hold: 0.6,
        pose: {
          // Dead hang: spine solved from the hands; head forward of the arms.
          pelvis: [0, -196],
          head: [34, -318],
          hands: { near: [4, -420], far: [0, -420] },
          feet: { near: [4, -24], far: [0, -24] },
          toes: { near: 75, far: 75 },
        },
      },
      {
        hold: 1.2,
        pose: {
          // Chest up towards the bar, shoulders behind the hands, back arched, legs behind.
          pelvis: [-42, -216],
          chest: [3, -278],
          spine: { bend: 1 },
          head: [38, -316],
          hands: { near: [4, -420], far: [0, -420] },
          feet: { near: [-78, -48], far: [-81, -48] },
          toes: { near: 75, far: 75 },
        },
      },
    ],
  },
  {
    id: "wger_2690",
    slug: "active-hang",
    title: "Active hang",
    view: "front",
    props: [{ kind: "bar", y: -420, x1: -150, x2: 150, grips: [-56, 56] }],
    transition: 1.3,
    frames: [
      // Passive: shoulders shrugged up around the ears, head sunk. Active: shoulders drawn down,
      // the head rises out of them. Arms stay locked and the legs hang straight and still
      // (the shoulder-blade drop itself is shown in the zoomed inset).
      { hold: 0.8, pose: { ...ACTIVE_HANG, head: [0, -332] } },
      { hold: 1.6, pose: { ...ACTIVE_HANG, head: [0, -337] } },
    ],
  },
  {
    id: "wger_1704",
    slug: "tuck-l-sit",
    title: "Tuck L-sit",
    props: [TUCK_MAT],
    transition: 1.1,
    frames: [
      { hold: 1.4, pose: tuckLSit(0) },
      { hold: 0.8, pose: tuckLSit(1) },
    ],
  },
  {
    id: "hf_127",
    slug: "press-to-handstand",
    title: "Press to handstand",
    transition: 1.2,
    frames: [
      { hold: 0.5, pose: pressPike() },
      { hold: 0.3, pose: pressLean() },
      { hold: 0.3, pose: pressHipsOver() },
      { hold: 1, pose: handstand() },
      // Lower back down the same way.
      { hold: 0.2, pose: pressHipsOver() },
      { hold: 0.2, pose: pressLean() },
    ],
  },
  {
    id: "wger_2557",
    slug: "supported-split-squat",
    title: "Supported split squat",
    // A rep move: one hand on an upright (rack, door frame, chair back) for balance only.
    props: [{ kind: "box", x: SPLIT_POST_X, y: -250, w: 8, h: 250 }],
    transition: 1,
    frames: [
      { hold: 0.4, pose: supportedSplit([-10, -150]) },
      { hold: 0.4, pose: supportedSplit([-14, -104]) },
    ],
  },
  {
    id: "fedb_split_squats",
    slug: "split-squats",
    title: "Split squat",
    transition: 1,
    frames: [
      { hold: 0.4, pose: splitSquat([-10, -150]) },
      { hold: 0.4, pose: splitSquat([-10, -100]) },
    ],
  },
  {
    id: "hf_91",
    slug: "deficit-step-down",
    title: "Deficit step-down",
    props: [{ kind: "box", x: -90, y: -40, w: 120, h: 40 }],
    transition: 1.2,
    frames: [
      {
        hold: 0.5,
        pose: {
          pelvis: [4, -208],
          chest: along([4, -208], -90, 80),
          hands: { near: [114, -276], far: [108, -276] },
          feet: { near: [4, -40], far: [40, -52] },
          toes: { near: 0, far: 90 },
        },
      },
      {
        hold: 0.5,
        pose: {
          // Hips back, standing knee forward, free heel tapping the floor in front of the box.
          pelvis: [-10, -162],
          chest: along([-10, -162], -80, 80),
          hands: { near: [104, -232], far: [98, -232] },
          feet: { near: [4, -40], far: [50, 0] },
          toes: { near: 0, far: -30 },
        },
      },
    ],
  },
  {
    id: "hf_72",
    slug: "skater-squat",
    title: "Skater squat",
    transition: 1.2,
    frames: [
      {
        hold: 0.4,
        pose: {
          pelvis: [0, -172],
          chest: [0, -252],
          hands: { near: [116, -262], far: [110, -262] },
          feet: { near: [0, 0], far: [-90, -120] },
          toes: { near: 0, far: 135 },
        },
      },
      {
        hold: 0.5,
        pose: {
          pelvis: [-35, -95],
          chest: along([-35, -95], -65, 80),
          hands: { near: [90, -190], far: [84, -190] },
          feet: { near: [0, 0], far: [-140, -45] },
          toes: { near: 0, far: 135 },
        },
      },
    ],
  },
  {
    id: "wger_1948",
    slug: "one-leg-box-squat",
    title: "One-leg box squat",
    props: [{ kind: "box", x: -130, y: -84, w: 90, h: 84 }],
    transition: 1.2,
    frames: [
      {
        hold: 0.5,
        pose: {
          pelvis: [0, -172],
          chest: [0, -252],
          hands: { near: [122, -262], far: [116, -262] },
          feet: { near: [10, 0], far: along([0, -172], 20, 170) },
          toes: { near: 0, far: -70 },
        },
      },
      {
        hold: 0.5,
        pose: {
          // Sitting back to touch the box; free leg held straight out in front.
          pelvis: [-52, -94],
          chest: along([-52, -94], -62, 80),
          hands: { near: [112, -180], far: [106, -180] },
          feet: { near: [10, 0], far: along([-52, -94], -5, 170) },
          toes: { near: 0, far: -70 },
        },
      },
    ],
  },
  {
    id: "hf_75",
    slug: "archer-squat",
    title: "Archer squat",
    view: "front",
    transition: 1.3,
    frames: [
      { hold: 0.4, pose: archer([2, -131]) },
      { hold: 0.5, pose: archer([-30, -88]) },
      { hold: 0.4, pose: archer([2, -131]) },
    ],
  },
  {
    id: "hf_122",
    slug: "lying-leg-raise",
    title: "Lying leg raise",
    transition: 0.35,
    frames: [
      { hold: 0.5, pose: lyingLegs(-6) },
      { hold: 0.05, pose: lyingLegs(-30) },
      { hold: 0.05, pose: lyingLegs(-60) },
      { hold: 0.5, pose: lyingLegs(-88) },
      { hold: 0.05, pose: lyingLegs(-60) },
      { hold: 0.05, pose: lyingLegs(-30) },
    ],
  },
  {
    id: "hf_119",
    slug: "reverse-crunch",
    title: "Reverse crunch",
    transition: 0.9,
    frames: [
      { hold: 0.5, pose: reverseCrunch(false) },
      { hold: 0.6, pose: reverseCrunch(true) },
    ],
  },
  {
    id: "hf_110",
    slug: "hanging-leg-raise",
    title: "Hanging leg raise",
    props: [{ kind: "bar", y: -420, x1: -110, x2: 110, grips: [0] }],
    transition: 0.3,
    frames: [
      { hold: 0.5, pose: hangingLegs(88) },
      { hold: 0.05, pose: hangingLegs(60) },
      { hold: 0.05, pose: hangingLegs(30) },
      { hold: 0.5, pose: hangingLegs(-5) },
      { hold: 0.05, pose: hangingLegs(30) },
      { hold: 0.05, pose: hangingLegs(60) },
    ],
  },
  {
    id: "hf_111",
    slug: "windshield-wiper",
    title: "Windshield wiper",
    view: "front",
    props: [{ kind: "bar", y: -420, x1: -150, x2: 150, grips: [-56, 56] }],
    transition: 0.3,
    frames: [
      { hold: 0.4, pose: wiperLegs(-55) },
      { hold: 0.05, pose: wiperLegs(-35) },
      { hold: 0.05, pose: wiperLegs(-18) },
      { hold: 0.05, pose: wiperLegs(18) },
      { hold: 0.05, pose: wiperLegs(35) },
      { hold: 0.4, pose: wiperLegs(55) },
      { hold: 0.05, pose: wiperLegs(35) },
      { hold: 0.05, pose: wiperLegs(18) },
      { hold: 0.05, pose: wiperLegs(-18) },
      { hold: 0.05, pose: wiperLegs(-35) },
    ],
  },
  {
    id: "wger_1529",
    slug: "toes-to-bar",
    title: "Toes to bar",
    props: [{ kind: "bar", y: -420, x1: -110, x2: 110, grips: [0] }],
    transition: 0.6,
    frames: [
      // Dead hang, then straight legs forward to an L, then hips back and up into a pike, toes at the bar.
      { hold: 0.4, pose: toesToBarPose([0, -196], along([0, -196], 89, 173.85)) },
      { hold: 0.05, pose: toesToBarPose([-6, -198], along([-6, -198], 0, 173.85)) },
      { hold: 0.5, pose: toesToBarPose([-80, -258], [12, -402], -20) },
      { hold: 0.05, pose: toesToBarPose([-6, -198], along([-6, -198], 0, 173.85)) },
    ],
  },
  {
    id: "wall_handstand",
    slug: "wall-handstand",
    title: "Wall handstand",
    replaces: true,
    props: [{ kind: "box", x: 17, y: -470, w: 14, h: 470 }],
    transition: 1.6,
    frames: [
      { hold: 1, pose: wallHandstand(0) },
      { hold: 1, pose: wallHandstand(1) },
    ],
  },
  {
    id: "pulse_raiser_march",
    slug: "march-in-place",
    title: "March in place",
    replaces: true,
    transition: 0.25,
    frames: [
      { hold: 0.15, pose: march(true) },
      { hold: 0.05, pose: marchStand() },
      { hold: 0.15, pose: march(false) },
      { hold: 0.05, pose: marchStand() },
    ],
  },
  {
    id: "hip_circles",
    slug: "hip-circles",
    title: "Hip circles",
    replaces: true,
    // Side view: the circle reads as hips pushed forward, then the bottom swept out behind.
    transition: 0.35,
    frames: HIP_CIRCLE_STEPS.map((step) => ({ hold: 0, pose: hipCircle(step) })),
  },
  {
    id: "ankle_rocks",
    slug: "ankle-rocks",
    title: "Ankle rocks",
    replaces: true,
    transition: 1,
    frames: [
      { hold: 0.5, pose: ankleRock(90) },
      { hold: 0.6, pose: ankleRock(58) },
    ],
  },
  {
    id: "glute_bridge",
    slug: "glute-bridge",
    title: "Glute bridge",
    replaces: true,
    transition: 0.9,
    frames: [
      {
        hold: 0.4,
        pose: { ...lyingFaceUp([-12, -24]), feet: { near: [82, 0], far: [78, 0] }, toes: { near: 0, far: 0 } },
      },
      {
        hold: 0.6,
        pose: {
          ...lyingFaceUp([-15, -51]),
          knees: { near: { at: [66.3, -84.6] }, far: { at: [66.3, -84.6] } },
          feet: { near: [82, 0], far: [80, 0] },
          toes: { near: 0, far: 0 },
        },
      },
    ],
  },
  {
    id: "wrist_load",
    slug: "wrist-load",
    title: "Wrist load",
    replaces: true,
    transition: 1.2,
    frames: [
      { hold: 0.4, pose: wristRock(false) },
      { hold: 0.5, pose: wristRock(true) },
    ],
  },
  {
    id: "scap_pushup",
    slug: "scap-pushup",
    title: "Scapular push-up",
    replaces: true,
    transition: 0.8,
    frames: [
      { hold: 0.4, pose: scapPlank(0) },
      { hold: 0.4, pose: scapPlank(1) },
    ],
  },
];

/** Session moves, then warm-up drills, then cool-down stretches. */
export const DOODLE_SPECS: DoodleSpec[] = [...SESSION_MOVE_SPECS, ...WARMUP_DRILL_SPECS, ...STRETCH_SPECS, ...BATCH_A_SPECS, ...BATCH_B_SPECS, ...BATCH_C_SPECS, ...BATCH_D_SPECS, ...BATCH_E_SPECS, ...BATCH_F_SPECS, ...BATCH_G_SPECS, ...BATCH_H_SPECS, ...BATCH_I_SPECS, ...BATCH_J_SPECS, ...BATCH_M_SPECS, ...BATCH_N_SPECS, ...BATCH_O_SPECS, ...BATCH_P_SPECS, ...BATCH_Q_SPECS, ...BATCH_R_SPECS, ...BATCH_S_SPECS, ...BATCH_T_SPECS, ...BATCH_U_SPECS, ...BATCH_V_SPECS, ...BATCH_W_SPECS, ...BATCH_X_SPECS, ...BATCH_Y_SPECS, ...BATCH_Z_SPECS, ...BATCH_AA_SPECS, ...BATCH_AB_SPECS, ...BATCH_AC_SPECS, ...BATCH_AE_SPECS, ...BATCH_AF_SPECS, ...BATCH_AG_SPECS, ...BATCH_AH_SPECS, ...BATCH_AI_SPECS, ...BATCH_AD_SPECS, ...BATCH_AJ_SPECS, ...BATCH_AL_SPECS, ...BATCH_AK_SPECS, ...BATCH_AM_SPECS, ...BATCH_AN_SPECS, ...BATCH_AO_SPECS, ...BATCH_AP_SPECS, ...BATCH_AQ_SPECS, ...BATCH_AR_SPECS, ...BATCH_AS_SPECS, ...BATCH_AT_SPECS, ...BATCH_AU_SPECS, ...BATCH_AW_SPECS, ...BATCH_AV_SPECS, ...BATCH_BI_SPECS];

/** Lying on the back, straight legs pivoting at the hips; `deg` is the leg angle (-88 up, -6 near the floor). */
function lyingLegs(deg: number): Pose {
  const base = lyingFaceUp([-12, -20]);
  const pelvis = base.pelvis as Point;
  return {
    ...base,
    feet: { near: along(pelvis, deg, 173.9), far: along(pelvis, deg - 1, 173.4) },
    toes: { near: deg, far: deg },
  };
}

/** Tabletop knees over the hips, or hips curled off the floor with the knees drawn towards the chest. */
function reverseCrunch(curled: boolean): Pose {
  const base = lyingFaceUp(curled ? [-20, -52] : [-12, -20]);
  const pelvis = base.pelvis as Point;
  const thigh = curled ? -115 : -90;
  const kneeNear = along(pelvis, thigh, 88);
  const kneeFar = along(pelvis, thigh - 2, 88);
  return {
    ...base,
    knees: { near: { at: kneeNear }, far: { at: kneeFar } },
    feet: { near: along(kneeNear, thigh + 90, 86), far: along(kneeFar, thigh + 88, 86) },
    toes: { near: thigh + 90, far: thigh + 90 },
  };
}

/** Side-view bar hang with straight legs; `deg` is the leg angle from the hips (90 down, 0 level forward). */
function hangingLegs(deg: number, headX = 34): Pose {
  const pelvis: Point = [0, -196];
  return {
    pelvis,
    head: [headX, -318],
    hands: { near: [4, -420], far: [0, -420] },
    feet: { near: along(pelvis, deg, 173.6), far: along(pelvis, deg - 1, 173.4) },
    toes: { near: deg, far: deg },
  };
}

/**
 * Toes to bar, facing +x throughout: straight arms, the spine leaning from the
 * hands; straight legs rise forward from the hips to `ankle`. The head looks
 * forward (+x), tilted a little off the spine line so it clears the arms.
 */
function toesToBarPose(pelvis: Point, ankle: Point, toe?: number): Pose {
  const hand: Point = [2, -420];
  // Shoulder 98 from the pelvis and an arm's length (125.6) from the bar: the solution in front, under the bar.
  const d = Math.hypot(hand[0] - pelvis[0], hand[1] - pelvis[1]);
  const along1 = (98 ** 2 - 125.6 ** 2 + d ** 2) / (2 * d);
  const h = Math.sqrt(Math.max(0, 98 ** 2 - along1 ** 2));
  const u: Point = [(hand[0] - pelvis[0]) / d, (hand[1] - pelvis[1]) / d];
  const shoulder: Point = [pelvis[0] + u[0] * along1 - u[1] * h, pelvis[1] + u[1] * along1 + u[0] * h];
  const spine = angle(pelvis, shoulder);
  const chest = along(pelvis, spine, 80);
  const legDeg = angle(pelvis, ankle);
  return {
    pelvis,
    chest,
    // Head up and forward, clear of the arms.
    head: along(chest, Math.min(spine + 40, -40), 54),
    hands: { near: [hand[0] + 2, hand[1]], far: [hand[0] - 2, hand[1]] },
    feet: { near: ankle, far: along(pelvis, legDeg - 1, Math.min(173.85, Math.hypot(ankle[0] - pelvis[0], ankle[1] - pelvis[1]))) },
    toes: { near: toe ?? legDeg, far: toe ?? legDeg },
  };
}

/** Front-view hang with straight legs raised and swept `deg` degrees to one side of vertical. */
function wiperLegs(deg: number): Pose {
  const pelvis: Point = [0, -201];
  const dir = -90 + deg;
  return {
    pelvis,
    chest: [0, -281],
    hands: { near: [-56, -420], far: [56, -420] },
    feet: { near: along([-8, pelvis[1]], dir - 1, 173.4), far: along([8, pelvis[1]], dir + 1, 173.4) },
    toes: { near: dir, far: dir },
  };
}

/**
 * Chest-to-wall handstand: hands planted well out from the wall (face at
 * x = 31), arms straight and vertical, body in one straight line leaning in
 * so the toes rest on the wall, head tucked between the arms on the wall side.
 * `push` presses the floor away a little (shoulders open, head clears the floor).
 */
function wallHandstand(push: 0 | 1): Pose {
  const hand: Point = [92, 0];
  const shoulder = along(hand, -91, 125.9);
  // Straight line shoulder → hips → ankles; the ankle sits a foot's length off the wall.
  const dir = -98.2;
  const pelvis = along(shoulder, dir, 98);
  const ankle = along(pelvis, dir, 173.85);
  const chest = along(pelvis, dir + 180, 80);
  return {
    pelvis,
    chest,
    head: along(along(shoulder, dir + 180, 30 - push * 3), dir - 90, 24),
    hands: { near: hand, far: hand },
    elbows: { near: { at: along(shoulder, 89, 60) }, far: { at: along(shoulder, 89, 60) } },
    feet: { near: ankle, far: ankle },
    toes: { near: 180, far: 180 },
  };
}

/** Standing march: one knee to hip height, opposite arm forward. */
function march(nearUp: boolean): Pose {
  const pelvis: Point = [0, -172];
  const knee = along(pelvis, 5, 88);
  const up = nearUp ? "near" : "far";
  const down = nearUp ? "far" : "near";
  const fwd: Point = [72, -214];
  const back: Point = [-33, -158];
  return {
    pelvis,
    chest: [0, -252],
    knees: { [up]: { at: knee } },
    feet: { [up]: along(knee, 92, 86), [down]: [0, 0] },
    toes: { [up]: 0, [down]: 0 },
    // Opposite arm swing: the arm opposite the raised knee goes forward.
    hands: { [up]: back, [down]: fwd },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

/** Standing between march steps: both feet down, hands hanging by the hips. */
function marchStand(): Pose {
  return {
    pelvis: [0, -172],
    chest: [0, -252],
    feet: { near: [0, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
    hands: { near: [6, -146], far: [2, -146] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

/**
 * Side-view standing, hands on hips, knees soft, feet planted. At `phase` 0
 * the hips are pushed forward, at π they sit back with the bottom out; the
 * shoulders lean the other way so they stay roughly over the feet.
 */
function hipCircle(phase: number): Pose {
  const x = round(Math.cos(phase) * HIP_CIRCLE_REACH);
  const pelvis: Point = [x, round(-168 + Math.abs(Math.sin(phase)) * HIP_CIRCLE_DIP)];
  const chest = chestToward(pelvis, [round(-x * 0.9), pelvis[1] - 98]);
  return {
    pelvis,
    chest,
    hands: { near: [pelvis[0] + 2, pelvis[1] - 16], far: [pelvis[0] - 2, pelvis[1] - 16] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [6, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Half-kneeling; the front shin leans `deg` from the floor (90 = vertical) while the heel stays down. */
function ankleRock(deg: number): Pose {
  const ankle: Point = [70, 0];
  const knee = along(ankle, -deg, 86);
  const pelvis: Point = deg === 90 ? [-17.9, -91] : [27.8, -78.2];
  const backKnee: Point = [-18, -3];
  return {
    pelvis,
    chest: [pelvis[0] + 6, pelvis[1] - 80],
    hands: { near: [knee[0] - 14, knee[1] - 10], far: [knee[0] - 18, knee[1] - 12] },
    knees: { near: { at: knee }, far: { at: backKnee } },
    feet: { near: ankle, far: [-104, -3] },
    toes: { near: 0, far: 180 },
  };
}

/** All fours; at the rock the shoulders travel forward of the hands. */
function wristRock(rocked: boolean): Pose {
  const base = allFours();
  if (!rocked) return base;
  const pelvis: Point = [-22, -88];
  return {
    pelvis,
    chest: chestToward(pelvis, [70, -124]),
    hands: { near: [48, 0], far: [44, 0] },
    feet: { near: [-136, -4], far: [-132, -4] },
    toes: { near: 180, far: 180 },
  };
}

/** High plank on straight arms; `sink` lets the chest drop between the shoulder blades. */
function scapPlank(sink: 0 | 1): Pose {
  if (sink) {
    return {
      pelvis: [-29.4, -86.7],
      chest: [42, -115],
      spine: { bend: 1 },
      head: [96, -130],
      hands: { near: [60, 0], far: [59, 0] },
      feet: { near: [-190, -19], far: [-190, -19] },
      toes: { near: 62, far: 62 },
    };
  }
  // Shoulders stay put over the hands (arms straight); only the chest segment tilts about them.
  const shoulder: Point = [60, -126];
  return {
    pelvis: [-29.4, -86.7],
    chest: along(shoulder, (sink ? -28 : -20) + 180, 18),
    // Head drops with the chest as the shoulder blades squeeze together.
    head: along(along(shoulder, (sink ? -28 : -20) + 180, 18), sink ? 8 : -16, 56),
    hands: { near: [60, 0], far: [59, 0] },
    feet: { near: [-190, -19], far: [-190, -19] },
    toes: { near: 62, far: 62 },
  };
}

/**
 * Lying on the back: upper back (chest) and head on the floor in one line,
 * arms long and flat on the floor by the sides, hips up at `pelvis`.
 */
function lyingFaceUp(pelvis: Point): Pose {
  const dy = -18 - pelvis[1];
  const chest: Point = [round(pelvis[0] - Math.sqrt(SUPINE_CHORD ** 2 - dy * dy)), -18];
  const head: Point = [round(chest[0] - 55), -24];
  const base: Pose = { pelvis, chest, head, spine: { bend: SUPINE_BEND } };
  const shoulder = solvePose(base).arms.near.root;
  const reach = 125.4;
  const handY = -6;
  const handX = round(shoulder[0] + Math.sqrt(reach ** 2 - (shoulder[1] - handY) ** 2));
  return {
    ...base,
    hands: { near: [handX, handY], far: [handX, handY - 1] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

/** High glute bridge, feet flat. */
function bridge(): Pose {
  return {
    ...lyingFaceUp([-12, -78]),
    feet: { near: [82, 0], far: [78, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Face down, head to the right; `shoulderY` lifts the chest a few units. */
function lyingFaceDown(shoulderY: number, hands: Pose["hands"]): Pose {
  const pelvis: Point = [-20, -12];
  return {
    pelvis,
    chest: chestToward(pelvis, [78, shoulderY]),
    hands,
    feet: { near: [-194, -6], far: [-194, -6] },
    toes: { near: 180, far: 180 },
  };
}

/**
 * Face down, arms straight by the sides. At rest the hands lie on the floor
 * beside the hips; with the shoulder-blade squeeze the arms lift 18° off the
 * floor (and the chest a touch), so they read as their own line above the body.
 */
function proneRetraction(lift: 0 | 1): Pose {
  const base = lyingFaceDown(lift ? -28 : -24, {});
  const shoulder = solvePose(base).arms.near.root;
  const rest = 180 - (Math.asin((-3 - shoulder[1]) / 125.9) * 180) / Math.PI;
  const deg = lift ? rest + 18 : rest;
  const hand = along(shoulder, deg, 125.9);
  const elbow = along(shoulder, deg, 60);
  return {
    ...base,
    hands: { near: hand, far: hand },
    elbows: { near: { at: elbow }, far: { at: elbow } },
  };
}

/** Forearms down, elbows under the shoulders, on the toes; `pelvisY` breathes the hold. */
function forearmPlank(pelvisY: number): Pose {
  // Pelvis slides along a 173.9 arc around the fixed feet so both legs stay straight.
  const foot: Point = [-207.6, -19.3];
  const pelvis: Point = [round(foot[0] + Math.sqrt(173.9 ** 2 - (pelvisY - foot[1]) ** 2)), pelvisY];
  const dy = -64 - pelvisY;
  const shoulder: Point = [pelvis[0] + Math.sqrt(98 * 98 - dy * dy), -64];
  const chest = chestToward(pelvis, shoulder);
  const s = shoulderOf(pelvis, chest);
  const elbowY = -4;
  // Upper arm vertical: shoulder at y = -64, elbow 60 below it.
  const elbow: Point = [round(s[0]), elbowY];
  return {
    pelvis,
    chest,
    elbows: { near: { at: [elbow[0] + 2, elbowY] }, far: { at: [elbow[0] - 2, elbowY] } },
    hands: { near: [elbow[0] + 68, -4], far: [elbow[0] + 64, -4] },
    // Straight line ankle to shoulder (no sag).
    feet: { near: foot, far: foot },
    toes: { near: 62, far: 62 },
  };
}

/** Elbows dug into the belly, forearms vertical, body level; `tilt` raises the chest a little (degrees). */
function elbowLever(pelvisY: number, tilt: number): Pose {
  const pelvis: Point = [-40, pelvisY];
  const chest = along(pelvis, tilt, 80);
  const s = shoulderOf(pelvis, chest);
  // Forearm + hand (66) vertical, fingertips just above the floor; upper arm (60) back to the shoulder.
  const elbowY = -68;
  const elbowX = round(s[0] - Math.sqrt(60 * 60 - (elbowY - s[1]) ** 2));
  return {
    pelvis,
    chest,
    elbows: { near: { at: [elbowX, elbowY] }, far: { at: [elbowX, elbowY] } },
    hands: { near: [elbowX + 2, -2], far: [elbowX - 2, -2] },
    feet: { near: along(pelvis, 180 - tilt, 174), far: along(pelvis, 180 - tilt, 174) },
    toes: { near: 180, far: 180 },
  };
}

/**
 * Support between parallel bars: hands on the rail beside the hips, arms
 * straight and vertical, torso nearly upright and still. `raised` lifts the thighs
 * above horizontal with the shins hanging.
 */
function kneeRaise(raised: boolean): Pose {
  const hand: Point = [48, KR_RAIL];
  const shoulder: Point = [44, KR_RAIL - 125.8];
  // Straight spine, chest leaning a touch forward over the hands so the arms read apart from the torso.
  const chest = along(shoulder, 101, 18);
  const pelvis = along(chest, 101, 80);
  const legDeg = raised ? -32 : 90;
  const knee = along(pelvis, legDeg, 88);
  const ankle = raised ? along(knee, 100, 86) : along(pelvis, legDeg, 173.85);
  return {
    pelvis,
    chest,
    hands: { near: hand, far: [hand[0] - 3, hand[1]] },
    // Side view: both legs stack.
    knees: { near: { at: knee }, far: { at: knee } },
    feet: { near: ankle, far: ankle },
    toes: raised ? { near: 80, far: 80 } : { near: 60, far: 60 },
  };
}

/**
 * Front-view hang from a bar at y = -420 with hands at ±`grip`. Shoulders sit
 * 22 either side of the chest; `legLength` is pelvis-to-ankle.
 */
function frontBarHang(pelvisY: number, grip: number, legLength: number, elbows?: Pose["elbows"]): Pose {
  return {
    pelvis: [0, pelvisY],
    chest: [0, pelvisY - 80],
    hands: { near: [-grip, -420], far: [grip, -420] },
    elbows,
    feet: { near: [-14, pelvisY + legLength - 1], far: [14, pelvisY + legLength - 1] },
    toes: { near: 180, far: 0 },
  };
}

/** Standing pike, hands on the floor in front of the feet, legs straight and together. */
function pressPike(): Pose {
  const ankle: Point = [-30, -4];
  return {
    pelvis: along(ankle, -87, 173.4),
    hands: { near: [56, 0], far: [52, 0] },
    feet: { near: ankle, far: [ankle[0] + 3, ankle[1]] },
    toes: { near: 0, far: 0 },
  };
}

/** Shoulders pushed forward over the hands, arms straight, up on the toes, legs still straight. */
function pressLean(): Pose {
  const ankle: Point = [-30, -12];
  const pelvis = along(ankle, -79, 173.4);
  return {
    pelvis,
    chest: chestToward(pelvis, [72, -126]),
    hands: { near: [56, 0], far: [52, 0] },
    feet: { near: ankle, far: [ankle[0] + 3, ankle[1]] },
    toes: { near: 30, far: 30 },
  };
}

/** Hips stacked over the shoulders first; both straight legs still piked low, feet just off the floor. */
function pressHipsOver(): Pose {
  const pelvis: Point = [54, -223.5];
  return {
    pelvis,
    chest: PRESS_CHEST,
    head: PRESS_HEAD,
    hands: { near: [52, -1], far: [50, -1.5] },
    feet: { near: along(pelvis, 124, 173.5), far: along(pelvis, 123, 173.5) },
    toes: { near: 124, far: 123 },
  };
}

function handstand(): Pose {
  const pelvis: Point = [54, -223.5];
  return {
    pelvis,
    chest: PRESS_CHEST,
    head: PRESS_HEAD,
    hands: { near: [52, -1], far: [50, -1.5] },
    feet: { near: [46, -397], far: [42, -397] },
    toes: { near: -90, far: -90 },
  };
}

/** Split stance with the near hand resting on a box; the back knee is solved just above the floor. */
function supportedSplit(pelvis: Point): Pose {
  // Torso upright; the near hand slides on the upright at chest height, the other rests on the hip.
  return {
    pelvis,
    chest: [pelvis[0], pelvis[1] - 80],
    hands: { near: [SPLIT_POST_X, pelvis[1] - 40], far: [pelvis[0] + 8, pelvis[1] - 14] },
    elbows: { far: { bend: 1 } },
    feet: { near: [44, 0], far: [-112, -20] },
    toes: { near: 0, far: 80 },
  };
}

/** Long staggered stance, back heel lifted, torso upright. */
function splitSquat(pelvis: Point): Pose {
  return {
    pelvis,
    chest: [pelvis[0], pelvis[1] - 80],
    hands: { near: [pelvis[0] + 110, pelvis[1] - 82], far: [pelvis[0] + 104, pelvis[1] - 82] },
    feet: { near: [60, 0], far: [-100, -20] },
    toes: { near: 0, far: 80 },
  };
}

/** Front-view wide stance; `side` 1 = deep on the near (left) leg. */
function archer(pelvis: Point): Pose {
  return {
    pelvis,
    chest: [pelvis[0], pelvis[1] - 80],
    // Arms out to the sides for balance.
    hands: { near: [pelvis[0] - 135, pelvis[1] - 120], far: [pelvis[0] + 135, pelvis[1] - 120] },
    feet: { near: [-120, 0], far: [125, 0] },
    knees: { near: { bend: 1 } },
    toes: { near: 180, far: 0 },
  };
}
