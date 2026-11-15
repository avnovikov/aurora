import { SEED_GRAPH, SESSION_TEMPLATES } from "../data/seed";
import type { SessionTemplate } from "../domain/program";
import type { ExerciseMemory } from "../domain/types";
import { distanceToTarget, type TargetDistance } from "../progress/targetDistance";
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
    return "No history yet — log a session";
  }
  const harder = SEED_GRAPH[currentId]?.harderId;
  if (memory.sessionsAtStandard >= 2 && harder) {
    return `Next level guess: ${SEED_GRAPH[harder]?.name ?? harder}`;
  }
  return `At standard ×${memory.sessionsAtStandard}, below ×${memory.sessionsBelowFloor}`;
}
