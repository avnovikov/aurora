import { BATCH_E_SPECS } from "./specsBatchE";
import { STRETCH_SPECS } from "./specsStretch";
import { WARMUP_DRILL_SPECS } from "./specsWarmup";
import { solvePose } from "./rig";
import type { DoodleSpec, Point, Pose } from "./rig";

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
 *   fire-hydrant               hands, feet, toes; spine from hands; near knee when lifted
 *   parallel-bar-knee-raise    chest, hands, feet, toes; knees when raised
 *   donkey-kick                hands, feet, toes; spine from hands; near knee when kicking
 *   forearm-plank              chest, elbows, hands, feet, toes
 *   prone-scapular-retraction  chest, hands, feet, knee bend, toes
 *   elbow-lever                chest, elbows, hands, feet, toes
 *   reverse-snow-angel         chest, hands, elbow bend, feet, knee bend, toes
 *   arch-hang                  head, hands, feet, toes; spine from hands, then chest + arch bend
 *   active-hang (front)        chest, hands, feet, toes; elbow bend when active
 *   tuck-l-sit                 hands, feet, toes; spine from hands; knees when tucked
 *   press-to-handstand         hands, feet, toes; spine from hands, chest pinned once inverted
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

/** Head lifted forward off the floor for the overhead snow-angel frame. */
const SNOW_HEAD: Point = [98, -80];

const HYDRANT_KNEE: Point = along([-50, -92], 150, 88);

const TUCK_PELVIS: Point = [-38, -30];
const TUCK_KNEE_NEAR: Point = along(TUCK_PELVIS, -55, 88);
const TUCK_KNEE_FAR: Point = along(TUCK_PELVIS, -53, 88);

/** Straight arms down to the floor, hips clear of the floor, chest pinned so the back rounds. */
function tuckBase(): Pose {
  return {
    pelvis: TUCK_PELVIS,
    chest: [-4, -101],
    spine: { bend: -1 },
    hands: { near: [42, 0], far: [38, 0] },
  };
}

/** Head pushed through between the arms, forward of the arm line. */
const PRESS_HEAD: Point = [92, -104];
const PRESS_CHEST: Point = [60.5, -143.6];

const KR_ROUND = 3.4;
const KR_PELVIS: Point = [-25, -240];
/** Raised thigh angle for the knee raise (above the hip). */
const KR_THIGH = -42;

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
    id: "ntc_fire_hydrant",
    slug: "fire-hydrant",
    title: "Fire hydrant",
    frames: [
      { hold: 0.4, pose: allFours() },
      {
        hold: 0.6,
        pose: {
          ...allFours(),
          // Knee lifts out from under the hip, bent 90 degrees, shin angled up and back.
          knees: { near: { at: HYDRANT_KNEE } },
          feet: { near: along(HYDRANT_KNEE, 240, 86), far: [-132, -4] },
          toes: { near: 190, far: 180 },
        },
      },
    ],
  },
  {
    id: "fedb_knee_hip_raise_on_parallel_bars",
    slug: "parallel-bar-knee-raise",
    title: "Knee raise on parallel bars",
    props: [{ kind: "parallelBars", y: -216, x1: -40, x2: 170 }], // uprights clear of the knee swing
    frames: [
      {
        hold: 0.4,
        pose: {
          // Arms straight from the shoulders down to the rails, body hanging below, legs straight down.
          ...dipSupport(0),
          feet: { near: [-21, -72], far: [-27, -72] },
          toes: { near: 70, far: 70 },
        },
      },
      {
        hold: 0.5,
        pose: {
          ...dipSupport(KR_ROUND),
          // Thighs come up above hip height in front of the rail; shins hang; back rounds a little.
          knees: { near: { at: kneeRaiseKnee(KR_THIGH) }, far: { at: kneeRaiseKnee(KR_THIGH + 3) } },
          feet: {
            near: along(kneeRaiseKnee(KR_THIGH), 112, 86),
            far: along(kneeRaiseKnee(KR_THIGH + 3), 114, 86),
          },
          toes: { near: 80, far: 80 },
        },
      },
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
      // Hands beside the hips; at the squeeze the chest and hands lift a touch.
      { hold: 0.5, pose: lyingFaceDown(-30, proneHands(-30, -4)) },
      { hold: 0.6, pose: lyingFaceDown(-38, proneHands(-38, -10)) },
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
    transition: 0.6,
    frames: [
      // Hands slide along the floor from the hips to overhead, arms long and low; the elbows fold under the chest on the way.
      { hold: 0.4, pose: snowAngel(-1) },
      { hold: 0.5, pose: snowAngel(1) },
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
      // Passive: arms fully long. Active: shoulders pull down, the body rises a few units.
      // Passive: shoulders shrugged up around the ears, head sunk.
      { hold: 0.8, pose: { ...frontBarHang(-201, 56, 172), head: [0, -332] } },
      {
        hold: 1.2,
        pose: {
          // Active: shoulders drawn down away from the ears, so the head rises 5 and the hips and
          // legs lift 6 as the lumbar spine curves; arms stay straight.
          ...frontBarHang(-207, 56, 172),
          pelvis: [20, -207],
          chest: [0, -281],
          feet: { near: [-12, -40], far: [12, -40] },
        },
      },
    ],
  },
  {
    id: "wger_1704",
    slug: "tuck-l-sit",
    title: "Tuck L-sit",
    transition: 1.1,
    frames: [
      {
        hold: 0.5,
        pose: {
          // Floor L-sit prep: hands on the floor beside and just ahead of the hips, arms straight, hips lifted, feet on the floor.
          ...tuckBase(),
          feet: { near: [74, -4], far: [70, -4] },
          toes: { near: 0, far: 0 },
        },
      },
      {
        hold: 1.2,
        pose: {
          // Hips stay lifted; knees pulled up to the chest, shins tucked back, feet off the floor, back rounded.
          ...tuckBase(),
          knees: { near: { at: TUCK_KNEE_NEAR }, far: { at: TUCK_KNEE_FAR } },
          feet: { near: along(TUCK_KNEE_NEAR, 100, 86), far: along(TUCK_KNEE_FAR, 102, 86) },
          toes: { near: 30, far: 30 },
        },
      },
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
    props: [{ kind: "box", x: 100, y: -92, w: 60, h: 92 }],
    transition: 1.2,
    frames: [
      { hold: 0.5, pose: supportedSplit(-95) },
      { hold: 0.5, pose: supportedSplit(-92) },
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
    id: "ntc_floor_windshield_wiper",
    slug: "floor-windshield-wiper",
    title: "Floor windshield wiper",
    transition: 0.3,
    frames: [
      { hold: 0.4, pose: lyingLegs(-88) },
      { hold: 0.05, pose: lyingLegs(-65) },
      { hold: 0.5, pose: lyingLegs(-35) },
      { hold: 0.05, pose: lyingLegs(-65) },
      { hold: 0.05, pose: lyingLegs(-88) },
      { hold: 0.05, pose: lyingLegs(-108) },
      { hold: 0.5, pose: lyingLegs(-130) },
      { hold: 0.05, pose: lyingLegs(-108) },
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
    transition: 0.3,
    frames: [
      { hold: 0.4, pose: hangingLegs(88, -34) },
      { hold: 0.05, pose: hangingLegs(60, -34) },
      { hold: 0.05, pose: hangingLegs(30, -34) },
      { hold: 0.05, pose: toesMid(-1) },
      { hold: 0.05, pose: toesMid() },
      { hold: 0.05, pose: toesMid(1) },
      { hold: 0.5, pose: toesToBar() },
      { hold: 0.05, pose: toesMid(1) },
      { hold: 0.05, pose: toesMid() },
      { hold: 0.05, pose: toesMid(-1) },
      { hold: 0.05, pose: hangingLegs(30, -34) },
      { hold: 0.05, pose: hangingLegs(60, -34) },
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
    view: "front",
    transition: 0.4,
    frames: [
      { hold: 0.1, pose: hipCircle(-20, -171) },
      { hold: 0.1, pose: hipCircle(0, -174) },
      { hold: 0.1, pose: hipCircle(20, -171) },
      { hold: 0.1, pose: hipCircle(0, -173) },
    ],
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
export const DOODLE_SPECS: DoodleSpec[] = [...SESSION_MOVE_SPECS, ...WARMUP_DRILL_SPECS, ...STRETCH_SPECS, ...BATCH_E_SPECS];

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

/** Toes meeting the bar: torso leaning back, body piked, arms pulling. */
function toesToBar(): Pose {
  const pelvis: Point = [-78, -252];
  return {
    pelvis,
    chest: along(pelvis, -66, 80),
    head: along(along(pelvis, -66, 80), -110, 55),
    hands: { near: [4, -420], far: [0, -420] },
    feet: { near: [8, -400], far: [4, -400] },
    toes: { near: -90, far: -90 },
  };
}

/** Halfway up to the bar: hips tucked back, head ducked behind the arms. */
function toesMid(t = 0): Pose {
  const pelvis: Point = [-40 - 20 * t, -224 - 14 * t];
  const chest = along(pelvis, -77 + 8 * t, 80);
  return {
    pelvis,
    chest,
    head: along(chest, -125 + 10 * t, 54),
    hands: { near: [4, -420], far: [0, -420] },
    feet: { near: along(pelvis, -62 + 3 * t, 173), far: along(pelvis, -63 + 3 * t, 172.8) },
    toes: { near: -62, far: -62 },
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

/** Inverted against a wall: hands on the floor, body leaning back so the heels rest on the wall. */
function wallHandstand(nod: 0 | 1): Pose {
  const hand: Point = [52, 0];
  const shoulder: Point = [52, -126];
  const dir = -94.2;
  const pelvis = along(shoulder, dir, 98);
  const chest = along(pelvis, dir + 180, 80);
  return {
    pelvis,
    chest,
    // Head between the arms (Opus review: was hanging 38 units in front of them).
    head: nod ? [77, -100] : [75, -97],
    hands: { near: hand, far: [hand[0] - 2, 0] },
    feet: { near: along(pelvis, dir, 174), far: along(pelvis, dir, 174) },
    toes: { near: -75, far: -75 },
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

/** Front-view standing, hands on hips, pelvis at (x, y); feet planted. */
function hipCircle(x: number, y: number): Pose {
  return {
    pelvis: [x, y],
    chest: [round(-x * 0.25), round(y - Math.sqrt(6400 - (x * 1.25) ** 2))],
    hands: { near: [x - 34, y - 12], far: [x + 34, y - 12] },
    elbows: { near: { bend: 1 }, far: { bend: -1 } },
    // Knees bow outward symmetrically (otherwise they cross at the side positions).
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [-14, 0], far: [14, 0] },
    toes: { near: 180, far: 0 },
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

/** Hands beside the hips at height `handY`, arms long (near 123, far 125 from the shoulder). */
function proneHands(shoulderY: number, handY: number): Pose["hands"] {
  const pelvis: Point = [-20, -12];
  const s = shoulderOf(pelvis, chestToward(pelvis, [78, shoulderY]));
  const reach = (r: number): Point => [round(s[0] - Math.sqrt(r * r - (s[1] - handY) ** 2)), handY];
  return { near: reach(125.6), far: reach(125.9) };
}

/** Prone with chest and head lifted; hands on the floor either by the hips (-1) or reaching overhead under the head (1). */
function snowAngel(side: -1 | 1): Pose {
  const base: Pose = { ...lyingFaceDown(-70, {}), head: SNOW_HEAD };
  const shoulder = solvePose(base).arms.near.root;
  const handY = -7;
  const dx = Math.sqrt(125.3 ** 2 - (shoulder[1] - handY) ** 2);
  const x = round(shoulder[0] + side * dx);
  return { ...base, hands: { near: [x, handY], far: [x - 1, handY] }, elbows: { near: { bend: 1 }, far: { bend: 1 } } };
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

/** Pelvis for the knee raise; `round` pulls it towards the chest so the back rounds. */
function krPelvis(round: number): Point {
  const chest = chestToward(KR_PELVIS, [2, -334]);
  const d = Math.hypot(chest[0] - KR_PELVIS[0], chest[1] - KR_PELVIS[1]);
  return [KR_PELVIS[0] + ((chest[0] - KR_PELVIS[0]) / d) * round, KR_PELVIS[1] + ((chest[1] - KR_PELVIS[1]) / d) * round];
}

function kneeRaiseKnee(thigh: number): Point {
  return along(krPelvis(KR_ROUND), thigh, 88);
}

/** Support on the parallel bars: arms straight and locked, shoulders behind the hands. */
function dipSupport(round: number): Pose {
  return {
    pelvis: krPelvis(round),
    chest: chestToward(KR_PELVIS, [2, -334]),
    spine: { bend: -1 },
    hands: { near: [47, -216], far: [43, -216] },
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

/** Standing pike, hands on the floor in front of the feet. */
function pressPike(): Pose {
  const pelvis: Point = [-20, -170];
  return {
    pelvis,
    hands: { near: [56, 0], far: [52, 0] },
    feet: { near: [-34, 0], far: [-30, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Shoulders pushed over the hands, arms straight, feet just leaving the floor. */
function pressLean(): Pose {
  const pelvis: Point = [-10, -176];
  return {
    pelvis,
    chest: [58.2, -134.2],
    hands: { near: [56, 0], far: [52, 0] },
    feet: { near: [-24, -14], far: [-20, -14] },
    toes: { near: 40, far: 40 },
  };
}

/** Hips stacked over the hands, straight legs rising behind towards vertical. */
function pressHipsOver(): Pose {
  const pelvis: Point = [54, -223.5];
  return {
    pelvis,
    chest: PRESS_CHEST,
    head: PRESS_HEAD,
    hands: { near: [52, -1], far: [50, -1.5] },
    feet: { near: along(pelvis, -131, 173.5), far: along(pelvis, -132, 173) },
    toes: { near: -60, far: -60 },
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
function supportedSplit(pelvisY: number): Pose {
  const pelvis: Point = [0, pelvisY];
  return {
    pelvis,
    // Torso upright, with a slight lean so the hand reaches the box.
    chest: along(pelvis, -72, 80),
    hands: { near: [108, -92], far: [107, -92] },
    feet: { near: [70, 0], far: [-96, -20] },
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
