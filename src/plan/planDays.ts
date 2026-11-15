import type { SessionTemplate } from "../domain/program";
import { createKeyValueStore } from "../storage/keyValueStore";

const store = createKeyValueStore("aurora.poc.planDays.v1");

type DayMap = Record<string, SessionTemplate>;

/** Generated days live under ids with this prefix; seed templates never do. */
export const GENERATED_DAY_PREFIX = "day_";

function isGeneratedDayId(templateId: string): boolean {
  return templateId.startsWith(GENERATED_DAY_PREFIX);
}

function isDay(value: unknown): value is SessionTemplate {
  const day = value as Partial<SessionTemplate> | null;
  return (
    typeof day === "object" &&
    day !== null &&
    typeof day.id === "string" &&
    typeof day.name === "string" &&
    Array.isArray(day.slots)
  );
}

function loadDays(): DayMap {
  const raw = store.read();
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const days = parsed as Record<string, unknown>;
    return Object.fromEntries(Object.entries(days).filter(([, value]) => isDay(value))) as DayMap;
  } catch {
    return {};
  }
}

function saveDays(days: DayMap): void {
  if (Object.keys(days).length === 0) {
    store.clear();
    return;
  }
  store.write(JSON.stringify(days));
}

export function getPlanDay(templateId: string): SessionTemplate | undefined {
  const day = loadDays()[templateId];
  return day ? structuredClone(day) : undefined;
}

export function listPlanDays(): SessionTemplate[] {
  return Object.values(loadDays()).map((day) => structuredClone(day));
}

/** Add or replace generated days (by id). */
export function savePlanDays(days: readonly SessionTemplate[]): void {
  const current = loadDays();
  for (const day of days) {
    if (!isGeneratedDayId(day.id)) {
      throw new Error(`Generated day ids must start with "${GENERATED_DAY_PREFIX}": ${day.id}`);
    }
    current[day.id] = structuredClone(day);
  }
  saveDays(current);
}

/** Point one slot of a generated day at a different exercise. */
export function replaceDaySlotExercise(
  templateId: string,
  slotId: string,
  exerciseId: string,
): SessionTemplate {
  const days = loadDays();
  const day = days[templateId];
  if (!day) {
    throw new Error(`Unknown generated day: ${templateId}`);
  }
  if (!day.slots.some((slot) => slot.id === slotId)) {
    throw new Error(`Unknown slot ${slotId} in ${templateId}`);
  }
  const next: SessionTemplate = {
    ...day,
    slots: day.slots.map((slot) => (slot.id === slotId ? { ...slot, exerciseId } : slot)),
  };
  days[templateId] = next;
  saveDays(days);
  return structuredClone(next);
}

/** Drop generated days nothing refers to any more (queue items, override). */
export function prunePlanDays(keepIds: Iterable<string | undefined>): void {
  const keep = new Set(keepIds);
  const days = loadDays();
  const kept = Object.fromEntries(Object.entries(days).filter(([id]) => keep.has(id)));
  if (Object.keys(kept).length !== Object.keys(days).length) {
    saveDays(kept);
  }
}
