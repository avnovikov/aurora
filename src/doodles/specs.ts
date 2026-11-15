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

export const DOODLE_SPECS: DoodleSpec[] = [
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
    props: [{ kind: "parallelBars", y: -216, x1: 32, x2: 110 }],
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
];

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
