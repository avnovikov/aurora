import { SEED_GRAPH, SESSION_TEMPLATES, TEMPLATE_BY_ID } from "../data/seed";
import type { SessionTemplate, TemplateSlot } from "../domain/program";

const KEY = "aurora.poc.templateOverrides.v1";

/** In-memory fallback when `localStorage` is unavailable (unit tests). */
const memoryOverrides: { value: string | null } = { value: null };

export interface TemplateOverride {
  targetExerciseIds?: string[];
  slotExerciseIds?: Record<string, string>;
}

export type TemplateOverrideMap = Record<string, TemplateOverride>;

export function loadTemplateOverrides(): TemplateOverrideMap {
  const raw = readStorage();
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as TemplateOverrideMap;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveTemplateOverrides(overrides: TemplateOverrideMap): void {
  writeStorage(JSON.stringify(overrides));
}

function readStorage(): string | null {
  if (typeof localStorage === "undefined") {
    return memoryOverrides.value;
  }
  return localStorage.getItem(KEY);
}

function writeStorage(value: string): void {
  if (typeof localStorage === "undefined") {
    memoryOverrides.value = value;
    return;
  }
  localStorage.setItem(KEY, value);
}

function clearStorage(): void {
  if (typeof localStorage === "undefined") {
    memoryOverrides.value = null;
    return;
  }
  localStorage.removeItem(KEY);
}

export function clearTemplateOverride(templateId: string): void {
  const overrides = loadTemplateOverrides();
  delete overrides[templateId];
  if (Object.keys(overrides).length === 0) {
    clearStorage();
    return;
  }
  saveTemplateOverrides(overrides);
}

/** Test helper — wipe persisted procedure edits. */
export function resetTemplateOverridesForTests(): void {
  clearStorage();
}

export function setSlotExercise(
  templateId: string,
  slotId: string,
  exerciseId: string,
): SessionTemplate {
  assertKnownTemplate(templateId);
  assertKnownExercise(exerciseId);
  const overrides = loadTemplateOverrides();
  const current = overrides[templateId] ?? {};
  overrides[templateId] = {
    ...current,
    slotExerciseIds: {
      ...(current.slotExerciseIds ?? {}),
      [slotId]: exerciseId,
    },
  };
  saveTemplateOverrides(overrides);
  return resolveTemplate(templateId);
}

export function setTemplateTarget(
  templateId: string,
  targetExerciseId: string,
): SessionTemplate {
  assertKnownTemplate(templateId);
  assertKnownExercise(targetExerciseId);
  const overrides = loadTemplateOverrides();
  const current = overrides[templateId] ?? {};
  overrides[templateId] = {
    ...current,
    targetExerciseIds: [targetExerciseId],
  };
  saveTemplateOverrides(overrides);
  return resolveTemplate(templateId);
}

export function resolveTemplate(templateId: string): SessionTemplate {
  const base = TEMPLATE_BY_ID[templateId];
  if (!base) {
    throw new Error(`Unknown template: ${templateId}`);
  }
  return applyOverride(base, loadTemplateOverrides()[templateId]);
}

export function listResolvedTemplates(): SessionTemplate[] {
  return SESSION_TEMPLATES.map((template) => resolveTemplate(template.id));
}

export function applyOverride(
  base: SessionTemplate,
  override: TemplateOverride | undefined,
): SessionTemplate {
  if (!override) {
    return structuredClone(base);
  }
  const slots = base.slots.map((slot) => applySlotOverride(slot, override));
  const targetExerciseIds =
    override.targetExerciseIds && override.targetExerciseIds.length > 0
      ? [...override.targetExerciseIds]
      : [...base.targetExerciseIds];
  return {
    ...structuredClone(base),
    slots,
    targetExerciseIds,
  };
}

function applySlotOverride(
  slot: TemplateSlot,
  override: TemplateOverride,
): TemplateSlot {
  const nextId = override.slotExerciseIds?.[slot.id];
  if (!nextId) {
    return structuredClone(slot);
  }
  return {
    ...structuredClone(slot),
    exerciseId: nextId,
  };
}

function assertKnownTemplate(templateId: string): void {
  if (!TEMPLATE_BY_ID[templateId]) {
    throw new Error(`Unknown template: ${templateId}`);
  }
}

function assertKnownExercise(exerciseId: string): void {
  if (!exerciseId.trim()) {
    throw new Error("exerciseId must be non-empty");
  }
  if (!SEED_GRAPH[exerciseId]) {
    throw new Error(`Unknown exercise: ${exerciseId}`);
  }
}
