import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import { SESSION_TEMPLATES, TEMPLATE_BY_ID } from "../data/seed";
import type { SessionTemplate, TemplateSlot } from "../domain/program";
import { createKeyValueStore } from "../storage/keyValueStore";
import { getPlanDay, listPlanDays } from "./planDays";

const store = createKeyValueStore("aurora.poc.templateOverrides.v1");

export interface TemplateOverride {
  targetExerciseIds?: string[];
  slotExerciseIds?: Record<string, string>;
}

export type TemplateOverrideMap = Record<string, TemplateOverride>;

function loadTemplateOverrides(): TemplateOverrideMap {
  const raw = store.read();
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

function saveTemplateOverrides(overrides: TemplateOverrideMap): void {
  store.write(JSON.stringify(overrides));
}

/** Test helper — wipe persisted procedure edits. */
export function resetTemplateOverridesForTests(): void {
  store.clear();
}

export function setSlotExercise(
  templateId: string,
  slotId: string,
  exerciseId: string,
): SessionTemplate {
  assertSeedTemplate(templateId);
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

/** The saved edit for one seed-day slot, if there is one (undefined: the slot uses its seed move). */
export function slotExerciseOverride(templateId: string, slotId: string): string | undefined {
  assertSeedTemplate(templateId);
  return loadTemplateOverrides()[templateId]?.slotExerciseIds?.[slotId];
}

/** Drop the saved edit for one seed-day slot, so it uses its seed move again. */
export function clearSlotExercise(templateId: string, slotId: string): SessionTemplate {
  assertSeedTemplate(templateId);
  const overrides = loadTemplateOverrides();
  const current = overrides[templateId];
  if (current?.slotExerciseIds?.[slotId] !== undefined) {
    const rest = Object.fromEntries(Object.entries(current.slotExerciseIds).filter(([id]) => id !== slotId));
    overrides[templateId] = { ...current, slotExerciseIds: rest };
    saveTemplateOverrides(overrides);
  }
  return resolveTemplate(templateId);
}

export function setTemplateTarget(
  templateId: string,
  targetExerciseId: string,
): SessionTemplate {
  assertSeedTemplate(templateId);
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

/**
 * A queue-able day by id: a generated day, else a seed template with its
 * saved edits. Undefined for ids that are neither (e.g. a pruned day).
 */
export function findTemplate(templateId: string): SessionTemplate | undefined {
  const generated = getPlanDay(templateId);
  if (generated) {
    return generated;
  }
  const base = TEMPLATE_BY_ID[templateId];
  return base ? applyOverride(base, loadTemplateOverrides()[templateId]) : undefined;
}

export function isKnownTemplate(templateId: string): boolean {
  return findTemplate(templateId) !== undefined;
}

/** Throws unless the id is a seed template or a generated day still stored. */
export function assertKnownTemplate(templateId: string): void {
  if (!isKnownTemplate(templateId)) {
    throw new Error(`Unknown template: ${templateId}`);
  }
}

export function resolveTemplate(templateId: string): SessionTemplate {
  const template = findTemplate(templateId);
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }
  return template;
}

export function listResolvedTemplates(): SessionTemplate[] {
  return SESSION_TEMPLATES.map((template) => resolveTemplate(template.id));
}

/** Seed templates plus every generated day still in use. */
export function listAllTemplates(): SessionTemplate[] {
  return [...listResolvedTemplates(), ...listPlanDays()];
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

function assertSeedTemplate(templateId: string): void {
  if (!TEMPLATE_BY_ID[templateId]) {
    throw new Error(`Unknown template: ${templateId}`);
  }
}

function assertKnownExercise(exerciseId: string): void {
  if (!exerciseId.trim()) {
    throw new Error("exerciseId must be non-empty");
  }
  if (!EXERCISE_GRAPH[exerciseId]) {
    throw new Error(`Unknown exercise: ${exerciseId}`);
  }
}
