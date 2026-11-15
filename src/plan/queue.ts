import { DEFAULT_PLAN_QUEUE, TEMPLATE_BY_ID } from "../data/seed";
import type { PlanQueue, SessionTemplate } from "../domain/program";
import type { ScheduleOverride } from "./scheduleOverride";
import { resolveTemplate } from "./templates";

const KEY = "aurora.poc.planQueue.v1";

export function loadPlanQueue(): PlanQueue {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    return structuredClone(DEFAULT_PLAN_QUEUE);
  }
  try {
    const parsed = JSON.parse(raw) as PlanQueue;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return structuredClone(DEFAULT_PLAN_QUEUE);
    }
    return parsed;
  } catch {
    return structuredClone(DEFAULT_PLAN_QUEUE);
  }
}

export function savePlanQueue(queue: PlanQueue): void {
  if (queue.items.length === 0) {
    throw new Error("Plan queue must not be empty");
  }
  localStorage.setItem(KEY, JSON.stringify(queue));
}

/**
 * Today's session: the one-off override when set, otherwise the queue head.
 * Never mutates the queue; it only advances when the session completes.
 */
export function peekNextTemplate(
  queue: PlanQueue,
  override: ScheduleOverride | null = null,
): SessionTemplate {
  if (override) {
    return resolveKnownTemplate(override.templateId, "schedule override");
  }
  return resolveKnownTemplate(queue.items[0], "queue");
}

/**
 * Forecast list: an override takes the "next" slot, and the untouched queue
 * head (which will still run after it) follows.
 */
export function peekUpcomingWithOverride(
  queue: PlanQueue,
  count: number,
  override: ScheduleOverride | null,
): SessionTemplate[] {
  assertPositiveCount(count);
  if (!override) {
    return peekUpcoming(queue, count);
  }
  const overrideTemplate = peekNextTemplate(queue, override);
  if (count === 1) {
    return [overrideTemplate];
  }
  return [overrideTemplate, ...peekUpcoming(queue, count - 1)];
}

function resolveKnownTemplate(id: string | undefined, source: string): SessionTemplate {
  if (!id || !TEMPLATE_BY_ID[id]) {
    throw new Error(`Unknown template in ${source}: ${id}`);
  }
  return resolveTemplate(id);
}

export function peekUpcoming(queue: PlanQueue, count: number): SessionTemplate[] {
  assertPositiveCount(count);
  return queue.items.slice(0, count).map((id) => {
    if (!TEMPLATE_BY_ID[id]) {
      throw new Error(`Unknown template in queue: ${id}`);
    }
    return resolveTemplate(id);
  });
}

/**
 * Completing the head advances the queue. Repeating templates re-append.
 */
export function completeNext(queue: PlanQueue): PlanQueue {
  const [head, ...rest] = queue.items;
  if (!head) {
    throw new Error("Cannot complete an empty plan queue");
  }
  const template = TEMPLATE_BY_ID[head];
  const nextItems = [...rest];
  if (template?.repeat) {
    nextItems.push(head);
  }
  if (nextItems.length === 0) {
    return structuredClone(DEFAULT_PLAN_QUEUE);
  }
  return { items: nextItems };
}

export function skipNext(queue: PlanQueue): PlanQueue {
  const [head, ...rest] = queue.items;
  if (!head) {
    throw new Error("Cannot skip an empty plan queue");
  }
  return { items: [...rest, head] };
}

export function moveQueueItem(
  queue: PlanQueue,
  fromIndex: number,
  toIndex: number,
): PlanQueue {
  assertIndex(queue, fromIndex);
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= queue.items.length) {
    throw new Error(`toIndex out of range: ${toIndex}`);
  }
  if (fromIndex === toIndex) {
    return { items: [...queue.items] };
  }
  const items = [...queue.items];
  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
  return { items };
}

export function removeQueueItem(queue: PlanQueue, index: number): PlanQueue {
  assertIndex(queue, index);
  if (queue.items.length <= 1) {
    throw new Error("Plan queue must keep at least one session");
  }
  const items = queue.items.filter((_, i) => i !== index);
  return { items };
}

export function replaceQueueItem(
  queue: PlanQueue,
  index: number,
  templateId: string,
): PlanQueue {
  assertIndex(queue, index);
  if (!TEMPLATE_BY_ID[templateId]) {
    throw new Error(`Unknown template: ${templateId}`);
  }
  const items = [...queue.items];
  items[index] = templateId;
  return { items };
}

function assertIndex(queue: PlanQueue, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= queue.items.length) {
    throw new Error(`queue index out of range: ${index}`);
  }
}

function assertPositiveCount(count: number): void {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`count must be a positive integer; got ${count}`);
  }
}
