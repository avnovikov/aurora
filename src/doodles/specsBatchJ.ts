import { solvePose } from "./rig";
import type { DoodleSpec, Point, Pose, Prop } from "./rig";

/**
 * Batch J: warm-up mobility, cool-down stretches and bar work (dips, tuck
 * front lever, wide pull-up, skin the cat). Floor at y = 0, up is negative,
 * the side-view figure faces +x. Import only from ./rig — never from ./specs
 * (that would be circular).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;

/** Near-side shoulder of a solved pose. */
const shoulderOf = (pose: Pose): Point => solvePose(pose).arms.near.root;

/** Straight-arm reach from shoulder to fingertip (a hair short of locked). */
const REACH = 125.4;

// ---------------------------------------------------------------- standing

const STAND_PELVIS: Point = [0, -172];
const STAND_CHEST: Point = [0, -252];

// ---------------------------------------------------------------- leg swings

/** A barre seen end-on, at hand height beside the hips (the leg swings clear of it). */
const BARRE: Prop = { kind: "bar", y: -196, x1: 20, x2: 34, grips: [27] };

/** Standing tall, far hand on the barre, near hand on the hip; the near leg swings `deg` from straight down (+ forward). */
function legSwing(deg: number): Pose {
  return {
    pelvis: STAND_PELVIS,
    chest: STAND_CHEST,
    hands: { near: [-4, -176], far: [30, -196] },
    feet: { near: along(STAND_PELVIS, 90 - deg, 173.6), far: [-2, 0] },
    toes: { near: deg > 20 ? -deg / 2 : 0, far: 0 },
  };
}

// ---------------------------------------------------------------- walking knee hug

/** Standing tall; `side` pulls that knee to the chest and rises onto the other foot's toes. */
function kneeHug(side: "near" | "far" | "none"): Pose {
  if (side === "none") {
    return {
      pelvis: STAND_PELVIS,
      chest: STAND_CHEST,
      hands: { near: [6, -148], far: [0, -148] },
      feet: { near: [4, 0], far: [-4, 0] },
      toes: { near: 0, far: 0 },
    };
  }
  const pelvis: Point = [0, -186];
  const knee = along(pelvis, -58, 88);
  const ankle = along(knee, 82, 86);
  const grip = along(knee, 82, 22);
  const standing = side === "near" ? "far" : "near";
  return {
    pelvis,
    chest: [2, -266],
    hands: { near: [grip[0] + 2, grip[1]], far: [grip[0] - 2, grip[1]] },
    knees: { [side]: { at: knee } },
    feet: { [side]: ankle, [standing]: [-6, -14] },
    toes: { [side]: 60, [standing]: 45 },
  };
}

// ---------------------------------------------------------------- wall slide

const WALL_X = 110;
const SLIDE_WALL: Prop = { kind: "box", x: WALL_X, y: -420, w: 14, h: 420 };

/**
 * Facing the wall, forearms vertical against it. `reach` is the shoulder's
 * distance from the wall: the elbow sits on the wall `reach` away horizontally,
 * below the shoulder (`up` false) or above it (`up` true). The chest sways in
 * and out a little so the elbow can slide past shoulder height on the wall.
 */
function wallSlide(reach: number, up: boolean): Pose {
  const pelvis: Point = [54, -172];
  const lean = ((WALL_X - 7 - reach - pelvis[0]) * 80) / 98;
  const chest: Point = along(pelvis, -90 + (Math.atan2(lean, 80) * 180) / Math.PI, 80);
  const shoulder = shoulderOf({ pelvis, chest });
  const dx = WALL_X - 7 - shoulder[0];
  const dy = Math.sqrt(Math.max(0, 60 * 60 - dx * dx));
  const elbow: Point = [WALL_X - 7, round(shoulder[1] + (up ? -dy : dy))];
  const hand: Point = [WALL_X - 7, round(elbow[1] - 65.9)];
  return {
    pelvis,
    chest,
    // Head stays back over the shoulders (chin tucked) while the elbows rise past it.
    head: along(along(pelvis, -90 + (Math.atan2(lean, 80) * 180) / Math.PI, 100), -104, 36),
    hands: { near: hand, far: hand },
    elbows: { near: { at: elbow }, far: { at: elbow } },
    feet: { near: [62, 0], far: [46, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- lying on the back (figure four)

const SUPINE_PELVIS: Point = [-12, -20];
const SUPINE_BASE: Pose = { pelvis: SUPINE_PELVIS, chest: [-89, -18], head: [-144, -24], spine: { bend: -1 } };

/** Figure four: far foot flat or far thigh pulled in (`thigh` angle); near ankle crossed over the far knee once `crossed`. */
function figureFour(thigh: number, crossed: boolean, pull: boolean): Pose {
  const farKnee = along(SUPINE_PELVIS, thigh, 88);
  const farAnkle: Point = pull ? along(farKnee, thigh + 115, 86) : [round(farKnee[0] + Math.sqrt(86 * 86 - (farKnee[1] + 5) ** 2)), -5];
  const nearAnkle: Point = crossed ? along(farKnee, thigh + 90, 8) : [farAnkle[0] - 4, -5];
  const shoulder = shoulderOf(SUPINE_BASE);
  const behindThigh = along(SUPINE_PELVIS, thigh, 58);
  const hands: Pose["hands"] = pull
    ? { near: behindThigh, far: [behindThigh[0] - 2, behindThigh[1]] }
    : { near: along(shoulder, 2, REACH), far: along(shoulder, 3, REACH) };
  return {
    ...SUPINE_BASE,
    hands,
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { far: { at: farKnee }, near: { bend: -1 } },
    feet: { near: nearAnkle, far: farAnkle },
    toes: { near: crossed ? thigh + 90 : 0, far: pull ? thigh + 115 + 90 : 0 },
  };
}

// ---------------------------------------------------------------- butterfly (seated, front view)

/** Seated tall, soles together, knees dropped out to the sides; `drop` lowers the feet a little so the knees sink. */
function butterfly(drop: number): Pose {
  const pelvis: Point = [0, -16];
  const ankleY = -52 + drop;
  return {
    pelvis,
    chest: [0, -96],
    hands: { near: [-14, ankleY + 4], far: [14, ankleY + 4] },
    elbows: { near: { bend: 1 }, far: { bend: -1 } },
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [-12, ankleY], far: [12, ankleY] },
    toes: { near: 70, far: 110 },
  };
}

// ---------------------------------------------------------------- dips

const DIP_HANDS = { near: [46, -216] as Point, far: [42, -216] as Point };
const DIP_BARS: Prop = { kind: "parallelBars", y: -216, x1: -190, x2: 190 };

/** Dip: shoulder at `shoulder`, torso leaning `lean` degrees forward of vertical, knees bent with the feet behind. */
function dip(shoulder: Point, lean: number, elbow?: Point): Pose {
  const pelvis = along(shoulder, 90 + lean, 98);
  const chest = along(pelvis, -90 + lean, 80);
  const knee = along(pelvis, 96, 88);
  return {
    pelvis,
    chest,
    hands: DIP_HANDS,
    elbows: elbow ? { near: { at: elbow }, far: { bend: 1 } } : undefined,
    knees: { near: { at: knee }, far: { at: [knee[0] - 3, knee[1]] } },
    feet: { near: along(knee, 170, 86), far: along([knee[0] - 3, knee[1]], 172, 86) },
    toes: { near: 100, far: 100 },
  };
}

/** Bottom of the dip: forearm near vertical, upper arm level, shoulders ahead of the hands. */
function dipBottom(): Pose {
  const elbow = along(DIP_HANDS.near, -104, 65.9);
  const shoulder: Point = [round(elbow[0] + 59.6), round(elbow[1] + 6)];
  return dip(shoulder, 28, elbow);
}

// ---------------------------------------------------------------- bar work

const SIDE_HANDS = { near: [4, -420] as Point, far: [0, -420] as Point };

/** Distance from `p` to segment ab. */
function toSegment(p: Point, a: Point, b: Point): number {
  const ab: Point = [b[0] - a[0], b[1] - a[1]];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / (ab[0] * ab[0] + ab[1] * ab[1])));
  return Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t);
}

/**
 * Head tilted (within the neck's range) away from the arms running up to the
 * bar, always to the side the turning body is heading, so it never swings
 * through them: back while the spine points up or left, forward otherwise.
 */
function clearHead(neck: Point, spine: number, shoulder: Point): Point {
  const a = ((((spine + 180) % 360) + 360) % 360) - 180;
  const sign = a > -90 && a < 90 ? 1 : -1;
  const heads = [20, 30, 40, 50, 55].map((tilt) => along(neck, spine + sign * tilt, 36));
  const clearance = (head: Point): number => toSegment(head, shoulder, SIDE_HANDS.near);
  return heads.find((head) => clearance(head) >= 27) ?? heads[heads.length - 1];
}

/** Shoulder held under the bar while the body turns around it (skin the cat, tuck lever). */
export const CAT_SHOULDER: Point = [0, -296];

/**
 * Tucked body turned around the shoulder: `theta` is the shoulder→pelvis
 * direction (90 hanging, 0 hips forward face up, -90 inverted, ±180 face down
 * behind). Knees stay tucked to the chest.
 */
export function tuckedAround(
  theta: number,
  shoulder: Point = CAT_SHOULDER,
  legs: "tuck" | number = "tuck",
  headInLine = false,
): Pose {
  const pelvis = along(shoulder, theta, 98);
  const chest = along(pelvis, theta + 180, 80);
  const neck = along(pelvis, theta + 180, 100);
  const head = headInLine ? along(neck, theta + 180, 36) : clearHead(neck, theta + 180, shoulder);
  if (legs !== "tuck") {
    // Legs long, hanging `legs` degrees from the hips.
    return {
      pelvis,
      chest,
      head,
      hands: SIDE_HANDS,
      feet: { near: along(pelvis, legs, 173.6), far: along(pelvis, legs - 1, 173.4) },
      toes: { near: legs - 10, far: legs - 10 },
    };
  }
  const kneeNear = along(pelvis, theta - 135, 88);
  const kneeFar = along(pelvis, theta - 133, 88);
  return {
    pelvis,
    chest,
    head,
    hands: SIDE_HANDS,
    knees: { near: { at: kneeNear }, far: { at: kneeFar } },
    feet: { near: along(kneeNear, theta + 12, 86), far: along(kneeFar, theta + 14, 86) },
    toes: { near: theta - 78, far: theta - 76 },
  };
}

/** Shoulder for the tuck front lever: straight arms angled forward from the bar. */
const LEVER_SHOULDER: Point = along([2, -420], 106, 124.8);

/** Front-view hang from a bar at y = -420 with hands at ±`grip`. */
function frontBarHang(pelvisY: number, grip: number, elbows?: Pose["elbows"]): Pose {
  return {
    pelvis: [0, pelvisY],
    chest: [0, pelvisY - 80],
    hands: { near: [-grip, -420], far: [grip, -420] },
    elbows,
    feet: { near: [-14, pelvisY + 173.9], far: [14, pelvisY + 173.9] },
    toes: { near: 180, far: 0 },
  };
}

const WIDE_GRIP = 124;
/** Pelvis height of a straight-arm wide hang (shoulders 22 either side of the chest, 98 above the pelvis). */
const WIDE_HANG_Y = round(-420 + Math.sqrt(REACH * REACH - (WIDE_GRIP - 22) ** 2) + 98);

export const BATCH_J_SPECS: DoodleSpec[] = [
  {
    id: "ntc_leg_swings",
    slug: "leg-swings",
    title: "Leg swings",
    props: [BARRE],
    transition: 0.7,
    frames: [
      { hold: 0.1, pose: legSwing(58) },
      { hold: 0.1, pose: legSwing(-32) },
    ],
  },


  {
    id: "wger_2523",
    slug: "serratus-wall-slide-stretch",
    title: "Serratus Wall Slide Stretch",
    props: [SLIDE_WALL],
    transition: 1.4,
    frames: [
      { hold: 0.5, pose: wallSlide(44, false) },
      { hold: 0.05, pose: wallSlide(60, false) },
      { hold: 1.2, pose: wallSlide(42, true) },
      { hold: 0.05, pose: wallSlide(60, false) },
    ],
  },

  {
    id: "ntc_figure_four",
    slug: "figure-four-stretch",
    title: "Figure-four stretch",
    transition: 1.3,
    frames: [
      { hold: 0.5, pose: figureFour(-45, false, false) },
      { hold: 0.5, pose: figureFour(-45, true, false) },
      { hold: 1.4, pose: figureFour(-100, true, true) },
    ],
  },
  {
    id: "ntc_butterfly_stretch",
    slug: "butterfly-stretch",
    title: "Butterfly stretch",
    view: "front",
    transition: 1.4,
    frames: [
      { hold: 1, pose: butterfly(0) },
      { hold: 1, pose: butterfly(5) },
    ],
  },
  {
    id: "ntc_walking_knee_hug",
    slug: "walking-knee-hug",
    title: "Walking knee hug",
    transition: 0.8,
    frames: [
      { hold: 0.3, pose: kneeHug("none") },
      { hold: 0.6, pose: kneeHug("near") },
      { hold: 0.3, pose: kneeHug("none") },
      { hold: 0.6, pose: kneeHug("far") },
    ],
  },
  {
    id: "hf_25",
    slug: "parallel-bar-dip",
    title: "Parallel Bar Dip",
    props: [DIP_BARS],
    transition: 1,
    frames: [
      { hold: 0.5, pose: dip(along(DIP_HANDS.near, -91, REACH), 18) },
      { hold: 0.3, pose: dipBottom() },
    ],
  },
  {
    id: "hf_57",
    slug: "tuck-front-lever",
    title: "Tuck Front Lever",
    props: [{ kind: "bar", y: -420, x1: -110, x2: 110, grips: [0] }],
    transition: 1,
    frames: [
      { hold: 0.4, pose: tuckedAround(90, CAT_SHOULDER, 89) },
      { hold: 0.05, pose: tuckedAround(90) },
      { hold: 1.4, pose: tuckedAround(0, LEVER_SHOULDER, "tuck", true) },
      { hold: 1.2, pose: tuckedAround(-3, LEVER_SHOULDER, "tuck", true) },
      { hold: 0.05, pose: tuckedAround(90) },
    ],
  },
  {
    id: "hf_45",
    slug: "wide-grip-pull-up",
    title: "Wide-Grip Pull-Up",
    view: "front",
    props: [{ kind: "bar", y: -420, x1: -190, x2: 190, grips: [-WIDE_GRIP, WIDE_GRIP] }],
    transition: 1,
    frames: [
      { hold: 0.5, pose: frontBarHang(WIDE_HANG_Y, WIDE_GRIP, { near: { bend: -1 }, far: { bend: 1 } }) },
      { hold: 0.4, pose: frontBarHang(-310, WIDE_GRIP, { near: { bend: -1 }, far: { bend: 1 } }) },
    ],
  },
  {
    id: "hf_60",
    slug: "skin-the-cat",
    title: "Skin the Cat",
    // The bar seen end-on (just the grip): the tucked legs pass it on the way over.
    props: [{ kind: "bar", y: -420, x1: 0, x2: 0, grips: [0] }],
    transition: 0.6,
    frames: [
      { hold: 0.4, pose: tuckedAround(90, CAT_SHOULDER, 89) },
      { hold: 0.05, pose: tuckedAround(90) },
      { hold: 0.05, pose: tuckedAround(45) },
      { hold: 0.05, pose: tuckedAround(0) },
      { hold: 0.05, pose: tuckedAround(-45) },
      { hold: 0.05, pose: tuckedAround(-90) },
      { hold: 0.05, pose: tuckedAround(-135) },
      { hold: 0.05, pose: tuckedAround(180) },
      { hold: 0.8, pose: tuckedAround(150, CAT_SHOULDER, 100) },
      { hold: 0.05, pose: tuckedAround(180) },
      { hold: 0.05, pose: tuckedAround(-135) },
      { hold: 0.05, pose: tuckedAround(-90) },
      { hold: 0.05, pose: tuckedAround(-45) },
      { hold: 0.05, pose: tuckedAround(0) },
      { hold: 0.05, pose: tuckedAround(45) },
      { hold: 0.05, pose: tuckedAround(90) },
    ],
  },
];
