import { SEED_GRAPH, SESSION_TEMPLATES } from "../data/seed";
import type { SessionTemplate } from "../domain/program";
import type { ExerciseMemory } from "../domain/types";
import { SKILL_TIER_LABELS } from "../domain/skillTier";
import { distanceToTarget, type TargetDistance } from "../progress/targetDistance";
import { shouldAdvanceProgression } from "../rules/skillDose";
import { loadMemories } from "../session/history";

export function renderProgressView(root: HTMLElement): void {
  const memories = loadMemories();
  const rows = SESSION_TEMPLATES.flatMap((template) =>
    template.targetExerciseIds.map((targetId) =>
      progressRowHtml(template, targetId, memories),
    ),
  );

  root.innerHTML = `
    <main class="shell">
      <p class="eyebrow">Progress</p>
      <h1>Targets</h1>
      <p class="tagline">Handstand and the other hard skills are goals. History guesses the next level.</p>
      <ul class="lib-list">${rows.join("")}</ul>
    </main>
  `;
}

function progressRowHtml(
  template: SessionTemplate,
  targetId: string,
  memories: Record<string, ExerciseMemory>,
): string {
  const currentId = template.slots[0]?.exerciseId ?? targetId;
  const distance = distanceToTarget(currentId, targetId);
  return `
    <li>
      <strong>${template.name}</strong>
      <span>Target: ${distance.targetName}</span>
      <span>Now: ${distance.currentName}</span>
      <span>${formatDistance(distance)}</span>
      <p class="hint">${formatGuess(currentId, memories[currentId])}</p>
    </li>
  `;
}

function formatDistance(distance: TargetDistance): string {
  if (distance.reachable && distance.stepsToTarget !== null) {
    return `${distance.stepsToTarget} steps on primary chain`;
  }
  return "Off primary chain / unknown";
}

function formatGuess(
  currentId: string,
  memory: ExerciseMemory | undefined,
): string {
  if (!memory) {
    return "No history yet — set a level in Library or log a session";
  }
  const tierLabel = tierLabelFor(memory);
  const next = nextProgressionHint(currentId, memory);
  if (next) {
    return `${tierLabel} · next: ${next}`;
  }
  return `${tierLabel}${bestRepsHint(memory)} · at standard ×${memory.sessionsAtStandard}`;
}

function tierLabelFor(memory: ExerciseMemory): string {
  const tier = memory.skillTier ?? memory.declaredTier;
  return tier ? SKILL_TIER_LABELS[tier] : "Unset";
}

function bestRepsHint(memory: ExerciseMemory): string {
  if (memory.bestReps === undefined) {
    return "";
  }
  return ` · best ${memory.bestReps}`;
}

function nextProgressionHint(
  currentId: string,
  memory: ExerciseMemory,
): string | null {
  const exercise = SEED_GRAPH[currentId];
  const harder = exercise?.harderId;
  if (!exercise || !harder) {
    return null;
  }
  if (!shouldAdvanceProgression(exercise, memory)) {
    return null;
  }
  return SEED_GRAPH[harder]?.name ?? harder;
}
