import { BONES, HIP_SIDE, other, solvePose, zOut } from "./rig";
import type { AuthoredPose, DoodleSpec, Keyframe, Point, Pose, Prop, Side } from "./rig";
import { solveKeyframe3, type Point3 } from "./rig3d";
import { TOP_VIEWS, TWO_VIEWS } from "./sideways";
import { FLOOR_PROP, along, angle, lerp, round, supineTorso } from "./geom";
import { lyingFigureFour } from "./specsBatchBD";
import { plank } from "./specsBatchI";

/**
 * Batch BE (#216): hamstring, calf, quad and leg stretches, knee and ankle
 * mobility, and a thoracic rotation. Floor at y = 0, up is negative, the
 * side-view figure faces +x (lying face up has the head at -x). Import only
 * from ./rig and other batch files, never from ./specs.
 */

const THIGH = BONES.thigh;
const SHIN = BONES.shin;
/** Hip to ankle with the knee a hair short of straight. */
const LEG = 173.4;

/** The solved near shoulder of a pose. */
const shoulderOf = (pose: Pose): Point => solvePose(pose).arms.near.root;

// ---------------------------------------------------------------- lying on the back (head at -x)

const SP_PELVIS: Point = [0, -22];
/** Face up: upper back and head on the floor, the pelvis a hand's width up. Arms and legs are left to the caller. */
const supine = (): Pose => supineTorso(SP_PELVIS, 79.6);
/** The straight leg flat on the floor: ankle just above it, toes up. */
const FLAT_ANKLE: Point = [173.2, -8];

/** Hands behind the (near) thigh `deg` from the hip, `reach` along it. */
function behindThigh(deg: number, reach: number): Pose["hands"] {
  const p = along(SP_PELVIS, deg, reach);
  return { near: [round(p[0] + 5), p[1]], far: [round(p[0] + 3), round(p[1] + 3)] };
}

/**
 * One leg straight on the floor, the other bent and drawn to the chest: thigh
 * `thigh` degrees from the hip, hands clasped behind it.
 */
function kneeToChest(thigh: number): Pose {
  const knee = along(SP_PELVIS, thigh, THIGH);
  return {
    ...supine(),
    hands: behindThigh(thigh, 58),
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: knee }, far: { bend: -1 } },
    feet: { near: along(knee, thigh + 100, SHIN), far: FLAT_ANKLE },
    toes: { far: -80 },
  };
}

/**
 * Lying hamstring mobility: the thigh held close (`thigh` from the hip, hands
 * behind it), the knee `extend` of the way from bent to straight.
 */
function heldHamstring(thigh: number, extend: number): Pose {
  const knee = along(SP_PELVIS, thigh, THIGH);
  const bent = along(knee, thigh + 112, SHIN);
  const straight = along(SP_PELVIS, thigh, THIGH + SHIN - 0.3);
  const ankle: Point = [round(lerp(bent[0], straight[0], extend)), round(lerp(bent[1], straight[1], extend))];
  return {
    ...supine(),
    hands: behindThigh(thigh, 60),
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: knee }, far: { bend: -1 } },
    feet: { near: ankle, far: FLAT_ANKLE },
    toes: { far: -80 },
  };
}

/** Tabletop on the back, hands on the thighs just above the knees: press hands and knees together. */
function tabletop(thigh: number): Pose {
  const knee = along(SP_PELVIS, thigh, THIGH);
  const grip = along(SP_PELVIS, thigh, 62);
  return {
    ...supine(),
    hands: { near: [round(grip[0] - 3), grip[1]], far: [round(grip[0] - 5), round(grip[1] + 2)] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: knee }, far: { at: [knee[0] - 2, knee[1]] } },
    feet: { near: [round(knee[0] + SHIN), knee[1]], far: [round(knee[0] + SHIN - 2), knee[1]] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- quad set (lying, legs straight)

/** Lying with both legs out: the near knee rests a little bent, then the thigh tightens, the knee presses down straight and the toes draw back. */
function quadSet(press: boolean): Pose {
  const ankle: Point = press ? [172.9, -9] : [169.5, -9];
  const sh = shoulderOf(supine());
  return {
    ...supine(),
    hands: { near: along(sh, 4, 124.5), far: along(sh, 6, 124) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: ankle, far: [173.2, -8] },
    toes: { near: press ? -88 : -64, far: -80 },
  };
}

// ---------------------------------------------------------------- raised-heel hamstring stretch (box)

const BOX_TOP = -92;
const HEEL_BOX: Prop = { kind: "box", x: 150, y: BOX_TOP, w: 110, h: -BOX_TOP };

/** Standing tall on the far leg, the near heel on the box with the leg straight, toes up; hinge forward with a flat back. */
function heelOnBox(lean: number): Pose {
  const heel: Point = [158, BOX_TOP - 6];
  const dy = heel[1] + 173.6;
  const pelvis: Point = [round(heel[0] - Math.sqrt(LEG ** 2 - dy ** 2)), -173.6];
  const chest = along(pelvis, -lean, 80);
  const onLeg = (reach: number, lift: number): Point => {
    const p = along(pelvis, angle(pelvis, heel), reach);
    return [p[0], round(p[1] - lift)];
  };
  return {
    pelvis,
    chest,
    hands: { near: onLeg(lean > 70 ? 70 : 118, 6), far: onLeg(lean > 70 ? 68 : 112, 4) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: heel, far: [pelvis[0], 0] },
    toes: { near: -86, far: 0 },
  };
}

// ---------------------------------------------------------------- standing quad stretch (hand on the wall)

const QS_WALL: Prop = { kind: "box", x: 84, y: -340, w: 14, h: 340 };

/** Stand on the near leg, hand on the wall; the far heel is drawn to the buttock and held (`pull` 0 = lifted, 1 = held close). */
function standingQuad(pull: number): Pose {
  const pelvis: Point = [round(lerp(4, 6, pull)), -172];
  const chest = along(pelvis, -100, 80);
  const knee = along(pelvis, lerp(92, 95, pull), THIGH);
  const ankle = along(knee, lerp(231, 238, pull), SHIN);
  return {
    pelvis,
    chest,
    hands: { near: [80, -214], far: [round(ankle[0] + 3), round(ankle[1] + 2)] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { at: knee } },
    feet: { near: [4, 0], far: ankle },
    toes: { near: 0, far: 220 },
  };
}

// ---------------------------------------------------------------- ankle circles (side view, the toe circles in front of the ankle)

const SUPPORT: Prop = { kind: "box", x: 112, y: -230, w: 26, h: 230 };

/**
 * Standing tall, hands on a support; the near (bright) foot lifted a little off the floor, knee forward.
 * The big toe circles round the ankle, always in front of it: `phi` 0 pointed (toe down and forward),
 * 90 in, 180 flexed (toe up and forward), 270 out. The rig's foot can't turn sideways (its toe stays
 * in the side plane even in two views, and from the front the support hides the legs), so in and out
 * show only as the toe passing level, half way between pointed and flexed.
 */
function ankleCircle(phi: number): Keyframe {
  const pelvis: Point = [0, -173.9];
  const knee = along(pelvis, 50, THIGH);
  const ankle = along(knee, 100, SHIN);
  const toe = round(24 + 46 * Math.cos((phi * Math.PI) / 180));
  return {
    hold: 0,
    pose: {
      pelvis,
      chest: [0, -253.9],
      hands: { near: [108, -232], far: [104, -232] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { at: knee } },
      feet: { near: ankle, far: [0, 0] },
      toes: { near: toe, far: 0 },
    },
  };
}

// ---------------------------------------------------------------- half-kneeling thoracic rotation (side + top)

const HK_PELVIS: Point = [2, -85];

/** Full roll of the shoulder line at the open end: + brings the far shoulder forward, the chest turning to the near side. */
const HK_TWIST = 85;

/**
 * Half-kneeling (near foot forward, far knee down, hips square), arms straight out in front at shoulder
 * height, palms together. `open` 0..1 rolls the shoulder line `HK_TWIST` about the spine: the far arm
 * keeps reaching forward while the near arm sweeps open and back with the chest until the arms make one
 * line fore and aft; the eyes turn with the chest and on after the hand.
 */
function halfKneelOpen(open: number): Keyframe {
  const twist = round(HK_TWIST * open);
  const base: Pose = {
    pelvis: HK_PELVIS,
    chest: [HK_PELVIS[0] - 4, HK_PELVIS[1] - 80],
    knees: { near: { bend: -1 }, far: { at: [-30, -3] } },
    feet: { near: [HK_PELVIS[0] + 86, 0], far: [-116, -3] },
    toes: { near: 0, far: 180 },
  };
  const arms = solveKeyframe3(solvePose(base), base, { twist }).arms;
  const reach = 124;
  // Horizontal hand directions, degrees from straight ahead (+x) towards the near side (-z).
  const toward = (root: Point3, deg: number): Point3 => {
    const r = (deg * Math.PI) / 180;
    return [root[0] + reach * Math.cos(r), root[1], root[2] - reach * Math.sin(r)];
  };
  // Palms together: each arm angled in so the hands meet on the midline.
  const inward = (Math.asin(22 / reach) * 180) / Math.PI;
  const near = toward(arms.near.root, -inward + (180 + inward) * open - (open === 1 ? 6 : 0));
  const far = toward(arms.far.root, inward * (1 - open));
  return {
    hold: 0,
    face: { turn: round(-40 * open) },
    pose: {
      ...base,
      hands: { near: [round(near[0]), round(near[1])], far: [round(far[0]), round(far[1])] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
    },
    sideways: { twist, hands: { near: round(near[2]), far: round(far[2]) } },
  };
}

// ---------------------------------------------------------------- knee circles (standing, side + top)

const vsub = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vlen = (a: Point3): number => Math.hypot(a[0], a[1], a[2]);

/** The knee of a leg from `hip` to `ankle` (3D), bent towards `aim`. */
function kneeAt(hip: Point3, ankle: Point3, aim: Point3): Point3 {
  const d = vsub(ankle, hip);
  const len = vlen(d);
  const axis: Point3 = [d[0] / len, d[1] / len, d[2] / len];
  const w = vsub(aim, hip);
  const dot = w[0] * axis[0] + w[1] * axis[1] + w[2] * axis[2];
  const n: Point3 = [w[0] - dot * axis[0], w[1] - dot * axis[1], w[2] - dot * axis[2]];
  const nl = vlen(n);
  const a = (THIGH ** 2 - SHIN ** 2 + len ** 2) / (2 * len);
  const h = Math.sqrt(Math.max(0, THIGH ** 2 - a * a));
  return [hip[0] + axis[0] * a + (n[0] / nl) * h, hip[1] + axis[1] * a + (n[1] / nl) * h, hip[2] + axis[2] * a + (n[2] / nl) * h];
}

/** Knee circle in shin lean (degrees): forward `KC_FORWARD` ± `KC_ROUND`, sideways ± `KC_ROUND`, so the knees stay bent and in front of the ankles. */
const KC_FORWARD = 28;
const KC_ROUND = 16;

/**
 * Standing with the feet together and the knees soft; both knees draw a small circle in front of the
 * ankles, `phi` round it (0 forward, 90 out to the far side, 180 back towards straight, never past,
 * 270 to the near side). The feet stay flat, the shins tilt and the hips ride up and down over them.
 * Hands rest on the waist.
 */
function kneeCircle(phi: number): Keyframe {
  const r = (phi * Math.PI) / 180;
  const forward = ((KC_FORWARD + KC_ROUND * Math.cos(r)) * Math.PI) / 180;
  const side = ((KC_ROUND * Math.sin(r)) * Math.PI) / 180;
  const ankleOf = (s: Side): Point3 => [6, 0, zOut(s) * 4];
  const kneeOf = (s: Side): Point3 => {
    const a = ankleOf(s);
    return [a[0] + SHIN * Math.sin(forward) * Math.cos(side), a[1] - SHIN * Math.cos(forward) * Math.cos(side), a[2] + SHIN * Math.sin(side)];
  };
  const knees = { near: kneeOf("near"), far: kneeOf("far") };
  // The pelvis sits over the heels, as high as both thighs reach (the lower of the two).
  const hipY = (s: Side): number => {
    const k = knees[s];
    return k[1] - Math.sqrt(THIGH ** 2 - k[0] ** 2 - (zOut(s) * HIP_SIDE - k[2]) ** 2);
  };
  const pelvis: Point = [0, round(Math.max(hipY("near"), hipY("far")) + 0.05)];
  // The other leg then has a little slack: bend its knee towards where it was aimed.
  for (const s of ["near", "far"] as Side[]) {
    const hip: Point3 = [pelvis[0], pelvis[1], zOut(s) * HIP_SIDE];
    knees[s] = kneeAt(hip, ankleOf(s), knees[s]);
  }
  const k2 = (s: Side): Point => [round(knees[s][0]), round(knees[s][1])];
  return {
    hold: 0,
    pose: {
      pelvis,
      chest: [0, round(pelvis[1] - 80)],
      hands: { near: [8, round(pelvis[1] - 32)], far: [4, round(pelvis[1] - 32)] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { at: k2("near") }, far: { at: k2("far") } },
      feet: { near: [ankleOf("near")[0], 0], far: [ankleOf("far")[0], 0] },
      toes: { near: 0, far: 0 },
    },
    sideways: {
      hands: { near: -40, far: 40 },
      elbows: { near: { out: 80 }, far: { out: 80 } },
      knees: { near: { at: round(knees.near[2]) }, far: { at: round(knees.far[2]) } },
      feet: { near: ankleOf("near")[2], far: ankleOf("far")[2] },
    },
  };
}

// ---------------------------------------------------------------- seated leg extended out to the side (chair, side + front)

const SEAT_TOP = -92;
const CHAIR: Prop[] = [
  { kind: "box", x: -130, y: SEAT_TOP, w: 132, h: -SEAT_TOP, frontHalf: 56 },
  { kind: "box", x: -130, y: -200, w: 14, h: 108, frontHalf: 56 },
  FLOOR_PROP,
];

/** Sitting near the front of the chair, gripping the seat sides; the near leg straight, heel down, toes back, swung `out` units to the side. */
function chairLeg(out: number): Keyframe {
  const pelvis: Point = [0, SEAT_TOP - 8];
  const hipZ = -HIP_SIDE;
  const dz = -out - hipZ;
  const flat = Math.sqrt(LEG ** 2 - dz ** 2);
  const dir = (Math.asin((-8 - pelvis[1]) / flat) * 180) / Math.PI;
  const kneeFar: Point = [round(Math.sqrt(THIGH ** 2 - 12 ** 2)), pelvis[1]];
  return {
    hold: 0,
    pose: {
      pelvis,
      chest: [-3, pelvis[1] - 80],
      hands: { near: [10, SEAT_TOP - 2], far: [8, SEAT_TOP - 2] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 }, far: { at: kneeFar } },
      feet: { near: { dir, length: LEG }, far: [round(kneeFar[0] + 4), SEAT_TOP + 90 - 12] },
      toes: { near: -78, far: 0 },
    },
    sideways: { hands: { near: -56, far: 56 }, elbows: { near: { out: 40 }, far: { out: 40 } }, feet: { near: -out, far: 14 }, knees: { far: { at: 20 } } },
  };
}

// ---------------------------------------------------------------- standing crossed-leg forward fold (side + front)

/** Legs crossed: the near (back) leg straight behind the far leg, its foot out past the far foot; folded forward from the hips. */
function crossedFold(lean: number): Keyframe {
  const pelvis: Point = [-6, -165];
  const chest = along(pelvis, -lean, 80);
  const shoulder = along(pelvis, -lean, 98);
  const reach = 120;
  const handY = (dz: number): number => round(shoulder[1] + Math.sqrt(Math.max(0, reach ** 2 - 55 ** 2 - dz ** 2)));
  return {
    hold: 0,
    pose: {
      pelvis,
      chest,
      hands: { near: [round(shoulder[0] - 55), handY(56)], far: [round(shoulder[0] - 52), handY(10)] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      feet: { near: [-24, 0], far: [10, 0] },
      toes: { near: 0, far: 0 },
    },
    sideways: { hands: { near: 34, far: 28 }, feet: { near: 40, far: 4 }, elbows: { near: { out: 20 }, far: { out: 20 } } },
  };
}

// ---------------------------------------------------------------- knee across the body (lying twist, side + top)

type Vec3 = Point3;

/** A point `length` from `from` heading to `to` (straight at it). */
function toward(from: Vec3, to: Vec3, length: number): Vec3 {
  const d = vsub(to, from);
  const l = vlen(d);
  return [round(from[0] + (d[0] / l) * length), round(from[1] + (d[1] / l) * length), round(from[2] + (d[2] / l) * length)];
}

/** On the back, the near knee drawn across the body (`across` 0 = foot flat, 1 = knee dropped over to the far side). */
function kneeAcross(across: number): Keyframe {
  const hip: Vec3 = [0, -22, -HIP_SIDE];
  const from: Vec3 = [0.66, -0.75, 0];
  const to: Vec3 = [0.12, -0.2, 0.97];
  const d: Vec3 = [lerp(from[0], to[0], across), lerp(from[1], to[1], across), lerp(from[2], to[2], across)];
  const knee = toward(hip, [hip[0] + d[0], hip[1] + d[1], hip[2] + d[2]], THIGH);
  const ankle = toward(knee, [lerp(92, 72, across), lerp(-5, -14, across), lerp(-8, 16, across)], SHIN);
  const base = supine();
  const sh = shoulderOf({ ...base, hands: {} });
  const farHand: Vec3 = across > 0.5 ? [round(knee[0] - 6), round(knee[1] - 4), round(knee[2] - 6)] : [round(sh[0] + 6), -5, 60];
  const flat = (p: Vec3): Point => [p[0], p[1]];
  return {
    hold: 0,
    pose: {
      ...base,
      hands: { near: [round(sh[0] - 4), -6], far: flat(farHand) },
      elbows: { near: { bend: -1 }, far: { bend: -1 } },
      knees: { near: { at: flat(knee) }, far: { bend: -1 } },
      feet: { near: flat(ankle), far: FLAT_ANKLE },
      toes: { far: -80 },
    },
    sideways: {
      hands: { near: -128, far: farHand[2] },
      elbows: { near: { out: 90 } },
      knees: { near: { at: knee[2] } },
      feet: { near: ankle[2], far: 8 },
    },
  };
}

// ---------------------------------------------------------------- plank knee to the opposite elbow (side + top)

const CROSS_KNEE_Z = 26;
const CROSS_ANKLE_Z = 2;
const CROSS_PIKE = 16;
const CROSS_PIKE_SLIDE = 5;

/** The driven knee comes in under the chest and across to the opposite elbow, the lower back rounded; the other foot stays planted. */
function crossKnee(side: Side, mid: boolean): Keyframe {
  const base = plank();
  const across = -zOut(side);
  if (mid) {
    const chest = base.chest as Point;
    const flat = base.pelvis as Point;
    const chord = Math.hypot(flat[0] - chest[0], flat[1] - chest[1]);
    const y = flat[1] - CROSS_PIKE;
    const pelvis: Point = [round(chest[0] - Math.sqrt(chord ** 2 - (chest[1] - y) ** 2)), y];
    const [plantX, plantY] = base.feet?.near as Point;
    const pose: AuthoredPose = {
      ...base,
      pelvis,
      spine: { bend: 1 },
      knees: { [side]: { dir: 92 } },
      feet: { [side]: { dir: 200 }, [other(side)]: [plantX + CROSS_PIKE_SLIDE, plantY] },
      toes: { [side]: 100, [other(side)]: 62 },
    };
    return { hold: 0, pose, sideways: { knees: { [side]: { at: across * 12 } }, feet: { [side]: across * 2 } } };
  }
  const pose: AuthoredPose = {
    ...base,
    knees: { [side]: { dir: 40 } },
    feet: { [side]: { dir: 170 }, [other(side)]: base.feet?.near as Point },
    toes: { [side]: 150, [other(side)]: 62 },
  };
  return { hold: 0.35, pose, sideways: { knees: { [side]: { at: across * CROSS_KNEE_Z } }, feet: { [side]: across * CROSS_ANKLE_Z } } };
}

// ---------------------------------------------------------------- specs

const arc = (steps: number[], make: (v: number) => Keyframe, holds: [number, number]): Keyframe[] =>
  steps.map((v, i) => {
    const hold = i === steps.length - 1 ? holds[1] : 0;
    return { ...make(v), hold: i === 0 ? holds[0] : hold };
  });

const OPEN = [0, 0.3, 0.55, 0.8, 1];
const CIRCLE = [0, 45, 90, 135, 180, 225, 270, 315];

export const BATCH_BE_SPECS: DoodleSpec[] = [
  {
    id: "wger_1966",
    slug: "half-kneeling-thoracic-rotation",
    title: "1/2 Kneeling Thoracic Rotation",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.4,
    frames: [...arc(OPEN, halfKneelOpen, [0.5, 1]), ...arc([0.66, 0.33], halfKneelOpen, [0, 0])],
  },
  {
    id: "fedb_ankle_circles",
    slug: "ankle-circles",
    title: "Ankle Circles",
    props: [SUPPORT, FLOOR_PROP],
    transition: 0.35,
    frames: CIRCLE.map(ankleCircle),
  },
  {
    id: "fedb_ankle_on_the_knee",
    slug: "ankle-on-the-knee",
    title: "Ankle On The Knee",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.3,
    // The same move as the Lying Figure Four Stretch (wger_1869).
    frames: [lyingFigureFour(0, 0.5), lyingFigureFour(1, 1.4)],
  },
  {
    id: "wger_1840",
    slug: "lying-hamstring-stretch",
    title: "Bent-Leg Hamstring Stretch",
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { hold: 0.5, pose: kneeToChest(-86) },
      { hold: 1.4, pose: kneeToChest(-113) },
    ],
  },
  {
    id: "wger_1475",
    slug: "plank-knee-to-opposite-elbow",
    title: "Black Widow Knee Slides",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.4,
    frames: [
      { ...crossKnee("near", false) },
      crossKnee("near", true),
      { hold: 0.2, pose: plank(), sideways: {} },
      crossKnee("far", true),
      { ...crossKnee("far", false) },
      crossKnee("far", true),
      { hold: 0.2, pose: plank(), sideways: {} },
      crossKnee("near", true),
    ],
  },
  {
    id: "fedb_chair_leg_extended_stretch",
    slug: "chair-leg-extended-stretch",
    title: "Chair Leg Extended Stretch",
    views: TWO_VIEWS,
    props: CHAIR,
    transition: 1.3,
    frames: [
      { ...chairLeg(14), hold: 0.5 },
      { ...chairLeg(86), hold: 1.4 },
    ],
  },
  {
    id: "wger_1400",
    slug: "crossed-leg-forward-fold",
    title: "Crossbody Hamstring Stretch",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.5,
    frames: [
      { ...crossedFold(40), hold: 0.5 },
      { ...crossedFold(-15), hold: 1.4 },
    ],
  },
  {
    id: "wger_1827",
    slug: "hands-to-knees-press",
    title: "Double-Leg Abdominal Press",
    props: [FLOOR_PROP],
    transition: 0.9,
    frames: [
      { hold: 0.5, pose: tabletop(-90) },
      { hold: 1.1, pose: tabletop(-100) },
    ],
  },
  {
    id: "wger_2615",
    slug: "heel-on-box-hamstring-stretch",
    title: "Elevated Hamstring Stretch",
    props: [HEEL_BOX, FLOOR_PROP],
    transition: 1.4,
    frames: [
      { hold: 0.5, pose: heelOnBox(76) },
      { hold: 1.4, pose: heelOnBox(40) },
    ],
  },
  {
    id: "wger_1398",
    slug: "lying-hamstring-mobility",
    title: "Hamstring Chokes",
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { hold: 0.5, pose: heldHamstring(-100, 0) },
      { hold: 1.2, pose: heldHamstring(-100, 1) },
    ],
  },
  {
    id: "fedb_knee_across_the_body",
    slug: "knee-across-the-body",
    title: "Knee Across The Body",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.4,
    frames: [
      { ...kneeAcross(0), hold: 0.5 },
      { ...kneeAcross(0.5), hold: 0 },
      { ...kneeAcross(1), hold: 1.4 },
    ],
  },
  {
    id: "fedb_knee_circles",
    slug: "knee-circles",
    title: "Knee Circles",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.4,
    frames: CIRCLE.map((phi) => ({ ...kneeCircle(phi), hold: 0 })),
  },
  {
    id: "wger_2617",
    slug: "quad-sets",
    title: "Quad Sets",
    props: [FLOOR_PROP],
    transition: 0.8,
    frames: [
      { hold: 0.6, pose: quadSet(false) },
      { hold: 1.2, pose: quadSet(true) },
    ],
  },
  {
    id: "wger_2687",
    slug: "quadriceps-stretch",
    title: "Quadriceps Stretch",
    props: [QS_WALL, FLOOR_PROP],
    transition: 1.2,
    frames: [
      { hold: 0.5, pose: standingQuad(0) },
      { hold: 1.4, pose: standingQuad(1) },
    ],
  },
];
