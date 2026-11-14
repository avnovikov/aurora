export type MuscleRole = "primary" | "secondary" | "stabilizer";

export type MuscleGroup =
  | "abdominals"
  | "abductors"
  | "adductors"
  | "biceps"
  | "calves"
  | "chest"
  | "forearms"
  | "glutes"
  | "hamstrings"
  | "lats"
  | "lower back"
  | "middle back"
  | "neck"
  | "quadriceps"
  | "shoulders"
  | "traps"
  | "triceps";

export type Pattern =
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "squat"
  | "hinge"
  | "core_compression"
  | "core_anti_extension"
  | "skill"
  | "conditioning"
  | "mobility";

export type ExerciseType = "dynamic" | "isometric" | "eccentric";
export type PrescriptionMode = "straight_sets" | "rounds";
export type SleepQuality = "good" | "fair" | "poor";
export type FailRegion = "start" | "mid" | "end";
export type StopReason =
  | "completed"
  | "technical_failure"
  | "muscular_failure"
  | "pain"
  | "skipped";

export interface MuscleEntry {
  group: MuscleGroup;
  muscle?: string;
  role: MuscleRole;
}

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  type: ExerciseType;
  muscles: MuscleEntry[];
  easierId?: string;
  harderId?: string;
  joints: string[];
}

export interface WeakLink {
  exerciseId: string;
  region: FailRegion | "";
  kind: "sticking_strength" | "stabilizer" | "mobility" | "tendon" | "skill_component";
  muscleGroups: MuscleGroup[];
  componentExerciseId: string;
  sourceNote: string;
}

export interface ExerciseMemory {
  exerciseId: string;
  sessionsAtStandard: number;
  sessionsBelowFloor: number;
  lastAddedLoadKg: number;
  weakLinkSessionsRemaining: number;
}

export interface Readiness {
  sleepQuality?: SleepQuality;
  restingHrBpm?: number;
  restingHrMedian14d?: number;
  highHrMorningCount?: number;
  rmssdBelowBand?: boolean;
  yesterdayWiped?: boolean;
  painJoints: string[];
}

export interface Dose {
  sets: number;
  reps: number;
  targetRir: number;
  addedLoadKg: number;
}

export interface ResolveInput {
  exercise: Exercise;
  memory: ExerciseMemory;
  readiness: Readiness;
  dose: Dose;
  pinned: boolean;
  weakLinks: WeakLink[];
  lastFailRegion?: FailRegion;
  graph: Record<string, Exercise>;
}

export type RuleId =
  | "pain"
  | "pin"
  | "light_day"
  | "advance"
  | "stall_weak_link"
  | "stall_regress"
  | "hold";

export interface ResolveResult {
  exerciseId: string;
  dose: Dose;
  ruleIds: RuleId[];
  reason: string;
  insertedWeakLinkExerciseId?: string;
}
