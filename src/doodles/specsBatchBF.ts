import { BONES, HIP_SIDE, solvePose } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose, Prop, Sideways } from "./rig";
import { solveKeyframe3 } from "./rig3d";
import { TWO_VIEWS } from "./sideways";
import { FLOOR_PROP, along, round, supineTorso } from "./geom";
import { FLAT_ANKLE, LEG_LEN, SEAT_ANKLE } from "./limbs3";

/**
 * Batch BF: hamstring, calf, quad and leg stretches. Floor at y = 0, up is
 * negative, the side-view figure faces +x (lying face up has the head at -x).
 * Import only from ./rig, ./sideways, ./geom — never from ./specs.
 *
 * Near-duplicates (each follows its own text):
 * - wger_1393 is the seated one-leg hamstring fold already drawn as
 *   fedb_seated_floor_hamstring_stretch (batch AN); this one reaches for the ankle.
 * - wger_2761 is fedb_leg_up_hamstring_stretch with the other leg flat.
 * - wger_1240, fedb_standing_soleus_and_achilles_stretch: the bent-knee calf stretch,
 *   with and without the wall.
 * - wger_1876 is the straight-knee calf stretch of fedb_calf_stretch_hands_against_wall
 *   and wger_1239, with the hands on a chair back.
 * - fedb_standing_toe_touches and wger_1390 are the same standing forward fold, held
 *   hanging vs. reached and returned.
 */

const THIGH = BONES.thigh;
const SHIN = BONES.shin;

// ---------------------------------------------------------------- seated, heel propped (wger_2664)

const HP_PELVIS: Point = [4, -10];
const HP_STEP: Prop = { kind: "box", x: 148, y: -40, w: 60, h: 40 };

/**
 * Sitting, one leg straight with the heel on a low step so the knee hangs free;
 * both hands on the thigh just above the kneecap. `ankleX` sets how straight the
 * knee is (further = straighter), `lean` the torso's angle from the floor.
 */
function heelProp(ankleX: number, lean: number, press: number): Pose {
  const pelvis = HP_PELVIS;
  const ankle: Point = [ankleX, -48];
  const knee = solvePose({ pelvis, feet: { near: ankle }, knees: { near: { bend: -1 } } }).legs.near.mid;
  const onThigh = (dx: number): Point => [round(knee[0] + 4 + dx), round(knee[1] - 3 + press)];
  return {
    pelvis,
    chest: along(pelvis, -lean, 80),
    hands: { near: onThigh(0), far: onThigh(-4) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: ankle, far: [62, -4] },
    toes: { near: -80, far: 0 },
  };
}

// ---------------------------------------------------------------- seated, both legs straight

const SEAT_PELVIS: Point = [0, -10];

/** Both legs straight ahead, toes up; both arms reach forward and the torso hinges from the hips (`lean` from the floor), the back kept long. */
function seatedReach(lean: number, hand: Point): Pose {
  const pelvis = SEAT_PELVIS;
  return {
    pelvis,
    chest: along(pelvis, -lean, 80),
    hands: { near: hand, far: [hand[0] - 3, hand[1] + 2] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: SEAT_ANKLE, far: [SEAT_ANKLE[0] - 1, -8] },
    toes: { near: -86, far: -86 },
  };
}

// ---------------------------------------------------------------- seated, hugging the thighs

/**
 * Legs straight and together; the torso folds forward onto the thighs, the back
 * rounding, and the arms wrap the thighs from underneath. `fold` 0 sits tall with
 * the hands reaching for the thighs, 1 hugs with the chest down, 1.4 pulls the
 * upper back away from the knees.
 */
function legGrab(fold: number): Pose {
  const pelvis = SEAT_PELVIS;
  if (fold === 0) {
    return {
      pelvis,
      chest: along(pelvis, -84, 80),
      hands: { near: [82, -7], far: [78, -7] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      feet: { near: SEAT_ANKLE, far: [SEAT_ANKLE[0] - 1, -8] },
      toes: { near: -86, far: -86 },
    };
  }
  const pull = fold > 1;
  const chest: Point = pull ? [55, -67] : [64, -58];
  const head: Point = pull ? [104, -74] : [118, -64];
  return {
    pelvis,
    chest,
    head,
    spine: { bend: -1 },
    hands: { near: [138, -5], far: [134, -5] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: SEAT_ANKLE, far: [SEAT_ANKLE[0] - 1, -8] },
    toes: { near: -86, far: -86 },
  };
}

// ---------------------------------------------------------------- seated single-leg hamstring (two views)

/** The tucked (far) leg: thigh flopped out to the side, sole against the straight leg's inner thigh. */
const TUCK_KNEE_Z = HIP_SIDE + 78;
const TUCK_KNEE: Point = [round(Math.sqrt(THIGH ** 2 - 78 ** 2 - 2 ** 2)), -12];
const TUCK_FOOT_Z = 3;
const TUCK_FOOT: Point = [round(TUCK_KNEE[0] + Math.sqrt(SHIN ** 2 - (TUCK_KNEE_Z - TUCK_FOOT_Z) ** 2 - 4 ** 2)), -8];

/** One leg straight ahead, the other sole against its inner thigh; the torso hinges forward over the straight leg (`lean` from the floor). */
function oneLegFold(lean: number, reach: boolean): Keyframe {
  const pelvis = SEAT_PELVIS;
  return {
    hold: 0,
    pose: {
      pelvis,
      chest: along(pelvis, -lean, 80),
      hands: reach ? { near: [160, -18], far: [157, -20] } : { near: [60, -14], far: [58, -16] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 }, far: { at: TUCK_KNEE } },
      feet: { near: SEAT_ANKLE, far: TUCK_FOOT },
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

// ---------------------------------------------------------------- lying, straight leg drawn in

const LY_PELVIS: Point = [0, -22];

/** Lying face up, the other leg flat; one straight leg raised (`deg` from +x, -90 vertical, beyond -90 towards the head), held behind the thigh. */
function legDraw(deg: number): Pose {
  const hip = LY_PELVIS;
  const hold = along(along(hip, deg, 78), deg + 90, -9);
  return {
    ...supineTorso(hip, 79.6),
    hands: { near: hold, far: along(hold, deg, 4) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: along(hip, deg, LEG_LEN), far: FLAT_ANKLE },
    toes: { far: -80 },
  };
}

// ---------------------------------------------------------------- standing forward fold

/**
 * Feet together, legs straight (knees soft), hinging at the hips: the pelvis
 * goes back as the torso folds. `fold` 0 stands tall; 1 hangs. `hand` is where
 * the hands end (hanging or reaching).
 */
function standFold(spine: number, back: number, hands: (shoulder: Point) => Point, head: "hang" | "line" = "line"): Pose {
  const ankle: Point = [0, 0];
  const pelvis: Point = [-back, -round(Math.sqrt(LEG_LEN ** 2 - back ** 2))];
  const chest = along(pelvis, spine, 80);
  const shoulder = along(pelvis, spine, 98);
  const hand = hands(shoulder);
  return {
    pelvis,
    chest,
    ...(head === "hang" ? { head: along(chest, spine + 22, 56) } : {}),
    hands: { near: hand, far: [hand[0] - 3, hand[1]] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [ankle[0] + 2, 0], far: [ankle[0] - 2, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Arms hanging nearly straight from the shoulder, fingertips just on the floor in front of the toes. */
const hangToFloor = (shoulder: Point): Point => {
  const y = Math.min(-4, shoulder[1] + 125.4);
  const dy = y - shoulder[1];
  return [round(shoulder[0] + Math.sqrt(Math.max(0, 125.4 ** 2 - dy * dy))), round(y)];
};

/** Standing tall, arms hanging. */
const standTall = (): Pose =>
  standFold(-90, 0, (shoulder) => [round(shoulder[0] + 2), round(shoulder[1] + 124)]);

// ---------------------------------------------------------------- step-edge calf stretch

const STEP_EDGE: Prop = { kind: "box", x: 6, y: -40, w: 100, h: 40 };
const RAIL: Prop = { kind: "box", x: 126, y: -330, w: 10, h: 330 };

/** The ball of the foot, on the step's back edge (x = 6); the heel hangs off behind it. */
const STEP_BALL: Point = [6, -43];
/** How much of the foot is behind the ball (the rest rests on the step). */
const HEEL_PART = 15;

/**
 * Balls of the feet on the step's edge, legs straight, hands on the rail. `foot`
 * is the foot's angle (+ toes down), pivoting on the ball: up on the toes at +20,
 * the heel dropped clearly below the step at -45, the whole body lowering with it.
 */
function stepCalf(foot: number): Pose {
  const r = (foot * Math.PI) / 180;
  const ankle: Point = [round(STEP_BALL[0] - HEEL_PART * Math.cos(r)), round(STEP_BALL[1] - HEEL_PART * Math.sin(r))];
  const pelvis: Point = [round(ankle[0] + 6), round(ankle[1] - Math.sqrt(LEG_LEN ** 2 - 36))];
  const chest = along(pelvis, -86, 80);
  return {
    pelvis,
    chest,
    hands: { near: [116, -276], far: [114, -272] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: ankle, far: [ankle[0] - 2, ankle[1]] },
    toes: { near: foot, far: foot },
  };
}

// ---------------------------------------------------------------- staggered calf stretches

const WALL: Prop = { kind: "box", x: 156, y: -340, w: 14, h: 340 };
const CHAIR_BACK: Prop = { kind: "box", x: 148, y: -192, w: 10, h: 192 };
const CHAIR_SEAT: Prop = { kind: "box", x: 148, y: -92, w: 76, h: 92 };

/** Ankle height above the floor; the foot runs down from it to the toes on the floor. */
const ANKLE_Y = -7;
/** Foot angle that puts the toes on the floor from an ankle at ANKLE_Y: a flat foot (heel down). */
const FLAT_FOOT = round((Math.asin(-ANKLE_Y / BONES.foot) * 180) / Math.PI);
/** Short stagger for the bent-knee calf stretches: the back foot half a stride behind. */
const SOLEUS_BACK: Point = [-30, ANKLE_Y];
const SOLEUS_FRONT: Point = [14, ANKLE_Y];
const SOLEUS_PELVIS_X = -22;
/** How far the wall version stands forward of the free-standing one, so the hands reach the wall. */
const WALL_STEP_IN = 24;

/**
 * Pelvis of a bent-knee calf stretch: straight above `SOLEUS_PELVIS_X` at the
 * height that puts the back shin at `shinDeg` from the floor (heel down), so a
 * smaller angle sinks the hips straight down as the back knee travels forward.
 */
function overBackShin(shinDeg: number): Point {
  const knee = along(SOLEUS_BACK, -shinDeg, SHIN);
  const dx = SOLEUS_PELVIS_X - knee[0];
  return [SOLEUS_PELVIS_X, round(knee[1] - Math.sqrt(THIGH ** 2 - dx * dx))];
}

/** Staggered stance facing a wall, hands on it: both knees bent, back heel down; `shinDeg` is the back shin's angle from the floor. */
function wallSoleus(shinDeg: number): Pose {
  const shift = (p: Point): Point => [p[0] + WALL_STEP_IN, p[1]];
  const pelvis = shift(overBackShin(shinDeg));
  const lean = 64;
  const shoulder = along(pelvis, -lean, 98);
  const hand: Point = [150, round(Math.max(shoulder[1] - 6, -250))];
  return {
    pelvis,
    chest: along(pelvis, -lean, 80),
    hands: { near: hand, far: [hand[0] - 3, hand[1] + 6] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: shift(SOLEUS_FRONT), far: shift(SOLEUS_BACK) },
    toes: { near: FLAT_FOOT, far: FLAT_FOOT },
  };
}

/** Free-standing bent-knee calf stretch: feet hip-width, one slightly behind, both knees bent, hands resting on the front thigh. */
function freeSoleus(shinDeg: number): Pose {
  const pelvis = overBackShin(shinDeg);
  const knee = solvePose({ pelvis, feet: { near: SOLEUS_FRONT }, knees: { near: { bend: -1 } } }).legs.near.mid;
  const shoulder = along(pelvis, -66, 98);
  const spot: Point = [round(pelvis[0] + (knee[0] - pelvis[0]) * 0.75 + 6), round(pelvis[1] + (knee[1] - pelvis[1]) * 0.75 - 6)];
  const reach = Math.hypot(spot[0] - shoulder[0], spot[1] - shoulder[1]);
  const k = Math.min(1, 114 / reach);
  const onThigh: Point = [round(shoulder[0] + (spot[0] - shoulder[0]) * k), round(shoulder[1] + (spot[1] - shoulder[1]) * k)];
  return {
    pelvis,
    chest: along(pelvis, -66, 80),
    hands: { near: onThigh, far: [onThigh[0] - 5, onThigh[1] + 3] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: SOLEUS_FRONT, far: SOLEUS_BACK },
    toes: { near: FLAT_FOOT, far: FLAT_FOOT },
  };
}

/** Back leg straight, heel down, body in one line leaning on a chair back; `lean` is the body line's angle from the floor. */
function chairCalf(lean: number): Pose {
  const backAnkle: Point = [-50, ANKLE_Y];
  const pelvis = along(backAnkle, -lean, 173.8);
  const shoulder = along(pelvis, -lean, 98);
  return {
    pelvis,
    chest: along(pelvis, -lean, 80),
    hands: { near: [146, round(Math.max(shoulder[1] + 10, -200))], far: [144, round(Math.max(shoulder[1] + 14, -196))] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [54, ANKLE_Y], far: backAnkle },
    toes: { near: FLAT_FOOT, far: FLAT_FOOT },
  };
}

// ---------------------------------------------------------------- standing IT band stretch (front view)

/**
 * Front view, near on the viewer's left. Legs crossed with the far leg behind
 * and its foot out past the near foot; the far arm overhead; `t` pushes the hips
 * out to the far side (the back leg's side) and leans the chest the other way,
 * the arm arching over with it; the near arm hangs at its own side.
 */
function itBand(t: number): Pose {
  const phi = (28 * t * Math.PI) / 180;
  const px = round(14 * t);
  const feet = { near: [round(px + 10), 0] as Point, far: [round(px - 10), 0] as Point };
  // Pelvis height at which both crossed legs are a hair short of straight (the tilted hips sit at different heights).
  let py = -172;
  for (let i = 0; i < 6; i += 1) {
    const pelvis: Point = [px, py];
    const chest: Point = [round(px - 80 * Math.sin(phi)), round(py - 80 * Math.cos(phi))];
    const hips = solvePose({ pelvis, chest, feet }, { view: "front" }).legs;
    const need = (["near", "far"] as const).map((side) => {
      const dx = feet[side][0] - hips[side].root[0];
      return -hips[side].root[1] + py - Math.sqrt(Math.max(0, 173 ** 2 - dx * dx)) + 0;
    });
    py = round(Math.max(...need) + 0);
  }
  const pelvis: Point = [px, py];
  const chest: Point = [round(px - 80 * Math.sin(phi)), round(py - 80 * Math.cos(phi))];
  const arms = solvePose({ pelvis, chest, feet }, { view: "front" }).arms;
  const over = along(arms.far.root, -90 - 16 * t, 125.4);
  // The free (near) arm hangs at its own side, just outside the leaning shoulder.
  const hang = along(arms.near.root, 94, 125.6);
  return {
    pelvis,
    chest,
    hands: { near: hang, far: over },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet,
    toes: { near: 0, far: 180 },
  };
}

// ---------------------------------------------------------------- squat with an open-chest reach (two views)

const SQ_FEET: { near: Point; far: Point } = { near: [0, -8], far: [3, -8] };
const SQ_PELVIS: Point = [-42, -62];
const SQ_FEET_Z = 24;

type ReachStage = "folded" | "mid" | "up";

/**
 * Deep squat, feet flat, the far hand holding the near ankle between the knees.
 * `lean` is the torso's angle from the floor and `twist` rolls the shoulder line
 * about the spine (+ brings the far shoulder forward, down towards the ankle, and
 * the near shoulder up and back: the chest opens to the near side). `stage` sends
 * the free near arm from folded across the chest, out along the opening shoulder
 * line, to straight up at the ceiling; the eyes follow the hand.
 */
function squatReach(lean: number, twist: number, stage: ReachStage): Keyframe {
  const chest = along(SQ_PELVIS, -lean, 80);
  const sideways: Sideways = { twist, feet: { near: -SQ_FEET_Z, far: SQ_FEET_Z } };
  const base: Pose = { pelvis: SQ_PELVIS, chest, feet: SQ_FEET, toes: { near: 0, far: 0 } };
  const figure = solveKeyframe3(solvePose(base), base, sideways);
  const farShoulder = figure.arms.far.root;
  const nearShoulder = figure.arms.near.root;
  const ankle: Point = [6, -13];
  // Out along the shoulder line (far to near), half way to straight up.
  const out = [nearShoulder[0] - farShoulder[0], nearShoulder[1] - farShoulder[1] - 44, nearShoulder[2] - farShoulder[2]];
  const k = 118 / Math.hypot(out[0], out[1], out[2]);
  const hands: Record<ReachStage, { hand: Point; z: number; out: number | undefined }> = {
    folded: { hand: [round(farShoulder[0] + 3), round(farShoulder[1] + 8)], z: farShoulder[2], out: 70 },
    mid: { hand: [round(nearShoulder[0] + out[0] * k), round(nearShoulder[1] + out[1] * k)], z: round(nearShoulder[2] + out[2] * k), out: undefined },
    // Straight up, a little out to the near side so the front view sees it beside the head.
    up: { hand: [round(nearShoulder[0] - 4), round(nearShoulder[1] - 116)], z: round(nearShoulder[2] - 45), out: undefined },
  };
  const near = hands[stage];
  const look: Record<ReachStage, number> = { folded: 0, mid: -25, up: -50 };
  return {
    hold: 0,
    face: { turn: look[stage] },
    pose: {
      ...base,
      hands: { near: near.hand, far: ankle },
      elbows: { near: { bend: stage === "folded" ? -1 : 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
    },
    sideways: {
      ...sideways,
      hands: { near: round(near.z), far: -SQ_FEET_Z },
      elbows: near.out === undefined ? {} : { near: { out: near.out } },
    },
  };
}

// ---------------------------------------------------------------- specs

export const BATCH_BF_SPECS: DoodleSpec[] = [
  {
    id: "wger_2664",
    slug: "seated-knee-extension-with-overpressure",
    title: "Seated Knee Extension with Overpressure",
    props: [HP_STEP, FLOOR_PROP],
    transition: 1.2,
    frames: [
      { hold: 0.6, pose: heelProp(170, 80, 0) },
      { hold: 1.4, pose: heelProp(173.3, 70, 5) },
    ],
  },
  {
    id: "wger_1393",
    slug: "single-leg-hamstring-stretch",
    title: "Single Leg Hamstring Stretch",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { ...oneLegFold(86, false), hold: 0.5 },
      { ...oneLegFold(28, true), hold: 1.4 },
    ],
  },
  {
    id: "wger_1394",
    slug: "sit-and-reach",
    title: "Sit & Reach",
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { hold: 0.6, pose: seatedReach(84, [133, -112]) },
      { hold: 1.4, pose: seatedReach(26, [203, -28]) },
    ],
  },
  {
    id: "fedb_upper_back_leg_grab",
    slug: "upper-back-leg-grab",
    title: "Upper Back-Leg Grab",
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { hold: 0.5, pose: legGrab(0) },
      { hold: 1, pose: legGrab(1) },
      { hold: 1, pose: legGrab(1.4) },
    ],
  },
  {
    id: "wger_2761",
    slug: "straight-leg-hamstring-stretch",
    title: "Straight Leg Hamstring Stretch",
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { hold: 0.6, pose: legDraw(-90) },
      { hold: 1.4, pose: legDraw(-108) },
    ],
  },
  {
    id: "fedb_standing_toe_touches",
    slug: "standing-toe-touches",
    title: "Standing Toe Touches",
    props: [FLOOR_PROP],
    transition: 1.5,
    frames: [
      { hold: 0.5, pose: standTall() },
      // Arms hang straight from the shoulders to the floor in front of the toes; the head drops a little (it can't hang between the arms in a side view).
      { hold: 1.2, pose: standFold(25, 32, hangToFloor), face: { nod: 14 } },
      { hold: 1.2, pose: standFold(28, 34, hangToFloor), face: { nod: 14 } },
    ],
  },
  {
    id: "wger_1390",
    slug: "toe-touch",
    title: "Toe Touch",
    props: [FLOOR_PROP],
    transition: 1.2,
    frames: [
      { hold: 0.5, pose: standTall() },
      { hold: 0.8, pose: standFold(32, 28, () => [34, -20]) },
    ],
  },
  {
    id: "wger_2666",
    slug: "step-calf-stretch",
    title: "Step Calf Stretch",
    props: [STEP_EDGE, RAIL, FLOOR_PROP],
    transition: 1.4,
    frames: [
      { hold: 0.5, pose: stepCalf(20) },
      { hold: 1.4, pose: stepCalf(-45) },
    ],
  },
  {
    id: "wger_1240",
    slug: "standing-soleus-stretch",
    title: "Standing Soleus Stretch",
    props: [WALL, FLOOR_PROP],
    transition: 1.3,
    frames: [
      { hold: 0.5, pose: wallSoleus(74) },
      { hold: 1.4, pose: wallSoleus(60) },
    ],
  },
  {
    id: "fedb_standing_soleus_and_achilles_stretch",
    slug: "standing-soleus-and-achilles-stretch",
    title: "Standing Soleus And Achilles Stretch",
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { hold: 0.5, pose: freeSoleus(74) },
      { hold: 1.4, pose: freeSoleus(60) },
    ],
  },
  {
    id: "wger_1876",
    slug: "supported-calf-stretch",
    title: "Supported Calf Stretch",
    props: [CHAIR_SEAT, CHAIR_BACK, FLOOR_PROP],
    transition: 1.3,
    frames: [
      { hold: 0.5, pose: chairCalf(70) },
      { hold: 1.4, pose: chairCalf(62) },
    ],
  },
  {
    id: "wger_1875",
    slug: "standing-it-band-stretch",
    title: "Standing IT Band Stretch",
    view: "front",
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { hold: 0.6, pose: itBand(0) },
      { hold: 1.4, pose: itBand(1) },
    ],
  },
  {
    id: "wger_2528",
    slug: "squat-sky-reach-stretch",
    title: "Squat Sky Reach Stretch",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { ...squatReach(44, 15, "folded"), hold: 0.6 },
      { ...squatReach(50, 45, "mid"), hold: 0 },
      { ...squatReach(52, 72, "up"), hold: 1.4 },
      { ...squatReach(50, 45, "mid"), hold: 0 },
    ],
  },
];
