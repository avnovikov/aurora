import type { SeedExercise } from "../data/seed";
import type { PlanQueue, SessionTemplate, TemplateSlot } from "../domain/program";
import { tierIndex } from "../domain/skillTier";
import type { Pattern, SkillTier } from "../domain/types";
import { buildChainIds } from "../progress/chainMap";

export type PlacementGraph = Record<string, SeedExercise>;

export type ExerciseLike = Pick<
  SeedExercise,
  "id" | "pattern" | "regions" | "easierId" | "harderId"
> & {
  difficulty?: SkillTier;
};

export interface UpcomingPlanDay {
  index: number;
  templateId: string;
  name: string;
  /** True when this is the default (tomorrow / next) choice. */
  isDefault: boolean;
}

/** True when the exercise has at least one primary progression neighbour. */
export function hasProgressionPath(exercise: {
  easierId?: string;
  harderId?: string;
}): boolean {
  return Boolean(exercise.easierId || exercise.harderId);
}

/**
 * Pick the chain step that matches the athlete's level.
 * Falls back to the closest difficulty on the chain, then the opened exercise.
 */
export function pickLevelAppropriateStep(
  anchorId: string,
  graph: PlacementGraph,
  athleteTier: SkillTier | undefined,
  fallbackId: string = anchorId,
): string {
  const chainIds = buildChainIds(anchorId, graph);
  if (chainIds.length === 0) {
    return fallbackId;
  }
  if (!athleteTier) {
    return chainIds.includes(fallbackId) ? fallbackId : (chainIds[0] ?? fallbackId);
  }
  const exactMatch = chainIds.find((id) => graph[id]?.difficulty === athleteTier);
  if (exactMatch) {
    return exactMatch;
  }
  return closestTierOnChain(chainIds, graph, athleteTier) ?? fallbackId;
}

/**
 * Best slot for an exercise: same pattern first, else random among candidates.
 */
export function pickBestSlotId(
  slots: readonly TemplateSlot[],
  exercise: { pattern: Pattern },
  random: () => number = Math.random,
): string {
  if (slots.length === 0) {
    throw new Error("Cannot place exercise: template has no slots");
  }
  const patternHits = slots.filter((slot) => slot.pattern === exercise.pattern);
  const pool = patternHits.length > 0 ? patternHits : slots;
  const chosen = pool[Math.floor(random() * pool.length)];
  if (!chosen) {
    throw new Error("Failed to pick a slot from a non-empty pool");
  }
  return chosen.id;
}

/** Prefer Skill template for skill pattern; else first template whose focus matches a region. */
export function chooseTemplateForExercise(
  templates: readonly SessionTemplate[],
  exercise: { pattern: Pattern; regions: readonly string[] },
): SessionTemplate {
  if (templates.length === 0) {
    throw new Error("No session templates available");
  }
  if (exercise.pattern === "skill") {
    const skillTemplate = findTemplateByFocus(templates, "skill");
    if (skillTemplate) {
      return skillTemplate;
    }
  }
  for (const region of exercise.regions) {
    const match = findTemplateByFocus(templates, region);
    if (match) {
      return match;
    }
  }
  return findTemplateByFocus(templates, "skill") ?? templates[0]!;
}

/** Tomorrow = index 1 when the queue has a day after today; otherwise today (0). */
export function defaultPlanDayIndex(queueLength: number): number {
  if (queueLength <= 0) {
    throw new Error(`queueLength must be positive; got ${queueLength}`);
  }
  return queueLength > 1 ? 1 : 0;
}

/** Insert a template id at index without dropping existing days. */
export function insertQueueItemAt(
  queue: PlanQueue,
  index: number,
  templateId: string,
): PlanQueue {
  if (!Number.isInteger(index) || index < 0 || index > queue.items.length) {
    throw new Error(`insert index out of range: ${index}`);
  }
  const items = [...queue.items];
  items.splice(index, 0, templateId);
  return { items };
}

/**
 * Ensure `templateId` sits at `index` (move if already present, else insert).
 */
export function placeTemplateAt(
  queue: PlanQueue,
  templateId: string,
  index: number,
): PlanQueue {
  const existingIndex = queue.items.indexOf(templateId);
  if (existingIndex === index) {
    return queue;
  }
  if (existingIndex >= 0) {
    const without = {
      items: queue.items.filter((_, itemIndex) => itemIndex !== existingIndex),
    };
    const adjustedIndex = existingIndex < index ? index - 1 : index;
    return insertQueueItemAt(without, adjustedIndex, templateId);
  }
  return insertQueueItemAt(queue, index, templateId);
}

export function listUpcomingPlanDays(
  queue: PlanQueue,
  resolveName: (templateId: string) => string,
  limit: number = 5,
): UpcomingPlanDay[] {
  if (limit < 1) {
    throw new Error(`limit must be >= 1; got ${limit}`);
  }
  const defaultIndex = defaultPlanDayIndex(queue.items.length);
  return queue.items.slice(0, limit).map((templateId, index) => ({
    index,
    templateId,
    name: resolveName(templateId),
    isDefault: index === defaultIndex,
  }));
}

function findTemplateByFocus(
  templates: readonly SessionTemplate[],
  focus: string,
): SessionTemplate | undefined {
  return templates.find((template) => template.focus === focus);
}

function closestTierOnChain(
  chainIds: readonly string[],
  graph: PlacementGraph,
  athleteTier: SkillTier,
): string | null {
  const target = tierIndex(athleteTier);
  let bestId: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const id of chainIds) {
    const difficulty = graph[id]?.difficulty;
    if (!difficulty) {
      continue;
    }
    const distance = Math.abs(tierIndex(difficulty) - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = id;
    }
  }
  return bestId;
}
