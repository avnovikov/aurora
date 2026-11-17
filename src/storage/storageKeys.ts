/**
 * Every key Aurora persists. Migration and Settings export use STORAGE_KEYS.
 * Named exports keep call sites from repeating string literals.
 */
export const PROFILE_KEY = "aurora.poc.profile.v1";
export const HISTORY_KEY = "aurora.poc.history.v1";
export const MEMORY_KEY = "aurora.poc.memory.v1";
export const SESSION_KEY = "aurora.poc.session.v1";
export const PLAN_QUEUE_KEY = "aurora.poc.planQueue.v1";
export const EXCLUDED_EXERCISES_KEY = "aurora.poc.excludedExercises.v1";
export const PLAN_LEVEL_KEY = "aurora.poc.planLevel.v1";
export const TEMPLATE_OVERRIDES_KEY = "aurora.poc.templateOverrides.v1";
export const DELOAD_KEY = "aurora.poc.deload.v1";
export const SCHEDULE_OVERRIDE_KEY = "aurora.poc.scheduleOverride.v1";
export const PLAN_DAYS_KEY = "aurora.poc.planDays.v1";

export const STORAGE_KEYS = [
  PROFILE_KEY,
  HISTORY_KEY,
  MEMORY_KEY,
  SESSION_KEY,
  PLAN_QUEUE_KEY,
  EXCLUDED_EXERCISES_KEY,
  PLAN_LEVEL_KEY,
  TEMPLATE_OVERRIDES_KEY,
  DELOAD_KEY,
  SCHEDULE_OVERRIDE_KEY,
  PLAN_DAYS_KEY,
] as const;

export type StorageKey = (typeof STORAGE_KEYS)[number];
