import { BONES, solvePose } from "./rig";
import type { DoodleSpec, Face, Keyframe, Point, Pose, Prop, Side, Sideways } from "./rig";
import { add3, dot3, norm3, scale3, solveKeyframe3, sub3, type Point3 } from "./rig3d";
import { FLOOR_PROP, round } from "./geom";
import { PLANK_FOOT, straightBody } from "./specsBatchC";
import { TOP_VIEWS, TWO_VIEWS } from "./sideways";

/**
 * Batch BP (#216 retry): moves earlier drawers left out for rig gaps that the
 * rig has since closed (spine roll, shoulder girdle, head facing, kettlebell
 * hand-offs), plus a few left for gear. Floor at y = 0, up is negative, the
 * side-view figure faces +x. Never import ./specs (circular).
 *
 * Left out: wger_1735 (single-leg side glute press): a leg-press machine whose
 * footplate moves with the foot; props are static and no gear rides on the feet.
 */

const SIDES: Side[] = ["near", "far"];

// ---------------------------------------------------------------- 3D limb planning

const unit3 = (a: Point3): Point3 => scale3(a, 1 / (norm3(a) || 1));
const flat = (a: Point3): Point => [round(a[0]), round(a[1])];
const ARM2: [number, number] = [BONES.upperArm, BONES.forearm + BONES.hand];
const LEG2: [number, number] = [BONES.thigh, BONES.shin];

interface Plan {
  mid: Point3;
  end: Point3;
}

/** A limb from `root` to `end` (pulled in if too far) with the middle joint towards `hint`. */
function chain(root: Point3, [l1, l2]: [number, number], end: Point3, hint: Point3): Plan {
  const full = sub3(end, root);
  const d = Math.min(Math.max(norm3(full), Math.abs(l1 - l2) + 1), l1 + l2 - 0.3);
  const u = unit3(full);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const centre = add3(root, scale3(u, a));
  const toHint = sub3(hint, centre);
  let n = sub3(toHint, scale3(u, dot3(toHint, u)));
  if (norm3(n) < 1e-6) n = [0, -1, 0];
  return { mid: add3(centre, scale3(unit3(n), h)), end: add3(root, scale3(u, d)) };
}

/** A limb as two directions: the upper bone, then the lower. */
function dirs(root: Point3, [l1, l2]: [number, number], d1: Point3, d2: Point3): Plan {
  const mid = add3(root, scale3(unit3(d1), l1));
  return { mid, end: add3(mid, scale3(unit3(d2), l2)) };
}

/** Shoulder and hip roots as the 3D solve places them for this spine and `sideways` (twist, girdle, lean). */
function roots3(pose: Pose, sw: Sideways): { arm: Record<Side, Point3>; leg: Record<Side, Point3> } {
  const f = solveKeyframe3(solvePose(pose), pose, sw);
  return { arm: { near: f.arms.near.root, far: f.arms.far.root }, leg: { near: f.legs.near.root, far: f.legs.far.root } };
}

interface Limbs {
  arms?: Partial<Record<Side, Plan>>;
  legs?: Partial<Record<Side, Plan & { toe?: number }>>;
}

/** Writes limb plans into a pose and its `sideways` as pins and z values. */
function pin(pose: Pose, sw: Sideways, limbs: Limbs): void {
  for (const side of SIDES) {
    const arm = limbs.arms?.[side];
    if (arm) {
      pose.hands = { ...pose.hands, [side]: flat(arm.end) };
      pose.elbows = { ...pose.elbows, [side]: { at: flat(arm.mid) } };
      sw.hands = { ...sw.hands, [side]: round(arm.end[2]) };
      sw.elbows = { ...sw.elbows, [side]: { at: round(arm.mid[2]) } };
    }
    const leg = limbs.legs?.[side];
    if (leg) {
      pose.feet = { ...pose.feet, [side]: flat(leg.end) };
      pose.knees = { ...pose.knees, [side]: { at: flat(leg.mid) } };
      pose.toes = { ...pose.toes, [side]: leg.toe ?? 0 };
      sw.feet = { ...sw.feet, [side]: round(leg.end[2]) };
      sw.knees = { ...sw.knees, [side]: { at: round(leg.mid[2]) } };
    }
  }
}

const key = (hold: number, pose: Pose, sideways: Sideways, face?: Face): Keyframe => ({ hold, pose, sideways, ...(face ? { face } : {}) });

// ---------------------------------------------------------------- standing base

const PELVIS: Point = [0, -172];
const CHEST: Point = [0, -252];

/** Standing tall, feet under the hips, arms left to hang (unpinned, so they ride with the shoulders). */
function stand(extra: Partial<Pose> = {}): Pose {
  return { pelvis: PELVIS, chest: CHEST, feet: { near: [4, 0], far: [0, 0] }, toes: { near: 0, far: 0 }, ...extra };
}

/** A bench seat (wrist turnover). */
const SEAT: Prop = { kind: "box", x: -56, y: -92, w: 96, h: 92, frontHalf: 40 };

const shrug = (up: number): Sideways => ({ shoulders: { near: { up }, far: { up } } });

// ---------------------------------------------------------------- human flag (front view)

/** The pole: a tall thin box, its right edge at x = POLE_X (front view). */
const POLE_X = -184;
const POLE: Prop = { kind: "box", x: POLE_X - 12, y: -430, w: 12, h: 430 };
/** Hands on the pole: the top hand pulls, the bottom hand pushes, a hair short of locked. */
const FLAG_REACH = 125.95;
const FLAG_TOP: Point = [POLE_X, -366];
const FLAG_BOTTOM: Point = [POLE_X, -134];

/** The point `r1` from `c1` and `r2` from `c2`, the one further along +x. */
function circles(c1: Point, r1: number, c2: Point, r2: number): Point {
  const d = Math.hypot(c2[0] - c1[0], c2[1] - c1[1]);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const [ux, uy] = [(c2[0] - c1[0]) / d, (c2[1] - c1[1]) / d];
  const p1: Point = [c1[0] + ux * a - uy * h, c1[1] + uy * a + ux * h];
  const p2: Point = [c1[0] + ux * a + uy * h, c1[1] + uy * a - ux * h];
  return p1[0] > p2[0] ? p1 : p2;
}

/**
 * Front view, the body out sideways from the pole: `drop` degrees below the
 * horizontal (0 is the flag), the far shoulder on top. Both hands stay on the
 * pole with the arms straight; the knees bend by `tuck` degrees (kick-up).
 */
function flag(drop: number, tuck = 0, reach = FLAG_REACH): Pose {
  const r = (drop * Math.PI) / 180;
  const up: Point = [-Math.cos(r), -Math.sin(r)];
  const across: Point = [-up[1], up[0]];
  // Far (top) shoulder T on the top hand's circle, the near one 44 along -across on the bottom hand's.
  const top = circles(FLAG_TOP, reach, [FLAG_BOTTOM[0] + 44 * across[0], FLAG_BOTTOM[1] + 44 * across[1]], reach);
  const centre: Point = [top[0] - 22 * across[0], top[1] - 22 * across[1]];
  const chest: Point = [round(centre[0] - 18 * up[0]), round(centre[1] - 18 * up[1])];
  const pelvis: Point = [round(chest[0] - 80 * up[0]), round(chest[1] - 80 * up[1])];
  const legs = (side: Side): { knee: Point; foot: Point } => {
    const hip: Point = [pelvis[0] + (side === "near" ? -8 : 8) * across[0], pelvis[1] + (side === "near" ? -8 : 8) * across[1]];
    const t = (tuck * Math.PI) / 180;
    // Thigh along the body, the shin folding towards the near (lower) side by `tuck`.
    const knee: Point = [hip[0] - 88 * up[0], hip[1] - 88 * up[1]];
    const shin: Point = [-up[0] * Math.cos(t) - across[0] * Math.sin(t), -up[1] * Math.cos(t) - across[1] * Math.sin(t)];
    return { knee: [round(knee[0]), round(knee[1])], foot: [round(knee[0] + 85.95 * shin[0]), round(knee[1] + 85.95 * shin[1])] };
  };
  const [near, far] = [legs("near"), legs("far")];
  return {
    pelvis,
    chest,
    hands: { near: FLAG_BOTTOM, far: FLAG_TOP },
    elbows: { near: { bend: -1 }, far: { bend: 1 } },
    knees: tuck ? { near: { at: near.knee }, far: { at: far.knee } } : undefined,
    feet: { near: near.foot, far: far.foot },
    toes: { near: round((Math.atan2(-up[1], -up[0]) * 180) / Math.PI), far: round((Math.atan2(-up[1], -up[0]) * 180) / Math.PI) },
  };
}


// ---------------------------------------------------------------- elbow stretches (side + front)

const P3 = (x: number, y: number, z: number): Point3 => [x, y, z];

/**
 * The working arm folded (elbow and hand tip given), the other hand on that elbow.
 * Points are authored with the working arm on the far side (+z); `work: "near"`
 * mirrors them across.
 */
interface ElbowHold {
  elbow: Point3;
  hand: Point3;
  /** Where the other hand's tip holds the elbow, and which way its own elbow points. */
  grip: Point3;
  gripElbow: Point3;
  /** Working shoulder's girdle lift and protraction (- draws it back). */
  lift?: number;
  forward?: number;
  face?: Face;
}

const WORK: Side = "far";

function elbowHold(o: ElbowHold, hold: number, work: Side = WORK): Keyframe {
  const help: Side = work === "far" ? "near" : "far";
  const m = (p: Point3): Point3 => (work === "far" ? p : [p[0], p[1], -p[2]]);
  const pose = stand();
  const sw: Sideways = { shoulders: { [work]: { up: o.lift ?? 0, forward: o.forward ?? 0 } } };
  const { arm } = roots3(pose, sw);
  const working = chain(arm[work], ARM2, m(o.hand), m(o.elbow));
  const helper = chain(arm[help], ARM2, m(o.grip), m(o.gripElbow));
  pin(pose, sw, { arms: { [work]: working, [help]: helper } });
  const face = o.face && work === "near" ? { ...o.face, tilt: -(o.face.tilt ?? 0), turn: -(o.face.turn ?? 0) } : o.face;
  return key(hold, pose, sw, face ?? { nod: 0 });
}

/** Arm and neck stretch: the pressing hand out wide of the head on its way up to the elbow and back down. */
const NECK_WIDE = P3(0, -312, -100);

/** The working arm straight up beside the head (before it folds), the other arm low and a little forward. */
function armUp(hold: number, work: Side = WORK, face?: Face): Keyframe {
  const help: Side = work === "far" ? "near" : "far";
  const out = work === "far" ? 1 : -1;
  const pose = stand();
  const sw: Sideways = { shoulders: { [work]: { up: 8 } } };
  const { arm } = roots3(pose, sw);
  const reach = dirs(arm[work], ARM2, [-0.05, -1, 0.16 * out], [-0.05, -1, 0.16 * out]);
  const low = chain(arm[help], ARM2, [16, -150, -24 * out], [-10, -210, -30 * out]);
  pin(pose, sw, { arms: { [work]: reach, [help]: low } });
  return key(hold, pose, sw, face ?? { nod: 0 });
}

/**
 * Arm across the body: the near hand reaches over the far shoulder (tip at `hand`), the
 * elbow folded in front of the chest towards `elbow`, the far hand pressing on that elbow.
 */
function across(hold: number, hand: Point3, elbow: Point3): Keyframe {
  const pose = stand();
  const sw: Sideways = {};
  const { arm } = roots3(pose, sw);
  const working = chain(arm.near, ARM2, hand, elbow);
  const grip = add3(working.mid, [6, -2, 2]);
  const helper = chain(arm.far, ARM2, grip, [20, -210, 60]);
  pin(pose, sw, { arms: { near: working, far: helper } });
  return key(hold, pose, sw, { nod: 0 });
}

// ---------------------------------------------------------------- wall chest stretch (side + top)

/**
 * A wall beside the figure: the figure stands at z = WALL_FIGURE_Z, the wall is a thin slab
 * along x at z = 0 (to the figure's far side). Side view sees it face-on behind the figure,
 * the top view as a line beside it.
 */
const WALL_FIGURE_Z = -150;
const SIDE_WALL: Prop = { kind: "box", x: -110, y: -400, w: 170, h: 400, frontHalf: 4 };
/** The far palm flat on the wall at shoulder height, a little behind the shoulder. */
const WALL_HAND: Point3 = [-34, -272, -5];

/** Standing beside the wall, far hand on it, near hand on the hip; the chest turned `twist` (+ away from the wall), hips 0.4 of that. */
function wallTurn(hold: number, twist: number, retract: number): Keyframe {
  const pose = stand();
  const sw: Sideways = {
    pelvis: WALL_FIGURE_Z,
    twist,
    hipTwist: round(twist * 0.4),
    shoulders: { far: { forward: -retract, up: -2 } },
    feet: { near: WALL_FIGURE_Z - 10, far: WALL_FIGURE_Z + 10 },
  };
  const { arm, leg } = roots3(pose, sw);
  const reach = chain(arm.far, ARM2, WALL_HAND, add3(arm.far, [-10, 40, 60]));
  // The other hand on the hip, elbow out along the shoulder line, so from above the turning
  // shoulder line shows past the head.
  const pelvis: Point3 = [PELVIS[0], PELVIS[1], WALL_FIGURE_Z];
  const hip = add3(pelvis, add3(scale3(sub3(leg.near, pelvis), 2.4), [0, -6, 0]));
  const centre = scale3(add3(arm.near, arm.far), 0.5);
  const akimbo = chain(arm.near, ARM2, hip, add3(arm.near, add3(scale3(sub3(arm.near, centre), 3), [-6, 40, 0])));
  pin(pose, sw, { arms: { far: reach, near: akimbo } });
  return key(hold, pose, sw, { nod: 0 });
}

// ---------------------------------------------------------------- sit-up elbow thrust (side + top)

/** Rodrigues: `v` turned by `degrees` about unit `axis`. */
function turnAbout(v: Point3, axis: Point3, degrees: number): Point3 {
  const r = (degrees * Math.PI) / 180;
  const [c, sn] = [Math.cos(r), Math.sin(r)];
  const cr: Point3 = [axis[1] * v[2] - axis[2] * v[1], axis[2] * v[0] - axis[0] * v[2], axis[0] * v[1] - axis[1] * v[0]];
  return add3(add3(scale3(v, c), scale3(cr, sn)), scale3(axis, dot3(axis, v) * (1 - c)));
}

const SU_PELVIS: Point = [-8, -20];

/**
 * Sit-up with the hands by the ears: the torso at `theta` (183 lying, about -78 sat up), the
 * chest rolled by `twist` (- drives the near elbow across to the far side). Arms are set out in
 * the chest's frame and turned with it, so the hands stay by the ears.
 */
function sitUpThrust(hold: number, theta: number, twist = 0, tuck = 4): Keyframe {
  const rad = (theta * Math.PI) / 180;
  const u: Point3 = [Math.cos(rad), Math.sin(rad), 0];
  const f: Point3 = [-u[1], u[0], 0];
  const chest: Point = [round(SU_PELVIS[0] + 80 * u[0]), round(SU_PELVIS[1] + 80 * u[1])];
  const tr = ((theta + tuck) * Math.PI) / 180;
  const head: Point = [round(chest[0] + 56 * Math.cos(tr)), round(chest[1] + 56 * Math.sin(tr))];
  const pose: Pose = {
    pelvis: SU_PELVIS,
    chest,
    head,
    spine: { bend: -1 },
    feet: { near: [84, -2], far: [82, -2] },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    toes: { near: 0, far: 0 },
  };
  const sw: Sideways = { twist, feet: { near: -14, far: 14 }, knees: { near: { at: -12 }, far: { at: 12 } } };
  const { arm } = roots3(pose, sw);
  const c3: Point3 = [chest[0], chest[1], 0];
  const h3: Point3 = [head[0], head[1], 0];
  const arms: Partial<Record<Side, Plan>> = {};
  for (const side of SIDES) {
    const z = side === "near" ? -1 : 1;
    // Hand tip by the ear, a little behind the head; the elbow wide (or, driving across, forward).
    const across = twist !== 0 && (twist < 0) === (side === "near");
    const ear = add3(add3(h3, [0, 0, z * 30]), scale3(f, -6));
    const hint: Point3 = across ? [0, 0, -z * 10] : [0, 0, z * 70];
    let forward = twist === 0 ? 6 : 40;
    if (across) forward = 70;
    const wide = add3(add3(c3, scale3(u, 18)), add3(hint, scale3(f, forward)));
    const turn = (p: Point3): Point3 => add3(c3, turnAbout(sub3(p, c3), u, -twist));
    const turnHead = (p: Point3): Point3 => add3(h3, turnAbout(sub3(p, h3), u, -twist));
    arms[side] = chain(arm[side], ARM2, turnHead(ear), turn(wide));
  }
  pin(pose, sw, { arms });
  return key(hold, pose, sw, { nod: tuck });
}

// ---------------------------------------------------------------- side-lying: open book, Bretzel (side + top)

/** Lying on the far side, head to -x: the flat 2D spine rolled 90 (back to the camera, front towards +z). */
const LIE_PELVIS: Point = [0, -24];
function lying(): Pose {
  return { pelvis: LIE_PELVIS, chest: [-80, -24], head: [-136, -24] };
}

/** A straight arm from `root` at angle `phi` in the y-z plane: 0 straight out in front (+z), 90 up, 180 behind. */
const armAt = (root: Point3, phi: number, x = 0): Plan => {
  const r = (phi * Math.PI) / 180;
  const d = unit3([x, -Math.sin(r), Math.cos(r)]);
  return dirs(root, ARM2, d, d);
};

/**
 * Open book: knees bent to 90 and stacked in front, the bottom (far) arm out in front on the
 * floor, the top (near) arm at `phi` (about -15 resting on the bottom one, 90 straight up, 190
 * on the floor behind) while the chest rolls open by `twist` (-90 stacked, -10 open).
 */
function openBook(hold: number, twist: number, phi: number, turn: number): Keyframe {
  const pose = lying();
  const sw: Sideways = { twist, hipTwist: -90 };
  const { arm, leg } = roots3(pose, sw);
  // The bottom arm lies straight out in front along the floor (it bends a little as the chest opens).
  const bottomHand: Point3 = [-98, -4, round(arm.far[2] + Math.sqrt(124.5 ** 2 - (arm.far[1] + 4) ** 2))];
  const bottom = chain(arm.far, ARM2, bottomHand, [-110, -30, 60]);
  const top = armAt(arm.near, phi);
  const legAt = (side: Side, y: number): Plan & { toe: number } => {
    const plan = dirs(leg[side], LEG2, [6, y - leg[side][1], 87], [86, 2, -6]);
    return { ...plan, toe: 0 };
  };
  pin(pose, sw, { arms: { far: bottom, near: top }, legs: { near: legAt("near", -26), far: legAt("far", -10) } });
  return key(hold, pose, sw, { turn });
}

/**
 * Bretzel: on the far side, the top (near) knee forward on the floor held down by the bottom
 * (far) hand; the bottom leg bent behind, its foot held by the top hand; the chest rolls
 * open towards the floor behind by `twist` (-50 to about -12).
 */
function bretzel(hold: number, twist: number, turn: number, reaching = false): Keyframe {
  const pose = lying();
  const sw: Sideways = { twist, hipTwist: -90 };
  const { arm, leg } = roots3(pose, sw);
  const topLeg = dirs(leg.near, LEG2, [0, -12 - leg.near[1], 86], [86, 0, -8]);
  const bottomLeg = dirs(leg.far, LEG2, [86, -10 - leg.far[1], -20], [-0.86, 0, -0.51]);
  const knee = topLeg.mid;
  const foot = bottomLeg.end;
  const holdKnee = chain(arm.far, ARM2, add3(knee, [-2, 2, 2]), [arm.far[0] + 40, -40, 60]);
  // Before it takes the foot the top hand rests on the top hip.
  const holdFoot = reaching
    ? chain(arm.near, ARM2, [22, -44, -8], [arm.near[0] + 50, -60, -10])
    : chain(arm.near, ARM2, add3(foot, [4, -6, -4]), [arm.near[0] + 50, -40, -60]);
  pin(pose, sw, {
    arms: { far: holdKnee, near: holdFoot },
    legs: { near: { ...topLeg, toe: 0 }, far: { ...bottomLeg, toe: 180 } },
  });
  return key(hold, pose, sw, { turn });
}

// ---------------------------------------------------------------- kettlebell push-up (side + front)

const KB = 14;
/** Near hand on the handle of a bell standing on the floor, far hand flat on the floor. */
const KB_HAND_Y = round(-KB * 2.85);
const KB_HANDS = { near: [72, KB_HAND_Y] as Point, far: [70, 0] as Point };
const KB_HAND_Z = { near: -40, far: 30 };

/** A straight plank with the shoulder centre at `y`, the shoulder line rolled `twist` (near side up). */
function kbPlank(y: number, twist: number): { pose: Pose; sw: Sideways } {
  const { pelvis, chest } = straightBody(PLANK_FOOT, y);
  const pose: Pose = {
    pelvis,
    chest,
    hands: { ...KB_HANDS },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: PLANK_FOOT, far: PLANK_FOOT },
    toes: { near: 62, far: 62 },
  };
  const sw: Sideways = { twist, hipTwist: round(twist / 3), hands: { ...KB_HAND_Z }, elbows: { near: { out: 30 }, far: { out: 30 } }, feet: { near: -10, far: 10 } };
  return { pose, sw };
}

/** Shoulder-to-hand distance of each arm for a plank. */
function kbReach(y: number, twist: number): Record<Side, number> {
  const { pose, sw } = kbPlank(y, twist);
  const { arm } = roots3(pose, sw);
  const d = (side: Side): number => norm3(sub3(arm[side], [KB_HANDS[side][0], KB_HANDS[side][1], KB_HAND_Z[side]]));
  return { near: d("near"), far: d("far") };
}

const KB_ROLL = 50;

/** The top: both arms straight, the shoulder line rolled so the near shoulder rides higher over the bell. */
function kbTop(): { y: number; twist: number } {
  let best = { y: -130, twist: 0, err: Infinity };
  // A real roll is modest: cap it and let the bell arm keep a little bend.
  for (let twist = 0; twist <= KB_ROLL; twist += 1) {
    let [lo, hi] = [-200, -60];
    for (let i = 0; i < 40; i += 1) {
      const mid = (lo + hi) / 2;
      // Over-reaching: the shoulders must come down (larger y).
      if (kbReach(mid, twist).far > 125.6) lo = mid;
      else hi = mid;
    }
    const y = (lo + hi) / 2;
    const err = Math.abs(kbReach(y, twist).near - 125.6);
    if (err < best.err) best = { y, twist, err };
  }
  return { y: round(best.y), twist: best.twist };
}

function kbPush(hold: number, y: number, twist: number): Keyframe {
  const { pose, sw } = kbPlank(y, twist);
  return key(hold, pose, sw);
}

// ---------------------------------------------------------------- kettlebell wrist turnover (side + front)

/**
 * Seated on a bench, leaning forward, the near forearm resting along the near thigh with
 * the hand past the knee, a light bell hanging from it; the far hand on the far knee.
 * Seen from the front the forearm points at the viewer, so turning it over swings the
 * bell from under the hand (`hang`) round to the outside of the wrist (`rack`).
 */
function wristTurn(hold: number, bell: "hang" | "rack"): Keyframe {
  const pose: Pose = { pelvis: [0, -100], chest: [44, -166], head: [76, -212] };
  const sw: Sideways = {};
  const { arm, leg } = roots3(pose, sw);
  const legs = {
    near: { ...dirs(leg.near, LEG2, [1, 0.03, -0.17], [0.05, 1, 0]), toe: 0 },
    far: { ...dirs(leg.far, LEG2, [1, 0.03, 0.17], [0.05, 1, 0]), toe: 0 },
  };
  const knee = legs.near.mid;
  // Elbow on the thigh a forearm back from the hand; the forearm level over the knee.
  const hand: Point3 = [knee[0] + 34, knee[1] - 10, knee[2]];
  const working = chain(arm.near, ARM2, hand, [hand[0] - 66, hand[1] + 20, hand[2] - 4]);
  const resting = chain(arm.far, ARM2, add3(legs.far.mid, [8, -8, 0]), [arm.far[0], arm.far[1] + 40, 60]);
  pin(pose, sw, { arms: { near: working, far: resting }, legs });
  return { ...key(hold, pose, sw), bell };
}

// ---------------------------------------------------------------- single-leg balance with kettlebell circles (side + front)

/** Waist-high hand spots round the body: in front, out to each side, behind the back. */
const ROUND: Record<"front" | "far" | "back" | "near", Point3> = {
  front: [42, -174, 0],
  far: [2, -176, 54],
  back: [-36, -170, 0],
  near: [2, -176, -54],
};

/**
 * Standing on the near leg, the far foot lifted behind (knee bent); a bell passed round the
 * waist hand to hand. `near`, `far`: where each hand is (a spot in ROUND); `bellIn` hands it over.
 */
function bellRound(near: keyof typeof ROUND, far: keyof typeof ROUND, bellIn?: Side): Keyframe {
  const pose: Pose = { pelvis: [0, -172], chest: [2, -252] };
  const sw: Sideways = {};
  const { arm, leg } = roots3(pose, sw);
  const stance = { ...dirs(leg.near, LEG2, [0.02, 1, 0], [0, 1, 0]), toe: 0 };
  const lifted = { ...dirs(leg.far, LEG2, [0.12, 1, 0], [-0.85, 0.53, 0]), toe: 60 };
  const hint = (side: Side): Point3 => [arm[side][0] - 10, arm[side][1] + 50, arm[side][2] * 3];
  pin(pose, sw, {
    arms: { near: chain(arm.near, ARM2, ROUND[near], hint("near")), far: chain(arm.far, ARM2, ROUND[far], hint("far")) },
    legs: { near: stance, far: lifted },
  });
  return { ...key(0, pose, sw, { nod: 10 }), ...(bellIn ? { bellIn } : {}) };
}

export const BATCH_BP_SPECS: DoodleSpec[] = [
  {
    id: "fedb_shoulder_raise",
    slug: "shoulder-raise",
    title: "Shoulder Raise",
    views: TWO_VIEWS,
    transition: 0.7,
    frames: [
      key(0.5, stand(), shrug(-2), { nod: 0 }),
      key(1.2, stand(), shrug(14), { nod: 0 }),
    ],
  },
  {
    id: "wger_570",
    slug: "shoulder-shrug",
    title: "Shoulder Shrug",
    views: TWO_VIEWS,
    transition: 0.6,
    frames: [
      key(0.4, stand(), shrug(-2), { nod: 0 }),
      key(0.35, stand(), shrug(14), { nod: 0 }),
    ],
  },
  {
    id: "hf_112",
    slug: "human-flag",
    title: "Human Flag",
    view: "front",
    props: [POLE, FLOOR_PROP],
    transition: 0.8,
    frames: [
      { hold: 0.3, pose: flag(50, 70, 122) },
      { hold: 1.4, pose: flag(0) },
      { hold: 0.6, pose: flag(-3) },
    ],
  },
  {
    id: "fedb_triceps_stretch",
    slug: "triceps-stretch",
    title: "Triceps Stretch",
    views: TWO_VIEWS,
    transition: 1.1,
    frames: [
      armUp(0.4),
      elbowHold({ elbow: P3(0, -345, 45), hand: P3(-34, -290, 6), grip: P3(2, -344, 30), gripElbow: P3(30, -322, -20), lift: 8 }, 0.5),
      elbowHold({ elbow: P3(-8, -345, 38), hand: P3(-38, -288, 0), grip: P3(-6, -344, 24), gripElbow: P3(30, -322, -20), lift: 8, forward: -4 }, 1.6),
    ],
  },
  {
    id: "wger_1590",
    slug: "arm-and-neck-stretch",
    title: "Arm and neck stretch",
    views: TWO_VIEWS,
    // The folded arm's forearm behind the head is drawn pale, behind it.
    fadeBehind: true,
    transition: 1,
    frames: [
      armUp(0.4),
      // The pressing hand goes up the outside, wide of the head, then over the top to the elbow.
      elbowHold({ elbow: P3(0, -345, 45), hand: P3(-34, -290, 6), grip: NECK_WIDE, gripElbow: P3(0, -300, -90), lift: 8 }, 0),
      elbowHold({ elbow: P3(0, -345, 45), hand: P3(-34, -290, 6), grip: P3(-4, -352, 26), gripElbow: P3(-4, -330, -90), lift: 8, face: { tilt: -10 } }, 0.3),
      elbowHold({ elbow: P3(-12, -350, 14), hand: P3(-40, -288, 0), grip: P3(-12, -356, 8), gripElbow: P3(-6, -326, -90), lift: 6, forward: -4, face: { tilt: -28 } }, 1.6),
      elbowHold({ elbow: P3(0, -345, 45), hand: P3(-34, -290, 6), grip: NECK_WIDE, gripElbow: P3(0, -300, -90), lift: 8, face: { tilt: -10 } }, 0),
    ],
  },
  {
    id: "fedb_tricep_side_stretch",
    slug: "tricep-side-stretch",
    title: "Tricep Side Stretch",
    views: TWO_VIEWS,
    transition: 1,
    frames: [
      key(0.4, stand(), {}, { nod: 0 }),
      across(0.5, P3(-4, -284, 28), P3(60, -280, 10)),
      across(1.6, P3(-16, -282, 34), P3(48, -282, 6)),
    ],
  },
  {
    id: "wger_1712",
    slug: "horizontal-shoulder-flexion-stretch",
    title: "Horizontal Shoulder Flexion Stretch",
    views: TOP_VIEWS,
    props: [SIDE_WALL, FLOOR_PROP],
    transition: 1.4,
    frames: [wallTurn(0.6, -12, 0), wallTurn(1.6, 42, 12)],
  },
  {
    id: "wger_1479",
    slug: "sit-up-elbow-thrust",
    title: "Sit Up Elbow Thrust",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    transition: 0.6,
    frames: [
      sitUpThrust(0.3, 183),
      sitUpThrust(0.1, -80, 0, 8),
      sitUpThrust(0.35, -80, -55, 8),
      sitUpThrust(0.1, -80, 0, 8),
      sitUpThrust(0.3, 183),
      sitUpThrust(0.1, -80, 0, 8),
      sitUpThrust(0.35, -80, 55, 8),
      sitUpThrust(0.1, -80, 0, 8),
    ],
  },
  {
    id: "wger_1822",
    slug: "open-book",
    title: "Open Book",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.1,
    frames: [openBook(0.5, -90, -14, 0), openBook(0, -50, 90, -20), openBook(1.2, -12, 188, -60), openBook(0, -50, 90, -20)],
  },
  {
    id: "wger_1577",
    slug: "bretzel-stretch",
    title: "Bretzel stretch",
    views: TOP_VIEWS,
    props: [FLOOR_PROP],
    transition: 1.5,
    frames: [bretzel(0.5, -86, 0, true), bretzel(0.4, -50, -10), bretzel(1.8, -12, -40)],
  },
  (() => {
    const top = kbTop();
    return {
      id: "fedb_plyo_kettlebell_pushups",
      slug: "plyo-kettlebell-pushups",
      title: "Plyo Kettlebell Pushups",
      views: TWO_VIEWS,
      props: [FLOOR_PROP],
      kettlebell: { hands: ["near"], size: KB },
      transition: 0.5,
      frames: [kbPush(0.35, top.y, top.twist), kbPush(0.2, -78, round(top.twist * 0.8))],
    } satisfies DoodleSpec;
  })(),
  {
    id: "wger_2727",
    slug: "kettlebell-wrist-turnover",
    title: "Kettlebell Wrist Turnover",
    views: TWO_VIEWS,
    props: [SEAT, FLOOR_PROP],
    kettlebell: { hands: ["near"], size: 13 },
    transition: 1.1,
    frames: [wristTurn(0.5, "hang"), wristTurn(0.6, "rack")],
  },
  {
    id: "wger_2668",
    slug: "single-leg-balance-kettlebell-circles",
    title: "Single-Leg Balance with Kettlebell Circles",
    views: TWO_VIEWS,
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: 13 },
    // Behind the back the bell and the reaching forearms are drawn pale, behind the body.
    fadeBehind: true,
    transition: 0.5,
    frames: [bellRound("front", "front", "far"), bellRound("back", "far"), bellRound("back", "back", "near"), bellRound("near", "front")],
  },
];

