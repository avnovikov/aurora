import { TEMPLATE_BY_ID } from "../data/seed";

const KEY = "aurora.poc.scheduleOverride.v1";

/** One-off "train X instead today" choice; the plan queue itself is untouched. */
export interface ScheduleOverride {
  templateId: string;
}

/** In-memory fallback when `localStorage` is unavailable (unit tests). */
const memoryStore: { value: string | null } = { value: null };

/** Returns the stored override, or null when unset, malformed, or pointing at an unknown template. */
export function loadScheduleOverride(): ScheduleOverride | null {
  const raw = readStorage();
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
  writeStorage(JSON.stringify({ templateId: override.templateId }));
}

export function clearScheduleOverride(): void {
  if (typeof localStorage === "undefined") {
    memoryStore.value = null;
    return;
  }
  localStorage.removeItem(KEY);
}

export function resetScheduleOverrideForTests(): void {
  memoryStore.value = null;
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(KEY);
  }
}

function isValidOverride(value: unknown): value is ScheduleOverride {
  if (!value || typeof value !== "object") {
    return false;
  }
  const templateId = (value as { templateId?: unknown }).templateId;
  return typeof templateId === "string" && Boolean(TEMPLATE_BY_ID[templateId]);
}

function readStorage(): string | null {
  if (typeof localStorage === "undefined") {
    return memoryStore.value;
  }
  return localStorage.getItem(KEY);
}

function writeStorage(value: string): void {
  if (typeof localStorage === "undefined") {
    memoryStore.value = value;
    return;
  }
  localStorage.setItem(KEY, value);
}
