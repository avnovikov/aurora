import type { ExercisePrescription } from "./prescription";

export type { ExercisePrescription } from "./prescription";

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
  /**
   * Pre-parsed dose from description (rounds × amount, total or per side).
   * Warm-up expands it; work clamps tier-standard picks into the band.
   */
  prescription?: ExercisePrescription;
}

export interface WeakLink {
  exerciseId: string;
  region: FailRegion | "";
  kind: "sticking_strength" | "stabilizer" | "mobility" | "tendon" | "skill_component";
  muscleGroups: MuscleGroup[];
  componentExerciseId: string;
  sourceNote: string;
}

/** A level inferred from harder tested family members (#112). */
export interface InferredTier {
  tier: SkillTier;
  /** Supporting exercise ids (tested, harder rungs). */
  from: string[];
  /** ISO time the tier was first inferred at this value. */
  at: string;
}

/** Ceiling on inference after a failed set on an easier rung (#112 rule 2). */
export interface FailedCap {
  tier: SkillTier;
  /** The exercise whose failed set set the cap. */
  from: string;
  at: string;
}

export interface ExerciseMemory {
  exerciseId: string;
  sessionsAtStandard: number;
  sessionsBelowFloor: number;
  lastAddedLoadKg: number;
  weakLinkSessionsRemaining: number;
  /** Cached effective tier (derived by refreshSkillTier); never write directly. */
  skillTier?: SkillTier;
  /** Last manual pick from Library; wins ties with inference until best exceeds it. */
  declaredTier?: SkillTier;
  /** Best clean completed reps / hold seconds logged. */
  bestReps?: number;
  /** Rolling mean duration of logged rep sets (seconds). */
  avgSetDurationSeconds?: number;
  /** How many set durations feed `avgSetDurationSeconds`. */
  setDurationSampleCount?: number;
  /** ISO time of the athlete's last Library pick. */
  declaredAt?: string;
  /** Highest tier proven by logged reps against standards (tested). */
  loggedTier?: SkillTier;
  /** ISO time of the last logged set on this move. */
  lastSessionAt?: string;
  /** Derived by `inferTiers`; never set by hand. */
  inferred?: InferredTier;
  /** Ceilings on inference from failed sets on easier rungs, one per failing exercise (#112 rule 2). */
  failedCaps?: FailedCap[];
  /** Dose default from the plan level; never evidence. */
  planTier?: SkillTier;
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
  | "excluded"
  | "pin"
  | "light_day"
  | "deload"
  | "skill_dose"
  | "advance"
  | "stall_weak_link"
  | "stall_regress"
  | "hold"
  /** Later slot would have repeated a move already used today; swapped. */
  | "same_day_duplicate";

export interface ResolveResult {
  exerciseId: string;
  dose: Dose;
  ruleIds: RuleId[];
  reason: string;
  insertedWeakLinkExerciseId?: string;
}
