import { BONES, HIP_SIDE, solvePose, zOut } from "./rig";
import type { AuthoredPose, DoodleSpec, Keyframe, Point, Pose, Prop, Side, Sideways } from "./rig";
import { add3, scale3, type Point3 } from "./rig3d";
import { TOP_VIEWS, TWO_VIEWS } from "./sideways";
import { FLOOR_PROP, along, lerp, round, supineTorso } from "./geom";
import { LEG_LEN } from "./limbs3";

/**
 * Batch BD (#216): hip and glute stretches. Floor at y = 0, up is negative, the
 * side-view figure faces +x (lying face up has the head at -x). Import only from
 * ./rig, ./geom and other batch files, never from ./specs.
 */

const THIGH = BONES.thigh;
const SHIN = BONES.shin;

// ---------------------------------------------------------------- half-kneeling (hip flexor stretches)

const BACK_KNEE: Point = [-30, -3];
const BACK_FOOT: Point = [-116, -3];

/** Pelvis over a back knee that stays down: height from the 88-long thigh. */
function kneelingPelvis(pelvisX: number): Point {
  return [pelvisX, -(round(Math.sqrt(THIGH * THIGH - (pelvisX - BACK_KNEE[0]) ** 2)) + 3)];
}

/** Hands on the hips (elbows out behind), torso tall, back shin on the floor, front foot flat. */
function halfKneeling(pelvisX: number, hands: "hips" | "knee" | "sides"): Pose {
  const pelvis = kneelingPelvis(pelvisX);
  const chest: Point = [pelvis[0] - 4, pelvis[1] - 80];
  const frontFoot: Point = [pelvis[0] + 86, 0];
  const handsByStyle = {
    hips: { near: [pelvis[0] + 6, pelvis[1] - 6] as Point, far: [pelvis[0] + 2, pelvis[1] - 8] as Point },
    knee: { near: [pelvis[0] + 64, pelvis[1] + 6] as Point, far: [pelvis[0] + 60, pelvis[1] + 8] as Point },
    sides: { near: [pelvis[0] + 8, pelvis[1] + 36] as Point, far: [pelvis[0] + 4, pelvis[1] + 38] as Point },
  };
  const handsAt = handsByStyle[hands];
  return {
    pelvis,
    chest,
    hands: handsAt,
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { at: BACK_KNEE } },
    feet: { near: frontFoot, far: BACK_FOOT },
    toes: { near: 0, far: 180 },
  };
}

// ---------------------------------------------------------------- rear-foot-elevated hip flexor stretch

const BENCH_TOP = -46;
const BENCH: Prop = { kind: "box", x: -270, y: BENCH_TOP, w: 182, h: -BENCH_TOP };
const REF_KNEE: Point = [-30, -3];
const REF_ANKLE: Point = [round(REF_KNEE[0] - Math.sqrt(SHIN * SHIN - (BENCH_TOP - 12 - REF_KNEE[1]) ** 2)), BENCH_TOP - 12];

/** Back foot's laces on the bench, back knee on a pad, torso stacked over it. */
function rearElevated(pelvisX: number): Pose {
  const pelvis = kneelingPelvis(pelvisX);
  return {
    pelvis,
    chest: [pelvis[0] - 4, pelvis[1] - 80],
    hands: { near: [pelvis[0] + 6, pelvis[1] - 6], far: [pelvis[0] + 2, pelvis[1] - 8] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { at: REF_KNEE } },
    feet: { near: [pelvis[0] + 86, 0], far: REF_ANKLE },
    toes: { near: 0, far: 180 },
  };
}

// ---------------------------------------------------------------- leg and hip stretch (lunge, then hamstring fold)

/** Hips back over the back knee, front leg straight on its heel with the toes up, back flat and hinged forward over it. */
function lungeFold(lean: number): Pose {
  const pelvis: Point = [-34, -(THIGH + 3)];
  const heelY = -8;
  const frontAnkle: Point = [round(pelvis[0] + Math.sqrt(LEG_LEN * LEG_LEN - (pelvis[1] - heelY) ** 2)), heelY];
  const chest = along(pelvis, -lean, 80);
  const shoulder = along(pelvis, -lean, 98);
  // Hands rest on the straight leg, as far along it as the arms reach.
  const onLeg = (f: number, dy: number): Point => {
    const p = along(pelvis, Math.atan2(frontAnkle[1] - pelvis[1], frontAnkle[0] - pelvis[0]) * (180 / Math.PI), f * LEG_LEN);
    return [p[0], round(p[1] - dy)];
  };
  let f = 0.2;
  while (f < 0.95 && Math.hypot(onLeg(f + 0.02, 8)[0] - shoulder[0], onLeg(f + 0.02, 8)[1] - shoulder[1]) < 112) f += 0.02;
  return {
    pelvis,
    chest,
    hands: { near: onLeg(f, 8), far: onLeg(f - 0.03, 10) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { bend: -1 }, far: { at: [-30, -3] } },
    feet: { near: frontAnkle, far: BACK_FOOT },
    toes: { near: -75, far: 180 },
  };
}

// ---------------------------------------------------------------- lying on the back

const SUPINE_PELVIS: Point = [-12, -20];
const SUPINE = (): Pose => supineTorso(SUPINE_PELVIS, 77);

// ---------------------------------------------------------------- 3D helpers (top view)

/**
 * A knee that sits exactly a thigh from `hip` and a shin from `foot` (3D), on the
 * circle of such points the one nearest `target`.
 */
function kneeBetween(hip: Point3, foot: Point3, target: Point3, thigh = THIGH, shin = SHIN): Point3 {
  const d = [foot[0] - hip[0], foot[1] - hip[1], foot[2] - hip[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  const u = d.map((v) => v / len);
  const a = (thigh * thigh - shin * shin + len * len) / (2 * len);
  const rho = Math.sqrt(Math.max(0, thigh * thigh - a * a));
  const c = [hip[0] + u[0] * a, hip[1] + u[1] * a, hip[2] + u[2] * a];
  const t = [target[0] - c[0], target[1] - c[1], target[2] - c[2]];
  const along = t[0] * u[0] + t[1] * u[1] + t[2] * u[2];
  const w = [t[0] - u[0] * along, t[1] - u[1] * along, t[2] - u[2] * along];
  const wl = Math.hypot(w[0], w[1], w[2]) || 1;
  return [round(c[0] + (w[0] / wl) * rho), round(c[1] + (w[1] / wl) * rho), round(c[2] + (w[2] / wl) * rho)];
}

const flat = (p: Point3): Point => [p[0], p[1]];
const hipOf = (pelvis: Point, side: Side): Point3 => [pelvis[0], pelvis[1], zOut(side) * HIP_SIDE];

interface Leg3 {
  knee: Point3;
  ankle: Point3;
}

/** Writes both legs' 3D knees and ankles into a keyframe's pose and sideways. */
function legsKeyframe(pose: AuthoredPose, legs: Record<Side, Leg3>, toes: Record<Side, number>, sw: Sideways, hold: number): Keyframe {
  return {
    hold,
    pose: {
      ...pose,
      knees: { near: { at: flat(legs.near.knee) }, far: { at: flat(legs.far.knee) } },
      feet: { near: flat(legs.near.ankle), far: flat(legs.far.ankle) },
      toes,
    },
    sideways: {
      ...sw,
      knees: { near: { at: legs.near.knee[2] }, far: { at: legs.far.knee[2] }, ...sw.knees },
      feet: { near: legs.near.ankle[2], far: legs.far.ankle[2] },
    },
  };
}

// ---------------------------------------------------------------- lying on the back (side + top)

const v3 = {
  unit: (a: Point3): Point3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
};
const r3 = (p: Point3): Point3 => [round(p[0]), round(p[1]), round(p[2])];

/**
 * Lying figure four (side + top): the far leg bent, the near ankle crossed over it just below the
 * far knee, the near knee opened out to the near side. `pull` 0: the far foot flat on the floor,
 * hands down by the sides; 1: the far thigh drawn in towards the chest, both hands behind it (the
 * near hand reaching through between the legs). Exported for the duplicate in batch BE.
 */
export function lyingFigureFour(pull: 0 | 1, hold: number): Keyframe {
  const base = SUPINE();
  const hipFar = hipOf(SUPINE_PELVIS, "far");
  const hipNear = hipOf(SUPINE_PELVIS, "near");
  // Far leg: thigh 45 up from the floor with the foot planted, or drawn in just past vertical.
  const thighDeg = pull ? -100 : -45;
  const farKnee = r3(add3(hipFar, [THIGH * Math.cos((thighDeg * Math.PI) / 180), THIGH * Math.sin((thighDeg * Math.PI) / 180), 0]));
  const farAnkle: Point3 = pull
    ? r3(add3(farKnee, [SHIN * Math.cos(((thighDeg + 115) * Math.PI) / 180), SHIN * Math.sin(((thighDeg + 115) * Math.PI) / 180), 0]))
    : [round(farKnee[0] + Math.sqrt(SHIN * SHIN - (farKnee[1] + 5) ** 2)), -5, HIP_SIDE];
  // Near ankle on the front of the far thigh, just below the knee, a touch to the near side.
  const thighDir = v3.unit([farKnee[0] - hipFar[0], farKnee[1] - hipFar[1], 0]);
  const front: Point3 = [-thighDir[1], thighDir[0], 0];
  const onThigh = add3(hipFar, scale3(thighDir, THIGH - 14));
  const nearAnkle = r3(add3(onThigh, [front[0] * -7, front[1] * -7, -6]));
  // Near knee opened out to the near side, about level with the crossing.
  const nearKnee = kneeBetween(hipNear, nearAnkle, [nearAnkle[0] - 30, nearAnkle[1] + 20, -90]);
  // Hands: by the sides on the floor (arms long), or behind the far thigh (its back is away from `front`).
  const shoulderAt = (side: Side): Point3 => [base.chest![0] - 18, base.chest![1], zOut(side) * 22];
  const palmDown = (side: Side): Point3 => r3(add3(shoulderAt(side), scale3(v3.unit([1, 0.1, zOut(side) * 0.1]), 125.4)));
  const grip = add3(hipFar, scale3(thighDir, 56));
  const hands: Record<Side, Point3> = pull
    ? { near: r3(add3(grip, [-front[0] * 8, -front[1] * 8, -4])), far: r3(add3(grip, [-front[0] * 8, -front[1] * 8, 16])) }
    : { near: palmDown("near"), far: palmDown("far") };
  return legsKeyframe(
    {
      ...base,
      hands: { near: flat(hands.near), far: flat(hands.far) },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
    },
    { near: { knee: nearKnee, ankle: nearAnkle }, far: { knee: farKnee, ankle: farAnkle } },
    { near: round(thighDeg + 90 + 180), far: pull ? thighDeg + 115 + 90 : 0 },
    { hands: { near: hands.near[2], far: hands.far[2] } },
    hold,
  );
}

/**
 * Happy baby (side + top): knees wide, outside the torso towards the armpits, shins vertical with
 * the soles to the ceiling, hands holding the outsides of the shins by the ankles. `down` 0 to 1
 * pulls the knees down beside the ribs.
 */
function happyBaby(down: number, hold: number): Keyframe {
  const base = SUPINE();
  const legs = {} as Record<Side, Leg3>;
  const hands = {} as Record<Side, Point3>;
  for (const side of ["near", "far"] as Side[]) {
    const hip = hipOf(SUPINE_PELVIS, side);
    const dir = v3.unit([lerp(-48, -62, down), lerp(-52, -26, down), zOut(side) * lerp(52, 58, down)]);
    const knee = r3(add3(hip, scale3(dir, THIGH)));
    const ankle: Point3 = [knee[0], round(knee[1] - SHIN), knee[2]];
    legs[side] = { knee, ankle };
    hands[side] = [knee[0], round(ankle[1] + lerp(30, 14, down)), round(knee[2] + zOut(side) * 8)];
  }
  return legsKeyframe(
    {
      ...base,
      hands: { near: flat(hands.near), far: flat(hands.far) },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
    },
    legs,
    { near: 180, far: 180 },
    { hands: { near: hands.near[2], far: hands.far[2] } },
    hold,
  );
}

// ---------------------------------------------------------------- shinbox (90/90 sit, side + top)

const SB_PELVIS: Point = [0, -12];

/**
 * The 90/90 seat: the far thigh points straight ahead with its shin across to the near side;
 * the near thigh points out to the near side with its shin back. `lean` hinges the torso
 * forward over the front shin (degrees from the floor, 90 = tall).
 */
function shinbox(lean: number): Keyframe {
  const thigh = THIGH - 0.5;
  const shin = SHIN - 0.5;
  const frontKnee: Point3 = [thigh, -12, HIP_SIDE];
  const frontFoot: Point3 = [thigh, -8, HIP_SIDE - shin];
  const rearKnee: Point3 = [0, -12, -HIP_SIDE - thigh];
  const rearFoot: Point3 = [-shin, -8, -HIP_SIDE - thigh];
  const chest = along(SB_PELVIS, -lean, 80);
  const forward = lean < 80;
  return legsKeyframe(
    {
      pelvis: SB_PELVIS,
      chest,
      hands: forward ? { near: [round(frontKnee[0] + 36), -4], far: [round(frontKnee[0] + 30), -4] } : { near: [-52, -4], far: [-52, -4] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
    },
    { far: { knee: frontKnee, ankle: frontFoot }, near: { knee: rearKnee, ankle: rearFoot } },
    { near: -80, far: -80 },
    forward ? { hands: { near: -30, far: 14 } } : {},
    0,
  );
}

// ---------------------------------------------------------------- seated piriformis stretch (side + top)

const PF_PELVIS: Point = [0, -10];

/**
 * Sitting tall, the near leg straight ahead; the far foot planted outside the near knee,
 * its knee up. The near arm hugs the far knee and draws it across towards the near shoulder
 * (`pull` 0 to 1); the far hand props behind on the floor.
 */
function piriformis(pull: number): Keyframe {
  const hipFar = hipOf(PF_PELVIS, "far");
  const planted: Point3 = [82, -4, -36];
  const kneeTarget: Point3 = [lerp(62, 44, pull), lerp(-96, -92, pull), lerp(-4, -26, pull)];
  const knee = kneeBetween(hipFar, planted, kneeTarget);
  const chest = along(PF_PELVIS, -88, 80);
  const farKnee = knee;
  const grip: Point3 = [round(farKnee[0] + 10), round(farKnee[1] - 2), round(farKnee[2] - 4)];
  return legsKeyframe(
    {
      pelvis: PF_PELVIS,
      chest,
      hands: { near: flat(grip), far: [-40, -4] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
    },
    { near: { knee: [88, -10, -12], ankle: [LEG_LEN, -8, -12] }, far: { knee: farKnee, ankle: planted } },
    { near: -84, far: 0 },
    { hands: { near: grip[2], far: 40 } },
    0,
  );
}

// ---------------------------------------------------------------- hip crossover (supine, knees fall side to side; side + top)

const HC_PELVIS: Point = [-12, -20];
const HC_FOOT_X = 112;

/** On the back, arms out in a T, both knees bent with the feet planted; the knees drop `sway` (z) to one side. */
function hipCrossover(sway: number): Keyframe {
  const base = supineTorso(HC_PELVIS, 77) as AuthoredPose;
  const shoulder = solvePose(base as Pose).arms.near.root;
  const handY = -6;
  const handZ = 22 + Math.sqrt(125.4 ** 2 - (shoulder[1] - handY) ** 2) - 0.3;
  const hand: Point = [round(shoulder[0]), handY];
  const feet = { near: [HC_FOOT_X, -4, -10] as Point3, far: [HC_FOOT_X, -4, 10] as Point3 };
  const centre = sway === 0;
  const target = (side: Side): Point3 =>
    centre ? [50, -108, zOut(side) * 6] : [50, side === "near" ? -16 : -30, sway + (side === "near" ? 0 : 16 * Math.sign(sway))];
  const legs = {
    near: { knee: kneeBetween(hipOf(HC_PELVIS, "near"), feet.near, target("near")), ankle: feet.near },
    far: { knee: kneeBetween(hipOf(HC_PELVIS, "far"), feet.far, target("far")), ankle: feet.far },
  };
  return legsKeyframe(
    { ...base, hands: { near: hand, far: hand }, elbows: { near: { bend: 1 }, far: { bend: 1 } } },
    legs,
    { near: 0, far: 0 },
    { hands: { near: -round(handZ), far: round(handZ) } },
    0,
  );
}

// ---------------------------------------------------------------- seated figure four on a chair (side + front)

const CH_TOP = -48;
const CHAIR: Prop = { kind: "box", x: -70, y: CH_TOP, w: 140, h: -CH_TOP, frontHalf: 34 };
const CH_PELVIS: Point = [0, CH_TOP - 10];

/**
 * Sitting tall on the chair, the far foot flat on the floor, the near ankle crossed over the far
 * knee with the raised knee falling out to the side (`drop` 0 to 1 presses it down and out);
 * the near hand rests on the raised knee.
 */
function chairFigureFour(drop: number): Keyframe {
  const hipFar = hipOf(CH_PELVIS, "far");
  const hipNear = hipOf(CH_PELVIS, "near");
  const farFoot: Point3 = [150, -4, 12];
  const farKnee = kneeBetween(hipFar, farFoot, [88, CH_PELVIS[1] - 6, 12]);
  const nearAnkle: Point3 = [round(farKnee[0] - 6), round(farKnee[1] - 12), farKnee[2]];
  const nearKnee = kneeBetween(hipNear, nearAnkle, [lerp(50, 40, drop), lerp(CH_PELVIS[1] - 14, CH_PELVIS[1] + 2, drop), lerp(-64, -96, drop)]);
  const hand: Point3 = [nearKnee[0], round(nearKnee[1] - 10), nearKnee[2]];
  return legsKeyframe(
    {
      pelvis: CH_PELVIS,
      chest: along(CH_PELVIS, -90, 80),
      hands: { near: flat(hand), far: [round(farKnee[0] - 24), round(farKnee[1] - 14)] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
    },
    { near: { knee: nearKnee, ankle: nearAnkle }, far: { knee: farKnee, ankle: farFoot } },
    { near: 100, far: 0 },
    { hands: { near: hand[2], far: 16 } },
    0,
  );
}

// ---------------------------------------------------------------- pigeon (side + top)

/**
 * Pigeon: the near knee forward just behind the near wrist with its shin angled across to the far
 * side, the far leg long behind with the top of the foot on the floor, hips low and square. `fold` 0
 * props tall on straight arms, hands just ahead of the knee; 1 hinges forward over the front shin,
 * the chest lowering and the hands walking out.
 */
function pigeonAcross(fold: 0 | 1): Keyframe {
  const y = fold ? -34 : -38;
  const pelvis: Point = [-6, y];
  const hipNear = hipOf(pelvis, "near");
  const hipFar = hipOf(pelvis, "far");
  const frontFoot: Point3 = [6, -6, 34];
  const frontKnee = kneeBetween(hipNear, frontFoot, [72, -14, -30]);
  const backDx = Math.sqrt((LEG_LEN - 0.5) ** 2 - (-5 - y) ** 2 - 10 ** 2);
  const backFoot: Point3 = [round(pelvis[0] - backDx), -5, 18];
  const backKnee = kneeBetween(hipFar, backFoot, [round(pelvis[0] - 86), y + 14, 14]);
  // Torso angle from the floor; hands on the floor at nearly straight arms from the shoulders (z ±22 to ±26).
  const lean = fold ? 24 : 56;
  const chest = along(pelvis, -lean, 80);
  const shoulder = along(pelvis, -lean, 98);
  const handX = round(shoulder[0] + Math.sqrt(124.5 ** 2 - shoulder[1] ** 2 - 4 ** 2));
  return legsKeyframe(
    {
      pelvis,
      chest,
      hands: { near: [handX, 0], far: [handX, 0] },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
    },
    { near: { knee: frontKnee, ankle: frontFoot }, far: { knee: backKnee, ankle: backFoot } },
    { near: 180, far: 180 },
    { hands: { near: -26, far: 26 } },
    0,
  );
}

// ---------------------------------------------------------------- adductor rock backs (side + top)

const RB_KNEE: Point3 = [-50, -4, -HIP_SIDE];
const RB_ANKLE: Point3 = [-136, -4, -HIP_SIDE];
const RB_HANDS: Record<Side, Point> = { near: [46, 0], far: [50, 0] };

/**
 * All fours with the far leg straight out to the side, foot flat and toes forward; the near knee
 * stays down and the hips rock back (`back` 0 to 1) towards its heel.
 */
function rockBack(back: number): Keyframe {
  const pelvisY = lerp(-92, -62, back);
  const pelvis: Point = [round(RB_KNEE[0] - Math.sqrt(THIGH ** 2 - (pelvisY + 4) ** 2)), pelvisY];
  const hipFar = hipOf(pelvis, "far");
  const out: Point3 = [-84, -4, lerp(150, 163, back)];
  const farKnee = kneeBetween(hipFar, out, [-84, -70, 80]);
  return legsKeyframe(
    {
      pelvis,
      chest: along(pelvis, lerp(-17, -8, back), 80),
      hands: RB_HANDS,
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
    },
    { near: { knee: RB_KNEE, ankle: RB_ANKLE }, far: { knee: farKnee, ankle: out } },
    { near: 180, far: 0 },
    { hands: { near: -22, far: 22 } },
    0,
  );
}

// ---------------------------------------------------------------- butterfly sit-up (side + top)

const BS_PELVIS: Point = [0, -10];
const BS_FOOT_X = 36;

/** Soles together by the seat, knees dropped out to both sides. */
function butterflyLegs(lift: number): Record<Side, Leg3> {
  const leg = (side: Side): Leg3 => {
    const sign = zOut(side);
    const ankle: Point3 = [BS_FOOT_X, -7, sign * 3];
    const target: Point3 = [58, -10 - lift, sign * 92];
    return { knee: kneeBetween(hipOf(BS_PELVIS, side), ankle, target), ankle };
  };
  return { near: leg("near"), far: leg("far") };
}

/** `spine` is the torso's direction in degrees: 180 lying back, 270 sitting up. */
function butterflySitUp(spine: number, reach: "overhead" | "up" | "forward" | "feet", hold: number): Keyframe {
  const chest = along(BS_PELVIS, spine, 80);
  const shoulder = solvePose({ pelvis: BS_PELVIS, chest }).arms.near.root;
  const handFor: Record<typeof reach, Point> = {
    overhead: [round(shoulder[0] - 124), -6],
    up: along(shoulder, -90, 124),
    forward: along(shoulder, 0, 124),
    feet: [BS_FOOT_X + 6, -14],
  };
  const hand = handFor[reach];
  const z = reach === "feet" ? 8 : 22;
  const lift = spine > 250 ? 34 : 14;
  return legsKeyframe(
    {
      pelvis: BS_PELVIS,
      chest,
      hands: { near: hand, far: hand },
      elbows: { near: { bend: 1 }, far: { bend: 1 } },
    },
    butterflyLegs(lift),
    { near: 0, far: 0 },
    { hands: { near: -z, far: z } },
    hold,
  );
}

export const BATCH_BD_SPECS: DoodleSpec[] = [
  {
    id: "wger_1867",
    slug: "hip-flexor-stretch",
    title: "Hip Flexor Stretch",
    props: [FLOOR_PROP],
    transition: 1.5,
    frames: [
      { hold: 0.5, pose: halfKneeling(-22, "hips") },
      { hold: 1.4, pose: halfKneeling(10, "hips") },
    ],
  },
  {
    id: "wger_1839",
    slug: "solo-hip-flexor-stretch",
    title: "Solo Hip Flexor Stretch",
    props: [FLOOR_PROP],
    transition: 1.5,
    frames: [
      { hold: 0.5, pose: halfKneeling(-20, "knee") },
      { hold: 1.4, pose: halfKneeling(8, "knee") },
    ],
  },
  {
    id: "wger_1960",
    slug: "rear-foot-elevated-hip-flexor-stretch",
    title: "Rear-foot-elevated Hip Flexor Stretch",
    props: [BENCH, FLOOR_PROP],
    transition: 1.5,
    frames: [
      { hold: 0.5, pose: rearElevated(-22) },
      { hold: 1.4, pose: rearElevated(10) },
    ],
  },
  {
    id: "wger_1589",
    slug: "leg-and-hip-stretch",
    title: "Leg and hip stretch",
    props: [FLOOR_PROP],
    transition: 1.4,
    frames: [
      { hold: 0.9, pose: halfKneeling(10, "knee") },
      { hold: 0.9, pose: lungeFold(88) },
      { hold: 1.2, pose: lungeFold(40) },
    ],
  },
  {
    id: "wger_1869",
    slug: "lying-figure-four-stretch",
    title: "Lying Figure Four Stretch",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [lyingFigureFour(0, 0.5), lyingFigureFour(1, 1.4)],
  },
  {
    id: "wger_2656",
    slug: "happy-baby",
    title: "Happy Baby",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.4,
    frames: [happyBaby(0, 0.6), happyBaby(1, 1.4)],
  },
  {
    id: "wger_1884",
    slug: "shinbox-ir-stretch",
    title: "Shinbox IR Stretch",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.4,
    frames: [{ ...shinbox(88), hold: 0.6 }, { ...shinbox(52), hold: 1.4 }],
  },
  {
    id: "wger_1959",
    slug: "seated-piriformis-stretch",
    title: "Seated Piriformis Stretch",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.4,
    frames: [{ ...piriformis(0), hold: 0.6 }, { ...piriformis(1), hold: 1.4 }],
  },
  {
    id: "wger_1863",
    slug: "hip-crossover",
    title: "Hip Crossover",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1,
    frames: [{ ...hipCrossover(0), hold: 0.2 }, { ...hipCrossover(-66), hold: 0.5 }, { ...hipCrossover(0), hold: 0.1 }, { ...hipCrossover(66), hold: 0.5 }],
  },
  {
    id: "wger_1680",
    slug: "seated-figure-four",
    title: "Seated figure four",
    views: TWO_VIEWS,
    props: [CHAIR, FLOOR_PROP],
    transition: 1.4,
    frames: [{ ...chairFigureFour(0), hold: 0.6 }, { ...chairFigureFour(1), hold: 1.4 }],
  },
  {
    id: "wger_1872",
    slug: "pigeon-stretch",
    title: "Pigeon Stretch",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.4,
    frames: [{ ...pigeonAcross(0), hold: 0.6 }, { ...pigeonAcross(1), hold: 1.4 }],
  },
  {
    id: "wger_2614",
    slug: "adductor-rock-backs",
    title: "Adductor Rock Backs",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.3,
    frames: [{ ...rockBack(0), hold: 0.4 }, { ...rockBack(1), hold: 0.8 }],
  },
  {
    id: "wger_1476",
    slug: "butterfly-sit-up",
    title: "Butterfly Sit Up",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.9,
    frames: [
      butterflySitUp(190, "overhead", 0.4),
      butterflySitUp(202, "up", 0),
      butterflySitUp(228, "forward", 0),
      butterflySitUp(262, "feet", 0.6),
      butterflySitUp(228, "forward", 0),
      butterflySitUp(202, "up", 0),
    ],
  },
];
