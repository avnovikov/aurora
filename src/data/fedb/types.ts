export interface FedbExerciseRecord {
  id: string;
  name: string;
  force: "push" | "pull" | "static" | null;
  level: "beginner" | "intermediate" | "expert";
  mechanic: "compound" | "isolation" | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

/** Text only — images stay out (origin unclear; see design spec §licensing). */
export const FEDB_ATTRIBUTION =
  "yuhonas/free-exercise-db (Unlicense, public domain), text only";
