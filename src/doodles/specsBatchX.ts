import type { DoodleSpec, Keyframe, Point, Pose, Prop, Side } from "./rig";

/**
 * Batch X: jumps, bounds and hops. Floor at y = 0, up is negative, the side-view
 * figure faces +x. Import only from ./rig (./specs imports this).
 *
 * Every jump leaves the floor with the feet clearly in the air at the peak and
 * lands with the knees bent. Forward jumps are drawn in side view; sideways
 * jumps, bounds and hops in front view (near side at -x). The figure cannot
 * face -x, so forward jumps that travel reset by walking back to the start.
 *
 * Bench jump is drawn as the lateral version (side-on to the bench, over and
 * straight back): the forward version turns round between jumps, which a
 * figure that always faces +x cannot do.
 *
 * Left out:
 *   fedb_alternate_leg_diagonal_bound   the bound travels forward and sideways
 *     with a knee drive. Front view keeps only the sideways part (the forward
 *     travel and the knee drive point at the camera), so it read as a plain
 *     sideways bound duplicating Skater Bound (hf_98); side view loses the
 *     sideways part, which is the point of the drill. Now drawn in front view
 *     in batch AH, for the judge to decide on a second view.
 */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

/** Shoulder of a straight spine (pelvis → chest is 80, shoulder 18 further). */
const shoulderAt = (pelvis: Point, spine: number): Point => along(pelvis, spine, 98);

const other = (side: Side): Side => (side === "near" ? "far" : "near");

/** Arm reach with the elbow nearly locked (shoulder to fingertip). */
const ARM = 125;

// ---------------------------------------------------------------- side view building blocks

type Arms = "sides" | "back" | "forward" | "up" | "overhead" | "chest";

/** Hands for an arm position, from a straight spine at `spine` degrees. */
function sideArms(pelvis: Point, spine: number, arms: Arms): Pick<Pose, "hands" | "elbows"> {
  const s = shoulderAt(pelvis, spine);
  // Raised arms keep their angle to the spine, so a leaning body still clears the head.
  const tilt = spine + 90;
  switch (arms) {
    case "sides":
      return {
        hands: { near: along(s, 86, ARM), far: along(s, 88, ARM) },
        elbows: { near: { bend: 1 }, far: { bend: 1 } },
      };
    case "back":
      // Short of straight back, so the swing up to overhead goes forward, not over the head.
      return { hands: { near: along(s, 116, ARM), far: along(s, 118, ARM) } };
    case "forward":
      return { hands: { near: along(s, -4, ARM), far: along(s, -1, ARM) } };
    case "up":
      return { hands: { near: along(s, -40 + tilt, ARM), far: along(s, -43 + tilt, ARM) } };
    case "overhead":
      // As high as the arms go while still reading clear of the head.
      return { hands: { near: along(s, -57 + tilt, ARM), far: along(s, -59 + tilt, ARM) } };
    case "chest": {
      // Elbows bent, forearms level, palms down in front of the chest.
      const elbow = along(s, spine + 160, 60);
      const farElbow = along(s, spine + 162, 60);
      return {
        hands: { near: along(elbow, spine + 90, 66), far: along(farElbow, spine + 90, 66) },
        elbows: { near: { at: elbow }, far: { at: farElbow } },
      };
    }
  }
}

/** Standing tall at `x`, feet hip-width (side view stacks them). */
function stand(x: number, arms: Arms = "sides", footY = 0): Pose {
  const pelvis: Point = [x, -172 + footY];
  return {
    pelvis,
    chest: along(pelvis, -90, 80),
    ...sideArms(pelvis, -90, arms),
    feet: { near: [x + 6, footY], far: [x, footY] },
    toes: { near: 0, far: 0 },
  };
}

/**
 * Knees and hips bent with the feet flat at `x`: `drop` lowers the pelvis from
 * standing, the hips sit back and the chest leans to `spine` degrees.
 */
function bent(x: number, drop: number, spine: number, arms: Arms): Pose {
  const pelvis: Point = [round(x - drop * 0.45), -172 + drop];
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    ...sideArms(pelvis, spine, arms),
    feet: { near: [x + 6, 0], far: [x, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** In the air, body long, toes pointed: pelvis at `pelvis`, feet `hang` below it. */
function flight(pelvis: Point, spine: number, arms: Arms, hang = 166, lean = 0): Pose {
  const foot = along(pelvis, 90 - lean, hang);
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    ...sideArms(pelvis, spine, arms),
    feet: { near: [foot[0] + 5, foot[1]], far: [foot[0] - 1, foot[1]] },
    toes: { near: 70 - lean, far: 70 - lean },
  };
}

/** One step of walking back to the start: `lead` foot behind, the other in front. */
function walkBack(x: number, lead: Side): Pose {
  const pelvis: Point = [x, -166];
  return {
    pelvis,
    chest: along(pelvis, -90, 80),
    ...sideArms(pelvis, -90, "sides"),
    feet: { [lead]: [x - 34, -8], [other(lead)]: [x + 34, 0] } as Pose["feet"],
    toes: { [lead]: 20, [other(lead)]: -6 } as Pose["toes"],
  };
}

// ---------------------------------------------------------------- vertical jumps (side view)

/** Rocket jump: half squat with the arms close, then reach for the ceiling. */
const rocketJump = (): Pose[] => [
  stand(0, "sides"),
  bent(0, 44, -72, "sides"),
  flight([0, -268], -90, "overhead", 168),
  bent(0, 38, -76, "forward"),
];

/** Knee tuck jump: palms down at the chest, knees driven up to them in the air. */
function tuckAir(): Pose {
  const pelvis: Point = [0, -250];
  const spine = -86;
  const knee = along(pelvis, -24, 88);
  const ankle = along(knee, 104, 86);
  // Palms flat just above the knees.
  const farKnee = along(pelvis, -22, 88);
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    hands: { near: [knee[0] + 6, knee[1] - 14], far: [knee[0] + 2, knee[1] - 14] },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    knees: { near: { at: knee }, far: { at: farKnee } },
    feet: { near: ankle, far: along(farKnee, 106, 86) },
    toes: { near: 60, far: 60 },
  };
}

// ---------------------------------------------------------------- lunge jump (side view)

/** Lunge with `front` foot flat ahead and the back knee just off the floor. */
function lunge(front: Side, arms: Arms): Pose {
  const pelvis: Point = [0, -98];
  return {
    pelvis,
    chest: along(pelvis, -86, 80),
    ...sideArms(pelvis, -86, arms),
    knees: { [other(front)]: { bend: -1 } },
    feet: { [front]: [58, 0], [other(front)]: [-78, -20] } as Pose["feet"],
    toes: { [front]: 0, [other(front)]: 78 } as Pose["toes"],
  };
}

/** Airborne mid-switch: legs scissoring past each other under the hips. */
function lungeAir(front: Side): Pose {
  const pelvis: Point = [0, -236];
  return {
    pelvis,
    chest: along(pelvis, -88, 80),
    ...sideArms(pelvis, -88, "up"),
    feet: { [front]: [26, -76], [other(front)]: [-30, -84] } as Pose["feet"],
    toes: { [front]: 50, [other(front)]: 80 } as Pose["toes"],
  };
}

// ---------------------------------------------------------------- snap down (side view)

/** Tall on the balls of the feet, arms reaching overhead. */
function snapTall(lift = 0): Pose {
  const footY = -15 - lift;
  const pelvis: Point = [0, -188 - lift];
  return {
    pelvis,
    chest: along(pelvis, -90, 80),
    ...sideArms(pelvis, -90, "overhead"),
    feet: { near: [6, footY], far: [0, footY] },
    toes: { near: 46, far: 46 },
  };
}

/** Athletic landing: hips back, chest forward over the knees, arms down and back. */
function snapLand(): Pose {
  const pelvis: Point = [-46, -118];
  const spine = -38;
  const s = shoulderAt(pelvis, spine);
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    hands: { near: along(s, 110, ARM), far: along(s, 113, ARM) },
    feet: { near: [6, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

// ---------------------------------------------------------------- broad jumps (side view)

/** Deep squat at `x`, chest up, ready to jump (frog jump). */
function deepSquat(x: number, arms: Arms): Pose {
  const pelvis: Point = [x - 50, -92];
  return {
    pelvis,
    chest: along(pelvis, -62, 80),
    ...sideArms(pelvis, -62, arms),
    feet: { near: [x + 6, 0], far: [x, 0] },
    toes: { near: 0, far: 0 },
  };
}

/** Take-off: legs straight behind on the toes, body a long diagonal, arms driving forward. */
function takeOff(x: number, arms: Arms): Pose {
  const pelvis: Point = [x + 40, -160];
  return {
    pelvis,
    chest: along(pelvis, -62, 80),
    ...sideArms(pelvis, -62, arms),
    feet: { near: [x + 4, -20], far: [x - 2, -20] },
    toes: { near: 50, far: 50 },
  };
}

/** Peak of a broad jump: knees tucked, feet swinging forward under the hips. */
function broadPeak(x: number, arms: Arms): Pose {
  const pelvis: Point = [x, -264];
  const knee = along(pelvis, 30, 88);
  const ankle = along(knee, 120, 86);
  return {
    pelvis,
    chest: along(pelvis, -70, 80),
    ...sideArms(pelvis, -70, arms),
    knees: { near: { at: knee }, far: { at: along(pelvis, 32, 88) } },
    feet: { near: ankle, far: along(along(pelvis, 32, 88), 122, 86) },
    toes: { near: 30, far: 30 },
  };
}

/** Feet reaching forward just before touch-down. */
function reachLand(x: number): Pose {
  const pelvis: Point = [x - 60, -150];
  return {
    pelvis,
    chest: along(pelvis, -66, 80),
    ...sideArms(pelvis, -66, "forward"),
    feet: { near: [x + 6, -26], far: [x, -26] },
    toes: { near: -20, far: -20 },
  };
}

// ---------------------------------------------------------------- box and depth jumps (side view)

const BOX_X = 96;
const BOX_H = 84;
const BOX: Prop = { kind: "box", x: BOX_X, y: -BOX_H, w: 140, h: BOX_H };

/** Feet tucked high to clear the front edge of the box. */
function boxTuck(): Pose {
  const pelvis: Point = [92, -282];
  const knee = along(pelvis, 22, 88);
  const ankle = along(knee, 128, 86);
  return {
    pelvis,
    chest: along(pelvis, -74, 80),
    ...sideArms(pelvis, -74, "forward"),
    knees: { near: { at: knee }, far: { at: along(pelvis, 24, 88) } },
    feet: { near: ankle, far: along(along(pelvis, 24, 88), 130, 86) },
    toes: { near: 20, far: 20 },
  };
}

/** Soft landing on top of the box. */
function boxLand(): Pose {
  const x = 156;
  const pelvis: Point = [x - 30, -BOX_H - 120];
  return {
    pelvis,
    chest: along(pelvis, -66, 80),
    ...sideArms(pelvis, -66, "forward"),
    feet: { near: [x + 6, -BOX_H], far: [x, -BOX_H] },
    toes: { near: 0, far: 0 },
  };
}

/**
 * Stepping down backwards, one foot at a time: `phase` 0 lifts the far foot back
 * over the edge, 1 puts it on the floor, 2 lifts the near foot off the box, 3 brings
 * it back over the edge.
 */
function boxStepDown(phase: 0 | 1 | 2 | 3): Pose {
  const poses: [Point, Point, Point][] = [
    // pelvis, near ankle, far ankle
    [[146, -BOX_H - 170], [152, -BOX_H], [78, -BOX_H - 44]],
    [[80, -156], [132, -BOX_H], [30, 0]],
    [[64, -164], [124, -BOX_H - 22], [30, 0]],
    [[40, -172], [74, -82], [30, 0]],
  ];
  const [pelvis, near, far] = poses[phase];
  return {
    pelvis,
    chest: along(pelvis, -84, 80),
    ...sideArms(pelvis, -84, "sides"),
    // Last foot off: knee stays out over the edge while the foot drops behind it.
    ...(phase === 3 ? { knees: { near: { at: [125.4, -150.9] as Point } } } : {}),
    feet: { near, far },
    toes: { near: phase >= 2 ? -10 : 0, far: phase === 0 ? 30 : 0 },
  };
}

const DEPTH_BOX: Prop = { kind: "box", x: -230, y: -72, w: 130, h: 72 };
const DEPTH_TOP = -72;
const DEPTH_EDGE = -100;
const DEPTH_LAND = -24;

/** A pose with feet at `near` and `far` (ankles), pelvis given, arms by the sides. */
function feetAt(pelvis: Point, near: Point, far: Point, toes: [number, number], arms: Arms = "sides"): Pose {
  return {
    pelvis,
    chest: along(pelvis, -88, 80),
    ...sideArms(pelvis, -88, arms),
    feet: { near, far },
    toes: { near: toes[0], far: toes[1] },
  };
}

/** Step off the front edge: near foot out over the drop, standing leg still on the box. */
const depthStepOff = (): Pose =>
  feetAt([-136, DEPTH_TOP - 168], [DEPTH_EDGE + 14, DEPTH_TOP - 22], [-150, DEPTH_TOP], [20, 0]);

/** Off the box: both feet past the edge, body dropping. */
const depthOff = (): Pose =>
  feetAt([-86, DEPTH_TOP - 176], [-58, DEPTH_TOP - 14], [DEPTH_EDGE + 10, DEPTH_TOP - 20], [24, 30]);

/** Just before touch-down, arms swinging back. */
const depthDrop = (): Pose => feetAt([DEPTH_LAND - 10, -184], [DEPTH_LAND + 6, -14], [DEPTH_LAND, -14], [10, 10], "back");

/** Walking back up onto the box: far foot lifted over the edge, then on top, then the near foot over. */
const depthReturn = (phase: 0 | 1 | 2): Pose =>
  [
    feetAt([-34, -172], [-26, 0], [DEPTH_EDGE + 10, DEPTH_TOP - 36], [0, 20]),
    feetAt([-70, -170], [-36, 0], [-126, DEPTH_TOP], [0, 0]),
    feetAt([-122, DEPTH_TOP - 160], [DEPTH_EDGE + 10, DEPTH_TOP - 44], [-126, DEPTH_TOP], [20, 0]),
  ][phase];

// ---------------------------------------------------------------- front view building blocks

/** Front view arms: elbows out by `elbowOut` degrees, forearms turned in by `handIn`. */
function frontArms(pelvis: Point, elbowOut: number, handIn: number): Pick<Pose, "hands" | "elbows"> {
  const shoulderY = pelvis[1] - 98;
  const elbowNear = along([pelvis[0] - 22, shoulderY], 90 + elbowOut, 60);
  const elbowFar = along([pelvis[0] + 22, shoulderY], 90 - elbowOut, 60);
  return {
    hands: { near: along(elbowNear, 90 + elbowOut - handIn, 66), far: along(elbowFar, 90 - elbowOut + handIn, 66) },
    elbows: { near: { at: elbowNear }, far: { at: elbowFar } },
  };
}

/** Front view arms straight out at `near`/`far` degrees from the shoulders. */
function frontReach(pelvis: Point, spineTop: Point, near: number, far: number): Pick<Pose, "hands"> {
  const up = angle(pelvis, spineTop);
  const s = along(pelvis, up, 98);
  const across = up + 90;
  const nearShoulder = along(s, across + 180, 22);
  const farShoulder = along(s, across, 22);
  return { hands: { near: along(nearShoulder, near, ARM), far: along(farShoulder, far, ARM) } };
}

/** Two-foot stance at `x`, feet `width` apart, pelvis at `pelvisY`. */
function frontStance(x: number, width: number, pelvisY: number, arms: Pick<Pose, "hands" | "elbows">): Pose {
  return {
    pelvis: [x, pelvisY],
    chest: [x, pelvisY - 80],
    ...arms,
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [x - width / 2, 0], far: [x + width / 2, 0] },
    toes: { near: 180, far: 0 },
  };
}

// ---------------------------------------------------------------- star jump (front view)

function starX(): Pose {
  const pelvis: Point = [0, -262];
  const top: Point = [0, -342];
  return {
    pelvis,
    chest: top,
    ...frontReach(pelvis, top, -142, -38),
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: along([-8, pelvis[1]], 118, 172), far: along([8, pelvis[1]], 62, 172) },
    toes: { near: 150, far: 30 },
  };
}

// ---------------------------------------------------------------- side standing long jump (front view)

/** Loaded stance leaning toward `dir` (+1 or -1), arms swung down and away. */
function sideLoad(x: number, dir: 1 | -1): Pose {
  const pelvis: Point = [x - dir * 18, -136];
  const top = along(pelvis, -90 + dir * 14, 80);
  return {
    pelvis,
    chest: top,
    ...frontReach(pelvis, top, 108 + dir * 6, 72 + dir * 6),
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [x - 34, 0], far: [x + 34, 0] },
    toes: { near: 180, far: 0 },
  };
}

/** Mid-flight sideways: knees drawn up, arms swinging up toward the landing side. */
function sideFlight(x: number, dir: 1 | -1, pelvisY = -270): Pose {
  const pelvis: Point = [x, pelvisY];
  const top = along(pelvis, -90 + dir * 6, 80);
  return {
    pelvis,
    chest: top,
    ...frontReach(pelvis, top, -140 + dir * 6, -40 + dir * 6),
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [x - 30 + dir * 12, pelvisY + 144], far: [x + 30 + dir * 12, pelvisY + 144] },
    toes: { near: 150, far: 30 },
  };
}

/** Sticking the landing at `x`: feet hip-width, knees bent, arms forward-low for balance. */
function sideLand(x: number): Pose {
  return frontStance(x, 68, -140, frontArms([x, -140], 30, 24));
}

// ---------------------------------------------------------------- bounds and hops on one leg (front view)

/**
 * Single-leg landing on `stance` with the foot at `x`: the hip sits over the
 * foot's inside, the free leg sweeps behind and across the standing leg
 * (`cross`), or is lifted with the thigh hanging nearly straight down and the
 * shin folded in behind the standing leg (`lift`).
 */
function oneLeg(
  stance: Side,
  x: number,
  pelvisY: number,
  free: "cross" | "lift",
  arms: Pick<Pose, "hands" | "elbows">,
  footY = 0,
): Pose {
  const dir = stance === "near" ? -1 : 1; // the stance foot is on this side of the pelvis
  const pelvis: Point = [x - dir * 34, pelvisY];
  const freeHip: Point = [pelvis[0] - dir * 8, pelvisY];
  const freeKnee = along(freeHip, 90 + dir * LIFT_THIGH, 88);
  const freeFoot: Point = free === "cross" ? [x + dir * 22, footY - 36] : along(freeKnee, 90 - dir * LIFT_SHIN, 86);
  const freeBend = stance === "near" ? -1 : 1;
  return {
    pelvis,
    chest: [pelvis[0], pelvisY - 80],
    ...arms,
    knees: {
      [stance]: { bend: stance === "near" ? 1 : -1 },
      [other(stance)]: free === "lift" ? { at: freeKnee } : { bend: freeBend },
    },
    feet: { [stance]: [x, footY], [other(stance)]: freeFoot } as Pose["feet"],
    toes: { [stance]: stance === "near" ? 180 : 0, [other(stance)]: 90 } as Pose["toes"],
  };
}

/** A lifted free thigh leans out this many degrees from vertical. */
const LIFT_THIGH = 15;
/** ...and the shin folds in this many degrees from vertical, the foot hooked behind the standing calf. */
const LIFT_SHIN = 68;

/** Arms swung across the body toward the `stance` side (skater). */
function skaterArms(pelvis: Point, stance: Side): Pick<Pose, "hands" | "elbows"> {
  const dir = stance === "near" ? -1 : 1;
  const top: Point = [pelvis[0], pelvis[1] - 80];
  return frontReach(pelvis, top, dir < 0 ? 140 : 70, dir < 0 ? 110 : 40);
}

/** Between bounds: both feet off the floor, body passing over the middle. */
function boundAir(x: number, pelvisY: number): Pose {
  const pelvis: Point = [x, pelvisY];
  return {
    pelvis,
    chest: [x, pelvisY - 80],
    ...frontArms(pelvis, 20, 10),
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [x - 26, pelvisY + 140], far: [x + 26, pelvisY + 140] },
    toes: { near: 120, far: 60 },
  };
}

/** Bench jump: feet this far either side of the bench centre, pelvis this high mid-flight. */
/** Low bench seen end-on across the jump path, midway between take-off (x 0) and landing. */
const BENCH_LAND = 270;
const BENCH_MID = BENCH_LAND / 2;
const BENCH_W = 44;
const BENCH_H = 48;
const BENCH: Prop = { kind: "box", x: BENCH_MID - BENCH_W / 2, y: -BENCH_H, w: BENCH_W, h: BENCH_H };

/**
 * One jump over the bench, take-off at x 0 to landing at BENCH_LAND, ending
 * standing. With `mirror` the same jump is drawn reflected (the way back), and
 * the change of facing between the two passes is the turn round.
 */
function benchJumpOver(mirror?: number): Keyframe[] {
  return [
    // Arms forward while standing, so the turn reads: they swing from pointing one way to the other.
    { hold: 0.25, pose: stand(0, "forward") },
    { hold: 0.05, pose: bent(0, 50, -56, "back") },
    { hold: 0, pose: takeOff(0, "up") },
    { hold: 0.04, pose: broadPeak(BENCH_MID, "forward") },
    { hold: 0, pose: reachLand(BENCH_LAND) },
    { hold: 0.3, pose: bent(BENCH_LAND, 56, -56, "forward") },
    { hold: 0.2, pose: stand(BENCH_LAND, "forward") },
  ].map((frame) => (mirror === undefined ? frame : { ...frame, mirror }));
}

/** Single-leg lateral hop: landings either side of the marker, pelvis height at the top of the hop. */
const HOP_LAND = 72;
const HOP_AIR = -240;

/** Line (or low cone) hopped over. */
const MARKER: Prop = { kind: "box", x: -6, y: -14, w: 12, h: 14 };

export const BATCH_X_SPECS: DoodleSpec[] = [
  {
    id: "hf_141",
    slug: "depth-jump",
    title: "Depth Jump",
    props: [DEPTH_BOX, { kind: "floor" }],
    transition: 0.3,
    frames: [
      { hold: 0.4, pose: stand(-150, "sides", DEPTH_TOP) },
      { hold: 0, pose: depthStepOff() },
      { hold: 0, pose: depthOff() },
      { hold: 0, pose: depthDrop() },
      { hold: 0, pose: bent(DEPTH_LAND, 30, -72, "back") },
      { hold: 0, pose: flight([DEPTH_LAND, -276], -90, "overhead", 168) },
      { hold: 0.3, pose: bent(DEPTH_LAND, 44, -70, "forward") },
      { hold: 0.1, pose: stand(DEPTH_LAND) },
      { hold: 0, pose: depthReturn(0) },
      { hold: 0, pose: depthReturn(1) },
      { hold: 0, pose: depthReturn(2) },
    ],
  },
  {
    id: "fedb_rocket_jump",
    slug: "rocket-jump",
    title: "Rocket Jump",
    props: [{ kind: "floor" }],
    transition: 0.35,
    frames: rocketJump().map((pose, i) => ({ hold: [0.3, 0.1, 0.1, 0.25][i], pose })),
  },
  {
    id: "fedb_knee_tuck_jump",
    slug: "knee-tuck-jump",
    title: "Knee Tuck Jump",
    props: [{ kind: "floor" }],
    transition: 0.3,
    frames: [
      { hold: 0.3, pose: stand(0, "chest") },
      { hold: 0.05, pose: bent(0, 36, -76, "chest") },
      { hold: 0, pose: flight([0, -230], -88, "chest", 150) },
      { hold: 0.1, pose: tuckAir() },
      { hold: 0, pose: flight([0, -226], -88, "chest", 168) },
      { hold: 0.2, pose: bent(0, 40, -74, "chest") },
    ],
  },
  {
    id: "wger_1576",
    slug: "snap-down",
    title: "Snap Down",
    props: [{ kind: "floor" }],
    transition: 0.3,
    frames: [
      { hold: 0.4, pose: snapTall() },
      { hold: 0, pose: snapTall(26) },
      { hold: 0, pose: feetAt([-8, -176], [6, -6], [0, -6], [10, 10], "up") },
      { hold: 0.6, pose: snapLand() },
      { hold: 0.2, pose: stand(0) },
    ],
  },
  {
    id: "hf_96",
    slug: "lunge-jump",
    title: "Lunge Jump",
    props: [{ kind: "floor" }],
    transition: 0.3,
    frames: [
      { hold: 0.15, pose: lunge("near", "back") },
      { hold: 0, pose: lungeAir("near") },
      { hold: 0.15, pose: lunge("far", "back") },
      { hold: 0, pose: lungeAir("far") },
    ],
  },
  {
    id: "fedb_standing_long_jump",
    slug: "standing-long-jump",
    title: "Standing Long Jump",
    props: [{ kind: "floor" }],
    transition: 0.3,
    frames: [
      { hold: 0.2, pose: bent(0, 24, -82, "sides") },
      { hold: 0.05, pose: bent(0, 56, -50, "back") },
      { hold: 0, pose: takeOff(0, "up") },
      { hold: 0.04, pose: broadPeak(130, "forward") },
      { hold: 0, pose: reachLand(250) },
      { hold: 0.3, pose: bent(250, 62, -52, "forward") },
      { hold: 0.1, pose: stand(250) },
      { hold: 0, pose: walkBack(170, "far") },
      { hold: 0, pose: walkBack(80, "near") },
    ],
  },
  {
    id: "hf_97",
    slug: "frog-jump",
    title: "Frog Jump",
    props: [{ kind: "floor" }],
    transition: 0.3,
    frames: [
      { hold: 0.2, pose: deepSquat(0, "back") },
      { hold: 0, pose: takeOff(0, "overhead") },
      { hold: 0.04, pose: broadPeak(110, "up") },
      { hold: 0, pose: reachLand(210) },
      { hold: 0.35, pose: deepSquat(210, "forward") },
      { hold: 0.1, pose: stand(210) },
      { hold: 0, pose: walkBack(140, "far") },
      { hold: 0, pose: walkBack(60, "near") },
    ],
  },
  {
    id: "hf_95",
    slug: "box-jump",
    title: "Box Jump",
    props: [BOX, { kind: "floor" }],
    transition: 0.32,
    frames: [
      { hold: 0.25, pose: stand(24) },
      { hold: 0.05, pose: bent(24, 50, -56, "back") },
      { hold: 0, pose: takeOff(24, "up") },
      { hold: 0, pose: boxTuck() },
      { hold: 0.15, pose: boxLand() },
      { hold: 0.3, pose: stand(156, "sides", -BOX_H) },
      { hold: 0, pose: boxStepDown(0) },
      { hold: 0, pose: boxStepDown(1) },
      { hold: 0, pose: boxStepDown(2) },
      { hold: 0, pose: boxStepDown(3) },
      { hold: 0, pose: stand(30) },
    ],
  },
  {
    // Side view: jump over the bench, turn round, jump back over, turn round.
    // The way back is the same jump drawn mirrored about the bench (`mirror`).
    id: "fedb_bench_jump",
    slug: "bench-jump",
    title: "Bench Jump",
    props: [BENCH, { kind: "floor" }],
    transition: 0.3,
    frames: [...benchJumpOver(), ...benchJumpOver(BENCH_MID)],
  },
  {
    id: "fedb_side_standing_long_jump",
    slug: "side-standing-long-jump",
    title: "Side Standing Long Jump",
    view: "front",
    props: [{ kind: "floor" }],
    transition: 0.32,
    frames: [
      { hold: 0.2, pose: sideLoad(-140, 1) },
      { hold: 0.06, pose: sideFlight(0, 1) },
      { hold: 0.3, pose: sideLand(140) },
      { hold: 0.05, pose: sideLoad(140, -1) },
      { hold: 0.06, pose: sideFlight(0, -1) },
      { hold: 0.3, pose: sideLand(-140) },
    ],
  },
  {
    id: "hf_150",
    slug: "star-jump",
    title: "Star Jump",
    view: "front",
    props: [{ kind: "floor" }],
    transition: 0.32,
    frames: [
      { hold: 0.25, pose: frontStance(0, 60, -172, frontArms([0, -172], 8, 2)) },
      { hold: 0.05, pose: frontStance(0, 60, -146, frontArms([0, -146], 16, 0)) },
      { hold: 0.1, pose: starX() },
      { hold: 0.25, pose: frontStance(0, 60, -150, frontArms([0, -150], 30, 24)) },
    ],
  },
  {
    id: "fedb_skating",
    slug: "skating",
    title: "Skating",
    view: "front",
    props: [{ kind: "floor" }],
    transition: 0.3,
    frames: [
      { hold: 0.12, pose: oneLeg("near", -120, -148, "cross", skaterArms([-86, -148], "near")) },
      { hold: 0, pose: boundAir(0, -196) },
      { hold: 0.12, pose: oneLeg("far", 120, -148, "cross", skaterArms([86, -148], "far")) },
      { hold: 0, pose: boundAir(0, -196) },
    ],
  },
  {
    id: "hf_98",
    slug: "skater-bound",
    title: "Skater Bound",
    view: "front",
    props: [{ kind: "floor" }],
    transition: 0.32,
    frames: [
      { hold: 0.35, pose: oneLeg("near", -130, -144, "cross", skaterArms([-96, -144], "near")) },
      { hold: 0, pose: boundAir(0, -204) },
      { hold: 0.35, pose: oneLeg("far", 130, -144, "cross", skaterArms([96, -144], "far")) },
      { hold: 0, pose: boundAir(0, -204) },
    ],
  },
  {
    id: "fedb_single_leg_lateral_hop",
    slug: "single-leg-lateral-hop",
    title: "Single-Leg Lateral Hop",
    view: "front",
    props: [MARKER, { kind: "floor" }],
    transition: 0.24,
    frames: [
      { hold: 0.08, pose: oneLeg("near", -HOP_LAND, -160, "lift", frontArms([34 - HOP_LAND, -160], 26, 20)) },
      { hold: 0, pose: oneLeg("near", 0, HOP_AIR, "lift", frontArms([34, HOP_AIR], 30, 20), HOP_AIR + 160) },
      { hold: 0.08, pose: oneLeg("near", HOP_LAND, -160, "lift", frontArms([34 + HOP_LAND, -160], 26, 20)) },
      { hold: 0, pose: oneLeg("near", 0, HOP_AIR, "lift", frontArms([34, HOP_AIR], 30, 20), HOP_AIR + 160) },
    ],
  },
];
