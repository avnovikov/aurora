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
/** How `dose.reps` is interpreted: counted reps vs hold seconds. */
export type EffortKind = "reps" | "hold";
/** Athlete level for a single exercise (rep/hold standards). */
export type SkillTier =
  | "novice"
  | "beginner"
  | "intermediate"
  | "advanced"
  | "elite";
/** Difficulty of a movement (a move is never "novice"). */
export type Difficulty = Exclude<SkillTier, "novice">;
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

export interface ExerciseTiming {
  effort: EffortKind;
  /** Wall-clock seconds per counted rep (ignored when effort is hold). */
  secondsPerRep: number;
  /** Literature-default rest when a slot does not override. */
  defaultRestSeconds: number;
}

/** Max clean reps (or hold seconds) associated with each skill tier. */
export interface ExerciseStandards {
  novice: number;
  beginner: number;
  intermediate: number;
  advanced: number;
  elite: number;
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
  /** Optional; resolved via `resolveExerciseTiming` when absent. */
  effort?: EffortKind;
  secondsPerRep?: number;
  defaultRestSeconds?: number;
  /** Literature-inspired rep/hold floors per tier. */
  standards?: ExerciseStandards;
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
  /** Effective tier used for prescription (declared or inferred). */
  skillTier?: SkillTier;
  /** Last manual pick from Library; wins ties with inference until best exceeds it. */
  declaredTier?: SkillTier;
  /** Best clean completed reps / hold seconds logged. */
  bestReps?: number;
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
  /** Manual deload week: light-day dose, no progression advance. */
  deloadActive?: boolean;
}

export type RuleId =
  | "pain"
  | "joint_history"
  | "equipment"
  | "pin"
  | "light_day"
  | "deload"
  | "skill_dose"
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
