import { SESSION_TEMPLATES } from "../data/seed";
import type { SessionTemplate } from "../domain/program";

export function collectTemplateTargetIds(
  templates: readonly SessionTemplate[] = SESSION_TEMPLATES,
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const template of templates) {
    for (const exerciseId of template.targetExerciseIds) {
      ids.add(exerciseId);
    }
  }
  return ids;
}

export function isTemplateTarget(
  exerciseId: string,
  targetIds: ReadonlySet<string>,
): boolean {
  return targetIds.has(exerciseId);
}