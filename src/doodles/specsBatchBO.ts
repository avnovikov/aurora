import { HIP_SIDE, solvePose } from "./rig";
import type { DoodleSpec, Keyframe, Pose, Point, Sideways } from "./rig";
import { solveKeyframe3, sub3, type Point3 } from "./rig3d";
import { TOP_VIEWS } from "./sideways";
import { FLOOR_PROP, along, round, supineTorso } from "./geom";
import { FLAT_ANKLE, LEG_LEN, SEAT_ANKLE } from "./limbs3";

/**
 * Batch BO (#216): partner-assisted contract-relax stretches. The exerciser is
 * drawn first and bright; the partner (paler, behind) shows where the push comes
 * from. Floor at y = 0, up is negative, side view faces +x (lying face up: head
 * at -x). Partners are authored facing +x and reflected (`mirror`) when they
 * face the exerciser. Import only from ./rig and ./geom, never from ./specs.
 */

const THIGH = 88;
const SHIN = 86;
const HIP: Point = [0, -22];

/** Lying face up, arms resting by the hips. */
function lyingBase(): Pose {
  return { ...supineTorso(HIP, 79.6), hands: { near: [26, -4], far: [28, -8] } };
}

/**
 * A partner kneeling (authored facing +x): the pelvis at `[x, y]` (-92 tall,
 * about -50 sitting back on the heels), the chest `lean` degrees forward.
 */
function kneeling(lean: number, x = 0, y = -92): Pose {
  const pelvis: Point = [x, y];
  const reach = Math.sqrt(THIGH ** 2 - (y + 4) ** 2);
  const knee = (dx: number): Point => [round(x + reach + dx), -4];
  return {
    pelvis,
    chest: along(pelvis, -90 + lean, 80),
    knees: { near: { at: knee(0) }, far: { at: knee(0) } },
    feet: { near: [round(knee(0)[0] - SHIN), -4], far: [round(knee(0)[0] - SHIN), -4] },
    toes: { near: 180, far: 180 },
  };
}

/**
 * A partner standing behind and hinged at the hips to reach down (facing +x):
 * pelvis `[x, y]` (-156: knees soft, not a crouch), the feet a little ahead of
 * it under the hips, the chest `lean` degrees forward.
 */
function stooping(lean: number, x: number, y = -156): Pose {
  const pelvis: Point = [x, y];
  return {
    pelvis,
    chest: along(pelvis, -90 + lean, 80),
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [x + 24, 0], far: [x + 18, 0] },
    toes: { near: 0, far: 0 },
  };
}

/**
 * A partner kneeling BESIDE a lying exerciser, on the far side (two views):
 * authored facing +x, then the whole body rolled 90 (`twist`, `hipTwist`) so the
 * chest faces the near side (-z), i.e. the exerciser. Pelvis at side-view x `x`,
 * height `y` (-56: sitting back towards the heels) and sideways `z`; the knees
 * towards the exerciser, the shins flat behind (+z); the spine leans `lean`
 * (sideways units) towards the exerciser, so the head stays beside the body.
 */
function besideKneel(x: number, z: number, lean: number, y = -56): { pose: Pose; sideways: Sideways } {
  const upper: Pose = { pelvis: [x, y], chest: [x, y - 80] };
  const trunk: Sideways = { pelvis: z, chest: z - lean, twist: 90, hipTwist: 90 };
  // The leaned, rolled hips: each knee straight down under its hip (y -4) and
  // a little towards the exerciser, the shin flat on the floor behind it.
  const hips = solveKeyframe3(solvePose(upper), upper, trunk).legs;
  const knee = (side: "near" | "far"): Point3 => {
    const [hx, hy, hz] = hips[side].root;
    return [round(hx), -4, round(hz - Math.sqrt(THIGH ** 2 - (hy + 4) ** 2) + 0.5)];
  };
  const kn = knee("near");
  const kf = knee("far");
  return {
    pose: {
      ...upper,
      knees: { near: { at: [kn[0], kn[1]] }, far: { at: [kf[0], kf[1]] } },
      feet: { near: [kn[0], -4], far: [kf[0], -4] },
    },
    sideways: {
      ...trunk,
      knees: { near: { at: kn[2] }, far: { at: kf[2] } },
      feet: { near: round(kn[2] + SHIN - 0.5), far: round(kf[2] + SHIN - 0.5) },
    },
  };
}

// ---------------------------------------------------------------- lying hamstring

function lyingHamstring(deg: number): Pose {
  return {
    ...lyingBase(),
    feet: { near: along(HIP, deg, LEG_LEN), far: FLAT_ANKLE },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    toes: { far: -80 },
  };
}

// ---------------------------------------------------------------- lying glute

const GLUTE_FAR_FOOT: Point = [66, -4];
/** The middle of the far thigh, where the crossed ankle sits. */
const GLUTE_SEAT: Point3 = [30, -70, 8];

/**
 * Figure-four on the back, side + top view: the near knee out to the near side
 * (`kneeY`, `kneeZ`), the ankle across the body on the far thigh, the far
 * knee bent with the foot flat.
 */
function lyingGlute(kneeY: number, kneeZ: number): Keyframe {
  const dy = kneeY + 22;
  const dz = kneeZ + HIP_SIDE;
  const knee: Point3 = [round(Math.sqrt(THIGH ** 2 - dy * dy - dz * dz)), kneeY, kneeZ];
  const to = sub3(GLUTE_SEAT, knee);
  const n = Math.hypot(...to);
  const ankle: Point3 = [round(knee[0] + (to[0] / n) * SHIN), round(knee[1] + (to[1] / n) * SHIN), round(knee[2] + (to[2] / n) * SHIN)];
  return {
    hold: 0,
    pose: {
      ...lyingBase(),
      knees: { near: { at: [knee[0], knee[1]] }, far: { bend: -1 } },
      feet: { near: [ankle[0], ankle[1]], far: GLUTE_FAR_FOOT },
      toes: { near: -60, far: 0 },
    },
    sideways: { knees: { near: { at: knee[2] } }, feet: { near: ankle[2], far: 8 }, hands: { near: -28, far: 28 } },
  };
}

// ---------------------------------------------------------------- lying crossover

/**
 * Lying crossover (side + top view): face up, the near knee bent and crossed
 * over the body to the far side, the hips rolled after it (`roll`, the near hip
 * up) while the shoulders stay flat. `lift`: the knee's height above the floor.
 * The near foot rests by the straight far leg.
 */
function crossover(roll: number, lift: number): Keyframe {
  const base = lyingBase();
  const trunk: Sideways = { hipTwist: -roll, hands: { near: -28, far: 28 } };
  const upper: Pose = { pelvis: base.pelvis, chest: base.chest, head: base.head, spine: base.spine };
  const [hx, hy, hz] = solveKeyframe3(solvePose(upper), upper, trunk).legs.near.root;
  const kneeY = -6 - lift;
  // Knee across the body, `KNEE_X` ahead of the hip, at the thigh's length.
  const KNEE_X = 40;
  const knee: Point3 = [round(hx + KNEE_X), kneeY, round(hz + Math.sqrt(THIGH ** 2 - KNEE_X ** 2 - (kneeY - hy) ** 2))];
  // Shin back and down towards the far leg's knee, the foot resting on the floor.
  const ankle = toward3(knee, [round(knee[0] + 30), -8, 10], SHIN);
  // The far leg straight along the floor from its (rolled, lower) hip.
  const [fx, fy, fz] = solveKeyframe3(solvePose(upper), upper, trunk).legs.far.root;
  const farFoot: Point = [round(fx + Math.sqrt((LEG_LEN - 0.4) ** 2 - (fy + 8) ** 2)), -8];
  return {
    hold: 0,
    pose: {
      ...base,
      knees: { near: { at: [knee[0], knee[1]] }, far: { bend: -1 } },
      feet: { near: [ankle[0], ankle[1]], far: farFoot },
      toes: { near: 0, far: -80 },
    },
    sideways: { ...trunk, knees: { near: { at: knee[2] } }, feet: { near: ankle[2], far: round(fz) } },
  };
}

// ---------------------------------------------------------------- lying prone quadriceps

const PRONE_PELVIS: Point = [0, -14];
const PRONE_KNEE: Point = [-88, -10];

/** Face down, head to +x, arms straight back along the sides; the near knee on the floor with the shin folded up (`fold` degrees: -90 straight up, -45 heel towards the glute). */
function prone(fold: number): Pose {
  return {
    pelvis: PRONE_PELVIS,
    chest: [80, -16],
    head: [135.1, -26],
    spine: { bend: -1 },
    hands: { near: [-14, -6], far: [-12, -9] },
    knees: { near: { at: PRONE_KNEE }, far: { bend: -1 } },
    feet: { near: along(PRONE_KNEE, fold, SHIN), far: [-173, -8] },
    toes: { near: fold + 10, far: 180 },
  };
}

// ---------------------------------------------------------------- lying on the back, knees dropping out / across (side + top view)

/** Butterfly on the back: soles together, knees up and out to the sides (`az` degrees from straight ahead, `lift` above the hips). */
function lyingGroin(az: number, lift: number): Keyframe {
  const flat = Math.sqrt(THIGH ** 2 - lift ** 2);
  const kneeX = round(flat * Math.cos((az * Math.PI) / 180));
  const kneeZ = round(HIP_SIDE + flat * Math.sin((az * Math.PI) / 180));
  const kneeY = round(-22 - lift);
  const dy = -8 - kneeY;
  const dz = kneeZ - 3;
  const footX = round(kneeX - Math.sqrt(Math.max(0, SHIN ** 2 - dy * dy - dz * dz)));
  return {
    hold: 0,
    pose: {
      ...lyingBase(),
      knees: { near: { at: [kneeX, kneeY] }, far: { at: [kneeX, kneeY] } },
      feet: { near: [footX, -8], far: [footX, -8] },
      toes: { near: -90, far: -90 },
    },
    sideways: { knees: { near: { at: -kneeZ }, far: { at: kneeZ } }, feet: { near: -3, far: 3 }, hands: { near: -28, far: 28 } },
  };
}

// ---------------------------------------------------------------- seated on the floor, a partner standing behind

const SEAT: Point = [0, -10];
/** Shoulder of the seated figure, `lean` degrees up from the floor. */
const seatedShoulder = (lean: number): Point => along(SEAT, -lean, 98);

/** Sitting with the knees bent and the feet flat (`lean`: the torso's angle from the floor). */
function seatedKnees(lean: number): Pose {
  return {
    pelvis: SEAT,
    chest: along(SEAT, -lean, 80),
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: [80, -4], far: [76, -4] },
    toes: { near: 0, far: 0 },
  };
}

// seated biceps: arms straight back, palms facing each other, the partner lifting the wrists

function seatedBiceps(deg: number): Pose {
  const hand = along(seatedShoulder(88), deg, 125.5);
  return { ...seatedKnees(88), hands: { near: hand, far: along(hand, deg, -3) } };
}

// overhead triceps: elbow up beside the head, the hand down the back

function overheadTriceps(elbowDeg: number, forearmDeg: number): Pose {
  const shoulder = seatedShoulder(90);
  const elbow = along(shoulder, elbowDeg, 60);
  return {
    pelvis: SEAT,
    chest: along(SEAT, -90, 80),
    head: [18, -143],
    hands: { near: along(elbow, forearmDeg, 66), far: [34, -32] },
    elbows: { near: { at: elbow }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: SEAT_ANKLE, far: [SEAT_ANKLE[0] - 2, -8] },
    toes: { near: -84, far: -84 },
  };
}

// seated hamstring: legs straight, folding forward, the partner's hands on the shoulders

function seatedHamstring(lean: number, reach: number): Pose {
  return {
    pelvis: SEAT,
    chest: along(SEAT, -lean, 80),
    hands: { near: [reach, -26], far: [reach - 3, -28] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    feet: { near: SEAT_ANKLE, far: [SEAT_ANKLE[0] - 2, -8] },
    toes: { near: -84, far: -84 },
  };
}

// seated glute (side + top view): figure-four, the near ankle on the far knee, the near knee out to the side

const FOUR_FOOT: Point = [80, -4];
const FOUR_KNEE_Z = 70;

/** A point `length` from `from` towards `to`. */
function toward3(from: Point3, to: Point3, length: number): Point3 {
  const d = sub3(to, from);
  const n = Math.hypot(...d);
  return [round(from[0] + (d[0] / n) * length), round(from[1] + (d[1] / n) * length), round(from[2] + (d[2] / n) * length)];
}

function seatedGlute(lean: number): Keyframe {
  const farKnee = solvePose({ pelvis: SEAT, feet: { far: FOUR_FOOT }, knees: { far: { bend: -1 } } }).legs.far.mid;
  const nearKneeY = -30;
  const nearKneeX = round(Math.sqrt(THIGH ** 2 - (nearKneeY - SEAT[1]) ** 2 - (FOUR_KNEE_Z - HIP_SIDE) ** 2));
  const nearKnee: Point3 = [nearKneeX, nearKneeY, -FOUR_KNEE_Z];
  const ankle = toward3(nearKnee, [farKnee[0], round(farKnee[1] - 6), 6], SHIN);
  return {
    hold: 0,
    pose: {
      pelvis: SEAT,
      chest: along(SEAT, -lean, 80),
      hands: { near: [96, -16], far: [98, -18] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { at: [nearKneeX, nearKneeY] }, far: { bend: -1 } },
      feet: { near: [ankle[0], ankle[1]], far: FOUR_FOOT },
      toes: { near: -60, far: 0 },
    },
    sideways: {
      knees: { near: { at: -FOUR_KNEE_Z } },
      feet: { near: ankle[2], far: 8 },
      hands: { near: -30, far: 30 },
    },
  };
}

// seated front deltoid (side + top view): arms out to the sides and back, the partner drawing the wrists back

function seatedDeltoid(back: number): Keyframe {
  const L = 122;
  const r = (back * Math.PI) / 180;
  const shoulder = seatedShoulder(90);
  const hand: Point = [round(shoulder[0] - L * Math.sin(r)), round(shoulder[1] + 6)];
  const z = round(22 + L * Math.cos(r));
  return {
    hold: 0,
    pose: {
      pelvis: SEAT,
      chest: along(SEAT, -90, 80),
      hands: { near: hand, far: hand },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      feet: { near: [80, -4], far: [76, -4] },
      toes: { near: 0, far: 0 },
    },
    sideways: { hands: { near: -z, far: z }, feet: { near: -12, far: 12 } },
  };
}

// ---------------------------------------------------------------- the specs

export const BATCH_BO_SPECS: DoodleSpec[] = [
  {
    id: "fedb_lying_hamstring",
    slug: "lying-hamstring",
    title: "Lying Hamstring",
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { hold: 0.6, pose: lyingHamstring(-72) },
      { hold: 1.4, pose: lyingHamstring(-100) },
    ],
    partner: {
      mirror: 60,
      holds: [
        { hand: "near", on: "ankle.near" },
        { hand: "far", on: "knee.near" },
      ],
      frames: [{ pose: kneeling(5) }, { pose: kneeling(28) }],
    },
  },
  {
    id: "fedb_lying_glute",
    slug: "lying-glute",
    title: "Lying Glute",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { ...lyingGlute(-78, -36), hold: 0.6 },
      { ...lyingGlute(-104, -26), hold: 1.4 },
    ],
    partner: {
      holds: [
        { hand: "near", on: "knee.near" },
        { hand: "far", on: "ankle.near" },
      ],
      frames: [besideKneel(50, 126, 48), besideKneel(48, 126, 46)],
    },
  },
  {
    id: "fedb_lying_crossover",
    slug: "lying-crossover",
    title: "Lying Crossover",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { ...crossover(35, 44), hold: 0.6 },
      { ...crossover(50, 22), hold: 1.4 },
    ],
    partner: {
      holds: [
        { hand: "near", on: "shoulder.near" },
        { hand: "far", on: "knee.near" },
      ],
      frames: [besideKneel(-60, 136, 62, -50), besideKneel(-60, 136, 64, -50)],
    },
  },
  {
    id: "fedb_lying_prone_quadriceps",
    slug: "lying-prone-quadriceps",
    title: "Lying Prone Quadriceps",
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { hold: 0.6, pose: prone(-84) },
      { hold: 1.4, pose: prone(-48) },
    ],
    partner: {
      holds: [
        { hand: "near", on: "ankle.near" },
        { hand: "far", on: "knee.near" },
      ],
      frames: [{ pose: kneeling(50, -178, -50) }, { pose: kneeling(56, -178, -50) }],
    },
  },
  {
    id: "fedb_lying_bent_leg_groin",
    slug: "lying-bent-leg-groin",
    title: "Lying Bent Leg Groin",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { ...lyingGroin(50, 34), hold: 0.6 },
      { ...lyingGroin(58, 18), hold: 1.4 },
    ],
    partner: {
      mirror: 75,
      holds: [
        { hand: "near", on: "knee.near" },
        { hand: "far", on: "knee.far" },
      ],
      frames: [{ pose: kneeling(65, 0, -55) }, { pose: kneeling(68, 0, -55) }],
    },
  },
  {
    id: "fedb_seated_biceps",
    slug: "seated-biceps",
    title: "Seated Biceps",
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { hold: 0.6, pose: seatedBiceps(158) },
      { hold: 1.4, pose: seatedBiceps(172) },
    ],
    partner: {
      holds: [
        { hand: "near", on: "wrist.near" },
        { hand: "far", on: "wrist.far" },
      ],
      frames: [{ pose: stooping(78, -205) }, { pose: stooping(72, -212) }],
    },
  },
  {
    id: "fedb_overhead_triceps",
    slug: "overhead-triceps",
    title: "Overhead Triceps",
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { hold: 0.6, pose: overheadTriceps(-108, 95) },
      { hold: 1.4, pose: overheadTriceps(-118, 92) },
    ],
    partner: {
      holds: [
        { hand: "near", on: "elbow.near" },
        { hand: "far", on: "wrist.near" },
      ],
      frames: [{ pose: kneeling(12, -88) }, { pose: kneeling(14, -90) }],
    },
  },
  {
    id: "fedb_seated_hamstring",
    slug: "seated-hamstring",
    title: "Seated Hamstring",
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { hold: 0.6, pose: seatedHamstring(48, 120) },
      { hold: 1.4, pose: seatedHamstring(33, 140) },
    ],
    partner: {
      holds: [
        { hand: "near", on: "shoulder.near" },
        { hand: "far", on: "shoulder.far" },
      ],
      frames: [{ pose: stooping(76, -52) }, { pose: stooping(82, -50) }],
    },
  },
  {
    id: "fedb_seated_glute",
    slug: "seated-glute",
    title: "Seated Glute",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { ...seatedGlute(70), hold: 0.6 },
      { ...seatedGlute(52), hold: 1.4 },
    ],
    partner: {
      holds: [
        { hand: "near", on: "shoulder.near" },
        { hand: "far", on: "shoulder.far" },
      ],
      frames: [{ pose: stooping(56, -47, -150) }, { pose: stooping(62, -40, -150) }],
    },
  },
  {
    id: "fedb_seated_front_deltoid",
    slug: "seated-front-deltoid",
    title: "Seated Front Deltoid",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [
      { ...seatedDeltoid(45), hold: 0.6 },
      { ...seatedDeltoid(65), hold: 1.4 },
    ],
    partner: {
      holds: [
        { hand: "near", on: "wrist.near" },
        { hand: "far", on: "wrist.far" },
      ],
      frames: [{ pose: stooping(72, -179) }, { pose: stooping(70, -200) }],
    },
  },
];
