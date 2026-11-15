import { stripTags } from "../enrich/stripTags";
import type { WgerExerciseRecord } from "./types";

/** Equipment we assume a calisthenics athlete has (wger equipment names). */
const ALLOWED_EQUIPMENT = new Set([
  "none (bodyweight exercise)",
  "Pull-up bar",
  "Gym mat",
  "Bench",
  "Incline bench",
]);

/** Untagged in wger (no equipment listed) but clearly bodyweight. */
export const WGER_ALLOW_UNTAGGED: readonly string[] = [
  "Bent-knee Iron Cross",
  "Black Widow Knee Slides",
  "Crunches With Legs Up",
  "Feet-assisted Straight-bar Support",
  "Fire Hydrant Circles",
  "Happy Baby",
  "Hip Crossover",
  "Neck CARs",
  "Parallel Bar Hold",
  "Prone Scapular Retraction - Arms at Side",
  "Reverse Nordic Curl",
  "Roll-overs into V-sits",
  "Serratus Wall Slide Stretch",
  "Side to Side Push Ups",
  "Snap Down",
  "Squat Sky Reach Stretch",
  "Towel Superman",
  "Tyson push-ups",
];

/** Tagged bodyweight but machines, cardio kit, rehab tools, or not training. */
const DENY_PATTERN =
  /foam roll|flexbar|bosu|treadmill|elliptical|stair master|rowing machine|stationary bike|fingerboard|sloper|smith|machine|medicine ball|weighted|jump rope|captain's chair|meditation|breathing|radio taiso/i;

export const WGER_DENY: readonly string[] = [
  "3008 Abdominal Crunch",
  "Abdominal Stabilization",
  "Alternate Walking",
  "Bag training",
  "Cycling",
  "Diagonal Shoulder Press",
  "Inverted Lat Pull Down",
  "Pendulum Squat",
  "Run",
  "Run - Interval Training",
  "Seated Bench Press",
  "Spider Curl",
  "Talons fesses",
  "Walking",
  "Wall Drills",
  "punches",
];

/** Same movement as an existing library entry (or an earlier wger row). */
export const WGER_SAME_AS_EXISTING: Readonly<Record<string, string>> = {
  "4-count burpees": "Burpee",
  "Alternate back lunges": "Reverse lunge",
  "Arm Raises (T/Y/I)": "Prone Y-T-W raise",
  "Australian pull-ups": "Inverted Row",
  "Bench Dips On Floor HD": "Floor dips",
  Dips: "Parallel Bar Dip",
  "Double Leg Calf Raise": "Calf raise",
  "Explosive Push-Ups": "Plyo Push-up",
  "Front Lever": "Full Front Lever",
  "Front Plank": "Forearm Plank",
  "Front Split Stretch": "Front Split",
  "Front lever tuck": "Tuck Front Lever",
  "Frog stand": "Crow Pose",
  "Glute-Ham Raise": "Nordic Hamstring Curl",
  "Handstand Pushup": "Wall Handstand Push-Up",
  "Heel Touches": "Alternate Heel Touchers",
  "High plank": "High plank hold",
  "Hip Bridge": "Glute Bridge",
  "Hip Raise, Lying": "Glute Bridge",
  "Hollow Hold": "Hollow Body Hold",
  "Knee Raises": "Hanging Knee Raise",
  "Leg Raises, Lying": "Lying Leg Raise",
  "Leg Swings (Front–Back)": "Leg swings",
  "Leg raises pull up bar": "Hanging Leg Raise",
  Lunges: "Forward Lunge",
  "Muscle up": "Bar Muscle-Up",
  "No push-up burpees": "Squat thrust",
  "One armed push-ups": "One-Arm Push-Up",
  Plank: "Forearm Plank",
  "Planche Lean Hold": "Planche Lean",
  "Pull-Ups (Wide Grip)": "Wide-Grip Pull-Up",
  "Pull-ups": "Standard Pull-Up",
  "Push-Up": "Standard Push-Up",
  "Push-Ups | Decline": "Decline Push-Up",
  "Push-Ups | Incline": "Incline Push-Up",
  "Quadriped Arm and Leg Raise": "Bird Dog",
  "Reverse-grip pull-ups": "Chin-Up",
  "Scapula Pulls": "Scapular Pull-Up",
  "Scapular Pushups": "Scapula Push-Up",
  "Single Leg RDL": "Single-Leg Romanian Deadlift",
  Superman: "Superman Hold",
  "Supported Deep Squat Hold": "Deep Squat Hold",
  "Wall Handstand": "Wall handstand hold",
  "Wall Slides": "Wall Angel",
  "Wall Squat": "Wall Sit",
  "YTW Raises": "Prone Y-T-W raise",
  "Yoga exercise: Cow-cat": "Cat-Cow",
  "ankle dorsiflexion rocks": "Ankle rocks",
};

const MIN_DESCRIPTION_CHARS = 20;

export function isWgerCandidate(record: WgerExerciseRecord): boolean {
  if (WGER_DENY.includes(record.name) || DENY_PATTERN.test(record.name)) {
    return false;
  }
  if (stripTags(record.description).trim().length < MIN_DESCRIPTION_CHARS) {
    return false;
  }
  if (record.equipment.length === 0) {
    return WGER_ALLOW_UNTAGGED.includes(record.name);
  }
  return record.equipment.every((item) => ALLOWED_EQUIPMENT.has(item));
}
