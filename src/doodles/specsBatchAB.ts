import { solvePose } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose, Side, Sideways } from "./rig";
import { lockedY3, reach3, spreadFeet } from "./specsBatchAA";
import { LOCKED, PLANK_FOOT, lockedShoulderY, pushUp, rep, straightBody } from "./specsBatchC";

/**
 * Batch AB (#174): floor push-ups and planks, each drawn in one view first
 * (side view, the figure faces +x, head at +x in a plank). Floor at y = 0, up
 * is negative. Far limbs are pale behind the body, near limbs bright on top.
 *
 * Hand width, a sideways shift of the chest and feet jumping apart all run
 * across the body, so the side view shows the press and leaves the width to a
 * second view if the judge asks for one.
 *
 * The judge asked for a second view on most of them (ADD VIEW): those specs
 * now carry `views` and keyframe `sideways` positions (hand width, the shift,
 * the feet jumping apart). hf_13 Spiderman Push-Up is drawn in two views in
 * batch AJ.
 *
 * Left out:
 *   ntc_plank_hip_dips   the hips rotate about the long axis (a torso rotation).
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
const other = (side: Side): Side => (side === "near" ? "far" : "near");

// ---------------------------------------------------------------- wide / close push-ups

const HAND_X = 62;
/** Chest nearly touching the floor. */
const PUSH_BOTTOM = -46;
const push = (y: number): Pose => pushUp(y, HAND_X);

/** Close hands sit under the chest, a little behind the shoulders (as the close-grip push-up). */
const CLOSE_X = 48;
const SIDES: Side[] = ["near", "far"];
const zOut = (side: Side): number => (side === "near" ? -1 : 1);

/** Second view (#174): wide hands about twice shoulder width (shoulders at ±22), elbows flared. */
const WIDE_Z = 44;
const FLARE = 65;
/** Close hands just inside the shoulders, elbows tucked back along the body. */
const CLOSE_Z = 14;
/** Tucked elbows still sit a little off the ribs, so they peek out past the head from the front. */
const TUCK = 22;

/** Hands at ±`z`, elbows rolled `out` degrees. */
const handsWide = (z: number, out: number): Sideways => ({
  hands: { near: -z, far: z },
  elbows: { near: { out }, far: { out } },
});

/** The same sideways positions on every keyframe. */
const withSideways = (frames: Keyframe[], sideways: Sideways): Keyframe[] => frames.map((f) => ({ ...f, sideways }));

const WIDE = handsWide(WIDE_Z, FLARE);
const WIDE_TOP = lockedY3(push, WIDE);
const CLOSE = handsWide(CLOSE_Z, TUCK);
const CLOSE_TOP = lockedY3((y) => pushUp(y, CLOSE_X), CLOSE);

/**
 * Hands at their own x and z, the shoulders as high as the planted hands allow
 * (locked arms); `lift` raises that hand to move it.
 */
function handsAt(near: [number, number], far: [number, number], out: number, lift?: Side): Keyframe {
  const sideways: Sideways = { hands: { near: -near[1], far: far[1] }, elbows: { near: { out }, far: { out } } };
  const at = (y: number): Pose => {
    const hands: Partial<Record<Side, Point>> = { near: [near[0], 0], far: [far[0] - 2, 0] };
    if (lift) hands[lift] = [(hands[lift] as Point)[0], -20];
    return { ...pushUp(y, HAND_X), hands };
  };
  const y = lockedY3(at, sideways, SIDES.filter((side) => side !== lift));
  return { hold: 0, pose: at(y), sideways };
}

/** Wide rep (elbows flared), hands walk in, close rep (elbows tucked), hands walk out. */
function closeAndWide(): Keyframe[] {
  const mid: [number, number] = [(CLOSE_X + HAND_X) / 2, (CLOSE_Z + WIDE_Z) / 2];
  const wide: [number, number] = [HAND_X, WIDE_Z];
  const close: [number, number] = [CLOSE_X, CLOSE_Z];
  return [
    ...withSideways(rep(push, WIDE_TOP, PUSH_BOTTOM, 0.3, 0.2), WIDE),
    handsAt(mid, wide, FLARE / 2, "near"),
    handsAt(close, wide, FLARE / 2),
    handsAt(close, mid, FLARE / 2, "far"),
    ...withSideways(rep((y) => pushUp(y, CLOSE_X), CLOSE_TOP, -50, 0.3, 0.2), CLOSE),
    handsAt(mid, close, FLARE / 2, "near"),
    handsAt(wide, close, FLARE / 2),
    handsAt(wide, mid, FLARE / 2, "far"),
  ];
}

/** Feet stay planted (hip width) while the chest shifts over one hand. */
const FEET_Z = 10;
/** Natural hip z (rig HIP_SIDE). */
const HIP_Z = 8;

/**
 * Chest shifted `shift` sideways over wide hands (±`handZ`), the working
 * elbow (the side it shifts to) rolled out. `y` is the shoulder height.
 */
function shifted(y: number, shift: number, handZ: number): Keyframe {
  const working: Side = shift < 0 ? "near" : "far";
  const sideways: Sideways = {
    pelvis: shift,
    hands: { near: -handZ, far: handZ },
    feet: { near: -FEET_Z, far: FEET_Z },
    ...(shift ? { elbows: { [working]: { out: 35 } } } : {}),
  };
  return { hold: 0, pose: spreadFeet(push(y), sideways), sideways };
}

/** Shoulder height where the arm away from the shift (or both, centred) is locked. */
function lockedShift(shift: number, handZ: number): number {
  let straight: Side[] = SIDES;
  if (shift < 0) straight = ["far"];
  if (shift > 0) straight = ["near"];
  const s = shifted(0, shift, handZ).sideways as Sideways;
  return lockedY3((y) => spreadFeet(push(y), s), s, straight);
}

const held = (frame: Keyframe, hold: number): Keyframe => ({ ...frame, hold });

// ---------------------------------------------------------------- side to side, typewriter, wipers

/** Side to side: wide hands; lower over one hand (that elbow bends, the other arm nearly straight). */
const S2S_Z = 56;
const S2S_SHIFT = 46;
/** A few units below the straight-arm height, so the far arm is nearly (not quite) locked. */
const NEARLY = 10;

function sideToSide(): Keyframe[] {
  const top = lockedShift(0, S2S_Z);
  const low = (shift: number): Keyframe => shifted(lockedShift(shift, S2S_Z) + NEARLY, shift, S2S_Z);
  const mid = (shift: number): Keyframe => shifted(round((top + lockedShift(shift, S2S_Z) + NEARLY) / 2), shift / 2, S2S_Z);
  return [
    held(shifted(top, 0, S2S_Z), 0.35),
    mid(-S2S_SHIFT),
    held(low(-S2S_SHIFT), 0.35),
    mid(-S2S_SHIFT),
    held(shifted(top, 0, S2S_Z), 0.35),
    mid(S2S_SHIFT),
    held(low(S2S_SHIFT), 0.35),
    mid(S2S_SHIFT),
  ];
}

/** Typewriter: very wide hands; low over one hand, slide across low, press up from the other. */
const TW_Z = 80;
const TW_SHIFT = 50;

function typewriter(): Keyframe[] {
  const top = lockedShift(0, TW_Z);
  const bottom = lockedShift(-TW_SHIFT, TW_Z);
  const mid = round((top + bottom) / 2);
  return [
    held(shifted(top, 0, TW_Z), 0.4),
    shifted(mid, -TW_SHIFT / 2, TW_Z),
    held(shifted(bottom, -TW_SHIFT, TW_Z), 0.3),
    // Stay low while the chest slides across from one hand to the other.
    held(shifted(bottom, 0, TW_Z), 0),
    held(shifted(bottom, TW_SHIFT, TW_Z), 0.3),
    shifted(mid, TW_SHIFT / 2, TW_Z),
  ];
}

/** Isometric wipers: hold low over one hand, press up through the centre, hold over the other. */
const WIPER_Z = 54;
const WIPER_SHIFT = 50;

function wipers(): Keyframe[] {
  const low = (shift: number): Keyframe => held(shifted(lockedShift(shift, WIPER_Z) + NEARLY, shift, WIPER_Z), 1.4);
  const centre = held(shifted(lockedShift(0, WIPER_Z) + 22, 0, WIPER_Z), 0.1);
  return [low(-WIPER_SHIFT), centre, low(WIPER_SHIFT), centre];
}

// ---------------------------------------------------------------- maltese push-up

/** Hands back by the hips, the shoulders leaning far ahead of them; on the toes. */
const MALTESE_HAND_X = -4;
const MALTESE_FOOT: Point = [-190, -19];

function maltese(shoulderY: number): Pose {
  const base = pushUp(shoulderY, MALTESE_HAND_X, MALTESE_FOOT);
  return { ...base, toes: { near: 80, far: 80 } };
}

/** Second view: hands far outside the shoulders, arms angled out, elbows flaring as the chest lowers. */
const MALTESE_SW = handsWide(58, 70);
const MALTESE_TOP3 = lockedY3(maltese, MALTESE_SW, SIDES, -150, -20);

// ---------------------------------------------------------------- clock push-up

/** In the air: arms locked and hanging just ahead of the shoulders, hands off the floor. */
function hop(shoulderY: number): Pose {
  const { shoulder } = straightBody(PLANK_FOOT, shoulderY);
  const hand = along(shoulder, 86, LOCKED);
  return { ...push(shoulderY), hands: { near: hand, far: [hand[0] - 2, hand[1]] } };
}

/** Second view: hands shoulder width; each rep the hands and shoulders hop a step sideways, feet planted. */
const CLOCK_HAND_Z = 24;
const CLOCK_STEP = 56;

function clockSideways(shift: number): Sideways {
  return {
    pelvis: shift,
    hands: { near: shift - CLOCK_HAND_Z, far: shift + CLOCK_HAND_Z },
    feet: { near: -FEET_Z, far: FEET_Z },
    elbows: { near: { out: 30 }, far: { out: 30 } },
  };
}

const clockAt = (hold: number, pose: Pose, shift: number): Keyframe => ({
  hold,
  pose: spreadFeet(pose, clockSideways(shift)),
  sideways: clockSideways(shift),
});

/** One rep at `from`, landing a step across at `to`. */
function clockRep(from: number, to: number): Keyframe[] {
  return [
    // Land on soft elbows and flow straight into the next lowering.
    clockAt(0, push(-100), from),
    clockAt(0, push(-74), from),
    clockAt(0.15, push(-50), from),
    // Explode until the hands leave the floor; they land a step round the circle.
    clockAt(0, push(-82), from),
    clockAt(0, push(-114), from),
    clockAt(0.2, hop(-158), (from + to) / 2),
    clockAt(0, hop(-128), to),
  ];
}

// ---------------------------------------------------------------- plank jacks, lateral plank walk

/** High plank with the feet at `foot`; the arms stay locked on the hands. */
function plank(foot: Point = PLANK_FOOT): Pose {
  return pushUp(lockedShoulderY(foot, [HAND_X, 0]), HAND_X, foot);
}

/** Second view: feet jump from together to well beyond hip width (hips at ±8). */
const JACK_IN = 4;
const JACK_OUT = 62;
const feetAt = (z: number): Sideways => ({ feet: { near: -z, far: z } });

/** Planted plank with the feet at ±`z`. */
const jackPlank = (z: number): Pose => spreadFeet(plank(), feetAt(z));

/** Both feet off the floor mid-jump at ±`z`: straight legs swing up a little, hands planted. */
function plankJackAir(z: number): Pose {
  const base = plank();
  const pelvis = base.pelvis as Point;
  const deg = (Math.atan2(PLANK_FOOT[1] - pelvis[1], PLANK_FOOT[0] - pelvis[0]) * 180) / Math.PI + 9;
  const ankle = reach3(pelvis, deg, 173.6, z - HIP_Z);
  return { ...base, feet: { near: ankle, far: ankle }, toes: { near: 70, far: 70 } };
}

/**
 * Lateral plank walk, second view: hand and foot z on each side (`hands`,
 * `feet`), the spine at `pelvis`; `lift` steps that hand and foot together.
 */
interface Walk {
  pelvis: number;
  hands: [number, number];
  feet: [number, number];
  lift?: Side;
}

function walkFrame({ pelvis, hands, feet, lift }: Walk): Keyframe {
  const sideways: Sideways = { pelvis, hands: { near: hands[0], far: hands[1] }, feet: { near: feet[0], far: feet[1] } };
  const at = (y: number): Pose => {
    const base = spreadFeet(pushUp(y, HAND_X), sideways);
    if (!lift) return base;
    const hip = base.pelvis as Point;
    const deg = (Math.atan2(PLANK_FOOT[1] - hip[1], PLANK_FOOT[0] - hip[0]) * 180) / Math.PI + 8;
    const footZ = feet[lift === "near" ? 0 : 1];
    return {
      ...base,
      hands: { ...base.hands, [lift]: [HAND_X - 2, -12] },
      feet: { ...base.feet, [lift]: reach3(hip, deg, 173.6, footZ - (pelvis + zOut(lift) * HIP_Z)) },
      toes: { [lift]: 70, [other(lift)]: 62 },
    };
  };
  const y = lockedY3(at, sideways, SIDES.filter((side) => side !== lift));
  return { hold: lift ? 0.05 : 0.3, pose: at(y), sideways };
}

/** Steps of `WALK_STEP`: near pair out, far pair follows, then back the other way. */
const WALK_STEP = 56;

function lateralWalk(): Keyframe[] {
  const s = WALK_STEP;
  const narrow = (p: number): Walk => ({ pelvis: p, hands: [p - 22, p + 22], feet: [p - 8, p + 8] });
  // Wide stance: near pair a step out, far pair still home.
  const wide: Walk = { pelvis: -s / 2, hands: [-22 - s, 22], feet: [-8 - s, 8] };
  const nearMoving: Walk = { pelvis: -s / 4, hands: [-22 - s / 2, 22], feet: [-8 - s / 2, 8], lift: "near" };
  const farMoving: Walk = { pelvis: (-3 * s) / 4, hands: [-22 - s, 22 - s / 2], feet: [-8 - s, 8 - s / 2], lift: "far" };
  return [narrow(0), nearMoving, wide, farMoving, narrow(-s), farMoving, wide, nearMoving].map(walkFrame);
}

// ---------------------------------------------------------------- straddle planche

/** Hands on the floor here; the planche leans the locked arms forward of vertical. */
const PL_HAND: Point = [0, 0];
/** Straddle: a little less lean than the full planche (shorter lever). */
const PL_LEAN = 28;
const SPINE = 98;
const LEG = 173.6;

/**
 * Chest for `pose` (pelvis pinned) at `chord` from the pelvis, turned between
 * `lo` and `hi` degrees until the near shoulder is a locked arm from `hand`.
 */
function lockChest(pose: Pose, chord: number, hand: Point, lo: number, hi: number): Point {
  const pelvis = pose.pelvis as Point;
  const at = (deg: number): Point => {
    const r = (deg * Math.PI) / 180;
    return [pelvis[0] + Math.cos(r) * chord, pelvis[1] + Math.sin(r) * chord];
  };
  const gap = (deg: number): number => dist(solvePose({ ...pose, chest: at(deg) }).arms.near.root, hand) - LOCKED;
  const rising = gap(hi) > gap(lo);
  let a = lo;
  let b = hi;
  for (let i = 0; i < 50; i += 1) {
    const mid = (a + b) / 2;
    if (gap(mid) > 0 === rising) b = mid;
    else a = mid;
  }
  const [x, y] = at((a + b) / 2);
  return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
}

const PL_HANDS = { near: PL_HAND, far: [PL_HAND[0] + 2, 0] as Point };

/** Tuck planche: feet off the floor, knees pulled in under the chest, hips level with the shoulders. */
function tuckPlanche(): Pose {
  const pelvis: Point = [-40, -108];
  const knee = along(pelvis, 50, 88);
  const base: Pose = {
    pelvis,
    spine: { bend: -1 },
    hands: PL_HANDS,
    knees: { near: { at: knee }, far: { at: knee } },
    feet: { near: along(knee, 208, 86), far: along(knee, 208, 86) },
    toes: { near: 200, far: 200 },
  };
  const chest = lockChest(base, 77, PL_HAND, -40, 30);
  return { ...base, chest, head: along(chest, 25, 56) };
}


function planchePelvis(): Point {
  const shoulder = along(PL_HAND, -90 + PL_LEAN, LOCKED);
  return along(shoulder, 180, SPINE);
}

/** Second view: knees opening out on the way, legs in a wide V (feet well past the shoulders) in the hold. */
const EXT_KNEE_Z = 32;
const EXT_FOOT_Z = 46;
const STRADDLE_Z = 78;
const EXTENDING: Sideways = { knees: { near: { at: -EXT_KNEE_Z }, far: { at: EXT_KNEE_Z } }, feet: { near: -EXT_FOOT_Z, far: EXT_FOOT_Z } };
const STRADDLE: Sideways = { feet: { near: -STRADDLE_Z, far: STRADDLE_Z } };

/** Legs opening out behind: thighs angled down and back, knees still bent. */
function extending(): Pose {
  const pelvis = planchePelvis();
  const knee = reach3(pelvis, 150, 88, EXT_KNEE_Z - HIP_Z);
  const base: Pose = {
    pelvis,
    hands: PL_HANDS,
    knees: { near: { at: knee }, far: { at: knee } },
    feet: { near: reach3(knee, 195, 86, EXT_FOOT_Z - EXT_KNEE_Z), far: reach3(knee, 195, 86, EXT_FOOT_Z - EXT_KNEE_Z) },
    toes: { near: 195, far: 195 },
  };
  const chest = lockChest(base, 80, PL_HAND, -20, 20);
  return { ...base, chest, head: along(chest, 30, 56) };
}

/** Straddle planche hold: straight body level with the shoulders, legs long behind. */
function straddlePlanche(): Pose {
  const pelvis = planchePelvis();
  const foot = reach3(pelvis, 180, LEG, STRADDLE_Z - HIP_Z);
  const base: Pose = {
    pelvis,
    hands: PL_HANDS,
    feet: { near: foot, far: foot },
    toes: { near: 180, far: 180 },
  };
  const chest = lockChest(base, 80, PL_HAND, -20, 20);
  // Eyes to the floor a little ahead of the hands.
  return { ...base, chest, head: along(along(chest, 0, 20), 30, 36) };
}

// ---------------------------------------------------------------- specs

const wideRep = (): Keyframe[] => withSideways(rep(push, WIDE_TOP, PUSH_BOTTOM, 0.4, 0.3), WIDE);
const TWO_VIEWS = ["side", "front"] as const;

export const BATCH_AB_SPECS: DoodleSpec[] = [
  {
    id: "hf_3",
    slug: "wide-push-up",
    title: "Wide Push-Up",
    views: TWO_VIEWS,
    transition: 0.5,
    frames: wideRep(),
  },
  {
    id: "fedb_push_up_wide",
    slug: "push-up-wide",
    title: "Push-Up Wide",
    views: TWO_VIEWS,
    transition: 0.5,
    frames: wideRep(),
  },
  {
    id: "fedb_pushups_close_and_wide_hand_positions",
    slug: "pushups-close-and-wide-hand-positions",
    title: "Pushups (Close and Wide Hand Positions)",
    views: TWO_VIEWS,
    transition: 0.4,
    frames: closeAndWide(),
  },
  {
    id: "hf_16",
    slug: "maltese-push-up",
    title: "Maltese Push-Up",
    views: TWO_VIEWS,
    transition: 0.6,
    frames: withSideways(rep(maltese, MALTESE_TOP3, -40, 0.4, 0.3), MALTESE_SW),
  },
  {
    id: "fedb_clock_push_up",
    slug: "clock-push-up",
    title: "Clock Push-Up",
    views: TWO_VIEWS,
    transition: 0.35,
    frames: [...clockRep(-CLOCK_STEP / 2, CLOCK_STEP / 2), ...clockRep(CLOCK_STEP / 2, -CLOCK_STEP / 2)],
  },
  {
    id: "wger_583",
    slug: "side-to-side-push-up",
    title: "Side to Side Push Ups",
    views: TWO_VIEWS,
    transition: 0.55,
    frames: sideToSide(),
  },
  {
    id: "hf_7",
    slug: "typewriter-push-up",
    title: "Typewriter Push-Up",
    views: TWO_VIEWS,
    transition: 0.6,
    frames: typewriter(),
  },
  {
    id: "ntc_plank_jacks",
    slug: "plank-jacks",
    title: "Plank jacks",
    views: TWO_VIEWS,
    transition: 0.2,
    frames: [
      { hold: 0.15, pose: jackPlank(JACK_IN), sideways: feetAt(JACK_IN) },
      { hold: 0, pose: plankJackAir((JACK_IN + JACK_OUT) / 2), sideways: feetAt((JACK_IN + JACK_OUT) / 2) },
      { hold: 0.15, pose: jackPlank(JACK_OUT), sideways: feetAt(JACK_OUT) },
      { hold: 0, pose: plankJackAir((JACK_IN + JACK_OUT) / 2), sideways: feetAt((JACK_IN + JACK_OUT) / 2) },
    ],
  },
  {
    id: "ntc_lateral_plank_walk",
    slug: "lateral-plank-walk",
    title: "Lateral plank walk",
    views: TWO_VIEWS,
    transition: 0.35,
    frames: lateralWalk(),
  },
  {
    id: "hf_33",
    slug: "straddle-planche",
    title: "Straddle Planche",
    views: TWO_VIEWS,
    transition: 0.7,
    frames: [
      { hold: 0.6, pose: tuckPlanche() },
      { hold: 0, pose: extending(), sideways: EXTENDING },
      { hold: 1.8, pose: straddlePlanche(), sideways: STRADDLE },
      { hold: 0, pose: extending(), sideways: EXTENDING },
    ],
  },
  {
    id: "fedb_isometric_wipers",
    slug: "isometric-wipers",
    title: "Isometric Wipers",
    views: TWO_VIEWS,
    transition: 0.6,
    frames: wipers(),
  },
];
