/**
 * Every key Aurora persists. Migration and Settings export use STORAGE_KEYS.
 * Named exports keep call sites from repeating string literals.
 */
export const PROFILE_KEY = "aurora.poc.profile.v1";
export const HISTORY_KEY = "aurora.poc.history.v1";
export const MEMORY_KEY = "aurora.poc.memory.v1";
export const MEMORY_V2_KEY = "aurora.poc.memory.v2";
export const LEVELS_TO_CONFIRM_KEY = "aurora.poc.levelsToConfirm.v1";
export const SESSION_KEY = "aurora.poc.session.v1";
export const PLAN_QUEUE_KEY = "aurora.poc.planQueue.v1";
export const EXCLUDED_EXERCISES_KEY = "aurora.poc.excludedExercises.v1";
export const PLAN_LEVEL_KEY = "aurora.poc.planLevel.v1";
export const PLAN_LEVEL_RAISE_NOTICE_KEY = "aurora.poc.planLevelRaiseNotice.v1";
export const TEMPLATE_OVERRIDES_KEY = "aurora.poc.templateOverrides.v1";
export const DELOAD_KEY = "aurora.poc.deload.v1";
export const SCHEDULE_OVERRIDE_KEY = "aurora.poc.scheduleOverride.v1";
export const PLAN_DAYS_KEY = "aurora.poc.planDays.v1";
export const WARMUP_HR_KEY = "aurora.poc.warmupHr.v1";
export const LIGHTEN_LEARNING_KEY = "aurora.poc.lightenLearning.v1";

export const STORAGE_KEYS = [
  PROFILE_KEY,
  HISTORY_KEY,
  MEMORY_KEY,
  MEMORY_V2_KEY,
  LEVELS_TO_CONFIRM_KEY,
  SESSION_KEY,
  PLAN_QUEUE_KEY,
  EXCLUDED_EXERCISES_KEY,
  PLAN_LEVEL_KEY,
  PLAN_LEVEL_RAISE_NOTICE_KEY,
  TEMPLATE_OVERRIDES_KEY,
  DELOAD_KEY,
  SCHEDULE_OVERRIDE_KEY,
  PLAN_DAYS_KEY,
  WARMUP_HR_KEY,
  LIGHTEN_LEARNING_KEY,
] as const;

export type StorageKey = (typeof STORAGE_KEYS)[number];
