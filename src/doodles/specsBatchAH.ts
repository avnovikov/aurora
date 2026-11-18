import type { DoodleSpec, Keyframe, Point, Pose, Prop, Side } from "./rig";

/**
 * Batch AH (#174): standing leg moves and plyometrics. Floor at y = 0, up is
 * negative, the side-view figure faces +x. Import only from ./rig.
 *
 * Squats, lunges, the reverse Nordic, butt kicks, skips and the shuttle run are
 * drawn in side view; sideways steps, slides, hops and bounds in front view
 * (near side at -x). Each move is drawn in one view; the plane it cannot show
 * is noted on the spec.
 *
 * Left out:
 *   fedb_crossover_reverse_lunge   the defining torso rotation over the front
 *     leg has no joint in the rig, so it would read as a plain reverse lunge.
 */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}

const angle = (from: Point, to: Point): number => (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;

const other = (side: Side): Side => (side === "near" ? "far" : "near");

/** Floor line, so take-off and landing read. */
const floor = (x1: number, x2: number): Prop => ({ kind: "bar", y: 0, x1, x2 });

/** Shoulder of a straight spine (pelvis → chest is 80, shoulder 18 further). */
const shoulderAt = (pelvis: Point, spine: number): Point => along(pelvis, spine, 98);

/** Arm reach with the elbow nearly locked (shoulder to fingertip). */
const ARM = 125;
const THIGH = 88;
const SHIN = 86;

// ---------------------------------------------------------------- side view arms

type Arms = "sides" | "back" | "forward" | "up" | "chest";

/** Hands for an arm position, from a straight spine at `spine` degrees. */
function sideArms(pelvis: Point, spine: number, arms: Arms): Pick<Pose, "hands" | "elbows"> {
  const s = shoulderAt(pelvis, spine);
  const tilt = spine + 90;
  switch (arms) {
    case "sides":
      return {
        hands: { near: along(s, 86, ARM), far: along(s, 88, ARM) },
        elbows: { near: { bend: 1 }, far: { bend: 1 } },
      };
    case "back":
      return { hands: { near: along(s, 116, ARM), far: along(s, 118, ARM) } };
    case "forward":
      return { hands: { near: along(s, -4, ARM), far: along(s, -1, ARM) } };
    case "up":
      return { hands: { near: along(s, -40 + tilt, ARM), far: along(s, -43 + tilt, ARM) } };
    case "chest": {
      // Elbows bent, forearms level, hands together in front of the chest.
      const elbow = along(s, spine + 160, 60);
      const farElbow = along(s, spine + 162, 60);
      return {
        hands: { near: along(elbow, spine + 90, 66), far: along(farElbow, spine + 90, 66) },
        elbows: { near: { at: elbow }, far: { at: farElbow } },
      };
    }
  }
}

/** Arms swinging from hanging (`t` 0) to reaching straight forward (`t` 1). */
function armsToward(pelvis: Point, spine: number, t: number): Pick<Pose, "hands" | "elbows"> {
  const s = shoulderAt(pelvis, spine);
  const a = 86 - 88 * t;
  return {
    hands: { near: along(s, a, ARM), far: along(s, a + 3, ARM) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
  };
}

// ---------------------------------------------------------------- squats (side view)

/** Feet flat at x 0 (side view stacks them); hips at `pelvis`, chest leaning to `spine`. */
function squat(pelvis: Point, spine: number, arms: Pick<Pose, "hands" | "elbows">): Pose {
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    ...arms,
    feet: { near: [6, 0], far: [0, 0] },
    toes: { near: 0, far: 0 },
  };
}

const STAND: Point = [0, -172];
const standTall = (): Pose => squat(STAND, -90, armsToward(STAND, -90, 0));

/** Slow squat: share of the way down (0 standing, 1 full depth, hips below the knees). */
function slowSquat(t: number): Pose {
  const pelvis: Point = [round(-54 * t), round(-172 + 88 * t)];
  const spine = -90 + 28 * t;
  return squat(pelvis, spine, armsToward(pelvis, spine, Math.min(1, t * 1.25)));
}

/** Sit squat: partway down, hips back, thighs well above parallel. */
function sitSquat(): Pose {
  const pelvis: Point = [-36, -126];
  return squat(pelvis, -70, armsToward(pelvis, -70, 1));
}

// ---------------------------------------------------------------- jumps (side view)

/** Knees and hips bent with feet flat at x 0: `drop` lowers the pelvis from standing. */
function bent(drop: number, spine: number, arms: Arms): Pose {
  const pelvis: Point = [round(-drop * 0.45), -172 + drop];
  return squat(pelvis, spine, sideArms(pelvis, spine, arms));
}

/**
 * Double leg butt kick in the air: thighs hang straight down under the hips
 * (knees not lifted forward) and both shins fold back so the heels come up to the glutes.
 */
function buttKickAir(): Pose {
  const pelvis: Point = [0, -262];
  const spine = -86;
  const knee = along(pelvis, 94, THIGH);
  const farKnee = along(pelvis, 96, THIGH);
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    ...sideArms(pelvis, spine, "up"),
    knees: { near: { at: knee }, far: { at: farKnee } },
    feet: { near: along(knee, 246, SHIN), far: along(farKnee, 248, SHIN) },
    toes: { near: 190, far: 190 },
  };
}

/** Leaving / meeting the floor: legs long under the hips, toes pointed. */
function takeOffUp(pelvisY: number, arms: Arms): Pose {
  const pelvis: Point = [0, pelvisY];
  const foot: Point = [4, pelvisY + 166];
  return {
    pelvis,
    chest: along(pelvis, -88, 80),
    ...sideArms(pelvis, -88, arms),
    feet: { near: foot, far: [foot[0] - 4, foot[1]] },
    toes: { near: 70, far: 70 },
  };
}

// ---------------------------------------------------------------- reverse Nordic (side view)

const RN_KNEE: Point = [0, -5];

/** Kneeling on the shins, the straight knee-to-head line leaning `lean` degrees back from vertical. */
function reverseNordic(lean: number): Pose {
  const dir = -90 - lean;
  const pelvis = along(RN_KNEE, dir, THIGH);
  const s = along(pelvis, dir, 98);
  // Arms held straight out in front of the chest, square to the body.
  const reach = dir + 90;
  return {
    pelvis,
    chest: along(pelvis, dir, 80),
    hands: { near: along(s, reach, ARM), far: along(s, reach + 3, ARM) },
    knees: { near: { at: RN_KNEE }, far: { at: RN_KNEE } },
    feet: { near: [-86, -5], far: [-86, -5] },
    toes: { near: 180, far: 180 },
  };
}

// ---------------------------------------------------------------- lunges and single-leg squats (side view)

/**
 * Curtsy lunge: the far leg (drawn pale, behind the body) steps back and
 * across behind the near leg; both knees bend until the front thigh nears parallel.
 */
function curtsy(depth: number): Pose {
  const pelvis: Point = [round(-14 * depth), round(-172 + 72 * depth)];
  const spine = -90 + 4 * depth;
  const rear: Point = depth === 0 ? [-2, 0] : [round(-62 * depth), round(-12 * depth)];
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    ...sideArms(pelvis, spine, "chest"),
    feet: { near: [12, 0], far: rear },
    toes: { near: 0, far: depth === 0 ? 0 : 34 },
  };
}

/** Curtsy lunge, rear foot lifted on its way back. */
function curtsyStep(): Pose {
  const pelvis: Point = [-6, -168];
  return {
    pelvis,
    chest: along(pelvis, -89, 80),
    ...sideArms(pelvis, -89, "chest"),
    feet: { near: [12, 0], far: [-34, -26] },
    toes: { near: 0, far: 40 },
  };
}

/**
 * Dragon squat on the near leg: arms forward, the free (far, pale) leg sweeps
 * behind the standing leg and reaches back low as the hips sink to full depth.
 */
function dragon(t: number): Pose {
  const pelvis: Point = [round(-44 * t), round(-170 + 104 * t)];
  const spine = -88 + 30 * t;
  const s = shoulderAt(pelvis, spine);
  const free: Point = t === 0 ? [-30, -40] : [round(-30 - 166 * t), round(-40 + 26 * t)];
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    hands: { near: along(s, -6, ARM), far: along(s, -3, ARM) },
    feet: { near: [8, 0], far: free },
    knees: { far: { bend: -1 } },
    toes: { near: 0, far: 150 },
  };
}

// ---------------------------------------------------------------- high knee skips (side view)

/** Skipping: the `side` knee driven to hip height, the opposite arm swung forward; `air` hops off the stance foot. */
function skipKnee(side: Side, air: boolean): Pose {
  const pelvis: Point = [0, air ? -206 : -178];
  const k = along(pelvis, -4, THIGH);
  const shoulder = along(pelvis, -88, 98);
  const fwdElbow = along(shoulder, 40, 60);
  const backElbow = along(shoulder, 125, 60);
  // In the air the stance foot hangs toes down, its tip ~15 clear of the floor.
  const stanceY = air ? -34 : -10;
  return {
    pelvis,
    chest: along(pelvis, -88, 80),
    knees: { [side]: { at: k } },
    feet: { [side]: along(k, 98, SHIN), [other(side)]: [2, stanceY] } as Pose["feet"],
    toes: { [side]: 40, [other(side)]: air ? 70 : 28 } as Pose["toes"],
    hands: { [other(side)]: along(fwdElbow, -50, 66), [side]: along(backElbow, 60, 66) } as Pose["hands"],
    elbows: { [other(side)]: { at: fwdElbow }, [side]: { at: backElbow } } as Pose["elbows"],
  };
}

/** Landing between skips: the `rising` knee coming up, the other foot landing on its ball. */
function skipStep(rising: Side): Pose {
  const pelvis: Point = [0, -180];
  const k = along(pelvis, 54, THIGH);
  const shoulder = along(pelvis, -88, 98);
  const elbow = along(shoulder, 96, 60);
  return {
    pelvis,
    chest: along(pelvis, -88, 80),
    knees: { [rising]: { at: k } },
    feet: { [rising]: along(k, 140, SHIN), [other(rising)]: [6, -11] } as Pose["feet"],
    toes: { [rising]: 70, [other(rising)]: 30 } as Pose["toes"],
    hands: { near: along(elbow, 20, 66), far: along(elbow, 24, 66) },
    elbows: { near: { at: elbow }, far: { at: elbow } },
  };
}

// ---------------------------------------------------------------- shuttle run (side view)

/** Sprinting stride at `x`: `lead` knee forward, the other leg pushing off behind, opposite arm forward. */
function stride(x: number, lead: Side): Pose {
  const pelvis: Point = [x, -170];
  const spine = -76;
  const s = shoulderAt(pelvis, spine);
  const knee = along(pelvis, 34, THIGH);
  const fwdElbow = along(s, 60, 60);
  const backElbow = along(s, 140, 60);
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    knees: { [lead]: { at: knee } } as Pose["knees"],
    feet: { [lead]: along(knee, 112, SHIN), [other(lead)]: [x - 56, -9] } as Pose["feet"],
    toes: { [lead]: 20, [other(lead)]: 24 } as Pose["toes"],
    hands: { [other(lead)]: along(fwdElbow, -30, 66), [lead]: along(backElbow, 70, 66) } as Pose["hands"],
    elbows: { [other(lead)]: { at: fwdElbow }, [lead]: { at: backElbow } } as Pose["elbows"],
  };
}

/**
 * Turn at the marker: a short low plant. Front (near) foot planted, the back
 * knee bent and off the floor on the ball of the foot, torso pitched down,
 * near hand reaching down and forward to touch the line just ahead of the front foot.
 */
function shuttleTurn(x: number): Pose {
  const pelvis: Point = [x - 50, -134];
  const spine = 8;
  const s = shoulderAt(pelvis, spine);
  return {
    pelvis,
    chest: along(pelvis, spine, 80),
    head: along(along(pelvis, spine, 80), spine - 8, 56),
    hands: { near: [x + 48, -3], far: along(s, 140, ARM) },
    elbows: { near: { bend: 1 }, far: { bend: 1 } },
    feet: { near: [x + 16, 0], far: [x - 150, -9] },
    knees: { near: { bend: -1 }, far: { bend: -1 } },
    toes: { near: 0, far: 24 },
  };
}

/** Shuttle: run from the start to the turn line, turn low. The way back is the same run mirrored. */
const SHUTTLE_TURN = 130;
function shuttleLeg(mirror?: number): Keyframe[] {
  return [
    { hold: 0, pose: stride(-100, "near") },
    { hold: 0, pose: stride(-20, "far") },
    { hold: 0, pose: stride(60, "near") },
    { hold: 0.2, pose: shuttleTurn(SHUTTLE_TURN) },
  ].map((frame) => (mirror === undefined ? frame : { ...frame, mirror }));
}

/** Cones at both turn lines. */
const cone = (x: number): Prop => ({ kind: "box", x: x - 7, y: -16, w: 14, h: 16 });

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
function frontReach(pelvis: Point, spineTop: Point, near: number, far: number): Pick<Pose, "hands" | "elbows"> {
  const up = angle(pelvis, spineTop);
  const s = along(pelvis, up, 98);
  const nearShoulder = along(s, up - 90, 22);
  const farShoulder = along(s, up + 90, 22);
  return {
    hands: { near: along(nearShoulder, near, 126), far: along(farShoulder, far, 126) },
    elbows: { near: { at: along(nearShoulder, near, 60) }, far: { at: along(farShoulder, far, 60) } },
  };
}

/** Front view, both feet down at `nearX` / `farX`, pelvis at `pelvis`. */
function frontFeet(pelvis: Point, nearX: number, farX: number, arms: Pick<Pose, "hands" | "elbows">): Pose {
  return {
    pelvis,
    chest: [pelvis[0], pelvis[1] - 80],
    ...arms,
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [nearX, 0], far: [farX, 0] },
    toes: { near: 180, far: 0 },
  };
}

/** Step jack: one foot stepped out to `side`, arms swung overhead in a V. */
function stepJackOut(side: Side): Pose {
  const dir = side === "near" ? -1 : 1;
  const pelvis: Point = [dir * 36, -166];
  const top: Point = [pelvis[0], pelvis[1] - 80];
  const nearX = side === "near" ? -96 : -10;
  const farX = side === "far" ? 96 : 10;
  return frontFeet(pelvis, nearX, farX, frontReach(pelvis, top, -118, -62));
}

const stepJackIn = (): Pose => frontFeet([0, -172], -10, 10, frontArms([0, -172], 6, 0));

/** Low athletic stance for side slides, hands up in front. */
const slide = (nearX: number, farX: number): Pose =>
  frontFeet([(nearX + farX) / 2, -138], nearX, farX, frontArms([(nearX + farX) / 2, -138], 24, -36));

/** Squat at the end of the slides: wide feet, hips down, hands together at the chest. */
function slideSquat(x: number): Pose {
  const pelvis: Point = [x, -112];
  return frontFeet(pelvis, x - 56, x + 56, frontArms(pelvis, 24, -36));
}

/** Three slides from wide stance at `from` (centre) in direction `dir`, ending wide 150 further on. */
function slides(from: number, dir: 1 | -1): Pose[] {
  const poses: Pose[] = [];
  // Wide stance is 100 across, narrow 50: the trailing foot closes in, then the lead foot steps out.
  for (let i = 0; i < 3; i += 1) {
    const c = from + dir * 50 * i;
    const lead = c + dir * 50;
    const trailIn = c;
    poses.push(dir > 0 ? slide(trailIn, lead) : slide(lead, trailIn));
    poses.push(dir > 0 ? slide(c, c + 100) : slide(c - 100, c));
  }
  return poses;
}

/**
 * Landing on one leg (`stance`) with that foot at `x` and the knee bent; the free
 * leg is lifted off the floor, knee bent out to its side and the foot tucked up beside the standing shin.
 */
function oneLeg(stance: Side, x: number, pelvisY: number, arms: Pick<Pose, "hands" | "elbows">, footY = 0): Pose {
  const dir = stance === "near" ? -1 : 1;
  const pelvis: Point = [x - dir * 30, pelvisY];
  const freeHip: Point = [pelvis[0] - dir * 8, pelvisY];
  const freeKnee = along(freeHip, 90 + dir * 38, THIGH);
  return {
    pelvis,
    chest: [pelvis[0], pelvisY - 80],
    ...arms,
    knees: {
      [stance]: { bend: stance === "near" ? 1 : -1 },
      [other(stance)]: { at: freeKnee },
    },
    feet: { [stance]: [x, footY], [other(stance)]: along(freeKnee, 90 - dir * 55, SHIN) } as Pose["feet"],
    toes: { [stance]: stance === "near" ? 180 : 0, [other(stance)]: 90 } as Pose["toes"],
  };
}

/** Between bounds: both feet off the floor, body passing over the middle, legs reaching apart. */
function boundAir(x: number, pelvisY: number, reach: number): Pose {
  const pelvis: Point = [x, pelvisY];
  return {
    pelvis,
    chest: [x, pelvisY - 80],
    ...frontArms(pelvis, 34, 12),
    knees: { near: { bend: 1 }, far: { bend: -1 } },
    feet: { near: [x - reach, pelvisY + 150], far: [x + reach, pelvisY + 150] },
    toes: { near: 120, far: 60 },
  };
}

export const BATCH_AH_SPECS: DoodleSpec[] = [
  {
    // Side view: the step back and across is sideways (front plane) and can't show;
    // the far leg is drawn pale, behind the standing leg.
    id: "hf_81",
    slug: "curtsy-lunge",
    title: "Curtsy Lunge",
    transition: 0.7,
    frames: [
      { hold: 0.4, pose: curtsy(0) },
      { hold: 0, pose: curtsyStep() },
      { hold: 0.5, pose: curtsy(1) },
      { hold: 0, pose: curtsyStep() },
    ],
  },
  {
    // Side view: the free leg's sweep across behind the standing leg is sideways and can't show.
    id: "hf_71",
    slug: "dragon-squat",
    title: "Dragon Squat",
    transition: 1.1,
    frames: [
      { hold: 0.4, pose: dragon(0) },
      { hold: 0.5, pose: dragon(1) },
    ],
  },
  {
    id: "wger_1325",
    slug: "lateral-push-off",
    title: "Lateral Push Off",
    view: "front",
    props: [floor(-170, 170)],
    transition: 0.3,
    frames: [
      { hold: 0.35, pose: oneLeg("near", -90, -156, frontArms([-60, -156], 28, 18)) },
      { hold: 0, pose: boundAir(0, -196, 30) },
      { hold: 0.35, pose: oneLeg("far", 90, -156, frontArms([60, -156], 28, 18)) },
      { hold: 0, pose: boundAir(0, -196, 30) },
    ],
  },
  {
    // Front view: the pivot (a half turn) can't show from the front.
    id: "wger_1195",
    slug: "side-slides-squats",
    title: "Side Slides + Squats",
    view: "front",
    props: [floor(-200, 200)],
    transition: 0.2,
    frames: [
      ...slides(-75, 1).map((pose) => ({ hold: 0.02, pose })),
      { hold: 0.35, pose: slideSquat(75) },
      { hold: 0.05, pose: slide(25, 125) },
      ...slides(75, -1).map((pose) => ({ hold: 0.02, pose })),
      { hold: 0.35, pose: slideSquat(-75) },
      { hold: 0.05, pose: slide(-125, -25) },
    ],
  },
  {
    id: "fedb_sit_squats",
    slug: "sit-squats",
    title: "Sit Squats",
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: standTall() },
      { hold: 0.35, pose: sitSquat() },
    ],
  },
  {
    // Three-second lowering (three slow steps), a pause at the bottom, one quicker rise.
    id: "wger_1963",
    slug: "slow-squat",
    title: "Slow Squat",
    transition: 0.9,
    frames: [
      { hold: 0.4, pose: slowSquat(0) },
      { hold: 0.05, pose: slowSquat(0.36) },
      { hold: 0.05, pose: slowSquat(0.7) },
      { hold: 0.7, pose: slowSquat(1) },
    ],
  },
  {
    id: "wger_909",
    slug: "reverse-nordic-curl",
    title: "Reverse Nordic Curl",
    props: [floor(-130, 120)],
    transition: 0.9,
    frames: [
      { hold: 0.5, pose: reverseNordic(0) },
      { hold: 0.05, pose: reverseNordic(22) },
      { hold: 0.5, pose: reverseNordic(44) },
      { hold: 0.05, pose: reverseNordic(22) },
    ],
  },
  {
    id: "wger_1962",
    slug: "step-jack",
    title: "Step Jack",
    view: "front",
    props: [floor(-150, 150)],
    transition: 0.35,
    frames: [
      { hold: 0.12, pose: stepJackIn() },
      { hold: 0.18, pose: stepJackOut("near") },
      { hold: 0.12, pose: stepJackIn() },
      { hold: 0.18, pose: stepJackOut("far") },
    ],
  },
  {
    // Front view: the forward travel and the knee drive point at the camera and can't show.
    id: "fedb_alternate_leg_diagonal_bound",
    slug: "alternate-leg-diagonal-bound",
    title: "Alternate Leg Diagonal Bound",
    view: "front",
    props: [floor(-220, 220)],
    transition: 0.34,
    frames: [
      { hold: 0.3, pose: oneLeg("near", -140, -148, frontArms([-110, -148], 34, 20)) },
      { hold: 0, pose: boundAir(0, -224, 44) },
      { hold: 0.3, pose: oneLeg("far", 140, -148, frontArms([110, -148], 34, 20)) },
      { hold: 0, pose: boundAir(0, -224, 44) },
    ],
  },
  {
    // Side view: run to the line, turn low, run back (the way back mirrored). One shuttle of the set.
    id: "wger_1579",
    slug: "bronco",
    title: "Bronco",
    props: [cone(-SHUTTLE_TURN - 60), cone(SHUTTLE_TURN + 60), floor(-240, 240)],
    transition: 0.2,
    frames: [...shuttleLeg(), ...shuttleLeg(0)],
  },
  {
    id: "fedb_double_leg_butt_kick",
    slug: "double-leg-butt-kick",
    title: "Double Leg Butt Kick",
    props: [floor(-110, 110)],
    transition: 0.28,
    frames: [
      { hold: 0.25, pose: bent(16, -86, "sides") },
      { hold: 0.05, pose: bent(46, -72, "back") },
      { hold: 0, pose: takeOffUp(-226, "up") },
      { hold: 0.1, pose: buttKickAir() },
      { hold: 0, pose: takeOffUp(-222, "forward") },
      { hold: 0.2, pose: bent(44, -74, "forward") },
    ],
  },
  {
    id: "wger_1318",
    slug: "high-knee-skips",
    title: "High Knee Skips",
    props: [floor(-110, 110)],
    transition: 0.17,
    frames: [
      { hold: 0, pose: skipKnee("near", false) },
      { hold: 0.06, pose: skipKnee("near", true) },
      { hold: 0, pose: skipStep("far") },
      { hold: 0, pose: skipKnee("far", false) },
      { hold: 0.06, pose: skipKnee("far", true) },
      { hold: 0, pose: skipStep("near") },
    ],
  },
];
