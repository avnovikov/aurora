import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { PlanQueue, SessionTemplate } from "../domain/program";
import type { ExerciseMemory, Pattern, SkillTier } from "../domain/types";
import { displayExerciseName, displayNameOf } from "../library/displayName";
import {
  chooseTemplateForExercise,
  defaultPlanDayIndex,
  hasProgressionPath,
  pickBestSlotId,
  pickLevelAppropriateStep,
  placeTemplateAt,
  type ExerciseLike,
} from "./pathPlacement";
import {
  listResolvedTemplates,
  setSlotExercise,
  setTemplateTarget,
} from "./templates";

export interface AddToPlanResult {
  templateId: string;
  templateName: string;
  slotId: string;
  exerciseId: string;
  exerciseName: string;
  message: string;
}

export interface GeneratePlanResult {
  templateId: string;
  templateName: string;
  targetExerciseId: string;
  workingExerciseId: string;
  queue: PlanQueue;
  message: string;
}

interface WorkingStep {
  id: string;
  name: string;
  pattern: Pattern;
}

/**
 * Insert the level-appropriate chain step into a chosen plan day slot.
 * Stays in that procedure until the athlete advances and re-generates / re-adds.
 */
export function addExerciseToPlanDay(input: {
  templateId: string;
  exercise: ExerciseLike;
  memory?: Pick<ExerciseMemory, "skillTier" | "declaredTier">;
  random?: () => number;
}): AddToPlanResult {
  const working = resolveWorkingStep(input.exercise, input.memory);
  const template = requireTemplate(input.templateId);
  const slotId = assignWorkingToBestSlot(
    template,
    working,
    input.random ?? Math.random,
  );
  return {
    templateId: input.templateId,
    templateName: template.name,
    slotId,
    exerciseId: working.id,
    exerciseName: working.name,
    message: `Added ${displayExerciseName(working.name)} to ${template.name} (stays until you outgrow this level).`,
  };
}

/**
 * Build a whole session toward the skill: set target, place level step in the
 * best slot, and park the day as tomorrow on the queue.
 */
export function generatePlanTowardExercise(input: {
  exercise: ExerciseLike;
  queue: PlanQueue;
  memory?: Pick<ExerciseMemory, "skillTier" | "declaredTier">;
  random?: () => number;
}): GeneratePlanResult {
  const working = resolveWorkingStep(input.exercise, input.memory);
  const template = chooseTemplateForExercise(
    listResolvedTemplates(),
    input.exercise,
  );
  setTemplateTarget(template.id, input.exercise.id);
  assignWorkingToBestSlot(template, working, input.random ?? Math.random);

  const tomorrowIndex = defaultPlanDayIndex(input.queue.items.length);
  const nextQueue = placeTemplateAt(input.queue, template.id, tomorrowIndex);
  const targetName = displayNameOf(input.exercise.id, EXERCISE_GRAPH);

  return {
    templateId: template.id,
    templateName: template.name,
    targetExerciseId: input.exercise.id,
    workingExerciseId: working.id,
    queue: nextQueue,
    message: `Generated ${template.name} toward ${targetName}: work ${displayExerciseName(working.name)}, queued for tomorrow.`,
  };
}

function resolveWorkingStep(
  exercise: ExerciseLike,
  memory?: Pick<ExerciseMemory, "skillTier" | "declaredTier">,
): WorkingStep {
  assertHasPath(exercise);
  const id = pickLevelAppropriateStep(
    exercise.id,
    EXERCISE_GRAPH,
    athleteTierOf(memory),
    exercise.id,
  );
  const step = EXERCISE_GRAPH[id];
  if (!step) {
    throw new Error(`Unknown working exercise: ${id}`);
  }
  return { id, name: step.name, pattern: step.pattern };
}

function assignWorkingToBestSlot(
  template: SessionTemplate,
  working: WorkingStep,
  random: () => number,
): string {
  const slotId = pickBestSlotId(template.slots, working, random);
  setSlotExercise(template.id, slotId, working.id);
  return slotId;
}

function athleteTierOf(
  memory?: Pick<ExerciseMemory, "skillTier" | "declaredTier">,
): SkillTier | undefined {
  return memory?.skillTier ?? memory?.declaredTier;
}

function assertHasPath(exercise: ExerciseLike): void {
  if (!hasProgressionPath(exercise)) {
    throw new Error(`Exercise ${exercise.id} has no progression path`);
  }
}

function requireTemplate(templateId: string): SessionTemplate {
  const template = listResolvedTemplates().find((item) => item.id === templateId);
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }
  return template;
}
