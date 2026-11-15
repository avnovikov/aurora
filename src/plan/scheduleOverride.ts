import { TEMPLATE_BY_ID } from "../data/seed";
import { createKeyValueStore } from "../storage/keyValueStore";

const store = createKeyValueStore("aurora.poc.scheduleOverride.v1");

/** One-off "train X instead today" choice; the plan queue itself is untouched. */
export interface ScheduleOverride {
  templateId: string;
}

/** Returns the stored override, or null when unset, malformed, or pointing at an unknown template. */
export function loadScheduleOverride(): ScheduleOverride | null {
  const raw = store.read();
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidOverride(parsed) ? { templateId: parsed.templateId } : null;
  } catch {
    return null;
  }
}

export function saveScheduleOverride(override: ScheduleOverride): void {
  if (!TEMPLATE_BY_ID[override.templateId]) {
    throw new Error(`Unknown template for schedule override: ${override.templateId}`);
  }
  store.write(JSON.stringify({ templateId: override.templateId }));
}

export function clearScheduleOverride(): void {
  store.clear();
}

export function resetScheduleOverrideForTests(): void {
  store.clear();
}

function isValidOverride(value: unknown): value is ScheduleOverride {
  if (!value || typeof value !== "object") {
    return false;
  }
  const templateId = (value as { templateId?: unknown }).templateId;
  return typeof templateId === "string" && Boolean(TEMPLATE_BY_ID[templateId]);
}
