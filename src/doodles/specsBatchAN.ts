import { BONES, HIP_SIDE, solvePose } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose, Prop, Side } from "./rig";
import { TWO_VIEWS } from "./sideways";
import { SL_HIP_TOP, SL_KNEE_BOTTOM, SL_FOOT_BOTTOM, SIDE_LYING_FLOOR, sideLying } from "./specsWarmup";

/**
 * Batch AN: stretches. Floor at y = 0, up is negative, the side-view figure
 * faces +x (lying face up has the head at -x). Side-lying stretches use the
 * front view (near = bottom side, far = top side, head left), as in the
 * side-lying batch. Import only from ./rig and other batch files — never from
 * ./specs (that would be circular).
 */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const angleBetween = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

const THIGH = BONES.thigh;
const SHIN = BONES.shin;
/** Hip to ankle with the knee a hair short of straight. */
const LEG = 173.4;
const FLOOR: Prop = { kind: "floor" };

// ---------------------------------------------------------------- lying on the back (head at -x)

const SUPINE_PELVIS: Point = [0, -22];

/** Lying face up: upper back and head on the floor, pelvis a hand's width up. Arms are left to the caller. */
function supine(): Pose {
  const pelvis = SUPINE_PELVIS;
  const dy = -18 - pelvis[1];
  const chest: Point = [round(pelvis[0] - Math.sqrt(79.6 ** 2 - dy * dy)), -18];
  return { pelvis, chest, head: [round(chest[0] - 55), -24], spine: { bend: -1 } };
}

/** The straight leg flat on the floor: ankle just above it, toes up. */
const FLAT_ANKLE: Point = [173.2, -8];

// ---------------------------------------------------------------- 90/90 hamstring

const NINETY_KNEE: Point = [0, -22 - THIGH];

/** Near leg: thigh vertical, shin swinging from level (90°) up to straight; both hands behind the thigh. */
function ninety(shin: number): Pose {
  return {
    ...supine(),
    hands: { near: [9, -72], far: [7, -76] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: NINETY_KNEE }, far: { bend: -1 } },
    feet: { near: along(NINETY_KNEE, shin, SHIN), far: FLAT_ANKLE },
    toes: { far: -80 },
  };
}

// ---------------------------------------------------------------- leg-up hamstring

const LEGUP_FOOT: Point = [84, -5];

/** One knee bent with the foot flat; the other leg raised straight, held behind the thigh, drawn in towards the head. */
function legUp(deg: number): Pose {
  const hip = SUPINE_PELVIS;
  const hold = along(along(hip, deg, 78), deg + 90, -9);
  return {
    ...supine(),
    hands: { near: hold, far: along(hold, deg, 4) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: along(hip, deg, LEG), far: LEGUP_FOOT },
    toes: { far: 0 },
  };
}

// ---------------------------------------------------------------- all-fours quad stretch

const AF_PELVIS: Point = [-50, -92];

/**
 * Hands and knees. The far knee stays down while its foot is lifted behind and
 * held by the near hand: `fold` is the shin's angle (degrees) from the far knee,
 * `grab` sends the near hand back to the foot (otherwise it stays planted).
 */
function allFoursQuad(fold: number, grab: boolean, hand?: Point): Pose {
  const pelvis = AF_PELVIS;
  const knee: Point = [pelvis[0] - 2, -4];
  const ankle = along(knee, fold, SHIN);
  const lean = 15;
  const shoulderX = pelvis[0] + 98 * Math.cos((lean * Math.PI) / 180);
  return {
    pelvis,
    chest: along(pelvis, lean, 80),
    hands: { far: [round(shoulderX + 4), 0], near: hand ?? (grab ? along(ankle, 100, 2) : [round(shoulderX + 8), 0]) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: [pelvis[0] + 2, -4] }, far: { at: knee } },
    feet: { near: [pelvis[0] - 84, -4], far: ankle },
    toes: { near: 180, far: fold + 20 },
  };
}

// ---------------------------------------------------------------- calf stretch, elbows on the wall

const CW_WALL: Prop = { kind: "box", x: 156, y: -340, w: 14, h: 340 };
const CW_SHOULDER_X = 90;
const CW_ELBOW_X = 150;

/** Both legs straight, heels down, body in one line leaning on the forearms; `lean` is the body line's angle from the floor. */
function wallCalf(lean: number): Pose {
  const a = (lean * Math.PI) / 180;
  const ankle: Point = [round(CW_SHOULDER_X - 270 * Math.cos(a)), 0];
  const pelvis = along(ankle, -lean, 172);
  const shoulderY = ankle[1] - 270 * Math.sin(a);
  const elbowY = round(shoulderY + 4);
  return {
    pelvis,
    chest: along(pelvis, -lean, 80),
    hands: { near: [CW_ELBOW_X, round(elbowY - 66)], far: [CW_ELBOW_X, round(elbowY - 66)] },
    elbows: { near: { at: [CW_ELBOW_X, elbowY] }, far: { at: [CW_ELBOW_X, elbowY] } },
    feet: { near: ankle, far: [ankle[0] + 4, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- runner's stretch

const RUN_FRONT: Point = [40, -4];
const RUN_HAND: Point = [58, 0];

/**
 * Low lunge, hands on the floor either side of the front foot, back leg long
 * behind on the ball of the foot with the knee off the floor.
 */
function runners(pelvis: Point): Pose {
  const dy = pelvis[1] + 16;
  const back: Point = [round(pelvis[0] - Math.sqrt(LEG ** 2 - dy * dy)), -16];
  return {
    pelvis,
    hands: { near: RUN_HAND, far: [RUN_HAND[0] - 6, 0] },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: RUN_FRONT, far: back },
    toes: { near: 0, far: 55 },
  };
}

// ---------------------------------------------------------------- seated calf stretch

const SC_PELVIS: Point = [0, -10];

/**
 * Sitting with the near leg straight and the far knee bent, foot flat. The hand
 * draws the toes back (`toes` is the foot's angle: -90 upright, less = pointed).
 * `lean` is the torso's angle from the floor.
 */
function seatedCalf(lean: number, toes: number): Pose {
  const pelvis = SC_PELVIS;
  const ankle: Point = [173.6, -8];
  const tip = along(ankle, toes, 20);
  const thigh: Point = [92, -16];
  const knee = solvePose({ pelvis, feet: { far: [74, -4] }, knees: { far: { bend: -1 } } }).legs.far.mid;
  return {
    pelvis,
    chest: along(pelvis, -lean, 80),
    hands: lean > 60
      ? { near: thigh, far: [round(knee[0] + 4), round(knee[1] - 4)] }
      : { near: [round(tip[0] + 5), round(tip[1] + 2)], far: [round(tip[0] + 2), round(tip[1] + 8)] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { far: { bend: -1 } },
    feet: { near: ankle, far: [74, -4] },
    toes: { near: toes, far: 0 },
  };
}

// ---------------------------------------------------------------- standing elevated quad stretch

const BENCH_TOP = -50;
const BENCH: Prop = { kind: "box", x: -290, y: BENCH_TOP, w: 190, h: -BENCH_TOP };
const EQ_FOOT: Point = [-104, -58];

/** Standing tall, front knee soft, the far foot's laces on the bench behind; `hip` presses the pelvis forward. */
function elevatedQuad(hip: number): Pose {
  const pelvis: Point = [hip, -164];
  return {
    pelvis,
    chest: along(pelvis, -91, 80),
    knees: { far: { bend: -1 }, near: { bend: -1 } },
    feet: { near: [14, 0], far: EQ_FOOT },
    toes: { near: 0, far: 180 },
  };
}

// ---------------------------------------------------------------- standing gastrocnemius calf stretch

const STEP_TOP = -30;
const STEP: Prop = { kind: "box", x: 92, y: STEP_TOP, w: 90, h: -STEP_TOP };
const GA_HEEL: Point = [116, -38];

/**
 * Near heel on the step, leg straight, toes drawn back; the standing knee soft;
 * `lean` hinges the torso forward. Both hands rest on the thighs until the near
 * one reaches for the toes (`grab`).
 */
function gastroc(lean: number, hip: number, grab: boolean): Pose {
  const pelvis: Point = [-16, hip];
  const thighAngle = angleBetween(pelvis, GA_HEEL);
  const onThigh = (reach: number, side: number): Point => {
    const p = along(pelvis, thighAngle, reach);
    return [round(p[0] + side), round(p[1] - 8)];
  };
  const tip = along(GA_HEEL, -104, 20);
  return {
    pelvis,
    chest: along(pelvis, -lean, 80),
    hands: {
      near: grab ? [round(tip[0] + 5), round(tip[1] + 2)] : onThigh(50, 6),
      far: [round(pelvis[0] + 16), round(pelvis[1] + 40)],
    },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: GA_HEEL, far: [-6, 0] },
    toes: { near: grab ? -104 : -86, far: 0 },
  };
}

// ---------------------------------------------------------------- standing hip flexors

const HF_FRONT: Point = [56, -4];

/** Split stance, both knees soft, back heel lifted, pelvis tucked and pressed forward. */
function standingHipFlexor(hip: number): Pose {
  const pelvis: Point = [hip, -150 + (hip > 0 ? 10 : 0)];
  const dy = -16 - pelvis[1];
  const back: Point = [round(pelvis[0] - Math.sqrt(LEG ** 2 - dy * dy) + 8), -16];
  return {
    pelvis,
    chest: along(pelvis, -93, 80),
    hands: { near: [round(pelvis[0] + 4), round(pelvis[1] - 34)], far: [round(pelvis[0] + 2), round(pelvis[1] - 36)] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: HF_FRONT, far: back },
    toes: { near: 0, far: 58 },
  };
}

/** Bottom arm straight overhead along the floor, the head resting on it (as in the other side-lying doodles). */
const SL_PILLOW_HAND: Point = along([-98, -8], 181, 125);

// ---------------------------------------------------------------- side-lying quad stretch (front view, head left)

type P3 = readonly [number, number, number];

/** A point `length` from `from` along the direction `d` (normalised). */
function reach3(from: P3, d: P3, length: number): P3 {
  const n = Math.hypot(d[0], d[1], d[2]);
  return [round(from[0] + (d[0] / n) * length), round(from[1] + (d[1] / n) * length), round(from[2] + (d[2] / n) * length)];
}

/**
 * Lying on the side facing the viewer (forward = -z), two views: the side panel sees the
 * body along its length, the front panel looks along it, so the bottom knee comes forward
 * and the top heel is drawn back behind the glute. `fold` (degrees) is the top shin's
 * direction in the floor plane: 150 heel out behind, 172 heel at the glute.
 */
function sideQuad(fold: number): Keyframe {
  const hipBottom: P3 = [0, -30, -8];
  const hipTop: P3 = [0, -30, 8];
  const kneeBottom = reach3(hipBottom, [0.7, 0.1, -0.7], THIGH);
  const footBottom = reach3(kneeBottom, [0.55, 0, 0.83], SHIN);
  const kneeTop = reach3(hipTop, [0.97, -0.1, 0.2], THIGH);
  const r = (fold * Math.PI) / 180;
  const ankle = reach3(kneeTop, [Math.cos(r), 0, Math.sin(r)], SHIN);
  const hand: P3 = [round(ankle[0] + 2), round(ankle[1] + 3), ankle[2]];
  const pillow: P3 = [-205, -12, -20];
  const flat = (p: P3): Point => [p[0], p[1]];
  return {
    hold: 0,
    pose: sideLying({
      knees: { near: { at: flat(kneeBottom) }, far: { at: flat(kneeTop) } },
      feet: { near: flat(footBottom), far: flat(ankle) },
      hands: { near: flat(pillow), far: flat(hand) },
      elbows: { near: { bend: 1 }, far: { bend: -1 } },
      toes: { near: 0, far: 90 },
    }),
    sideways: {
      pelvis: 0,
      knees: { near: { at: kneeBottom[2] }, far: { at: kneeTop[2] } },
      feet: { near: footBottom[2], far: ankle[2] },
      hands: { near: pillow[2], far: hand[2] },
    },
  };
}

// ---------------------------------------------------------------- side-lying groin stretch (front view, head left)

/** Top leg raised towards the ceiling and the head, held behind the knee; `bend` is the knee's flexion in degrees. */
function sideGroin(thigh: number, bend: number): Pose {
  const knee = along(SL_HIP_TOP, thigh, THIGH);
  const ankle = along(knee, thigh + bend, SHIN);
  return sideLying({
    knees: { near: { at: SL_KNEE_BOTTOM }, far: { at: knee } },
    feet: { near: SL_FOOT_BOTTOM, far: ankle },
    hands: { near: SL_PILLOW_HAND, far: [round(knee[0] + 5), round(knee[1] + 8)] },
    elbows: { near: { bend: 1 }, far: { bend: -1 } },
    toes: { near: 0, far: thigh + bend - 90 },
  });
}

// ---------------------------------------------------------------- adductor groin stretch (lying, two views)

/**
 * Lying on the back, both legs straight up and then opened into a V: each leg
 * `spread` degrees from vertical in the front view (the side view sees them
 * shorten). Hands rest on the inner thighs.
 */
function adductor(spread: number): Keyframe {
  const base = supine();
  const pelvis = base.pelvis as Point;
  const r = (spread * Math.PI) / 180;
  const foot = (side: Side): { at: Point; z: number } => {
    const sign = side === "near" ? -1 : 1;
    const z = sign * (HIP_SIDE + LEG * Math.sin(r));
    return { at: [pelvis[0], round(pelvis[1] - LEG * Math.cos(r))], z: round(z) };
  };
  const hand = (side: Side): { at: Point; z: number } => {
    const sign = side === "near" ? -1 : 1;
    const along3 = 60;
    return {
      at: [pelvis[0] + 5, round(pelvis[1] - along3 * Math.cos(r))],
      z: round(sign * (HIP_SIDE + along3 * Math.sin(r) - 5)),
    };
  };
  const [fn, ff, hn, hf] = [foot("near"), foot("far"), hand("near"), hand("far")];
  return {
    hold: 0,
    pose: {
      ...base,
      hands: { near: hn.at, far: hf.at },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      feet: { near: fn.at, far: ff.at },
    },
    sideways: { feet: { near: fn.z, far: ff.z }, hands: { near: hn.z, far: hf.z } },
  };
}

// ---------------------------------------------------------------- seated floor hamstring stretch (two views)

const SEAT_PELVIS: Point = [0, -10];
/** The tucked (far) leg: thigh flopped out to the side, sole against the straight leg's inner thigh. */
const TUCK_KNEE_Z = HIP_SIDE + 78;
const TUCK_KNEE: Point = [round(Math.sqrt(THIGH ** 2 - 78 ** 2 - 2 ** 2)), -12];
const TUCK_FOOT_Z = 3;
const TUCK_FOOT: Point = [round(TUCK_KNEE[0] + Math.sqrt(SHIN ** 2 - (TUCK_KNEE_Z - TUCK_FOOT_Z) ** 2 - 4 ** 2)), -8];

/** Sitting with the near leg straight ahead and the far foot tucked in; the torso hinges forward over the straight leg (`lean` from the floor). */
function seatedHamstring(lean: number, reach: boolean): Keyframe {
  const pelvis = SEAT_PELVIS;
  return {
    hold: 0,
    pose: {
      pelvis,
      chest: along(pelvis, -lean, 80),
      hands: reach ? { near: [150, -14], far: [147, -16] } : { near: [60, -14], far: [58, -16] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 }, far: { at: TUCK_KNEE } },
      feet: { near: [173.6, -8], far: TUCK_FOOT },
      toes: { near: -84, far: 0 },
    },
    sideways: {
      hands: { near: -14, far: -2 },
      elbows: reach ? { near: { out: 70 }, far: { out: 70 } } : {},
      knees: { far: { at: TUCK_KNEE_Z } },
      feet: { far: TUCK_FOOT_Z },
    },
  };
}

// ---------------------------------------------------------------- groin and back stretch (seated butterfly, two views)

/** Butterfly legs: knees out to the sides (thighs `azimuth` degrees out from straight ahead), soles together in the middle. */
function butterflyLegs(azimuth: number, kneeLift: number): { knee: Point; kneeZ: number; foot: Point; footZ: number } {
  const r = (azimuth * Math.PI) / 180;
  const flat = Math.sqrt(THIGH ** 2 - kneeLift ** 2);
  const knee: Point = [round(flat * Math.cos(r)), round(SEAT_PELVIS[1] - kneeLift)];
  const kneeZ = HIP_SIDE + flat * Math.sin(r);
  const footZ = 3;
  const footY = -7;
  const dy = footY - knee[1];
  const dz = kneeZ - footZ;
  return { knee, kneeZ: round(kneeZ), foot: [round(knee[0] + Math.sqrt(SHIN ** 2 - dy * dy - dz * dz)), footY], footZ };
}

/**
 * Sitting with the soles together and knees dropped open. `curl` 0 sits tall
 * with the hands behind the head; 1 curls forward, elbows coming down inside the thighs.
 */
function butterfly(curl: number): Keyframe {
  const pelvis = SEAT_PELVIS;
  const legs = butterflyLegs(62 - 6 * curl, 36 - 14 * curl);
  const lean = 86 - 50 * curl;
  const chest = along(pelvis, -lean, 79);
  const head = along(chest, -lean + 4, 58 - 4 * curl);
  const hand = along(head, -lean - 100, 16);
  // Curled over, the elbows rest on the inner thighs just above the knees.
  const elbow: Point = [round(legs.knee[0] - 10), round(legs.knee[1] - 24)];
  const elbowZ = round(legs.kneeZ * 0.8);
  // The forearms fold up from the elbows towards the face.
  const fa = [30, -45, -25].map((v) => (v * 65.5) / Math.hypot(30, 45, 25));
  const forearmEnd: Point = [round(elbow[0] + fa[0]), round(elbow[1] + fa[1])];
  const handZ = round(elbowZ + fa[2]);
  return {
    hold: 0,
    pose: {
      pelvis,
      chest,
      head,
      hands: curl === 1 ? { near: forearmEnd, far: forearmEnd } : { near: hand, far: hand },
      elbows: curl === 1 ? { near: { at: elbow }, far: { at: elbow } } : { near: { bend: -1 }, far: { bend: -1 } },
      knees: { near: { at: legs.knee }, far: { at: legs.knee } },
      feet: { near: legs.foot, far: legs.foot },
      toes: { near: 0, far: 0 },
    },
    sideways: {
      hands: curl === 1 ? { near: -handZ, far: handZ } : { near: -27, far: 27 },
      elbows: curl === 1 ? { near: { at: -elbowZ }, far: { at: elbowZ } } : { near: { out: 80 }, far: { out: 80 } },
      knees: { near: { at: -legs.kneeZ }, far: { at: legs.kneeZ } },
      feet: { near: -legs.footZ, far: legs.footZ },
    },
  };
}

// ---------------------------------------------------------------- specs

export const BATCH_AN_SPECS: DoodleSpec[] = [
  {
    id: "fedb_90_90_hamstring",
    slug: "90-90-hamstring",
    title: "90 90 Hamstring",
    props: [FLOOR],
    transition: 1.3,
    frames: [
      { hold: 0.6, pose: ninety(0) },
      { hold: 1.4, pose: ninety(-88) },
    ],
  },
  {
    id: "fedb_leg_up_hamstring_stretch",
    slug: "leg-up-hamstring-stretch",
    title: "Leg-Up Hamstring Stretch",
    props: [FLOOR],
    transition: 1.3,
    frames: [
      { hold: 0.6, pose: legUp(-90) },
      { hold: 1.4, pose: legUp(-109) },
    ],
  },
  {
    id: "fedb_all_fours_quad_stretch",
    slug: "all-fours-quad-stretch",
    title: "All Fours Quad Stretch",
    props: [FLOOR],
    transition: 1.1,
    frames: [
      { hold: 0.6, pose: allFoursQuad(-150, false) },
      { hold: 0, pose: allFoursQuad(-130, false, [0, -52]) },
      { hold: 1.4, pose: allFoursQuad(-109, true) },
    ],
  },
  {
    id: "fedb_calf_stretch_elbows_against_wall",
    slug: "calf-stretch-elbows-against-wall",
    title: "Calf Stretch Elbows Against Wall",
    props: [CW_WALL, FLOOR],
    transition: 1.2,
    frames: [
      { hold: 0.6, pose: wallCalf(62) },
      { hold: 1.4, pose: wallCalf(50) },
    ],
  },
  {
    id: "fedb_runners_stretch",
    slug: "runners-stretch",
    title: "Runner's Stretch",
    props: [FLOOR],
    transition: 1.1,
    frames: [
      { hold: 0.6, pose: runners([-42, -84]) },
      { hold: 1.2, pose: runners([-68, -128]) },
    ],
  },
  {
    id: "fedb_seated_calf_stretch",
    slug: "seated-calf-stretch",
    title: "Seated Calf Stretch",
    props: [FLOOR],
    transition: 1.1,
    frames: [
      { hold: 0.6, pose: seatedCalf(80, -80) },
      { hold: 1.4, pose: seatedCalf(40, -104) },
    ],
  },
  {
    id: "fedb_standing_elevated_quad_stretch",
    slug: "standing-elevated-quad-stretch",
    title: "Standing Elevated Quad Stretch",
    props: [BENCH, FLOOR],
    transition: 1.1,
    frames: [
      { hold: 0.6, pose: elevatedQuad(-10) },
      { hold: 1.4, pose: elevatedQuad(16) },
    ],
  },
  {
    id: "fedb_standing_gastrocnemius_calf_stretch",
    slug: "standing-gastrocnemius-calf-stretch",
    title: "Standing Gastrocnemius Calf Stretch",
    props: [STEP, FLOOR],
    transition: 1.2,
    frames: [
      { hold: 0.6, pose: gastroc(50, -150, false) },
      { hold: 1.4, pose: gastroc(16, -144, true) },
    ],
  },
  {
    id: "fedb_standing_hip_flexors",
    slug: "standing-hip-flexors",
    title: "Standing Hip Flexors",
    props: [FLOOR],
    transition: 1.1,
    frames: [
      { hold: 0.6, pose: standingHipFlexor(-8) },
      { hold: 1.4, pose: standingHipFlexor(16) },
    ],
  },
  {
    id: "fedb_on_your_side_quad_stretch",
    slug: "on-your-side-quad-stretch",
    title: "On Your Side Quad Stretch",
    views: TWO_VIEWS,
    props: [SIDE_LYING_FLOOR],
    transition: 1.1,
    frames: [
      { ...sideQuad(150), hold: 0.5 },
      { ...sideQuad(172), hold: 1.4 },
    ],
  },
  {
    id: "fedb_side_lying_groin_stretch",
    slug: "side-lying-groin-stretch",
    title: "Side Lying Groin Stretch",
    view: "front",
    props: [SIDE_LYING_FLOOR],
    transition: 1.2,
    frames: [
      { hold: 0.5, pose: sideGroin(-102, 82) },
      { hold: 1.4, pose: sideGroin(-108, 2) },
    ],
  },
  {
    id: "fedb_adductor_groin",
    slug: "adductor-groin",
    title: "Adductor Groin",
    views: TWO_VIEWS,
    props: [FLOOR],
    transition: 1.4,
    frames: [
      { ...adductor(4), hold: 0.5 },
      { ...adductor(54), hold: 1.4 },
    ],
  },
  {
    id: "fedb_seated_floor_hamstring_stretch",
    slug: "seated-floor-hamstring-stretch",
    title: "Seated Floor Hamstring Stretch",
    views: TWO_VIEWS,
    props: [FLOOR],
    transition: 1.3,
    frames: [
      { ...seatedHamstring(86, false), hold: 0.5 },
      { ...seatedHamstring(30, true), hold: 1.4 },
    ],
  },
  {
    id: "fedb_groin_and_back_stretch",
    slug: "groin-and-back-stretch",
    title: "Groin and Back Stretch",
    views: TWO_VIEWS,
    props: [FLOOR],
    transition: 1.3,
    frames: [
      { ...butterfly(0), hold: 0.6 },
      { ...butterfly(1), hold: 1.4 },
    ],
  },
];
