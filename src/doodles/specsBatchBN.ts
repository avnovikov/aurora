import { FLOOR_PROP, along, round, supineTorso } from "./geom";
import { BONES, resolveSideways, solvePose } from "./rig";
import type { AuthoredPose, DoodleSpec, Keyframe, Point, Side, Sideways } from "./rig";
import { solveKeyframe3, sub3, type Point3 } from "./rig3d";
import { SIDE_LYING_FLOOR, sideLying } from "./specsWarmup";
import { TOP_VIEWS, TWO_VIEWS } from "./sideways";
import { FLAT_ANKLE, LEG_LEN, SEAT_ANKLE } from "./limbs3";

/**
 * Batch BN: towel and stick moves. Floor at y = 0, up is negative, the figure
 * faces +x (lying face up has the head at -x, face down the head at +x). Stick
 * moves are drawn in two views (a stick is end-on from the side); the grip is
 * 140 wide (z = +-70) on every keyframe so the stick keeps its length. Towel
 * stretches loop the towel round the sole of one foot; the hands sit on the line
 * from each shoulder to that sole, `slack` short of it, so the towel keeps its
 * length as the leg moves.
 * Import only from ./rig and other batch files, never from ./specs.
 */

/** The ball of the foot, where the towel crosses the sole (see TOWEL_WRAP). */
const WRAP = 0.55;

const mix3 = (a: readonly number[], b: readonly number[], t: number): number[] => a.map((v, i) => v + (b[i] - v) * t);

/**
 * Pin both hands on the towel: each on the line from its shoulder to the sole of
 * `foot`, `slack` short of it (hands in the same z as that shoulder-sole line when
 * `sideways` is given, so the 3D towel length holds).
 */
function towelled(pose: AuthoredPose, foot: Side, slack: number, sideways?: Sideways, handZ?: Record<Side, number>): Keyframe {
  const resolved = resolveSideways(pose, sideways ?? {});
  const spine = solvePose(resolved);
  const fig = sideways ? solveKeyframe3(spine, resolved, sideways) : undefined;
  const limbs = fig ?? spine;
  const dim = (p: readonly number[]): number[] => (fig ? [...p] : [p[0], p[1], 0]);
  const sole = mix3(dim(limbs.legs[foot].joint), dim(limbs.legs[foot].end), WRAP);
  const hands = {} as Record<Side, Point>;
  const zs = {} as Record<Side, number>;
  for (const side of ["near", "far"] as Side[]) {
    const shoulder = dim(limbs.arms[side].root);
    const d = Math.hypot(sole[0] - shoulder[0], sole[1] - shoulder[1], sole[2] - shoulder[2]);
    let p: number[];
    if (handZ) {
      // The hand at its own z: `slack` from the sole in 3D, on the shoulder-sole line as drawn from the side.
      const run = Math.sqrt(Math.max(0, slack ** 2 - (sole[2] - handZ[side]) ** 2));
      const flat = Math.hypot(shoulder[0] - sole[0], shoulder[1] - sole[1]);
      p = [sole[0] + ((shoulder[0] - sole[0]) / flat) * run, sole[1] + ((shoulder[1] - sole[1]) / flat) * run, handZ[side]];
    } else {
      const t = Math.max(0.1, (d - slack) / d);
      p = mix3(shoulder, sole, t);
    }
    hands[side] = [round(p[0]), round(p[1])];
    zs[side] = round(p[2]);
  }
  return {
    hold: 0,
    pose: { ...pose, hands },
    ...(sideways ? { sideways: { ...sideways, hands: zs } } : {}),
  };
}

// ---------------------------------------------------------------- lying on the back (head at -x)

const SUPINE_PELVIS: Point = [0, -22];
/** The other leg flat on the floor: ankle just above it, toes up. */

/** Face up, the near leg straight at `deg` (-90 = up, beyond that towards the head), the towel round its foot. */
function supineHamstring(deg: number): Keyframe {
  return towelled(
    {
      ...supineTorso(SUPINE_PELVIS, 79.6),
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      feet: { near: along(SUPINE_PELVIS, deg, LEG_LEN), far: FLAT_ANKLE },
      toes: { near: deg - 80, far: -85 },
    },
    "near",
    100,
  );
}

/** Face up, the near leg straight, `abd` degrees from vertical out to the side (negative z: the near side) or across the body (`across`), the towel round its foot. */
function supineSide(abd: number, across: boolean): Keyframe {
  const r = (abd * Math.PI) / 180;
  const dir = [-0.08, -Math.cos(r), (across ? 1 : -1) * Math.sin(r)];
  const n = Math.hypot(...dir);
  const foot: Point = [round(SUPINE_PELVIS[0] + (LEG_LEN * dir[0]) / n), round(SUPINE_PELVIS[1] + (LEG_LEN * dir[1]) / n)];
  const footZ = round(-8 + (LEG_LEN * dir[2]) / n);
  return towelled(
    {
      ...supineTorso(SUPINE_PELVIS, 79.6),
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      feet: { near: foot, far: FLAT_ANKLE },
      toes: { near: -170, far: -85 },
    },
    "near",
    100,
    { pelvis: 0, feet: { near: footZ, far: 8 } },
  );
}

// ---------------------------------------------------------------- seated (floor, facing +x)

const SEAT_PELVIS: Point = [0, -10];

/** Sitting with both legs out, the near foot in the towel; `lean` is the torso's angle from the floor, `toes` the foot's (-90 upright). */
function seatedHamstringCalf(lean: number, toes: number): Keyframe {
  return towelled(
    {
      pelvis: SEAT_PELVIS,
      chest: along(SEAT_PELVIS, -lean, 80),
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      feet: { near: SEAT_ANKLE, far: [SEAT_ANKLE[0] - 2, -8] },
      toes: { near: toes, far: -80 },
    },
    "near",
    75,
  );
}

/**
 * Sitting tall, near leg out with the heel a little off the floor, far knee bent with the foot flat.
 * The towel round the foot is pulled to the side (`pullZ`: + towards the far side, across the body; - to the near side),
 * turning the sole in (+) or out (-).
 */
function seatedFoot(heel: number, pullZ: number): Keyframe {
  return towelled(
    {
      pelvis: SEAT_PELVIS,
      chest: along(SEAT_PELVIS, -66, 80),
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      feet: { near: along(SEAT_PELVIS, -heel, LEG_LEN), far: [74, -4] },
      toes: { near: -70 - heel, far: 0 },
    },
    "near",
    75,
    { pelvis: 0, hands: {}, feet: { near: -8, far: 22 }, knees: { far: { at: 14 } } },
    { near: pullZ, far: pullZ },
  );
}

// ---------------------------------------------------------------- standing hamstring and calf

/** Front foot forward, heel down, toes up and the leg straight; the back knee bent under the hips; the torso hinged `lean` degrees above the horizontal. */
function standingStretch(lean: number): Keyframe {
  const front: Point = [118, -8];
  const pelvis = along(front, -118, LEG_LEN);
  return towelled(
    {
      pelvis,
      chest: along(pelvis, -lean, 80),
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { bend: -1 }, far: { bend: -1 } },
      feet: { near: front, far: [-10, 0] },
      toes: { near: -50, far: 0 },
    },
    "near",
    120,
  );
}

// ---------------------------------------------------------------- face down (head at +x)

const PRONE_PELVIS: Point = [-20, -14];

/**
 * Face down, the near knee bent with the foot in the towel, both hands over the shoulders holding it.
 * `lift` (0..1) pulls the heel in towards the glute and lifts the knee a little off the floor.
 */
function proneQuad(lift: number): Keyframe {
  const pelvis = PRONE_PELVIS;
  const spine = -9;
  const chest = along(pelvis, spine, 80);
  const head = along(along(chest, spine, 20), spine + 10, 36);
  const thigh = 175 + 14 * lift;
  const knee = along(pelvis, thigh, 88);
  const shin = -88 + 36 * lift;
  const foot = along(knee, shin, 86);
  return towelled(
    {
      pelvis,
      chest,
      head,
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
      knees: { near: { at: knee }, far: { at: along(pelvis, 181, 88) } },
      feet: { near: foot, far: along(pelvis, 181, 173.9) },
      toes: { near: shin + 25, far: 181 },
    },
    "near",
    90,
  );
}

// ---------------------------------------------------------------- side-lying quad stretch (side + top, head at -x)

const reach3 = (from: Point3, d: Point3, length: number): Point3 => {
  const n = Math.hypot(d[0], d[1], d[2]);
  return [round(from[0] + (d[0] / n) * length), round(from[1] + (d[1] / n) * length), round(from[2] + (d[2] / n) * length)];
};
const toward3 = (from: Point3, to: Point3, length: number): Point3 => reach3(from, sub3(to, from), length);

/**
 * Lying on the side, the front towards the side panel's camera (forward = -z), so the view from above shows the fold:
 * the bottom knee bent forward, the top thigh in line with the trunk and the top shin folded back behind it with the
 * heel `heelX` from the hip, towelled; both hands hold the towel up by the head.
 */
function sideQuad(heelX: number, heelBehind: number): Keyframe {
  const hipBottom: Point3 = [0, -30, -8];
  const hipTop: Point3 = [0, -30, 8];
  const kneeBottom = reach3(hipBottom, [0.04, 0.18, -1], BONES.thigh);
  const footBottom = reach3(kneeBottom, [1, 0.02, 0.06], BONES.shin);
  const kneeTop = reach3(hipTop, [1, -0.1, 0.06], BONES.thigh);
  const ankle = toward3(kneeTop, [heelX, -48, heelBehind], BONES.shin);
  const flat = (p: Point3): Point => [p[0], p[1]];
  return towelled(
    sideLying({
      knees: { near: { at: flat(kneeBottom) }, far: { at: flat(kneeTop) } },
      feet: { near: flat(footBottom), far: flat(ankle) },
      toes: { near: 0, far: -150 },
      elbows: { near: { bend: -1 }, far: { bend: -1 } },
    }),
    "far",
    85,
    {
      pelvis: 0,
      knees: { near: { at: kneeBottom[2] }, far: { at: kneeTop[2] } },
      feet: { near: footBottom[2], far: ankle[2] },
    },
  );
}

// ---------------------------------------------------------------- towel superman (face down, side + front)

const TOWEL_Z = 50;
const SUPERMAN_LEG = 184;

/** Face down, the chest and arms lifted, a taut towel between the hands (grip fixed at 2 x TOWEL_Z); `hand` is where both hands are (side view). */
function towelSuperman(spine: number, hand: Point, out: number): Keyframe {
  const pelvis = PRONE_PELVIS;
  const chest = along(pelvis, spine, 80);
  const head = along(along(chest, spine, 20), spine + 8, 36);
  const foot = along(pelvis, SUPERMAN_LEG, 173.9);
  const knee = along(pelvis, SUPERMAN_LEG, 88);
  return {
    hold: 0,
    pose: {
      pelvis,
      chest,
      head,
      hands: { near: hand, far: hand },
      elbows: { near: { bend: -1 }, far: { bend: -1 } },
      knees: { near: { at: knee }, far: { at: knee } },
      feet: { near: foot, far: foot },
      toes: { near: SUPERMAN_LEG, far: SUPERMAN_LEG },
    },
    sideways: {
      hands: { near: -TOWEL_Z, far: TOWEL_Z },
      elbows: { near: { out }, far: { out } },
      knees: { near: { at: -8 }, far: { at: 8 } },
      feet: { near: -8, far: 8 },
    },
  };
}

// ---------------------------------------------------------------- standing stick arcs (two views)

/** Both hands hold the stick 140 apart (z = +-70) on every keyframe. */
const GRIP_Z = 70;
/** In-plane reach of a straight arm whose hand sits GRIP_Z out from a shoulder 22 out. */
const ARM_REACH = Math.sqrt(125.5 ** 2 - (GRIP_Z - 22) ** 2);
const STICK_SIDEWAYS: Sideways = { hands: { near: -GRIP_Z, far: GRIP_Z } };

/** Standing tall, the straight arms swung to `deg` about the shoulder (90 = down, 0 = forward, -90 = overhead, 180 = behind); `lean` tilts the trunk (+ forward). */
function stickArc(deg: number, hold: number, lean = 0): Keyframe {
  const pelvis: Point = [0, -170];
  const shoulder = along(pelvis, -90 + lean, 98);
  const hand = along(shoulder, deg, ARM_REACH);
  return {
    hold,
    pose: {
      pelvis,
      chest: along(pelvis, -90 + lean, 80),
      hands: { near: hand, far: hand },
      feet: { near: [-4, 0], far: [4, 0] },
      toes: { near: 0, far: 0 },
    },
    sideways: STICK_SIDEWAYS,
  };
}

/** The arc out and back: each step of `degs` once forwards, then reversed (the end points held longer). */
function there(degs: [number, number][], first: number, last: number): Keyframe[] {
  const holdAt = (i: number): number => {
    if (i === 0) return first;
    return i === degs.length - 1 ? last : 0.05;
  };
  const out = degs.map(([d, lean], i) => stickArc(d, holdAt(i), lean));
  return [...out, ...out.slice(1, -1).reverse()];
}

export const BATCH_BN_SPECS: DoodleSpec[] = [
  {
    id: "fedb_hamstring_stretch",
    slug: "hamstring-stretch",
    title: "Hamstring Stretch",
    props: [FLOOR_PROP],
    towel: { around: "near-foot" },
    transition: 1.2,
    frames: [
      { ...supineHamstring(-78), hold: 0.5 },
      { ...supineHamstring(-100), hold: 1.4 },
    ],
  },
  {
    id: "fedb_intermediate_groin_stretch",
    slug: "lying-groin-stretch-with-towel",
    title: "Intermediate Groin Stretch",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    towel: { around: "near-foot" },
    transition: 1.2,
    frames: [
      { ...supineSide(14, false), hold: 0.5 },
      { ...supineSide(50, false), hold: 1.4 },
    ],
  },
  {
    id: "fedb_it_band_and_glute_stretch",
    slug: "lying-it-band-stretch-with-towel",
    title: "IT Band and Glute Stretch",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    towel: { around: "near-foot" },
    transition: 1.2,
    frames: [
      { ...supineSide(14, true), hold: 0.5 },
      { ...supineSide(48, true), hold: 1.4 },
    ],
  },
  {
    id: "fedb_seated_hamstring_and_calf_stretch",
    slug: "seated-hamstring-calf-stretch-with-towel",
    title: "Seated Hamstring and Calf Stretch",
    props: [FLOOR_PROP],
    towel: { around: "near-foot" },
    transition: 1.1,
    frames: [
      { ...seatedHamstringCalf(70, -92), hold: 0.5 },
      { ...seatedHamstringCalf(40, -102), hold: 1.4 },
    ],
  },
  {
    id: "fedb_peroneals_stretch",
    slug: "peroneals-stretch-with-towel",
    title: "Peroneals Stretch",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    towel: { around: "near-foot" },
    transition: 1.1,
    frames: [
      { ...seatedFoot(2, -2), hold: 0.5 },
      { ...seatedFoot(8, 44), hold: 1.4 },
    ],
  },
  {
    id: "fedb_posterior_tibialis_stretch",
    slug: "posterior-tibialis-stretch-with-towel",
    title: "Posterior Tibialis Stretch",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    towel: { around: "near-foot" },
    transition: 1.1,
    frames: [
      { ...seatedFoot(2, -14), hold: 0.5 },
      { ...seatedFoot(8, -48), hold: 1.4 },
    ],
  },
  {
    id: "fedb_standing_hamstring_and_calf_stretch",
    slug: "standing-hamstring-calf-stretch-with-towel",
    title: "Standing Hamstring and Calf Stretch",
    props: [FLOOR_PROP],
    towel: { around: "near-foot" },
    transition: 1.2,
    frames: [
      { ...standingStretch(58), hold: 0.5 },
      { ...standingStretch(34), hold: 1.4 },
    ],
  },
  {
    id: "fedb_intermediate_hip_flexor_and_quad_stretch",
    slug: "prone-quad-stretch-with-towel",
    title: "Intermediate Hip Flexor and Quad Stretch",
    props: [FLOOR_PROP],
    towel: { around: "near-foot" },
    transition: 1.2,
    frames: [
      { ...proneQuad(0), hold: 0.5 },
      { ...proneQuad(1), hold: 1.4 },
    ],
  },
  {
    id: "fedb_quad_stretch",
    slug: "side-lying-quad-stretch-with-towel",
    title: "Quad Stretch",
    views: TOP_VIEWS,
    props: [SIDE_LYING_FLOOR],
    towel: { around: "far-foot" },
    transition: 1.2,
    frames: [
      { ...sideQuad(54, 60), hold: 0.5 },
      { ...sideQuad(34, 40), hold: 1.4 },
    ],
  },
  {
    id: "wger_1455",
    slug: "towel-superman",
    title: "Towel Superman",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    towel: {},
    transition: 0.9,
    frames: [
      { ...towelSuperman(-16, [194, -52], 0), hold: 0.4 },
      { ...towelSuperman(-20, [120, -125], 40), hold: 0.1 },
      { ...towelSuperman(-22, [44, -100], 75), hold: 0.5 },
      { ...towelSuperman(-20, [120, -125], 40), hold: 0.1 },
    ],
  },
  {
    id: "hf_151",
    slug: "shoulder-dislocate",
    title: "Shoulder Dislocate",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    stick: {},
    transition: 0.3,
    frames: there(
      [70, 40, 10, -20, -50, -80, -110, -140, -170, 160, 135, 118].map((d) => [d, 0] as [number, number]),
      0.4,
      0.7,
    ),
  },
  {
    id: "fedb_chest_and_front_of_shoulder_stretch",
    slug: "stick-chest-and-shoulder-stretch",
    title: "Chest And Front Of Shoulder Stretch",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    stick: {},
    transition: 0.4,
    frames: there(
      [[70, 0], [35, 0], [0, 0], [-35, 0], [-70, 0], [-100, -2], [-125, -4], [-150, -6], [-162, -8]],
      0.4,
      1.2,
    ),
  },
  {
    id: "fedb_round_the_world_shoulder_stretch",
    slug: "round-the-world-shoulder-stretch",
    title: "Round The World Shoulder Stretch",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    stick: {},
    transition: 0.6,
    frames: there(
      [[112, 0], [128, 0], [142, 0], [154, 0]],
      0.5,
      1.2,
    ),
  },
];
