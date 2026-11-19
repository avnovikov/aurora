import { BONES, SHOULDER_SIDE, solvePose, zOut } from "./rig";
import type { AuthoredPose, DoodleSpec, Keyframe, Point, Pose, Prop, Side, Sideways } from "./rig";
import { SIDE_LYING_FLOOR, SL_FOOT_BOTTOM, SL_HIP_TOP, SL_KNEE_BOTTOM, SL_SHOULDER_BOTTOM, SL_SHOULDER_TOP, sideLying } from "./specsWarmup";
import { add3, dot3, norm3, scale3, solveKeyframe3, sub3, type Point3 } from "./rig3d";
import { TOP_VIEWS } from "./sideways";
import { FLOOR_PROP, along, angle, round, supineTorso } from "./geom";

/**
 * Batch BH (#216): spine, back and core mobility. Floor at y = 0, up is negative,
 * the side-view figure faces +x. Never import ./specs (circular).
 */

const ARM = BONES.upperArm + BONES.forearm + BONES.hand - 0.03;

// ---------------------------------------------------------------- standing side bends (front view)

/** Hip to ankle with the knees a hair short of locked. */
const LEG_REACH = BONES.thigh + BONES.shin - 0.03;

/**
 * A front-view spine bending sideways `lean` degrees to the near side at the waist: the lower half
 * stays upright (so the hips stay level) and the upper half leans. The chest is pinned at the chord
 * of that bend, with the spine bowing so the waist stays over the pelvis.
 */
function leaned(lean: number, half: number): { pelvis: Point; chest: Point; head: Point; spine: { bend: 1 | -1 } } {
  // Hips sit 8 either side of the pelvis: the highest pelvis at which both legs just reach their feet.
  const pelvis: Point = [0, -round(Math.sqrt(LEG_REACH ** 2 - (half - 8) ** 2))];
  const bendHalf = lean / 2;
  const chest = along(pelvis, -90 - bendHalf, 80 * Math.cos((bendHalf * Math.PI) / 180));
  const waistX = (bend: 1 | -1): number => solvePose({ pelvis, chest, spine: { bend } }, { view: "front" }).waist[0];
  const bend: 1 | -1 = Math.abs(waistX(1)) <= Math.abs(waistX(-1)) ? 1 : -1;
  const solved = solvePose({ pelvis, chest, spine: { bend } }, { view: "front" });
  const up = angle(solved.waist, solved.chest);
  return { pelvis, chest, head: along(solved.chest, up, 20 + 36), spine: { bend } };
}

/** Shoulder (near = viewer's left) of a front-view figure with this spine. */
function frontShoulder(pose: Pose, side: "near" | "far"): Point {
  return solvePose(pose, { view: "front" }).arms[side].root;
}

const frontFeet = (half: number): Pick<Pose, "feet" | "toes"> => ({
  feet: { near: [-half, 0], far: [half, 0] },
  toes: { near: 180, far: 0 },
});

/** Overhead side bend: far arm straight up and over towards the near side, near hand on the hip. */
function overheadBend(lean: number): Pose {
  const { pelvis, chest, spine } = leaned(lean, 12);
  const hand = along(frontShoulder({ pelvis, chest, spine }, "far"), -90 - lean * 0.8, ARM);
  return {
    pelvis,
    chest,
    spine,
    hands: { near: [-34, pelvis[1] - 8], far: hand },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    ...frontFeet(12),
  };
}

/** Standing lateral stretch: feet wider than the hips, the near hand on the hip, the far hand behind the head. */
function lateralStretch(lean: number): Pose {
  const { pelvis, chest, head, spine } = leaned(lean, 26);
  return {
    pelvis,
    chest,
    spine,
    hands: { near: [-34, pelvis[1] - 8], far: along(head, -lean, 30) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    ...frontFeet(26),
  };
}

/** Both hands lightly behind the head; the bend draws the near elbow down towards the hip as the far elbow lifts. */
function elbowToHip(lean: number): Pose {
  const { pelvis, chest, head, spine } = leaned(lean, 22);
  const a = -90 - lean;
  return {
    pelvis,
    chest,
    spine,
    hands: { near: along(head, a - 90, 30), far: along(head, a + 90, 30) },
    elbows: { near: { bend: -1 }, far: { bend: 1 } },
    ...frontFeet(22),
  };
}

// ---------------------------------------------------------------- standing, side view

/** Hands resting on the hips: the near elbow out behind, the far elbow hidden. */
function handsOnHips(pelvis: Point): Pick<Pose, "hands" | "elbows"> {
  return {
    hands: { near: [round(pelvis[0] + 14), round(pelvis[1] - 6)], far: [round(pelvis[0] + 10), round(pelvis[1] - 8)] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

/**
 * Standing pelvic tilt, soft knees, hands on the hips. The rig has no pelvis angle, so the tilt shows
 * as the pelvis rocking: tipped forward the seat sticks back and the low back arches (`tuck` 0); tucked
 * the tailbone goes forward and under and the low back flattens (`tuck` 1).
 */
function pelvicTilt(tuck: 0 | 1): Pose {
  const pelvis: Point = tuck ? [10, -165] : [-8, -167];
  return {
    pelvis,
    chest: tuck ? [0, -244] : [-1, -243],
    spine: { bend: tuck ? -1 : 1 },
    ...handsOnHips(pelvis),
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [2, 0], far: [-4, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Stomach vacuum: standing tall, hands on the hips; breathed out the waist is drawn in and back (`vacuum` 1). */
function stomachVacuum(vacuum: 0 | 1): Pose {
  const pelvis: Point = [0, -173.9];
  return {
    pelvis,
    chest: vacuum ? [-1, -173.9 - 76.4] : [1, -173.9 - 77.4],
    spine: { bend: vacuum ? -1 : 1 },
    ...handsOnHips(pelvis),
    feet: { near: [2, 0], far: [-2, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Clasped hands reaching forward at shoulder height; `round` 1 rounds the upper back, the shoulder blades spreading and the head dropping between the arms. */
function upperBackReach(round1: 0 | 1): Pose {
  const pelvis: Point = round1 ? [5, -173.9] : [0, -173.9];
  const chest: Point = round1 ? [-6, -249.5] : [0, -253.9];
  const base: Pose = { pelvis, chest, spine: { bend: -1 } };
  const shoulder = solvePose(base).arms.near.root;
  const hand: Point = [round(shoulder[0] + ARM), round(shoulder[1] + (round1 ? 3 : 0))];
  return {
    ...base,
    head: round1 ? [5, -299] : [4, -308],
    hands: { near: hand, far: [hand[0], hand[1]] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [round(pelvis[0] + 2), 0], far: [round(pelvis[0] - 2), 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- sphinx (face down on the forearms)

/** Elbows `ahead` in front of the shoulders: 0 is the full sphinx, more settles the chest lower. */
function sphinx(ahead: number): Pose {
  const pelvis: Point = [-20, -12];
  const rise = Math.sqrt(BONES.upperArm ** 2 - ahead ** 2);
  const shoulderY = -4 - rise;
  const shoulderX = pelvis[0] + Math.sqrt(98 ** 2 - (shoulderY - pelvis[1]) ** 2);
  const spineDeg = (Math.atan2(shoulderY - pelvis[1], shoulderX - pelvis[0]) * 180) / Math.PI;
  const elbowX = round(shoulderX + ahead);
  return {
    pelvis,
    chest: along(pelvis, spineDeg, 80),
    spine: { bend: 1 },
    elbows: { near: { at: [elbowX, -4] }, far: { at: [elbowX, -4] } },
    hands: { near: [round(elbowX + 66), -4], far: [round(elbowX + 66), -4] },
    feet: { near: [-194, -6], far: [-194, -6] },
    toes: { near: 180, far: 180 },
  };
}

// ---------------------------------------------------------------- standing rotations (side + top)

const ROT_PELVIS: Point = [0, -173.9];
const ROT_CHEST: Point = [0, -253.9];
const ROT_FEET_Z = 14;
const ROT_SHOULDER_Y = -271.9;

/** Shoulders of the upright figure: 22 either side of the spine, `ROT_SHOULDER_Y` high. */
const rotShoulder = (side: Side): Point3 => [0, ROT_SHOULDER_Y, zOut(side) * SHOULDER_SIDE];

const unit3 = (a: Point3): Point3 => scale3(a, 1 / (norm3(a) || 1));

/** Elbow of an arm from `root` to `end` (forearm 66 long), on the `hint` side of the line between them. */
function elbowToward(root: Point3, end: Point3, hint: Point3): Point3 {
  const [l1, l2] = [BONES.upperArm, BONES.forearm + BONES.hand];
  const full = sub3(end, root);
  const d = Math.min(norm3(full), l1 + l2 - 0.3);
  const u = unit3(full);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const centre = add3(root, scale3(u, a));
  const toHint = sub3(hint, centre);
  const n = sub3(toHint, scale3(u, dot3(toHint, u)));
  return add3(centre, scale3(unit3(n), h));
}

/**
 * A standing rotation, seen from the side and from above: the hips and feet stay square while the
 * arms held in front of the chest swing across the front to one side, `turn` degrees either way
 * (+ to the far side). Straight arms reach out from the shoulders; bent arms keep the hands together
 * `HANDS_OUT` in front of the chest, the elbows out.
 */
const HANDS_OUT = 70;

function rotation(turn: number, hold: number, arms: "straight" | "bent"): Keyframe {
  const t = (turn * Math.PI) / 180;
  const pose: AuthoredPose = {
    pelvis: ROT_PELVIS,
    chest: ROT_CHEST,
    feet: { near: [0, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
    spreadFeet: true,
  };
  const sideways: Sideways = { feet: { near: -ROT_FEET_Z, far: ROT_FEET_Z } };
  const hands: Partial<Record<Side, Point>> = {};
  const elbows: Partial<Record<Side, { at: Point }>> = {};
  const swHands: Partial<Record<Side, number>> = {};
  const swElbows: Partial<Record<Side, { at: number }>> = {};
  for (const side of ["near", "far"] as Side[]) {
    const root = rotShoulder(side);
    let elbow: Point3;
    let hand: Point3;
    if (arms === "straight") {
      const dir: Point3 = [Math.cos(t), 0, Math.sin(t)];
      elbow = add3(root, scale3(dir, BONES.upperArm));
      hand = add3(root, scale3(dir, ARM));
    } else {
      // Hands together on the arc of radius HANDS_OUT round the spine, a hand's width below the shoulders.
      hand = [HANDS_OUT * Math.cos(t), ROT_SHOULDER_Y + 16 + zOut(side) * 2, HANDS_OUT * Math.sin(t) + zOut(side) * 4];
      elbow = elbowToward(root, hand, [root[0] + 10, root[1] + 30, root[2] + zOut(side) * 90]);
    }
    hands[side] = [round(hand[0]), round(hand[1])];
    elbows[side] = { at: [round(elbow[0]), round(elbow[1])] };
    swHands[side] = round(hand[2]);
    swElbows[side] = { at: round(elbow[2]) };
  }
  Object.assign(pose, { hands, elbows });
  Object.assign(sideways, { hands: swHands, elbows: swElbows });
  return { pose, hold, sideways };
}

/**
 * Standing torso twist with the arms bent in front of the chest: the hips and feet stay square while
 * the shoulder line rolls `twist` degrees about the spine (+ brings the far shoulder forward, so the
 * chest turns to the near side). The hands stay together `HANDS_OUT` in front of the turned chest, the
 * elbows out to the sides of the turned shoulders, and the head turns with the chest.
 */
function torsoTwist(twist: number, hold: number): Keyframe {
  const t = (twist * Math.PI) / 180;
  // The chest's sideways (near to far) and front directions after the roll.
  const across: Point3 = [Math.sin(t), 0, Math.cos(t)];
  const front: Point3 = [Math.cos(t), 0, -Math.sin(t)];
  const centre: Point3 = [0, ROT_SHOULDER_Y, 0];
  const hands: Partial<Record<Side, Point>> = {};
  const elbows: Partial<Record<Side, { at: Point }>> = {};
  const swHands: Partial<Record<Side, number>> = {};
  const swElbows: Partial<Record<Side, { at: number }>> = {};
  for (const side of ["near", "far"] as Side[]) {
    const root = add3(centre, scale3(across, zOut(side) * SHOULDER_SIDE));
    const hand = add3(add3(centre, scale3(front, HANDS_OUT)), add3([0, 16 + zOut(side) * 2, 0], scale3(across, zOut(side) * 4)));
    const elbow = elbowToward(root, hand, add3(add3(root, [0, 30, 0]), add3(scale3(across, zOut(side) * 90), scale3(front, 10))));
    hands[side] = [round(hand[0]), round(hand[1])];
    elbows[side] = { at: [round(elbow[0]), round(elbow[1])] };
    swHands[side] = round(hand[2]);
    swElbows[side] = { at: round(elbow[2]) };
  }
  return {
    hold,
    face: { turn: 0 },
    pose: {
      pelvis: ROT_PELVIS,
      chest: ROT_CHEST,
      hands,
      elbows,
      feet: { near: [0, 0], far: [0, 0] },
      toes: { near: 0, far: 0 },
      spreadFeet: true,
    },
    sideways: { twist, feet: { near: -ROT_FEET_Z, far: ROT_FEET_Z }, hands: swHands, elbows: swElbows },
  };
}

// ---------------------------------------------------------------- supine twist (side + top)

const ST_PELVIS: Point = [0, -22];

/** Lying face up (head at -x), arms straight out to the sides on the floor. Returns the pose and the arms' sideways. */
function supineArmsOut(): { pose: AuthoredPose; sideways: Sideways } {
  const torso = supineTorso(ST_PELVIS, 79.6);
  const base: Pose = { pelvis: torso.pelvis, chest: torso.chest, head: torso.head, spine: torso.spine };
  const solved = solvePose(base);
  const hands: Partial<Record<Side, Point>> = {};
  const elbows: Partial<Record<Side, { at: Point }>> = {};
  const swHands: Partial<Record<Side, number>> = {};
  const swElbows: Partial<Record<Side, { at: number }>> = {};
  for (const side of ["near", "far"] as Side[]) {
    const root = solved.arms[side].root;
    const rz = zOut(side) * SHOULDER_SIDE;
    const dy = -4 - root[1];
    const run = Math.sqrt(ARM ** 2 - dy ** 2);
    const k = BONES.upperArm / ARM;
    hands[side] = [round(root[0]), -4];
    elbows[side] = { at: [round(root[0]), round(root[1] + dy * k)] };
    swHands[side] = round(rz + zOut(side) * run);
    swElbows[side] = { at: round(rz + zOut(side) * run * k) };
  }
  return {
    pose: { ...base, hands, elbows },
    sideways: { hands: swHands, elbows: swElbows },
  };
}

/** `fall` 0: knees up, feet flat; 1: both knees dropped to the near side and resting on the floor. */
function supineTwist(fall: 0 | 1, hold: number): Keyframe {
  const { pose, sideways } = supineArmsOut();
  if (!fall) {
    return {
      hold,
      pose: { ...pose, feet: { near: [84, -5], far: [84, -5] }, knees: { near: { bend: -1 }, far: { bend: -1 } }, toes: { near: 0, far: 0 } },
      sideways: { ...sideways, feet: { near: -12, far: 12 } },
    };
  }
  // Pelvis rolled to the near side under square shoulders; the legs are placed from the hips as the 3D solve puts them.
  const roll = -16;
  const swBase: Sideways = { ...sideways, pelvis: roll, chest: 0, pivot: "chest" };
  const figure = solveKeyframe3(solvePose(pose as Pose), pose as Pose, swBase);
  const thighDir: Record<Side, Point3> = { near: unit3([0.5, 0.16, -0.85]), far: unit3([0.5, -0.1, -0.85]) };
  const shinDir: Record<Side, Point3> = { near: unit3([-0.7, 0, -0.7]), far: unit3([-0.7, 0, -0.7]) };
  const knees: Partial<Record<Side, { at: Point }>> = {};
  const feet: Partial<Record<Side, Point>> = {};
  const swKnees: Partial<Record<Side, { at: number }>> = {};
  const swFeet: Partial<Record<Side, number>> = {};
  for (const side of ["near", "far"] as Side[]) {
    const knee = add3(figure.legs[side].root, scale3(thighDir[side], BONES.thigh));
    const foot = add3(knee, scale3(shinDir[side], BONES.shin));
    knees[side] = { at: [round(knee[0]), round(knee[1])] };
    feet[side] = [round(foot[0]), round(foot[1])];
    swKnees[side] = { at: round(knee[2]) };
    swFeet[side] = round(foot[2]);
  }
  return {
    hold,
    pose: { ...pose, knees, feet, toes: { near: 175, far: 175 } },
    sideways: { ...swBase, knees: swKnees, feet: swFeet },
  };
}

// ---------------------------------------------------------------- thread the needle (side + top)

const TN_PELVIS: Point = [-92, -92];

/**
 * All fours, knees under the hips. `open` 0: the near arm threaded flat under the chest to the far side,
 * the chest lowered towards the floor; `open` 1: the chest up and turned open, the near arm straight
 * up to the ceiling over the shoulder, a little towards the near side. The far hand stays planted.
 */
function threadNeedle(open: 0 | 1, hold: number): Keyframe {
  const chest = along(TN_PELVIS, open ? -20.3 : 20, 80);
  const base: Pose = { pelvis: TN_PELVIS, chest, spine: { bend: -1 } };
  const figure = solveKeyframe3(solvePose(base), base, { pelvis: 0 });
  const near = figure.arms.near.root;
  const far = figure.arms.far.root;
  // Near hand: threaded across the floor under the chest, or straight up.
  const nearHand: Point3 = open
    ? add3(near, scale3(unit3([-0.1, -0.93, -0.36]), ARM))
    : [round(near[0] + 22), -6, round(near[2] + Math.sqrt(Math.max(0, ARM ** 2 - 22 ** 2 - (near[1] + 6) ** 2)) - 6)];
  const farHand: Point3 = [round(far[0] + 6), -2, far[2]];
  const nearElbow = elbowToward(near, nearHand, open ? [near[0] - 40, near[1] - 20, near[2] - 70] : [near[0] + 10, near[1] + 40, near[2] + 30]);
  const farElbow = elbowToward(far, farHand, [far[0] - 30, far[1] + 10, far[2] + 60]);
  const flat = (p: Point3): Point => [round(p[0]), round(p[1])];
  return {
    hold,
    pose: {
      ...base,
      hands: { near: flat(nearHand), far: flat(farHand) },
      elbows: { near: { at: flat(nearElbow) }, far: { at: flat(farElbow) } },
      knees: { near: { at: [TN_PELVIS[0], -4] }, far: { at: [TN_PELVIS[0], -4] } },
      feet: { near: [TN_PELVIS[0] - 86, -4], far: [TN_PELVIS[0] - 86, -4] },
      toes: { near: 180, far: 180 },
    },
    sideways: {
      pelvis: 0,
      hands: { near: round(nearHand[2]), far: round(farHand[2]) },
      elbows: { near: { at: round(nearElbow[2]) }, far: { at: round(farElbow[2]) } },
      knees: { near: { at: -8 }, far: { at: 8 } },
      feet: { near: -8, far: 8 },
    },
  };
}

// ---------------------------------------------------------------- side-lying floor stretch (front view, head left)

/**
 * Lying on the near side, the near knee bent in front and the top leg straight behind it; both arms
 * reach overhead, the head resting between them on the bottom arm (the near hand lies along the
 * floor under the head, the top arm reaches `reach` degrees from its shoulder, 180 level, more is up).
 */
function sideLyingReach(reach: number): Pose {
  return sideLying({
    head: [-130, -34],
    hands: { near: along(SL_SHOULDER_BOTTOM, 181, ARM), far: along(SL_SHOULDER_TOP, reach, ARM) },
    elbows: { near: { bend: 1 }, far: { bend: -1 } },
    knees: { near: { at: SL_KNEE_BOTTOM } },
    feet: { near: SL_FOOT_BOTTOM, far: along(SL_HIP_TOP, 5, LEG_REACH) },
    toes: { near: 0, far: 5 },
  });
}

// ---------------------------------------------------------------- side-lying open book (side + top)

const OB_PELVIS: Point = [0, -30];

/**
 * Lying on the near side, belly towards the camera (z < 0): knees bent 90 degrees and stacked in front,
 * the bottom arm straight out in front on the floor, the top arm sweeping in the plane across the
 * chest (`sweep` degrees: 0 forward over the bottom arm, 90 straight up, 188 back and down to the
 * floor behind).
 */
function openBook(sweep: number, hold: number): Keyframe {
  const base: Pose = { pelvis: OB_PELVIS, chest: [-80, -30], head: [-134, -28] };
  const sw: Sideways = { pelvis: 0 };
  const figure = solveKeyframe3(solvePose(base), base, sw);
  const phi = (sweep * Math.PI) / 180;
  const armDir: Record<Side, Point3> = {
    near: unit3([0.05, 0.1, -1]),
    far: unit3([0.05, -Math.sin(phi), -Math.cos(phi)]),
  };
  const thigh = unit3([0.04, 0.16, -1]);
  const shin = unit3([1, 0.02, 0.06]);
  const pins = {
    hands: {} as Partial<Record<Side, Point>>,
    elbows: {} as Partial<Record<Side, { at: Point }>>,
    knees: {} as Partial<Record<Side, { at: Point }>>,
    feet: {} as Partial<Record<Side, Point>>,
  };
  const z = {
    hands: {} as Partial<Record<Side, number>>,
    elbows: {} as Partial<Record<Side, { at: number }>>,
    knees: {} as Partial<Record<Side, { at: number }>>,
    feet: {} as Partial<Record<Side, number>>,
  };
  for (const side of ["near", "far"] as Side[]) {
    const elbow = add3(figure.arms[side].root, scale3(armDir[side], BONES.upperArm));
    const hand = add3(figure.arms[side].root, scale3(armDir[side], ARM));
    const knee = add3(figure.legs[side].root, scale3(side === "near" ? thigh : unit3([0.04, 0.02, -1]), BONES.thigh));
    const foot = add3(knee, scale3(shin, BONES.shin));
    pins.hands[side] = [round(hand[0]), round(hand[1])];
    pins.elbows[side] = { at: [round(elbow[0]), round(elbow[1])] };
    pins.knees[side] = { at: [round(knee[0]), round(knee[1])] };
    pins.feet[side] = [round(foot[0]), round(foot[1])];
    z.hands[side] = round(hand[2]);
    z.elbows[side] = { at: round(elbow[2]) };
    z.knees[side] = { at: round(knee[2]) };
    z.feet[side] = round(foot[2]);
  }
  return {
    hold,
    pose: { ...base, ...pins, toes: { near: 0, far: 0 } },
    sideways: { pelvis: 0, hands: z.hands, elbows: z.elbows, knees: z.knees, feet: z.feet },
  };
}

// ---------------------------------------------------------------- seated spinal stretch (side + top)

const SS_PELVIS: Point = [0, -90];
const SS_CHAIR: Prop = { kind: "box", x: -60, y: -80, w: 110, h: 80, frontHalf: 34 };

/**
 * Sitting on a chair, feet flat, fingers laced behind the head, elbows wide. `lean` degrees of forward
 * fold from upright, `twist` the shoulder line's roll about the spine (- turns the chest to the far side,
 * bringing the near shoulder forward). Folded and turned, the near elbow drops towards the floor inside
 * the far knee while the far elbow opens up and back. The hands stay behind the (turned) head.
 */
const cross3 = (a: Point3, b: Point3): Point3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function spinalStretch(lean: number, twist: number, hold: number, shift = 0): Keyframe {
  const a = (lean * Math.PI) / 180;
  const chest: Point = [round(SS_PELVIS[0] + 80 * Math.sin(a)), round(SS_PELVIS[1] - 80 * Math.cos(a))];
  const head: Point = [round(chest[0] + 56 * Math.sin(a)), round(chest[1] - 56 * Math.cos(a))];
  const base: Pose = { pelvis: SS_PELVIS, chest, head };
  const turn: Sideways = shift ? { pelvis: 0, chest: shift, twist } : { pelvis: 0, twist };
  const figure = solveKeyframe3(solvePose(base), base, turn);
  const root = (side: Side): Point3 => figure.arms[side].root;
  // The turned chest's frame: across (near to far), up the spine, front.
  const across = unit3(sub3(root("far"), root("near")));
  const up = unit3(sub3(figure.chest, figure.waist));
  const front = cross3(across, up);
  const behind = add3(figure.head, add3(scale3(front, -22), scale3(up, -4)));
  const hands: Record<Side, Point3> = {
    near: add3(behind, scale3(across, -6)),
    far: add3(behind, scale3(across, 6)),
  };
  // Elbows wide, out along the turned shoulder line: folded and turned, that line tips, so the near
  // elbow points down at the floor and the far one up.
  const hint = (side: Side): Point3 => add3(root(side), add3(scale3(across, zOut(side) * 90), scale3(front, 10)));
  const elbow: Record<Side, Point3> = {
    near: elbowToward(root("near"), hands.near, hint("near")),
    far: elbowToward(root("far"), hands.far, hint("far")),
  };
  const flat = (p: Point3): Point => [round(p[0]), round(p[1])];
  return {
    hold,
    face: { nod: 8 },
    pose: {
      ...base,
      hands: { near: flat(hands.near), far: flat(hands.far) },
      elbows: { near: { at: flat(elbow.near) }, far: { at: flat(elbow.far) } },
      knees: { near: { at: [87, -90] }, far: { at: [87, -90] } },
      feet: { near: [88, -4], far: [88, -4] },
      toes: { near: 0, far: 0 },
    },
    sideways: {
      ...turn,
      hands: { near: round(hands.near[2]), far: round(hands.far[2]) },
      elbows: { near: { at: round(elbow.near[2]) }, far: { at: round(elbow.far[2]) } },
      knees: { near: { at: -22 }, far: { at: 22 } },
      feet: { near: -22, far: 22 },
    },
  };
}

const kf = (pose: Pose, hold: number): Keyframe => ({ pose, hold });

export const BATCH_BH_SPECS: DoodleSpec[] = [
  {
    id: "fedb_standing_pelvic_tilt",
    slug: "standing-pelvic-tilt",
    title: "Standing Pelvic Tilt",
    props: [FLOOR_PROP],
    transition: 1.2,
    frames: [kf(pelvicTilt(0), 0.5), kf(pelvicTilt(1), 1.4)],
  },
  {
    id: "fedb_stomach_vacuum",
    slug: "stomach-vacuum",
    title: "Stomach Vacuum",
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [kf(stomachVacuum(0), 0.6), kf(stomachVacuum(1), 1.6)],
  },
  {
    id: "fedb_upper_back_stretch",
    slug: "upper-back-stretch",
    title: "Upper Back Stretch",
    props: [FLOOR_PROP],
    transition: 1.2,
    frames: [kf(upperBackReach(0), 0.5), kf(upperBackReach(1), 1.4)],
  },
  {
    id: "wger_1810",
    slug: "sphinx",
    title: "Sphinx",
    props: [FLOOR_PROP],
    transition: 1.4,
    frames: [kf(sphinx(30), 0.5), kf(sphinx(0), 1.5)],
  },
  {
    id: "wger_1451",
    slug: "torso-rotation-stretch",
    title: "Torso rotation stretch",
    views: TOP_VIEWS,
    transition: 1.1,
    frames: [rotation(-65, 0.5, "straight"), rotation(0, 0, "straight"), rotation(65, 0.5, "straight"), rotation(0, 0, "straight")],
  },
  {
    id: "wger_1377",
    slug: "torso-twist",
    title: "Torso Twist",
    views: TOP_VIEWS,
    transition: 0.8,
    frames: [torsoTwist(70, 0.3), torsoTwist(0, 0), torsoTwist(-70, 0.3), torsoTwist(0, 0)],
  },
  {
    id: "ntc_supine_twist",
    slug: "supine-spinal-twist",
    title: "Supine spinal twist",
    views: TOP_VIEWS,
    transition: 1.4,
    frames: [supineTwist(0, 0.5), supineTwist(1, 1.6)],
  },
  {
    id: "ntc_thread_the_needle",
    slug: "thread-the-needle",
    title: "Thread the needle",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [threadNeedle(0, 1), threadNeedle(1, 1.2)],
  },
  {
    id: "fedb_side_lying_floor_stretch",
    slug: "side-lying-floor-stretch",
    title: "Side Lying Floor Stretch",
    view: "front",
    props: [SIDE_LYING_FLOOR],
    transition: 1.3,
    frames: [kf(sideLyingReach(204), 0.5), kf(sideLyingReach(192), 1.5)],
  },
  {
    id: "hf_170",
    slug: "side-lying-windmill",
    title: "Side-Lying Windmill",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.1,
    frames: [openBook(0, 0.5), openBook(90, 0), openBook(188, 0.8), openBook(90, 0)],
  },
  {
    id: "fedb_spinal_stretch",
    slug: "spinal-stretch",
    title: "Spinal Stretch",
    views: TOP_VIEWS,
    props: [SS_CHAIR, FLOOR_PROP],
    transition: 1.4,
    frames: [spinalStretch(0, 0, 0.5), spinalStretch(0, -60, 0.4), spinalStretch(74, -80, 1.5, 22), spinalStretch(0, -60, 0.2)],
  },
  {
    id: "wger_1861",
    slug: "side-stretch",
    title: "Side stretch",
    view: "front",
    props: [FLOOR_PROP],
    transition: 1.1,
    frames: [kf(overheadBend(0), 0.5), kf(overheadBend(32), 1.3)],
  },
  {
    id: "fedb_standing_lateral_stretch",
    slug: "standing-lateral-stretch",
    title: "Standing Lateral Stretch",
    view: "front",
    props: [FLOOR_PROP],
    transition: 1.1,
    frames: [kf(lateralStretch(0), 0.5), kf(lateralStretch(28), 1.3)],
  },
  {
    id: "wger_1426",
    slug: "standing-side-crunches",
    title: "Standing Side Crunches",
    view: "front",
    props: [FLOOR_PROP],
    transition: 0.9,
    frames: [kf(elbowToHip(0), 0.3), kf(elbowToHip(30), 0.5), kf(elbowToHip(0), 0.3), kf(elbowToHip(-30), 0.5)],
  },
];
