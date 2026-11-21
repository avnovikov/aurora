import { kettlebellOnFloor } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose, Prop, Side } from "./rig";
import { FLOOR_PROP, along, chestOf, round, shoulderOf } from "./geom";
import { PLANK_FOOT, lockedShoulderY, straightBody } from "./specsBatchC";

/**
 * Batch BQ (#278): the dumbbell cousins from the weighted cousin swap (#251),
 * drawn with kettlebells in place of the dumbbells (the rig has no dumbbell).
 * Floor at y = 0, up is negative, side view faces +x (far limbs pale behind,
 * near limbs bright). All one view (side).
 *
 *   front squat                       a bell racked at each shoulder, elbows forward
 *   Bulgarian squat, walking lunge,   a bell hanging in each hand at the sides
 *   rear lunge, calf raise, step-ups
 *   deadlift                          bells on the floor beside the feet, flat-back hinge
 *   single-leg deadlift               one bell in the near hand, near leg back (opposite the standing leg)
 *   hip thrusts                       upper back on a bench, the bell held on the hips
 *   renegade row                      plank on two bells: push-up, then a row, alternating
 *
 * Left out: wger_1902 (Weighted push-ups): the load is a plate on the upper back,
 * and a kettlebell is only ever drawn gripped in a hand.
 */

const BELL = 14;
const FLOOR_HAND = round(kettlebellOnFloor(BELL));
/** Arm reach (shoulder to fingertip), a hair short so a straight arm draws straight. */
const REACH = 125.8;
/** A hanging bell: grip to the bell's bottom (`KETTLEBELL.grip` radii to the centre, one more to the bottom). */
const GRIP_TO_BOTTOM = round(BELL * 2.85);

const BENT = { near: { bend: 1 }, far: { bend: 1 } } as const;
const FLAT = { near: 0, far: 0 } as const;
const TWO_BELLS = { hands: ["near", "far"] as Side[], size: BELL };
const kf = (pose: Pose, hold: number, extra: Partial<Keyframe> = {}): Keyframe => ({ pose, hold, ...extra });
const other = (side: Side): Side => (side === "near" ? "far" : "near");

/** Both arms hanging by the sides from a straight spine, a bell in each hand. */
function sideHands(pelvis: Point, spine: number): Pick<Pose, "hands" | "elbows"> {
  const s = shoulderOf(pelvis, spine);
  return { hands: { near: [round(s[0] + 6), round(s[1] + 124)], far: [round(s[0] + 2), round(s[1] + 124)] }, elbows: BENT };
}

/** Lead foot flat at `front`, the other on the ball of the foot (heel up) at `back`. */
function splitLegs(lead: Side, front: Point, back: Point, backToe: number): Pick<Pose, "feet" | "toes" | "knees"> {
  return {
    knees: { [other(lead)]: { bend: -1 } },
    feet: { [lead]: front, [other(lead)]: back } as Pose["feet"],
    toes: { [lead]: 0, [other(lead)]: backToe } as Pose["toes"],
  };
}

// ---------------------------------------------------------------- front squat (bells racked)

const STAND: Point = [0, -172];
const FEET: Pose["feet"] = { near: [6, 0], far: [0, 0] };
/**
 * Racked arms: the upper arm `RACK_UPPER` degrees forward of vertical (elbows forward,
 * not dropped), the forearm up from the elbow, so the bell rests on the
 * back of the forearm in front of the shoulder, clear of the head.
 */
const RACK_UPPER = 58;
/** The forearm leans this far forward of vertical, carrying the bell out in front of the face. */
const RACK_FOREARM = 20;
const FOREARM_TIP = 65.8;

function rackArm(s: Point, upper: number): { hand: Point; elbow: Point } {
  const elbow = along(s, 90 - upper, 60);
  return { elbow, hand: along(elbow, -90 + RACK_FOREARM, FOREARM_TIP) };
}

function frontSquat(deep: boolean): Pose {
  const pelvis: Point = deep ? [-48, -66] : STAND;
  const spine = deep ? -78 : -90;
  const s = shoulderOf(pelvis, spine);
  const near = rackArm(s, RACK_UPPER);
  const far = rackArm(s, RACK_UPPER - 4);
  return {
    pelvis,
    chest: chestOf(pelvis, spine),
    hands: { near: near.hand, far: far.hand },
    elbows: { near: { at: near.elbow }, far: { at: far.elbow } },
    feet: FEET,
    toes: FLAT,
  };
}

// ---------------------------------------------------------------- Bulgarian squat

const BENCH: Prop = { kind: "box", x: -200, y: -64, w: 84, h: 64 };
/** Rear ankle just past the bench edge, the top of the foot lying back along the bench. */
const BSS_REAR: Point = [-110, -68];

function bulgarian(pelvis: Point): Pose {
  return {
    pelvis,
    chest: chestOf(pelvis, -84),
    ...sideHands(pelvis, -84),
    knees: { far: { bend: -1 } },
    feet: { near: [64, 0], far: BSS_REAR },
    toes: { near: 0, far: 178 },
  };
}

// ---------------------------------------------------------------- lunges

/** Upright split stance, the bells hanging at the sides. */
function splitStance(pelvis: Point, lead: Side, front: number, back: number): Pose {
  return { pelvis, chest: chestOf(pelvis, -88), ...sideHands(pelvis, -88), ...splitLegs(lead, [front, 0], [back, -20], 78) };
}

// Walking lunge, drawn on the spot like a walk cycle: the planted foot slides
// back under the hips while the back leg swings through into the next lunge.
const walkLunge = (lead: Side): Pose => splitStance([0, -96], lead, 56, -76);

function walkPass(stance: Side): Pose {
  const pelvis: Point = [0, -166];
  const knee = along(pelvis, 18, 88);
  const swing = other(stance);
  return {
    pelvis,
    chest: chestOf(pelvis, -88),
    ...sideHands(pelvis, -88),
    // The back leg swings through, knee forward and below the hip.
    knees: { [swing]: { at: knee } },
    feet: { [stance]: [-6, 0], [swing]: along(knee, 104, 86) } as Pose["feet"],
    toes: { [stance]: 0, [swing]: 40 } as Pose["toes"],
  };
}

/** Rear lunge: the far foot steps back and lands on the ball of the foot. */
function rearLunge(stage: "stand" | "step" | "down"): Pose {
  if (stage === "stand") return { pelvis: STAND, chest: chestOf(STAND, -90), ...sideHands(STAND, -90), feet: FEET, toes: FLAT };
  return splitStance(stage === "step" ? [-40, -166] : [-50, -96], "near", 6, -126);
}

// ---------------------------------------------------------------- calf raise (flat floor)

/** Standing tall, feet flat; `raised` rises onto the balls of the feet, the toes staying on the floor. */
function calfRaise(raised: boolean): Pose {
  const toeTip: Point = [26, 0];
  const toe = raised ? 70 : 0;
  const ankle = along(toeTip, toe + 180, 20);
  // Knees soft: the pelvis a touch under full leg length above the ankle.
  const pelvis: Point = [ankle[0], round(ankle[1] - 172.5)];
  return {
    pelvis,
    chest: chestOf(pelvis, -90),
    ...sideHands(pelvis, -90),
    feet: { near: ankle, far: [round(ankle[0] - 4), ankle[1]] },
    toes: { near: toe, far: toe },
  };
}

// ---------------------------------------------------------------- deadlift (bells beside the feet)

const DEAD_FEET: Pose["feet"] = { near: [0, 0], far: [-4, 0] };
/** The bells sit beside the middle of the feet. */
const DEAD_HAND_X = 14;

function deadlift(down: boolean): Pose {
  if (down) {
    // Flat back, the arms straight down from the shoulders to the bells on the floor.
    const shoulder: Point = [DEAD_HAND_X, round(FLOOR_HAND - REACH)];
    const spine = -34;
    const pelvis = along(shoulder, spine + 180, 98);
    return {
      pelvis,
      chest: chestOf(pelvis, spine),
      hands: { near: [DEAD_HAND_X, FLOOR_HAND], far: [DEAD_HAND_X - 2, FLOOR_HAND] },
      elbows: BENT,
      feet: DEAD_FEET,
      toes: FLAT,
    };
  }
  const pelvis: Point = [-4, -172];
  return { pelvis, chest: chestOf(pelvis, -90), hands: { near: [0, -146], far: [-2, -146] }, elbows: BENT, feet: DEAD_FEET, toes: FLAT };
}

// ---------------------------------------------------------------- single-leg deadlift

/**
 * Standing on the far leg, the bell in the near hand (the opposite side); the
 * near leg goes back in line with the torso as the bell lowers towards the floor.
 */
function singleLegDeadlift(hinge: boolean): Pose {
  if (!hinge) {
    const pelvis: Point = [0, -172];
    return {
      pelvis,
      chest: chestOf(pelvis, -90),
      hands: { near: [10, -146], far: [-6, -146] },
      elbows: BENT,
      feet: { near: [-34, -34], far: [0, 0] },
      toes: { near: 70, far: 0 },
    };
  }
  const pelvis: Point = [-6, -167];
  const spine = -6;
  const s = shoulderOf(pelvis, spine);
  return {
    pelvis,
    chest: chestOf(pelvis, spine),
    hands: { near: along(s, 90, REACH), far: along(s, 86, REACH) },
    feet: { near: [-179, -166], far: [0, 0] },
    toes: { near: 90, far: 0 },
  };
}

// ---------------------------------------------------------------- hip thrusts

const THRUST_BENCH: Prop = { kind: "box", x: -300, y: -80, w: 180, h: 80 };
/**
 * Upper back on the bench edge. The chest sits right at the edge (not further back
 * on the bench) so the upper arms, folded down beside the torso to hold the bell,
 * clear the bench.
 */
const THRUST_CHEST: Point = [-112, -86];
const THRUST_HEAD: Point = [-140, -128];
const THRUST_ANKLE: Point = [40, 0];
/** Bottom of the thrust: the spine's angle below level, chest to pelvis. */
const THRUST_LOW = 40;
/** The grip just ahead of the hip joint at the top and the bottom, so the hanging bell rests on the hips. */
const GRIP_TOP = 6;
const GRIP_LOW = 8;
const onHips = (pelvis: Point, dx: number): Point => [round(pelvis[0] + dx), round(pelvis[1] - GRIP_TO_BOTTOM - 4)];

/** Height the resting arm lies at on the bench (the stroke sits on the box's top line). */
const BENCH_TOP_ARM = -82;

/** The far arm lying straight back along the bench top from the shoulder (single-leg thrust). */
function benchHand(pelvis: Point): Point {
  const [cx, cy] = THRUST_CHEST;
  const len = Math.hypot(cx - pelvis[0], cy - pelvis[1]);
  const shoulder: Point = [cx + ((cx - pelvis[0]) / len) * 18, cy + ((cy - pelvis[1]) / len) * 18];
  return [round(shoulder[0] - Math.sqrt(125.4 ** 2 - (BENCH_TOP_ARM - shoulder[1]) ** 2)), BENCH_TOP_ARM];
}

/**
 * Upper back on the bench edge; `top` drives the hips up level with the shoulders.
 * Both feet planted, both hands holding the bell on the hips; single leg: the far
 * leg held out straight, the bell on the near (working) hip in the near hand and
 * the far arm resting back along the bench.
 */
function hipThrust(top: boolean, singleLeg: boolean): Pose {
  const pelvis = along(THRUST_CHEST, top ? 0 : THRUST_LOW, 80);
  const freeLeg = top ? -8 : -30;
  const grip = top ? GRIP_TOP : GRIP_LOW;
  return {
    pelvis,
    chest: THRUST_CHEST,
    head: THRUST_HEAD,
    hands: { near: onHips(pelvis, grip), far: singleLeg ? benchHand(pelvis) : onHips(pelvis, grip - 2) },
    elbows: BENT,
    feet: singleLeg ? { near: THRUST_ANKLE, far: along(pelvis, freeLeg, 172) } : { near: THRUST_ANKLE, far: [THRUST_ANKLE[0] - 4, 0] },
    toes: { near: 0, far: singleLeg ? freeLeg - 60 : 0 },
  };
}

// ---------------------------------------------------------------- step-ups

const STEP_BOX: Prop = { kind: "box", x: 40, y: -72, w: 150, h: 72 };

/** Whole lead (near) foot on the box, trailing foot on the floor, chest leaning slightly forward. */
function stepStart(): Pose {
  const pelvis: Point = [-6, -164];
  return { pelvis, chest: chestOf(pelvis, -80), ...sideHands(pelvis, -80), feet: { near: [62, -73], far: [-34, 0] }, toes: FLAT };
}

/** Driving up through the lead foot; the trailing foot has just left the floor. */
function stepRise(): Pose {
  const pelvis: Point = [44, -226];
  return {
    pelvis,
    chest: chestOf(pelvis, -84),
    ...sideHands(pelvis, -84),
    knees: { far: { bend: -1 } },
    feet: { near: [62, -73], far: [0, -96] },
    toes: { near: 0, far: 5 },
  };
}

function stepTop(): Pose {
  const pelvis: Point = [60, -245];
  return { pelvis, chest: chestOf(pelvis, -90), ...sideHands(pelvis, -90), feet: { near: [62, -73], far: [56, -73] }, toes: FLAT };
}

// ---------------------------------------------------------------- renegade row

const RENEGADE_HAND_X = 62;
const RENEGADE_TOP = lockedShoulderY(PLANK_FOOT, [RENEGADE_HAND_X, FLOOR_HAND]);
/** Push-up bottom on the bells: the chest a little below the handles. */
const RENEGADE_LOW = -66;

/** Plank on two bells at shoulder height `shoulderY`; `row` pulls that hand's bell up to the ribs. */
function renegade(shoulderY: number, row: Side | null = null): Pose {
  const { pelvis, chest, shoulder } = straightBody(PLANK_FOOT, shoulderY);
  const down: Point = [RENEGADE_HAND_X, FLOOR_HAND];
  const elbow = along(shoulder, 175, 60);
  const up: Point = [round(elbow[0] + 7), round(elbow[1] + 65.6)];
  return {
    pelvis,
    chest,
    hands: { near: row === "near" ? up : down, far: row === "far" ? up : [down[0] - 2, down[1]] },
    elbows: { near: row === "near" ? { at: elbow } : { bend: 1 }, far: row === "far" ? { at: elbow } : { bend: 1 } },
    feet: { near: PLANK_FOOT, far: PLANK_FOOT },
    toes: { near: 62, far: 62 },
  };
}

/** Push-up (quarter-point frames so the legs stay straight), press up, then row with `side`. */
function renegadeRep(side: Side): Keyframe[] {
  const at = (t: number): number => round(RENEGADE_TOP + (RENEGADE_LOW - RENEGADE_TOP) * t);
  const pass = (t: number): Keyframe => kf(renegade(at(t)), 0);
  return [
    kf(renegade(RENEGADE_TOP), 0.2),
    pass(0.25),
    pass(0.5),
    pass(0.75),
    kf(renegade(RENEGADE_LOW), 0.3),
    pass(0.75),
    pass(0.5),
    pass(0.25),
    kf(renegade(RENEGADE_TOP), 0.15),
    kf(renegade(RENEGADE_TOP, side), 0.4),
  ];
}

export const BATCH_BQ_SPECS: DoodleSpec[] = [
  {
    id: "wger_1640",
    slug: "dumbbell-front-squat",
    title: "Dumbbell Front Squat",
    props: [FLOOR_PROP],
    kettlebell: TWO_BELLS,
    transition: 1.1,
    frames: [kf(frontSquat(false), 0.4, { bell: "rack" }), kf(frontSquat(true), 0.5, { bell: "rack" })],
  },
  {
    id: "wger_1706",
    slug: "bulgarian-squat-with-dumbbells",
    title: "Bulgarian Squat with Dumbbells",
    props: [BENCH, FLOOR_PROP],
    kettlebell: TWO_BELLS,
    transition: 1.1,
    frames: [kf(bulgarian([-14, -150]), 0.5), kf(bulgarian([-30, -96]), 0.4)],
  },
  {
    id: "wger_206",
    slug: "dumbbell-lunges-walking",
    title: "Dumbbell Lunges Walking",
    props: [FLOOR_PROP],
    kettlebell: TWO_BELLS,
    transition: 0.6,
    frames: [kf(walkLunge("near"), 0.35), kf(walkPass("near"), 0), kf(walkLunge("far"), 0.35), kf(walkPass("far"), 0)],
  },
  {
    id: "wger_1651",
    slug: "dumbbell-rear-lunge",
    title: "Dumbbell Rear Lunge",
    props: [FLOOR_PROP],
    kettlebell: TWO_BELLS,
    transition: 0.6,
    frames: [kf(rearLunge("stand"), 0.4), kf(rearLunge("step"), 0), kf(rearLunge("down"), 0.5), kf(rearLunge("step"), 0)],
  },
  {
    id: "wger_1370",
    slug: "dumbbell-deadlift",
    title: "Dumbbell Deadlift",
    props: [FLOOR_PROP],
    kettlebell: TWO_BELLS,
    transition: 1.1,
    frames: [kf(deadlift(true), 0.5), kf(deadlift(false), 0.5)],
  },
  {
    id: "wger_1736",
    slug: "single-leg-deadlift-with-dumbbell",
    title: "Single-Leg Deadlift with Dumbbell",
    props: [FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 1.1,
    frames: [kf(singleLegDeadlift(false), 0.5), kf(singleLegDeadlift(true), 0.6)],
  },
  {
    id: "wger_1642",
    slug: "dumbbell-hip-thrust",
    title: "Dumbbell Hip Thrust",
    props: [THRUST_BENCH, FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 1,
    frames: [kf(hipThrust(false, false), 0.4), kf(hipThrust(true, false), 0.6)],
  },
  {
    id: "wger_1234",
    slug: "dumbbell-single-leg-hip-thrust",
    title: "Dumbbell Single-leg Hip Thrust",
    props: [THRUST_BENCH, FLOOR_PROP],
    kettlebell: { hands: ["near"], size: BELL },
    transition: 1,
    frames: [kf(hipThrust(false, true), 0.4), kf(hipThrust(true, true), 0.6)],
  },
  {
    id: "wger_2661",
    slug: "dumbbell-calf-raise",
    title: "Dumbbell Calf Raise",
    props: [FLOOR_PROP],
    kettlebell: TWO_BELLS,
    transition: 0.9,
    frames: [kf(calfRaise(false), 0.4), kf(calfRaise(true), 0.6)],
  },
  {
    id: "wger_490",
    slug: "renegade-row",
    title: "Renegade Row",
    props: [FLOOR_PROP],
    kettlebell: TWO_BELLS,
    transition: 0.5,
    frames: [...renegadeRep("near"), ...renegadeRep("far")],
  },
  {
    id: "wger_722",
    slug: "weighted-step-ups",
    title: "Weighted Step-ups",
    props: [STEP_BOX, FLOOR_PROP],
    kettlebell: TWO_BELLS,
    transition: 0.6,
    frames: [kf(stepStart(), 0.4), kf(stepRise(), 0), kf(stepTop(), 0.5), kf(stepRise(), 0)],
  },
];
