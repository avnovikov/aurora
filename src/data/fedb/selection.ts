import type { ExerciseType, Pattern } from "../../domain/types";
import type { LoadRegion } from "../seed";
import type { FedbExerciseRecord } from "./types";

/** Equipment values that mean "no gear needed". */
const BODYWEIGHT_EQUIPMENT = new Set<string | null>(["body only", null]);

/** Pure dumbbell in free-exercise-db (not barbell/cable/machine hybrids). */
export const DUMBBELL_EQUIPMENT = "dumbbell";

/**
 * Tagged `other` in free-exercise-db but trainable with a bar, rings,
 * parallel bars, a chair, or nothing at all.
 */
export const FEDB_ALLOW_OTHER: readonly string[] = [
  "Behind Head Chest Stretch",
  "Bodyweight Mid Row",
  "Chair Leg Extended Stretch",
  "Chair Upper Body Stretch",
  "Chest And Front Of Shoulder Stretch",
  "Gironda Sternum Chins",
  "IT Band and Glute Stretch",
  "Intermediate Groin Stretch",
  "Intermediate Hip Flexor and Quad Stretch",
  "Kipping Muscle Up",
  "Knee/Hip Raise On Parallel Bars",
  "Lying Bent Leg Groin",
  "Lying Hamstring",
  "Mixed Grip Chin",
  "On-Your-Back Quad Stretch",
  "One Handed Hang",
  "Peroneals Stretch",
  "Posterior Tibialis Stretch",
  "Quad Stretch",
  "Round The World Shoulder Stretch",
  "Seated Hamstring and Calf Stretch",
  "Side To Side Chins",
  "Single-Leg Lateral Hop",
  "Skating",
  "Standing Biceps Stretch",
  "Standing Elevated Quad Stretch",
  "Standing Hamstring and Calf Stretch",
  "Suspended Fallout",
  "Suspended Push-Up",
  "Suspended Reverse Crunch",
  "Suspended Row",
  "Suspended Split Squat",
];

/** Bodyweight-tagged but needs gear we don't assume, or isn't a training move. */
export const FEDB_DENY: readonly string[] = [
  "Close-Grip Push-Up off of a Dumbbell",
  "Crunch - Legs On Exercise Ball",
  "Decline Crunch",
  "Decline Oblique Crunch",
  "Decline Reverse Crunch",
  "Kneeling Arm Drill",
  "Linear 3-Part Start Technique",
  "Linear Acceleration Wall Drill",
  "Moving Claw Series",
  "Prone Manual Hamstring",
  "Trail Running/Walking",
  "V-Bar Pullup",
  // Behind-the-neck pulling: abducted + externally rotated shoulder under load
  // (Kolber 2010 JSCR 24(6):1696; Prinold & Bull 2016 PMID 26383875).
  "Wide-Grip Rear Pull-Up",
];

/**
 * Same movement as an existing library entry under a different name.
 * (Exact/plural name matches are caught automatically by the name key.)
 */
export const FEDB_SAME_AS_EXISTING: Readonly<Record<string, string>> = {
  "Butt Lift (Bridge)": "Glute Bridge",
  "Cat Stretch": "Cat-Cow",
  "Dips - Chest Version": "Forward Lean Dip",
  "Dips - Triceps Version": "Parallel Bar Dip",
  "Floor Glute-Ham Raise": "Nordic Hamstring Curl",
  "Freehand Jump Squat": "Jump Squat",
  "Frog Hops": "Frog Jump",
  "Handstand Push-Ups": "Wall Handstand Push-Up",
  "Lateral Bound": "Skater Bound",
  "Muscle Up": "Bar Muscle-Up",
  "Natural Glute Ham Raise": "Nordic Hamstring Curl",
  Plank: "Forearm Plank",
  Pullups: "Standard Pull-Up",
  Pushups: "Standard Push-Up",
  "Scissors Jump": "Lunge Jump",
  "Side Bridge": "Side Plank",
  "Single-Arm Push-Up": "One-Arm Push-Up",
  "Split Jump": "Lunge Jump",
  "Standing Hip Circles": "Hip circles",
  "Step-up with Knee Raise": "Step-Up with Knee Drive",
  Superman: "Superman Hold",
};

export function isFedbCandidate(record: FedbExerciseRecord): boolean {
  if (FEDB_DENY.includes(record.name)) {
    return false;
  }
  if (BODYWEIGHT_EQUIPMENT.has(record.equipment) || record.equipment === DUMBBELL_EQUIPMENT) {
    return true;
  }
  return record.equipment === "other" && FEDB_ALLOW_OTHER.includes(record.name);
}

export interface FedbReclassification {
  pattern: Pattern;
  regions: LoadRegion[];
  type: ExerciseType;
}

/** Source tags these as `stretching`; they are loaded strength work. */
export const FEDB_RECLASSIFY: Readonly<Record<string, FedbReclassification>> = {
  "Crossover Reverse Lunge": { pattern: "squat", regions: ["legs"], type: "dynamic" },
  "One Handed Hang": { pattern: "vertical_pull", regions: ["pull"], type: "isometric" },
  "Scissor Kick": { pattern: "core_anti_extension", regions: ["core"], type: "dynamic" },
  "Side Leg Raises": { pattern: "hinge", regions: ["legs"], type: "dynamic" },
  "Sit Squats": { pattern: "squat", regions: ["legs"], type: "dynamic" },
  "Split Squats": { pattern: "squat", regions: ["legs"], type: "dynamic" },
  "Stomach Vacuum": { pattern: "core_anti_extension", regions: ["core"], type: "isometric" },
  "Toe Touchers": { pattern: "core_compression", regions: ["core"], type: "dynamic" },
};
