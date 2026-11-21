/**
 * Calisteniapp exercise name → Aurora library id (#291).
 *
 * `id` is the unweighted move. A set that Calisteniapp logged with added weight
 * goes to that move's curated `weightedId` twin, the same swap the session's
 * Add weight makes. `hold` marks Calisteniapp exercises logged in seconds; they
 * must map to an isometric library move, because history keeps a hold's
 * seconds in `completedReps`.
 *
 * `confidence`: high = same movement; medium = same pattern and loading, a
 * variant detail differs; low = nearest available, needs the athlete's call.
 * `null` id = do not import (no honest match).
 */
export interface CalisteniappMapping {
  id: string | null;
  confidence: "high" | "medium" | "low";
  note: string;
}

export const CALISTENIAPP_MAP: Readonly<Record<string, CalisteniappMapping>> = {
  Lunges: {
    id: "hf_79",
    confidence: "high",
    note: "Alternating forward lunge. Weighted sets → Dumbbell Lunges Walking (curated twin).",
  },
  "Side lunges": {
    id: "hf_82",
    confidence: "high",
    note: "Lateral lunge.",
  },
  "Deep squat": {
    id: "bodyweight_squat",
    confidence: "medium",
    note: "Full-depth bodyweight squat for reps (not the Deep Squat Hold mobility drill). Weighted sets → Dumbbell Front Squat (curated twin).",
  },
  "Isometric squat": {
    id: "wger_1733",
    confidence: "medium",
    note: "Squat hold at parallel; Isometric Squat to Failure is the only isometric squat-strength move.",
  },
  "Partial single leg squat": {
    id: "wger_1948",
    confidence: "medium",
    note: "Reduced-depth one-leg squat; 1 Leg Box Squat is the same range. Alternative: Assisted pistol squat.",
  },
  "Single leg hamstring bridge": {
    id: "fedb_single_leg_glute_bridge",
    confidence: "medium",
    note: "Single-leg bridge with heels further out (hamstring bias). Weighted sets → Dumbbell Single-leg Hip Thrust (curated twin).",
  },
  "Isometric single leg hamstring bridge": {
    id: null,
    confidence: "low",
    note: "No isometric single-leg bridge in the library. Nearest is Pelvic Tilt Into Bridge (two legs, isometric). Skipped until decided.",
  },
  "Sumo squat": {
    id: "ntc_sumo_squat",
    confidence: "high",
    note: "Wide-stance squat. No curated weighted twin, so weighted sets keep this id and lose the load.",
  },
  "Platform step-ups": {
    id: "step_up",
    confidence: "high",
    note: "Step-up onto a box. Weighted sets → Weighted Step-ups (curated twin).",
  },
  "Calf raises": {
    id: "calf_raise",
    confidence: "high",
    note: "Standing two-leg calf raise. Weighted sets → Dumbbell Calf Raise (curated twin).",
  },
  "Bulgarian squat": {
    id: "bulgarian_split",
    confidence: "high",
    note: "Rear-foot-elevated split squat. Weighted sets → Bulgarian Squat with Dumbbells (curated twin).",
  },
  "Back lunges": {
    id: "reverse_lunge",
    confidence: "high",
    note: "Step-back lunge.",
  },
  "Isometric wall squat": {
    id: "hf_78",
    confidence: "high",
    note: "Wall sit.",
  },
  "Hamstring bridge": {
    id: "glute_bridge",
    confidence: "medium",
    note: "Two-leg bridge with heels further out. Weighted sets → Dumbbell Hip Thrust (curated twin).",
  },
  "Hamstring bridge with elevation": {
    id: "glute_bridge",
    confidence: "medium",
    note: "Feet-elevated hamstring bridge; the library has no feet-elevated bridge.",
  },
  "Kettlebell half get up": {
    id: "fedb_kettlebell_turkish_get_up_lunge_style",
    confidence: "medium",
    note: "First half of a Turkish get-up; the full get-up is the nearest move.",
  },
  "Kettlebell hip halo": {
    id: null,
    confidence: "low",
    note: "Kettlebell passed around the waist; no matching move (Halo is around the head). Skipped.",
  },
  "Kettlebell shoulder halo": {
    id: "fedb_kettlebell_halo",
    confidence: "high",
    note: "Halo around the head.",
  },
  "Kettlebell deadlift": {
    id: "wger_1003",
    confidence: "high",
    note: "Kettlebell deadlift.",
  },
  "Kettlebell swing": {
    id: "wger_331",
    confidence: "high",
    note: "Two-hand swing.",
  },
  "One arm kettlebell row": {
    id: "fedb_one_arm_kettlebell_row",
    confidence: "high",
    note: "One-arm row.",
  },
  "Squat and kettlebell press": {
    id: "fedb_kettlebell_thruster",
    confidence: "high",
    note: "Squat into overhead press.",
  },
};
