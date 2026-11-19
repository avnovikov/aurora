import { BONES, HIP_SIDE, other, zOut } from "./rig";
import type { DoodleSpec, Keyframe, Point, Pose, Side, Sideways } from "./rig";
import { lockedY3, TWO_VIEWS } from "./sideways";
import { PLANK_FOOT, pushUp } from "./specsBatchC";

/**
 * Batch AJ (#174): moves drawn in two views from the start, because one view
 * can't show them (see docs/doodles-authoring.md, "Two views").
 *
 * hf_13 Spiderman Push-Up: in one view the thigh tangles with the elbow at
 * push-up depth. In 3D the knee travels out to the side and up, so it passes
 * outside the elbow; the side view draws that thigh short (foreshortened).
 */

const round = (value: number): number => Math.round(value * 1000) / 1000;

const THIGH = BONES.thigh;
const SHIN = BONES.shin;

// ---------------------------------------------------------------- spiderman push-up

const SP_HAND_X = 62;
/** Hands slightly wider than the shoulders (±22). */
const SP_HAND_Z = 30;
/** Elbows back along the body, rolled out a little. */
const SP_ELBOW_OUT = 12;
const SP_BOTTOM = -50;

const spPush = (y: number): Pose => pushUp(y, SP_HAND_X);
const SP_HANDS: Sideways = {
  hands: { near: -SP_HAND_Z, far: SP_HAND_Z },
  elbows: { near: { out: SP_ELBOW_OUT }, far: { out: SP_ELBOW_OUT } },
};
const SP_TOP = lockedY3(spPush, SP_HANDS);

type P3 = [number, number, number];

/** The point `length` from `from` towards `to` (3D). */
function toward(from: P3, to: P3, length: number): P3 {
  const d: P3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const n = Math.hypot(...d);
  return [round(from[0] + (d[0] / n) * length), round(from[1] + (d[1] / n) * length), round(from[2] + (d[2] / n) * length)];
}

/**
 * Shoulder height `y`; `side`'s knee swings out to the side (`full` false) or
 * all the way up to that elbow (`full`), the foot off the floor trailing behind.
 */
function spiderman(y: number, side: Side | null, full = false): Keyframe {
  const base = spPush(y);
  if (!side) return { hold: 0, pose: base, sideways: SP_HANDS };
  const pelvis = base.pelvis as Point;
  const chest = base.chest as Point;
  const out = zOut(side);
  const hip: P3 = [pelvis[0], pelvis[1], out * HIP_SIDE];
  // Full: just behind and outside the elbow (it sits about 50 out, level with the chest).
  // Partway: the knee swung out to the side, still a little behind the hip.
  const aim: P3 =
    full
      ? [chest[0] - 34, pelvis[1] - 12, out * (HIP_SIDE + 90)]
      : [pelvis[0] - 30, pelvis[1] + 20, out * (HIP_SIDE + 80)];
  const knee = toward(hip, aim, THIGH);
  // The shin trails back and a little down, the foot clear of the floor.
  const ankle = toward(knee, [knee[0] - 80, knee[1] + 24, knee[2] - out * 10], SHIN);
  const sideways: Sideways = {
    ...SP_HANDS,
    knees: { [side]: { at: knee[2] } },
    feet: { [side]: ankle[2] },
  };
  return {
    hold: 0,
    pose: {
      ...base,
      knees: { [side]: { at: [knee[0], knee[1]] } },
      feet: { [side]: [ankle[0], ankle[1]], [other(side)]: PLANK_FOOT },
      toes: { [side]: 190, [other(side)]: 62 },
    },
    sideways,
  };
}

const held = (frame: Keyframe, hold: number): Keyframe => ({ ...frame, hold });

function spidermanRep(): Keyframe[] {
  const mid = Math.round((SP_TOP + SP_BOTTOM) / 2);
  return [
    held(spiderman(SP_TOP, null), 0.3),
    spiderman(mid, "near"),
    held(spiderman(SP_BOTTOM, "near", true), 0.35),
    spiderman(mid, "near"),
    held(spiderman(SP_TOP, null), 0.3),
    spiderman(mid, "far"),
    held(spiderman(SP_BOTTOM, "far", true), 0.35),
    spiderman(mid, "far"),
  ];
}

export const BATCH_AJ_SPECS: DoodleSpec[] = [
  {
    id: "hf_13",
    slug: "spiderman-push-up",
    title: "Spiderman Push-Up",
    views: TWO_VIEWS,
    transition: 0.5,
    frames: spidermanRep(),
  },
];
