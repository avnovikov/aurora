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
  /** false: keep in history but do not count towards the move's level (an easier variant than the move's standards assume). */
  levels?: false;
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
    note: "Reduced-depth one-leg squat. History only: the box squat's standards assume full depth, so 15 partial reps would read as advanced.",
    levels: false,
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
  "Pull-ups": { id: "pullup", confidence: "high", note: "Overhand pull-up." },
  "Chin-ups": { id: "hf_44", confidence: "high", note: "Underhand chin-up." },
  "Australian chin ups": { id: "ntc_australian_chin_up", confidence: "high", note: "Underhand inverted row." },
  "Explosive australian pull-ups": {
    id: "hf_39",
    confidence: "medium",
    note: "Explosive inverted row; the library has the plain inverted row.",
  },
  "Bar knee raises": { id: "hanging_knee_raise", confidence: "high", note: "Hanging knee raise." },
  "Bar L sit raises": {
    id: "hf_110",
    confidence: "medium",
    note: "Raising straight legs to an L on the bar; Hanging Leg Raise is the same move.",
  },
  "Isometric L sit on bar": {
    id: "hf_105",
    confidence: "medium",
    note: "Hanging L hold; the library L-Sit is the support version.",
  },
  "Tucked front lever": { id: "hf_57", confidence: "high", note: "Tuck front lever hold." },
  "Fallen tucked front lever": {
    id: "hf_57",
    confidence: "medium",
    note: "Tuck front lever held while lowering from the top; nearest is the tuck front lever hold.",
  },
  "Tucked front lever raises": {
    id: null,
    confidence: "low",
    note: "Raising into a tuck front lever for reps; the library has only the hold (isometric). Skipped.",
  },
  "Single leg dragon flag": {
    id: null,
    confidence: "low",
    note: "Logged as a hold; the library Dragon Flag is a rep move. Skipped.",
  },
  "Kettlebell squat": { id: "fedb_goblet_squat", confidence: "high", note: "Goblet squat with one kettlebell." },
  "Kettlebell thrusters": { id: "fedb_kettlebell_thruster", confidence: "high", note: "Kettlebell thruster." },
  "Kettlebell snatch": { id: "fedb_one_arm_kettlebell_snatch", confidence: "high", note: "One-arm snatch." },
  "Explosive kettlebell deadlift": {
    id: "wger_1003",
    confidence: "medium",
    note: "Kettlebell deadlift done fast; same move.",
  },
  "Walking lunges with kettlebell": {
    id: "wger_206",
    confidence: "medium",
    note: "Loaded walking lunge; the library's loaded walking lunge uses dumbbells.",
  },
  "Kettlebell chest press": {
    id: "fedb_one_arm_kettlebell_floor_press",
    confidence: "medium",
    note: "Kettlebell press lying on the floor; the library's kettlebell floor press is one-arm.",
  },
  "Kettlebell row": { id: "fedb_one_arm_kettlebell_row", confidence: "medium", note: "Bent-over kettlebell row." },
  "Australian pull-ups": { id: "hf_39", confidence: "high", note: "Inverted row, overhand." },
  "Isometric pull-ups": { id: "wger_1537", confidence: "high", note: "Pull-up hold." },
  "Isometric chin-ups": { id: "wger_1282", confidence: "high", note: "Chin-up hold." },
  "Short pull-ups": {
    id: "pullup",
    confidence: "medium",
    note: "Partial-range pull-ups. History only: the pull-up's standards assume full range.",
    levels: false,
  },
  "Short chin-ups": {
    id: "hf_44",
    confidence: "medium",
    note: "Partial-range chin-ups. History only: the chin-up's standards assume full range.",
    levels: false,
  },
  "Knee raises on parallel bars": {
    id: "hanging_knee_raise",
    confidence: "medium",
    note: "Knee raise supported on parallel bars; same hip flexion as the hanging version.",
  },
  "Leg raises on the ground": { id: "hf_122", confidence: "high", note: "Lying leg raise." },
  "Abdominal crunch with extended arms": { id: "fedb_crunch_hands_overhead", confidence: "high", note: "Crunch with arms overhead." },
  "Kettlebell atomic crunch": {
    id: null,
    confidence: "low",
    note: "No matching crunch with a kettlebell. Skipped.",
  },
};
