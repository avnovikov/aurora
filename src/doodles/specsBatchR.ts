import { solvePose } from "./rig";
import type { DoodleSpec, Point, Pose } from "./rig";
import { lockedShoulderY, pushUp } from "./specsBatchC";

/**
 * Batch R: Spiderman plank, drawn with depth shading. In side view
 * the far limbs are pale behind the body and the near limbs bright on top, so
 * the bright near knee crossing the bright near arm reads as passing outside
 * the elbow, and the pale far knee does the same behind the body.
 * Floor at y = 0, up is negative, the figure faces +x (head at +x in a plank).
 *
 * The knee really travels out to the side, which a fixed-length thigh cannot
 * foreshorten: in side view it swings forward through a brief "under" frame
 * (thigh below the hip, foot lifted) rather than through an invisible sideways arc.
 *
 * Left out, depth shading included:
 *   hf_13 Spiderman Push-Up   at push-up depth the elbow sits on the torso line,
 *     so the full-length thigh lands on the torso or under the chest: a tangle at phone size.
 *   hf_71 Dragon Squat, hf_81 Curtsy Lunge   The support knee bends towards the
 *     camera in front view. With full-length bones any lowering throws that knee
 *     40-60 units sideways (a lateral lunge) or the hips off the feet; in side view
 *     the crossing is sideways and invisible (a low-leg pistol, a reverse lunge).
 *   fedb_crossover_reverse_lunge   the defining torso rotation has no joint in the rig.
 *   ntc_fire_hydrant   the knee lifts straight at the camera from the side; from
 *     the front the all-fours torso points at the camera and cannot be foreshortened.
 */

const round = (value: number): number => Math.round(value * 10) / 10;

/** Point `length` from `from` at `degrees` (0 = +x, 90 = down, -90 = up). */
function along(from: Point, degrees: number, length: number): Point {
  const r = (degrees * Math.PI) / 180;
  return [round(from[0] + Math.cos(r) * length), round(from[1] + Math.sin(r) * length)];
}


type Side = "near" | "far";
const other = (side: Side): Side => (side === "near" ? "far" : "near");

const THIGH = 88;
const SHIN = 86;

// ---------------------------------------------------------------- spiderman (knee outside the elbow)

/** Hands on the floor here; feet a little nearer than a long plank, so the knee reaches past the arm. */
const SP_HAND_X = 62;
const SP_FOOT: Point = [-170, -18];
const SP_TOP = lockedShoulderY(SP_FOOT, [SP_HAND_X, 0]);

/**
 * Push-up or plank at `shoulderY`; `knee` lifts that foot off the floor with
 * the thigh at `thighDeg` from the hip and the ankle hovering at `ankleY`
 * behind the knee.
 */
function spiderman(shoulderY: number, knee: Side | null, thighDeg = 0, ankleY = -8, foot: Point = SP_FOOT): Pose {
  const base = pushUp(shoulderY, SP_HAND_X, foot);
  if (!knee) return base;
  const solved = solvePose(base);
  const hip = solved.legs[knee].root;
  const k = along(hip, thighDeg, THIGH);
  const shinDeg = 180 - (Math.asin(Math.max(-1, Math.min(1, (ankleY - k[1]) / SHIN))) * 180) / Math.PI;
  const ankle = along(k, shinDeg, SHIN);
  return {
    ...base,
    chest: solved.chest,
    knees: { [knee]: { at: k } },
    feet: { [knee]: ankle, [other(knee)]: foot },
    toes: { [knee]: 185, [other(knee)]: 62 },
  };
}

export const BATCH_R_SPECS: DoodleSpec[] = [
  {
    id: "ntc_spiderman_plank",
    slug: "spiderman-plank",
    title: "Spiderman plank",
    transition: 0.55,
    frames: [
      { hold: 0.4, pose: spiderman(SP_TOP, null) },
      { hold: 0, pose: spiderman(SP_TOP, "near", 30, -36) },
      { hold: 0.9, pose: spiderman(SP_TOP, "near", 14, -30) },
      { hold: 0, pose: spiderman(SP_TOP, "near", 30, -36) },
      { hold: 0.4, pose: spiderman(SP_TOP, null) },
      { hold: 0, pose: spiderman(SP_TOP, "far", 30, -36) },
      { hold: 0.9, pose: spiderman(SP_TOP, "far", 14, -30) },
      { hold: 0, pose: spiderman(SP_TOP, "far", 30, -36) },
    ],
  },
];
