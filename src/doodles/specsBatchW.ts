import { plank, squatHandsDown, stand } from "./specsBatchI";
import { CAT_SHOULDER, tuckedAround } from "./specsBatchJ";
import { solvePose } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose, Prop } from "./rig";

/**
 * Batch W: lever and bar skills (full front lever, front lever row, tuck and
 * full back lever, ice cream maker, burpee pull-up, bar pullover) and the
 * kip-up. Floor at y = 0, up is negative, the side-view figure faces +x.
 *
 * Front vs back lever: a front lever lies face up with the head towards -x
 * and the legs towards +x, reached by lifting the legs forward from the hang;
 * a back lever lies face down with the head towards +x and the legs towards
 * -x, reached through skin the cat (legs up between the arms, inverted, then
 * lowered behind). The tucked versions fold the knees up (front) or down
 * (back) towards the chest.
 *
 * Back Lever (wger_1742) and Full Back Lever (hf_62) are the same move and
 * share one animation.
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

/** Pelvis to ankle with the knee straight. */
const LEG = 173.6;
/** Straight-arm reach from shoulder to fingertip (a hair short of locked). */
const REACH = 125.7;

/** Knees pinned on the hip→ankle line, so straight legs never kink. */
function straightKnees(pelvis: Point, near: Point, far: Point): Pose["knees"] {
  const knee = (ankle: Point): Point => along(pelvis, angle(pelvis, ankle), 88);
  return { near: { at: knee(near) }, far: { at: knee(far) } };
}

/** Where circles around `a` (radius ra) and `b` (radius rb) meet; `side` 1 or -1 picks the point left/right of a→b. */
function meet(a: Point, ra: number, b: Point, rb: number, side: 1 | -1): Point {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  return [round(a[0] + ux * x - side * uy * h), round(a[1] + uy * x + side * ux * h)];
}

/** Elbow of a bent arm from `shoulder` to the fingertips at `hand`, on the lower (larger y) side. */
function lowElbow(shoulder: Point, hand: Point): Point {
  const a = meet(shoulder, 60, hand, 66, 1);
  const b = meet(shoulder, 60, hand, 66, -1);
  return a[1] > b[1] ? a : b;
}

// ---------------------------------------------------------------- the bar

const BAR_Y = -420;
/** Grip on the bar, near and far hand (the same as skin the cat). */
const HANDS = { near: [4, BAR_Y] as Point, far: [0, BAR_Y] as Point };
/** A bar seen side on (front lever work, pull-ups). */
const SIDE_BAR: Prop = { kind: "bar", y: BAR_Y, x1: -110, x2: 110, grips: [0] };
/** The bar seen end-on (just the grip): the legs pass it on the way round. */
const END_BAR: Prop = { kind: "bar", y: BAR_Y, x1: 0, x2: 0, grips: [0] };

/** Front lever shoulder: arms straight, slanting up towards the hips. */
const FRONT_SHOULDER: Point = along([2, BAR_Y], 104, REACH);
/** Back lever shoulder: arms straight, slanting up towards the hips (the hips are now at -x). */
const BACK_SHOULDER: Point = along([2, BAR_Y], 76, REACH);

/**
 * Straight body turned around the shoulder: `theta` is the shoulder→pelvis
 * direction (0 face up with the legs at +x, -90 inverted, 180 face down with
 * the legs at -x). Head in line, legs together and pointed.
 */
function straightAround(theta: number, shoulder: Point): Pose {
  const pelvis = along(shoulder, theta, 98);
  const near = along(pelvis, theta, LEG);
  const far = along(pelvis, theta + 0.5, LEG);
  return {
    pelvis,
    chest: along(pelvis, theta + 180, 80),
    head: along(shoulder, theta + 180, 38),
    hands: HANDS,
    knees: straightKnees(pelvis, near, far),
    feet: { near, far },
    toes: { near: theta, far: theta },
  };
}

/** Dead hang under the bar, legs long. */
const hang = (): Pose => tuckedAround(90, CAT_SHOULDER, 89);

// ---------------------------------------------------------------- front lever row

/** Front lever with the arms bent: shoulders `back` past the bar and `up` below it (the body hangs under the bar), elbows driven behind the back. */
function frontLeverRow(back: number, up: number): Pose {
  const shoulder: Point = [2 - back, BAR_Y + up];
  const lever = straightAround(0, shoulder);
  return {
    ...lever,
    elbows: { near: { at: lowElbow(shoulder, HANDS.near) }, far: { at: lowElbow(shoulder, HANDS.far) } },
  };
}

// ---------------------------------------------------------------- pull-up top (side view)

/** Top of a pull-up: chin over the bar, elbows down in front of the ribs, legs long. */
function pullUpTop(): Pose {
  const shoulder: Point = [-22, -410];
  const pelvis = along(shoulder, 92, 98);
  const near = along(pelvis, 93, LEG);
  const far = along(pelvis, 93.5, LEG);
  return {
    pelvis,
    chest: along(pelvis, -88, 80),
    head: along(along(pelvis, -88, 100), -96, 36),
    hands: HANDS,
    elbows: { near: { at: lowElbow(shoulder, HANDS.near) }, far: { at: lowElbow(shoulder, HANDS.far) } },
    knees: straightKnees(pelvis, near, far),
    feet: { near, far },
    toes: { near: 80, far: 80 },
  };
}

/** Rising out of the squat, arms swinging forward and up. */
function riseToJump(): Pose {
  const pelvis: Point = [-12, -150];
  const shoulder = along(pelvis, -80, 98);
  return {
    pelvis,
    chest: along(pelvis, -80, 80),
    hands: { near: along(shoulder, -30, 124), far: along(shoulder, -32, 124) },
    feet: { near: [6, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Take-off towards the bar: arms reaching up, feet leaving the floor. */
function jumpToBar(): Pose {
  const pelvis: Point = [0, -184];
  return {
    pelvis,
    chest: [1, -264],
    // Head tipped back to look at the bar, clear of the arms.
    head: along([1.2, -284], -125, 36),
    hands: { near: [6, BAR_Y + 18], far: [2, BAR_Y + 18] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [6, -22], far: [0, -22] },
    toes: { near: 70, far: 70 },
  };
}

// ---------------------------------------------------------------- bar pullover

/** Pull with the legs raised in front: chest towards the bar, elbows bent. */
function pulloverPull(): Pose {
  const shoulder: Point = [-26, -392];
  const pelvis = along(shoulder, 70, 98);
  const near = along(pelvis, -20, LEG);
  const far = along(pelvis, -19.5, LEG);
  return {
    pelvis,
    chest: along(pelvis, -110, 80),
    head: along(along(pelvis, -110, 100), -140, 36),
    hands: HANDS,
    elbows: { near: { at: lowElbow(shoulder, HANDS.near) }, far: { at: lowElbow(shoulder, HANDS.far) } },
    knees: straightKnees(pelvis, near, far),
    feet: { near, far },
    toes: { near: -20, far: -20 },
  };
}

/** Hips at the bar, upside down and piked, legs swinging over the top. */
function pulloverHips(): Pose {
  const pelvis: Point = [20, -428];
  const torso = 104;
  const shoulder = along(pelvis, torso, 98);
  const near = along(pelvis, -118, LEG);
  const far = along(pelvis, -117.5, LEG);
  return {
    pelvis,
    chest: along(pelvis, torso, 80),
    head: along(along(pelvis, torso, 100), torso - 30, 36),
    hands: HANDS,
    elbows: { near: { at: lowElbow(shoulder, HANDS.near) }, far: { at: lowElbow(shoulder, HANDS.far) } },
    knees: straightKnees(pelvis, near, far),
    feet: { near, far },
    toes: { near: -118, far: -118 },
  };
}

/** Hips rolling over the top of the bar: legs dropping behind, chest coming up in front. */
function pulloverOver(): Pose {
  const pelvis: Point = [-6, -444];
  const torso = 25;
  const near = along(pelvis, 150, LEG);
  const far = along(pelvis, 150.5, LEG);
  return {
    pelvis,
    chest: along(pelvis, torso, 80),
    head: along(along(pelvis, torso, 100), torso - 20, 36),
    hands: HANDS,
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: straightKnees(pelvis, near, far),
    feet: { near, far },
    toes: { near: 150, far: 150 },
  };
}

/** Front support on top of the bar: arms straight, bar at the front of the hips, legs hanging. */
function frontSupport(): Pose {
  const pelvis: Point = [-24, -446];
  const near = along(pelvis, 96, LEG);
  const far = along(pelvis, 96.5, LEG);
  return {
    pelvis,
    chest: along(pelvis, -76, 80),
    head: along(along(pelvis, -76, 100), -76, 36),
    hands: HANDS,
    knees: straightKnees(pelvis, near, far),
    feet: { near, far },
    toes: { near: 80, far: 80 },
  };
}

// ---------------------------------------------------------------- kip-up

/** Roll-back: hips over the shoulders as far as the spine's bend limit allows, knees by the face. */
const ROLL_PELVIS: Point = [-80, -120];
const ROLL_CHEST: Point = [-98, -45];
const ROLL_THIGH = 158;
/** The push: shoulders lifting with the hands still planted, head tucked so the arms clear it. */
const PUSH_CHEST: Point = [-86, -86];
const PUSH_HEAD: Point = [-126, -48];

/**
 * Hands by the ears, palms down: in side view the wrists sit just past the
 * head with the fingers on the floor, the elbows up above the face, so the
 * arms frame the head rather than crossing it.
 */
const KIP_WRISTS = { near: [-183, -13] as Point, far: [-183, -14] as Point };

/** Hands planted by the head, elbows pointing up: elbows solved from the pose's shoulder. */
function kipHands(pose: Pose): Pose {
  const shoulder = solvePose(pose).arms.near.root;
  const elbow = (wrist: Point): Point => {
    const a = meet(shoulder, 60, wrist, 58, 1);
    const b = meet(shoulder, 60, wrist, 58, -1);
    return a[1] < b[1] ? a : b;
  };
  return {
    ...pose,
    hands: KIP_WRISTS,
    wrists: { near: 120, far: 120 },
    elbows: { near: { at: elbow(KIP_WRISTS.near) }, far: { at: elbow(KIP_WRISTS.far) } },
  };
}

/** Lying on the back, hands by the ears palms down, legs long. */
function kipLie(): Pose {
  return kipHands({
    pelvis: [-10, -14],
    chest: [-90, -16],
    head: [-144, -25],
    feet: { near: [162, -8], far: [160, -8] },
    toes: { near: -75, far: -75 },
  });
}

/** Lying back down from the sit, arms long by the sides. */
function kipLieDown(): Pose {
  return {
    pelvis: [-10, -14],
    chest: [-90, -16],
    head: [-144, -25],
    hands: { near: [17, -14], far: [15, -14] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [162, -8], far: [160, -8] },
    toes: { near: -75, far: -75 },
  };
}

/** Lying flat, arms reaching straight up on their way to the ears. */
function kipArmsUp(): Pose {
  return {
    ...kipLieDown(),
    hands: { near: [-106, -142], far: [-110, -142] },
    elbows: undefined,
  };
}

/** On the way into the roll: knees pulled up over the hips, shins level, hands still by the ears. */
function kipTuck(): Pose {
  const pelvis: Point = [-10, -14];
  const knee = along(pelvis, -95, 88);
  return kipHands({
    pelvis,
    chest: [-90, -16],
    head: [-144, -25],
    knees: { near: { at: knee }, far: { at: [knee[0] - 2, knee[1]] } },
    feet: { near: along(knee, -5, 86), far: along([knee[0] - 2, knee[1]], -5, 86) },
    toes: { near: -5, far: -5 },
  });
}

/** Rolled back onto the shoulders, back rounded, hips over the shoulders and knees pulled to the face. */
function kipRoll(pelvis: Point = ROLL_PELVIS, chest: Point = ROLL_CHEST, thigh = ROLL_THIGH): Pose {
  const kneeNear = along(pelvis, thigh, 88);
  const kneeFar = along(pelvis, thigh + 2, 88);
  return kipHands({
    pelvis,
    chest,
    head: [-146, -27],
    knees: { near: { at: kneeNear }, far: { at: kneeFar } },
    feet: { near: along(kneeNear, thigh + 90, 86), far: along(kneeFar, thigh + 92, 86) },
    toes: { near: thigh + 90, far: thigh + 92 },
  });
}

/** The kick: legs whipping up and forward, hands pressing the floor. */
function kipKick(): Pose {
  const pelvis: Point = [-26, -76];
  const chest: Point = [-93, -32];
  const near = along(pelvis, -50, LEG);
  const far = along(pelvis, -49, LEG);
  return kipHands({
    pelvis,
    chest,
    head: [-146, -27],
    knees: straightKnees(pelvis, near, far),
    feet: { near, far },
    toes: { near: -50, far: -49 },
  });
}

/** The push: hands still planted by the ears and the head down while the shoulders lift, legs whipping down. */
function kipPush(): Pose {
  const pelvis: Point = [-34, -146];
  const near = along(pelvis, -32, LEG);
  const far = along(pelvis, -31, LEG);
  return kipHands({
    pelvis,
    chest: PUSH_CHEST,
    head: PUSH_HEAD,
    knees: straightKnees(pelvis, near, far),
    feet: { near, far },
    toes: { near: -32, far: -31 },
  });
}

/** Pushed off the hands: hips snapped up and arched, arms thrown forward, feet coming down under the body. */
function kipFlight(): Pose {
  const pelvis: Point = [-20, -172];
  const shoulder = along(pelvis, 145, 97);
  const kneeNear = along(pelvis, 30, 88);
  const kneeFar = along(pelvis, 32, 88);
  return {
    pelvis,
    chest: along(pelvis, 145, 79),
    spine: { bend: 1 },
    head: along(along(pelvis, 145, 99), 170, 36),
    hands: { near: along(shoulder, -62, 122), far: along(shoulder, -60, 122) },
    knees: { near: { at: kneeNear }, far: { at: kneeFar } },
    feet: { near: along(kneeNear, 120, 86), far: along(kneeFar, 122, 86) },
    toes: { near: 30, far: 32 },
  };
}

/** Landed in a deep squat, chest forward, arms reaching forward. */
function kipLand(): Pose {
  const pelvis: Point = [-10, -78];
  const ankle: Point = [40, 0];
  const shoulder = along(pelvis, -55, 98);
  return {
    pelvis,
    chest: along(pelvis, -55, 80),
    hands: { near: along(shoulder, 10, 122), far: along(shoulder, 12, 122) },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: ankle, far: [ankle[0] - 4, 0] },
    toes: { near: 0, far: 0 },
  };
}

function kipStand(): Pose {
  return {
    pelvis: [36, -172],
    chest: [36, -252],
    hands: { near: [42, -146], far: [38, -146] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [40, 0], far: [36, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Sitting back down to start again: hips on the floor, knees bent, hands behind. */
function kipSit(): Pose {
  const pelvis: Point = [0, -16];
  return {
    pelvis,
    chest: along(pelvis, -125, 80),
    hands: { near: [-70, -2], far: [-74, -2] },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [110, -6], far: [106, -6] },
    toes: { near: -30, far: -30 },
  };
}

// ---------------------------------------------------------------- shared sequences

/** Hang, tuck and turn up through skin the cat to the inverted tuck. */
const skinUp: Keyframe[] = [
  { hold: 0.4, pose: hang() },
  { hold: 0.05, pose: tuckedAround(90) },
  { hold: 0.05, pose: tuckedAround(30) },
  { hold: 0.05, pose: tuckedAround(-30) },
  { hold: 0.05, pose: tuckedAround(-90) },
];

const skinDown: Keyframe[] = [
  { hold: 0.05, pose: tuckedAround(-90) },
  { hold: 0.05, pose: tuckedAround(-30) },
  { hold: 0.05, pose: tuckedAround(30) },
  { hold: 0.05, pose: tuckedAround(90) },
];

/** Full back lever: inverted, legs straightened, lowered behind to horizontal face down, and back. */
const backLeverFrames: Keyframe[] = [
  ...skinUp,
  { hold: 0.15, pose: straightAround(-95, CAT_SHOULDER) },
  { hold: 0.05, pose: straightAround(-140, along([2, BAR_Y], 84, REACH)) },
  { hold: 1.8, pose: straightAround(180, BACK_SHOULDER) },
  { hold: 0.05, pose: straightAround(-140, along([2, BAR_Y], 84, REACH)) },
  { hold: 0.1, pose: straightAround(-95, CAT_SHOULDER) },
  ...skinDown,
];

export const BATCH_W_SPECS: DoodleSpec[] = [
  {
    id: "hf_58",
    slug: "full-front-lever",
    title: "Full Front Lever",
    props: [SIDE_BAR],
    transition: 1,
    frames: [
      { hold: 0.4, pose: hang() },
      { hold: 0.05, pose: tuckedAround(90) },
      { hold: 0.3, pose: tuckedAround(0, FRONT_SHOULDER, "tuck", true) },
      { hold: 1.8, pose: straightAround(0, FRONT_SHOULDER) },
      { hold: 0.05, pose: tuckedAround(0, FRONT_SHOULDER, "tuck", true) },
      { hold: 0.05, pose: tuckedAround(90) },
    ],
  },
  {
    id: "hf_59",
    slug: "front-lever-row",
    title: "Front Lever Row",
    props: [SIDE_BAR],
    transition: 0.9,
    frames: [
      { hold: 0.6, pose: straightAround(0, FRONT_SHOULDER) },
      { hold: 0.5, pose: frontLeverRow(54, 34) },
    ],
  },
  {
    id: "hf_61",
    slug: "tuck-back-lever",
    title: "Tuck Back Lever",
    props: [END_BAR],
    transition: 0.6,
    frames: [
      ...skinUp,
      { hold: 0.05, pose: tuckedAround(-140, along([2, BAR_Y], 84, REACH), "tuck", true) },
      { hold: 1.8, pose: tuckedAround(180, BACK_SHOULDER, "tuck", true) },
      { hold: 0.05, pose: tuckedAround(-140, along([2, BAR_Y], 84, REACH), "tuck", true) },
      ...skinDown,
    ],
  },
  {
    id: "hf_62",
    slug: "full-back-lever",
    title: "Full Back Lever",
    props: [END_BAR],
    transition: 0.6,
    frames: backLeverFrames,
  },
  {
    id: "wger_1742",
    slug: "back-lever",
    title: "Back Lever",
    props: [END_BAR],
    transition: 0.6,
    frames: backLeverFrames,
  },
  {
    id: "hf_66",
    slug: "ice-cream-maker",
    title: "Ice Cream Maker",
    props: [SIDE_BAR],
    transition: 1,
    frames: [
      { hold: 0.5, pose: pullUpTop() },
      { hold: 0.6, pose: straightAround(0, FRONT_SHOULDER) },
    ],
  },
  {
    id: "hf_140",
    slug: "burpee-pull-up",
    title: "Burpee Pull-Up",
    props: [SIDE_BAR],
    transition: 0.4,
    frames: [
      { hold: 0.2, pose: stand() },
      { hold: 0.1, pose: squatHandsDown() },
      { hold: 0.1, pose: plank() },
      { hold: 0.1, pose: plank(-48) },
      { hold: 0.1, pose: plank() },
      { hold: 0.1, pose: squatHandsDown() },
      { hold: 0.02, pose: riseToJump() },
      { hold: 0.05, pose: jumpToBar() },
      { hold: 0.1, pose: hang() },
      { hold: 0.3, pose: pullUpTop() },
      { hold: 0.1, pose: hang() },
    ],
  },
  {
    id: "hf_147",
    slug: "kip-up",
    title: "Kip-Up",
    transition: 0.4,
    frames: [
      { hold: 0.5, pose: kipLie() },
      { hold: 0, pose: kipTuck() },
      { hold: 0, pose: kipRoll([-45, -90], [-95, -31], -165) },
      { hold: 0.1, pose: kipRoll() },
      { hold: 0.02, pose: kipKick() },
      { hold: 0.02, pose: kipPush() },
      { hold: 0.08, pose: kipFlight() },
      { hold: 0.2, pose: kipLand() },
      { hold: 0.5, pose: kipStand() },
      { hold: 0.1, pose: kipLand() },
      { hold: 0.1, pose: kipSit() },
      { hold: 0.05, pose: kipLieDown() },
      { hold: 0.02, pose: kipArmsUp() },
    ],
  },
  {
    id: "hf_148",
    slug: "bar-pullover",
    title: "Bar Pullover",
    props: [END_BAR],
    transition: 0.6,
    frames: [
      { hold: 0.4, pose: hang() },
      { hold: 0.05, pose: pulloverPull() },
      { hold: 0.05, pose: pulloverHips() },
      { hold: 0.05, pose: pulloverOver() },
      { hold: 0.8, pose: frontSupport() },
      { hold: 0.05, pose: pulloverOver() },
      { hold: 0.05, pose: pulloverHips() },
      { hold: 0.05, pose: pulloverPull() },
    ],
  },
];
