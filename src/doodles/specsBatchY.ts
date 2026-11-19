import { solvePose } from "./rig";
import type { DoodleSpec, Point, Pose, Prop } from "./rig";

/**
 * Batch Y: core moves (V-sit, V-up, jackknifes, crunches, roll-overs,
 * straddle L-sit, arch hold), the inchworm, crab walk and a bar chin/crunch.
 * Floor at y = 0, up is negative, the side-view figure faces +x (lying face up
 * has the head at -x, lying face down the head at +x). Side-lying and lateral
 * moves use the front view (near = bottom side when lying on the side).
 * Import only from ./rig — never from ./specs (that would be circular).
 *
 * Left out:
 * - Plank jacks (ntc_plank_jacks): the feet jump apart sideways. In side view
 *   both legs project to one line; from the front the plank body points at the
 *   camera; from above the support arms point at the camera and the rig cannot
 *   shorten them, so it reads as lying face down.
 * - Alternate heel touchers (fedb_alternate_heel_touchers): the side bend only
 *   shows from above, where the bent knees point at the camera; at full length
 *   they splay into a frog/butterfly shape. In side view the bend is invisible.
 * - Front kickthrough (hf_144): the hips rotate and the leg kicks out sideways
 *   across the view axis. Depth does not help: the kicking leg ends up on the
 *   far side of the body but in front of the far support arm, so neither
 *   near/far choice puts the right limb in front, and the rotation is invisible.
 */

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const round = (value: number): number => Math.round(value * 10) / 10;
const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Where circles around `a` (radius ra) and `b` (radius rb) meet; `pick` chooses between the two points. */
function meet(a: Point, ra: number, b: Point, rb: number, pick: (p: Point, q: Point) => boolean): Point {
  const d = dist(a, b);
  const x = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  const p: Point = [round(a[0] + ux * x - uy * h), round(a[1] + uy * x + ux * h)];
  const q: Point = [round(a[0] + ux * x + uy * h), round(a[1] + uy * x - ux * h)];
  return pick(p, q) ? p : q;
}

const upper = (p: Point, q: Point): boolean => p[1] < q[1];
const lower = (p: Point, q: Point): boolean => p[1] > q[1];
const ahead = (p: Point, q: Point): boolean => p[0] > q[0];

/** Hip to ankle with the knee straight. */
const LEG = 173.6;
/** Shoulder to fingertip with the elbow locked. */
const LOCKED = 125.97;
const THIGH = 88;
const SHIN = 86;

/** Knee between hip and ankle, folded towards +x (`forward`) or -x. */
const knee = (hip: Point, ankle: Point, forward: boolean): Point =>
  meet(hip, THIGH, ankle, SHIN, forward ? ahead : (p, q) => !ahead(p, q));

/** Knees pinned on the hip→ankle line (side view, hip = pelvis), so straight legs never kink. */
function straightLegs(pelvis: Point, near: number, far: number, toe = 0): Pick<Pose, "knees" | "feet" | "toes"> {
  return {
    knees: { near: { at: along(pelvis, near, THIGH) }, far: { at: along(pelvis, far, THIGH) } },
    feet: { near: along(pelvis, near, THIGH + SHIN), far: along(pelvis, far, THIGH + SHIN) },
    toes: { near: round(near + toe), far: round(far + toe) },
  };
}

/** Shoulder of a solved pose (near side). */
const shoulderOf = (pose: Pose): Point => solvePose(pose).arms.near.root;

// ---------------------------------------------------------------- V-sit (support on the hands)

const VS_HAND: Point = [-50, 0];

/** Hands on the floor beside the hips, arms locked, hips just off the floor; straight legs at `legs` degrees. */
function vSit(legs: number): Pose {
  const pelvis: Point = [0, -24];
  // Shoulder a torso (98) from the pelvis and a locked arm from the hand.
  const shoulder = meet(pelvis, 98, VS_HAND, LOCKED - 0.2, upper);
  const torso = angle(pelvis, shoulder);
  return {
    pelvis,
    chest: along(pelvis, torso, 80),
    head: along(along(pelvis, torso, 100), torso + 14, 36),
    hands: { near: VS_HAND, far: [VS_HAND[0] + 1, 0] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    ...straightLegs(pelvis, legs, legs - 0.8, 6),
  };
}

// ---------------------------------------------------------------- V-up / jackknife (head at -x)

const VU_PELVIS: Point = [0, -16];

/**
 * Lying flat with straight arms reaching overhead, held up off the floor past
 * the head, legs just off the floor. The arms stay ahead of the head as both
 * rise, so they never sweep through it.
 */
function vUpLow(): Pose {
  const chest: Point = [-80, -18];
  const base: Pose = { pelvis: VU_PELVIS, chest, head: along(chest, 186, 56) };
  const shoulder = shoulderOf(base);
  return {
    ...base,
    hands: { near: along(shoulder, 218, 125.4), far: along(shoulder, 219, 125.4) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    ...straightLegs(VU_PELVIS, -6, -7),
  };
}

/** Folded on the hips: torso at `torso` degrees, straight legs at `legs`, hands reaching up the legs. */
function vUpTop(torso: number, legs: number): Pose {
  const pelvis: Point = [0, -14];
  const chest = along(pelvis, torso, 80);
  const shoulder = along(pelvis, torso, 98);
  // The hands meet the legs as far up as straight arms allow (at the toes when they can).
  let reach = LEG + 10;
  while (reach > 60 && dist(along(pelvis, legs, reach), shoulder) > 125.2) reach -= 0.5;
  const hand = along(pelvis, legs, reach);
  return {
    pelvis,
    chest,
    head: along(chest, torso + 18, 56),
    hands: { near: hand, far: along(pelvis, legs - 1, reach) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    ...straightLegs(pelvis, legs, legs - 1, 4),
  };
}

// ---------------------------------------------------------------- crunch (head at -x, knees bent)

const CR_PELVIS: Point = [-8, -20];
const CR_FEET: Point = [84, -2];

/** Torso at `theta` (≈183 lying, ≈212 curled), fingertips lightly beside the head, elbows out. */
function crunch(theta: number, tuck: number): Pose {
  const pelvis = CR_PELVIS;
  const chest = along(pelvis, theta, 80);
  const head = along(chest, theta + tuck, 56);
  const shoulder = shoulderOf({ pelvis, chest, head });
  // Fingertips at the temple; the elbow points up past the face.
  const hand = along(head, theta + 75, 22);
  const elbow = meet(shoulder, 60, hand, 66, upper);
  const elbowFar = meet(shoulder, 60, along(hand, theta, 3), 66, upper);
  return {
    pelvis,
    chest,
    head,
    hands: { near: hand, far: along(hand, theta, 3) },
    elbows: { near: { at: elbow }, far: { at: elbowFar } },
    feet: { near: CR_FEET, far: [CR_FEET[0] - 3, CR_FEET[1]] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- arch body hold (face down, head at +x)

const ARCH_PELVIS: Point = [-20, -14];

/** Face down, arched: chest, straight arms by the ears and straight legs lifted; `lift` 1 is the full hold. */
function archHold(lift: number): Pose {
  const pelvis = ARCH_PELVIS;
  const spine = -12 - 10 * lift;
  // A shorter chord with the spine arched: the lower back starts low and the chest curves up, an even bow.
  const chest = along(pelvis, spine, 77.5);
  const base: Pose = { pelvis, chest, spine: { bend: 1 } };
  const solved = solvePose(base);
  const upperSpine = angle(solved.waist, solved.chest);
  const shoulder = solved.arms.near.root;
  // Neck long, eyes to the floor: the head tips just below the spine line so the arms pass above it.
  const head = along(along(chest, upperSpine, 20), upperSpine + 30, 36);
  const arm = upperSpine - 22;
  const leg = 184 + 10 * lift;
  return {
    ...base,
    head,
    hands: { near: along(shoulder, arm, 125.9), far: along(shoulder, arm - 1, 125.9) },
    ...straightLegs(pelvis, leg, leg + 1, 0),
  };
}

// ---------------------------------------------------------------- side jackknife (front view, head left)

/** Bottom forearm on the floor; the bottom shoulder sits straight above the elbow. */
const SJ_ELBOW: Point = [-88, -4];
const SJ_SHOULDER: Point = [SJ_ELBOW[0], SJ_ELBOW[1] - 60];
/** Pelvis to the bottom shoulder in the front view (98 along the spine, 22 across). */
const SJ_TWIST = (Math.atan2(22, 98) * 180) / Math.PI;

/** Chest that puts the front-view near (bottom) shoulder at `target`, searched on a grid round the pelvis. */
function chestForShoulder(pelvis: Point, target: Point, bend: 1 | -1): Point {
  let best: Point = along(pelvis, 180, 80);
  let bestGap = Infinity;
  const tryChest = (chest: Point) => {
    const solved = solvePose({ pelvis, chest, spine: { bend } }, { view: "front" });
    // Keep the side bend smooth: no more than 28° at the waist.
    const a = angle(solved.pelvis, solved.waist);
    const b = angle(solved.waist, solved.chest);
    if (Math.abs(((b - a + 540) % 360) - 180) > 28) return;
    const gap = dist(solved.arms.near.root, target);
    if (gap < bestGap) {
      bestGap = gap;
      best = chest;
    }
  };
  for (let deg = 150; deg <= 215; deg += 0.5) for (let chord = 64; chord <= 80; chord += 0.5) tryChest(along(pelvis, deg, chord));
  const [deg0, chord0] = [angle(pelvis, best), dist(pelvis, best)];
  for (let deg = deg0 - 0.5; deg <= deg0 + 0.5; deg += 0.05) {
    for (let chord = chord0 - 0.5; chord <= Math.min(80, chord0 + 0.5); chord += 0.05) {
      const r = (deg * Math.PI) / 180;
      tryChest([pelvis[0] + Math.cos(r) * chord, pelvis[1] + Math.sin(r) * chord]);
    }
  }
  return best;
}

/**
 * Lying on the bottom side, propped on the forearm, top hand behind the head.
 * `legs` lifts both straight legs together (degrees above the floor); `curl`
 * swings the bottom shoulder round the planted elbow towards the hips, so the
 * torso side-bends up towards the legs.
 */
function sideJackknife(legs: number, curl: number): Pose {
  const pelvis: Point = [0, -16];
  const shoulder = along(SJ_ELBOW, -90 + curl, 60);
  const chest = curl === 0 ? along(pelvis, angle(pelvis, SJ_SHOULDER) + SJ_TWIST, 80) : chestForShoulder(pelvis, shoulder, -1);
  const spine = angle(pelvis, chest);
  const solved = solvePose({ pelvis, chest, spine: { bend: -1 } }, { view: "front" });
  const hipNear = solved.legs.near.root;
  const hipFar = solved.legs.far.root;
  const shoulderFar = solved.arms.far.root;
  const head = solved.head;
  const hand = along(head, spine + 115, 22);
  // The forearm stays flat; the elbow sits on the floor a upper arm's length from where the shoulder landed.
  const shoulderNear = solved.arms.near.root;
  const elbow: Point = [round(shoulderNear[0] - Math.sqrt(Math.max(0, 59.9 ** 2 - (-4 - shoulderNear[1]) ** 2))), -4];
  return {
    pelvis,
    chest,
    spine: { bend: -1 },
    elbows: { near: { at: elbow }, far: { at: meet(shoulderFar, 60, hand, 66, upper) } },
    hands: { near: [elbow[0] + 66, -4], far: hand },
    knees: { near: { at: along(hipNear, -legs + 2, THIGH) }, far: { at: along(hipFar, -legs, THIGH) } },
    feet: { near: along(hipNear, -legs + 2, THIGH + SHIN), far: along(hipFar, -legs, THIGH + SHIN) },
    toes: { near: -legs + 2, far: -legs },
  };
}

// ---------------------------------------------------------------- roll-over into V-sit (facing +x)

/** Seated wide V reaching forward between the legs (the straddle is edge-on in side view). */
function rollReach(): Pose {
  const pelvis: Point = [0, -16];
  const torso = -42;
  const shoulder = along(pelvis, torso, 98);
  return {
    pelvis,
    chest: along(pelvis, torso, 80),
    head: along(along(pelvis, torso, 100), torso + 26, 36),
    hands: { near: along(shoulder, 26, 124), far: along(shoulder, 27, 124) },
    ...straightLegs(pelvis, 2, 2.6, 4),
  };
}

const ROLL_CHEST: Point = [-112, -22];

/** Rolling through the back: shoulders down, straight legs pointing up. */
function rollRock(): Pose {
  const pelvis: Point = [-34, -20];
  const base: Pose = { pelvis, chest: ROLL_CHEST, head: [-164, -40] };
  const shoulder = shoulderOf(base);
  return {
    ...base,
    hands: { near: along(shoulder, -4, 124), far: along(shoulder, -5, 124) },
    ...straightLegs(pelvis, -100, -101, 4),
  };
}

/** Rolled back onto the upper back: hips over the shoulders, straight legs overhead, hands on the floor. */
function rollOver(): Pose {
  // The flexion is shared out: about 30° at the waist, the chest and the neck.
  const chest: Point = [-120, -26];
  const waist = along(chest, 130 + 180, 40);
  const pelvis = along(waist, 100 + 180, 40);
  const head = along(along(chest, 160, 20), 190, 36);
  const base: Pose = { pelvis, chest, head };
  const shoulder = shoulderOf(base);
  return {
    ...base,
    hands: { near: along(shoulder, 0, 125.9), far: along(shoulder, -0.5, 125.9) },
    ...straightLegs(pelvis, 173, 174, 0),
  };
}

// ---------------------------------------------------------------- straddle L-sit (front view)

/** Seated straddle (`lifted` false) or pressed up: arms locked, hips and wide straight legs off the floor. */
function straddle(lifted: boolean): Pose {
  const pelvis: Point = [0, lifted ? -28 : -14];
  const legs = lifted ? 4 : -2;
  return {
    pelvis,
    chest: [0, pelvis[1] - 80],
    hands: { near: [-25, 0], far: [25, 0] },
    elbows: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: along([-8, pelvis[1]], 180 + legs, LEG), far: along([8, pelvis[1]], -legs, LEG) },
    knees: { near: { at: along([-8, pelvis[1]], 180 + legs, THIGH) }, far: { at: along([8, pelvis[1]], -legs, THIGH) } },
    toes: { near: 180 + legs, far: -legs },
  };
}

// ---------------------------------------------------------------- gorilla chin/crunch (side view, bar end-on)

const BAR: Prop = { kind: "bar", y: -420, x1: 0, x2: 0, grips: [0] };
const BAR_HANDS = { near: [2, -420] as Point, far: [-2, -420] as Point };

/** Dead hang on straight arms, knees bent to a right angle (thighs down, shins back). */
function gorillaHang(): Pose {
  const pelvis: Point = [0, -196];
  const kneeAt = along(pelvis, 92, THIGH);
  return {
    pelvis,
    chest: [0, -276],
    head: along([0, -276], -128, 54),
    hands: BAR_HANDS,
    knees: { near: { at: kneeAt }, far: { at: along(pelvis, 93, THIGH) } },
    feet: { near: along(kneeAt, 182, SHIN), far: along(along(pelvis, 93, THIGH), 183, SHIN) },
    toes: { near: 110, far: 110 },
  };
}

/** Top: chin at the bar (head just behind it), elbows down and forward, knees crunched to the chest. */
function gorillaTop(): Pose {
  const chest: Point = [-34, -360];
  const pelvis: Point = [-26, -280];
  const base: Pose = { pelvis, chest, head: [-34, -414] };
  const shoulder = shoulderOf(base);
  const kneeNear = along(pelvis, -44, THIGH);
  const kneeFar = along(pelvis, -46, THIGH);
  return {
    ...base,
    hands: BAR_HANDS,
    elbows: {
      near: { at: meet(shoulder, 60, BAR_HANDS.near, 66, lower) },
      far: { at: meet(shoulder, 60, BAR_HANDS.far, 66, lower) },
    },
    knees: { near: { at: kneeNear }, far: { at: kneeFar } },
    feet: { near: along(kneeNear, 100, SHIN), far: along(kneeFar, 101, SHIN) },
    toes: { near: 120, far: 120 },
  };
}

// ---------------------------------------------------------------- crab walk (face up, feet at +x)

const CRAB_PELVIS: Point = [0, -90];
const CRAB_CHEST = along(CRAB_PELVIS, -162, 80);
const CRAB_HAND_X = -82;
const CRAB_FOOT_X = 84;
const CRAB_STEP = 16;
const CRAB_LIFT = 16;

/**
 * Crab walk in place (feet first): `phase` 0 has the near hand and far foot
 * forward, 2 the far hand and near foot; 1 and 3 swing the other pair through.
 */
function crab(phase: 0 | 1 | 2 | 3): Pose {
  const pairA = [1, 0, -1, 0][phase]; // near hand + far foot
  const pairB = -[1, 0, -1, 0][phase]; // far hand + near foot
  const liftA = phase === 3;
  const liftB = phase === 1;
  const hand = (offset: number, lifted: boolean, dx: number): Point => [CRAB_HAND_X + dx + offset * CRAB_STEP, lifted ? -CRAB_LIFT : 0];
  const foot = (offset: number, lifted: boolean, dx: number): Point => [CRAB_FOOT_X + dx + offset * CRAB_STEP, lifted ? -CRAB_LIFT : 0];
  const nearFoot = foot(pairB, liftB, 0);
  const farFoot = foot(pairA, liftA, -4);
  return {
    pelvis: CRAB_PELVIS,
    chest: CRAB_CHEST,
    hands: { near: hand(pairA, liftA, 0), far: hand(pairB, liftB, -4) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: knee(CRAB_PELVIS, nearFoot, true) }, far: { at: knee(CRAB_PELVIS, farFoot, true) } },
    feet: { near: nearFoot, far: farFoot },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- inchworm (facing +x)

/** Hands to hips along straight arms and spine (126 + 98), a hair short. */
const ARM_SPINE = 223.6;
/** Ankle to shoulder of a straight plank body (leg 173.9 + pelvis-to-shoulder 98). */
const BODY = 271.9;

function standAt(x: number): Pose {
  return {
    pelvis: [x, -172],
    chest: [x, -252],
    hands: { near: [x + 6, -146], far: [x + 2, -146] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [x + 6, 0], far: [x, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Inverted V on straight arms and legs, heels down: hands at `hand`, ankles at `foot`. */
function pike(foot: number, hand: number): Pose {
  const ankle: Point = [foot, -5];
  const palm: Point = [hand, 0];
  const pelvis = meet(palm, ARM_SPINE, ankle, LEG, upper);
  const deg = angle(pelvis, palm);
  const chest = along(pelvis, deg, 80);
  return {
    pelvis,
    chest,
    // Head down between the arms, eyes to the floor.
    head: along(chest, deg - 26, 56),
    hands: { near: palm, far: [hand - 2, 0] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: along(pelvis, angle(pelvis, ankle), THIGH) }, far: { at: along(pelvis, angle(pelvis, ankle), THIGH) } },
    feet: { near: ankle, far: ankle },
    toes: { near: 4, far: 4 },
  };
}

/** High plank on the balls of the feet: straight body, locked arms, hands under the shoulders. */
function plankAt(foot: number, hand: number): Pose {
  const ankle: Point = [foot, -18];
  const palm: Point = [hand, 0];
  const shoulder = meet(ankle, BODY, palm, LOCKED - 0.2, upper);
  const deg = angle(ankle, shoulder);
  const pelvis = along(ankle, deg, 173.9);
  return {
    pelvis,
    chest: along(ankle, deg, 253.9),
    knees: { near: { at: along(ankle, deg, SHIN) }, far: { at: along(ankle, deg, SHIN) } },
    hands: { near: palm, far: [hand - 2, 0] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: ankle, far: ankle },
    toes: { near: 62, far: 62 },
  };
}

/** Plank length from ankle to hands. */
const PLANK_SPAN = 252;
const FOLD_SPAN = 122;
const DOG_SPAN = 196;
/** How far the whole worm inches forward in one rep. */
const INCH = PLANK_SPAN - FOLD_SPAN;

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Arm angle at the hands (hand → shoulder) of the downward-dog pike and of the plank. */
const DOG_ARM = (() => {
  const pose = pike(0, DOG_SPAN);
  return angle([DOG_SPAN, 0], along(pose.pelvis as Point, angle(pose.pelvis as Point, [DOG_SPAN, 0]), 98));
})();
const PLANK_ARM = (() => {
  const shoulder = meet([0, -18], BODY, [PLANK_SPAN, 0], LOCKED - 0.2, upper);
  return angle([PLANK_SPAN, 0], shoulder);
})();

/**
 * Part way from the pike (0) to the high plank (1), ankles at `foot`: arms stay
 * locked and legs straight while the hands walk out and the hips lower.
 */
function walkOut(foot: number, t: number): Pose {
  if (t <= 0) return pike(foot, foot + DOG_SPAN);
  if (t >= 1) return plankAt(foot, foot + PLANK_SPAN);
  const palm: Point = [round(foot + mix(DOG_SPAN, PLANK_SPAN, t)), 0];
  const ankle: Point = [foot, round(mix(-5, -18, t))];
  const shoulder = along(palm, mix(DOG_ARM, PLANK_ARM, t), LOCKED - 0.2);
  const pelvis = meet(ankle, 174, shoulder, 98, upper);
  const spine = angle(pelvis, shoulder);
  const chest = along(pelvis, spine, 80);
  const legDeg = angle(pelvis, ankle);
  const toe = round(mix(4, 62, t));
  return {
    pelvis,
    chest,
    head: along(chest, spine - 26 * (1 - t), 56),
    hands: { near: palm, far: [palm[0] - 2, 0] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: along(pelvis, legDeg, THIGH) }, far: { at: along(pelvis, legDeg, THIGH) } },
    feet: { near: ankle, far: ankle },
    toes: { near: toe, far: toe },
  };
}

/**
 * Stand, fold, walk the hands out to a plank, walk the feet in, roll up. Drawn
 * on the spot: every transition slides the figure back by an equal share of
 * the distance the worm travels, so the loop closes.
 */
/** Steps of the walk between the pike and the plank. */
const WALK = [0, 0.2, 0.4, 0.6, 0.8, 1];

function inchwormFrames(): { hold: number; pose: Pose }[] {
  // Each step: hold, ankle position relative to where the feet started, and the pose maker.
  const steps: [number, number, (foot: number) => Pose][] = [
    [0.4, 0, (f) => standAt(f)],
    [0.25, 0, (f) => pike(f, f + FOLD_SPAN)],
    ...WALK.map((t): [number, number, (foot: number) => Pose] => [t === 1 ? 0.35 : 0, 0, (f) => walkOut(f, t)]),
    ...WALK.slice(0, -1)
      .reverse()
      .map((t): [number, number, (foot: number) => Pose] => [0, PLANK_SPAN - mix(DOG_SPAN, PLANK_SPAN, t), (f) => walkOut(f, t)]),
    [0.25, INCH, (f) => pike(f, f + FOLD_SPAN)],
    [0.4, INCH, (f) => standAt(f)],
  ];
  const n = steps.length;
  return steps.map(([hold, foot, make], k) => ({ hold, pose: make(round(-60 + foot - (INCH * k) / n)) }));
}

export const BATCH_Y_SPECS: DoodleSpec[] = [
  {
    id: "hf_106",
    slug: "v-sit-hold",
    title: "V-Sit",
    transition: 1,
    frames: [
      // From an L-sit the straight legs rise above horizontal into the V, then hold.
      { hold: 0.5, pose: vSit(0) },
      { hold: 1.6, pose: vSit(-40) },
    ],
  },
  {
    id: "hf_120",
    slug: "v-up",
    title: "V-Up",
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: vUpLow() },
      { hold: 0.35, pose: vUpTop(-112, -66) },
    ],
  },
  {
    id: "fedb_jackknife_sit_up",
    slug: "jackknife-sit-up",
    title: "Jackknife Sit-Up",
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: vUpLow() },
      { hold: 0.35, pose: vUpTop(-124, -56) },
    ],
  },
  {
    id: "fedb_gorilla_chin_crunch",
    slug: "gorilla-chin-crunch",
    title: "Gorilla Chin/Crunch",
    props: [BAR],
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: gorillaHang() },
      { hold: 0.5, pose: gorillaTop() },
    ],
  },
  {
    id: "fedb_side_jackknife",
    slug: "side-jackknife",
    title: "Side Jackknife",
    view: "front",
    transition: 0.8,
    frames: [
      { hold: 0.4, pose: sideJackknife(0, 0) },
      { hold: 0.4, pose: sideJackknife(32, 10) },
    ],
  },
  {
    id: "wger_1954",
    slug: "roll-over-into-v-sit",
    title: "Roll-overs into V-sits",
    transition: 0.6,
    frames: [
      { hold: 0.5, pose: rollReach() },
      { hold: 0.05, pose: rollRock() },
      { hold: 0.4, pose: rollOver() },
      { hold: 0.05, pose: rollRock() },
    ],
  },
  {
    id: "wger_1847",
    slug: "straddle-l-sit",
    title: "Straddle L-Sit",
    view: "front",
    // Floor line, so the lift of the hips and legs reads.
    props: [{ kind: "floor" }],
    transition: 0.8,
    frames: [
      { hold: 0.4, pose: straddle(false) },
      { hold: 1.4, pose: straddle(true) },
    ],
  },
  {
    id: "fedb_crunches",
    slug: "crunches",
    title: "Crunches",
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: crunch(183, 2) },
      { hold: 0.4, pose: crunch(212, 12) },
    ],
  },
  {
    id: "hf_118",
    slug: "arch-body-hold",
    title: "Arch Body Hold",
    transition: 1.2,
    frames: [
      { hold: 1.4, pose: archHold(1) },
      { hold: 1.4, pose: archHold(0.85) },
    ],
  },
  {
    id: "hf_149",
    slug: "inchworm",
    title: "Inchworm",
    transition: 0.32,
    frames: inchwormFrames(),
  },
  {
    id: "hf_143",
    slug: "crab-walk",
    title: "Crab Walk",
    transition: 0.35,
    frames: [
      { hold: 0.05, pose: crab(0) },
      { hold: 0, pose: crab(1) },
      { hold: 0.05, pose: crab(2) },
      { hold: 0, pose: crab(3) },
    ],
  },
];
