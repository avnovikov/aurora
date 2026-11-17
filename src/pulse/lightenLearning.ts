import type { SessionEvaluation } from "../domain/program";
import { createKeyValueStore } from "../storage/keyValueStore";
import { LIGHTEN_LEARNING_KEY } from "../storage/storageKeys";
import {
  predictPreferLight,
  trainLightenForest,
  type LightenExample,
  type LightenFeatures,
  type LightenForest,
} from "./lightenForest";

const MAX_EXAMPLES = 60;
const DECISION_WEIGHT = 1;
const REINFORCEMENT_WEIGHT = 2;

interface LearningStore {
  readonly examples: LightenExample[];
  /** Open gate awaiting session rating for the same session. */
  readonly pending?: PendingLightenGate;
}

export interface PendingLightenGate {
  readonly features: LightenFeatures;
  readonly acceptedLight: boolean;
  readonly sessionStartedAtMs: number;
}

const store = createKeyValueStore(LIGHTEN_LEARNING_KEY);

function read(): LearningStore {
  const raw = store.read();
  if (!raw) {
    return { examples: [] };
  }
  try {
    const parsed = JSON.parse(raw) as LearningStore;
    return {
      examples: Array.isArray(parsed.examples) ? parsed.examples : [],
      pending: parsed.pending,
    };
  } catch {
    return { examples: [] };
  }
}

function write(next: LearningStore): void {
  store.write(JSON.stringify(next));
}

function appendExample(
  examples: readonly LightenExample[],
  example: LightenExample,
): LightenExample[] {
  return [...examples, example].slice(-MAX_EXAMPLES);
}

function sameFeatures(a: LightenFeatures, b: LightenFeatures): boolean {
  return a.sleep === b.sleep && a.pain === b.pain && a.hr === b.hr;
}

/**
 * Drop the last weight-1 decision for these features so a later reinforcement
 * does not leave two opposite labels for the same vector.
 */
function withoutLastDecision(
  examples: readonly LightenExample[],
  features: LightenFeatures,
): LightenExample[] {
  for (let i = examples.length - 1; i >= 0; i -= 1) {
    const ex = examples[i]!;
    if (ex.weight === DECISION_WEIGHT && sameFeatures(ex, features)) {
      return [...examples.slice(0, i), ...examples.slice(i + 1)];
    }
  }
  return [...examples];
}

export function loadLightenExamples(): LightenExample[] {
  return [...read().examples];
}

export function forestFromStore(): LightenForest {
  return trainLightenForest(loadLightenExamples());
}

/** Default the confirm toward Light when the forest (or cold start) says so. */
export function preferLightDefault(features: LightenFeatures): boolean {
  return predictPreferLight(forestFromStore(), features);
}

/** Clear a stale pending gate (e.g. athlete abandoned the prior session). */
export function clearPendingLightenGate(): void {
  const current = read();
  if (!current.pending) {
    return;
  }
  write({ examples: current.examples });
}

export function recordLightenDecision(
  features: LightenFeatures,
  acceptedLight: boolean,
  sessionStartedAtMs: number,
): void {
  assertFiniteSessionStart(sessionStartedAtMs);
  const current = read();
  write({
    examples: appendExample(current.examples, {
      ...features,
      label: acceptedLight ? 1 : 0,
      weight: DECISION_WEIGHT,
    }),
    pending: { features, acceptedLight, sessionStartedAtMs },
  });
}

/**
 * Stronger delayed label from session rating for the same session that confirmed.
 * Declined light then difficult/wiped → should have preferred light.
 * Accepted light then easy/on_target → reinforce accept.
 */
export function reinforceFromSessionEvaluation(
  evaluation: SessionEvaluation,
  sessionStartedAtMs: number,
): void {
  assertFiniteSessionStart(sessionStartedAtMs);
  const current = read();
  const pending = current.pending;
  if (!pending || pending.sessionStartedAtMs !== sessionStartedAtMs) {
    return;
  }
  const label = reinforcementLabel(pending.acceptedLight, evaluation);
  if (label === null) {
    write({ examples: current.examples });
    return;
  }
  write({
    examples: appendExample(withoutLastDecision(current.examples, pending.features), {
      ...pending.features,
      label,
      weight: REINFORCEMENT_WEIGHT,
    }),
  });
}

function reinforcementLabel(
  acceptedLight: boolean,
  evaluation: SessionEvaluation,
): 0 | 1 | null {
  const hard = evaluation === "difficult" || evaluation === "wiped";
  const easy = evaluation === "easy" || evaluation === "on_target";
  if (hard) {
    return acceptedLight ? 0 : 1;
  }
  if (easy) {
    return acceptedLight ? 1 : 0;
  }
  return null;
}

function assertFiniteSessionStart(sessionStartedAtMs: number): void {
  if (!Number.isFinite(sessionStartedAtMs)) {
    throw new Error(`sessionStartedAtMs must be finite; got ${sessionStartedAtMs}`);
  }
}
