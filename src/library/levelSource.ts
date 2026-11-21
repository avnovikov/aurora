import { tierIndex } from "../domain/skillTier";
import type { ExerciseMemory, StandardsSource } from "../domain/types";
import { evidenceTier, liveInferredTier, needsRetest } from "../progress/levelEvidence";

export interface LevelSourceView {
  label: string | null;
  retest: boolean;
}

/** Where the effective level comes from, highest evidence first (#112). */
export function describeLevelSource(
  memory: ExerciseMemory,
  now: Date,
  nameOf: (id: string) => string,
): LevelSourceView {
  const effective = evidenceTier(memory, now);
  const retest = needsRetest(memory, now);
  if (!effective) {
    return { label: null, retest };
  }
  const at = (tier: ExerciseMemory["declaredTier"]) => tier !== undefined && tierIndex(tier) === tierIndex(effective);
  if (at(memory.declaredTier)) {
    return { label: "Your pick", retest };
  }
  if (at(memory.loggedTier)) {
    return { label: "Logged sets", retest };
  }
  const inferred = memory.inferred;
  if (inferred && at(liveInferredTier(memory, now))) {
    return { label: `Inferred from ${inferred.from.map(nameOf).join(" + ")}`, retest };
  }
  return { label: "Plan default", retest };
}

/**
 * Where a move's tier band comes from, for the Library (#262): the Endura or
 * coaching row, "Sourced: …", "Derived from …", or the generic table. Null
 * when the move has no band source recorded.
 */
export function describeStandardsSource(source: StandardsSource | undefined): string | null {
  if (!source) {
    return null;
  }
  if (source.kind === "none") {
    return "No tiers: not a max-rep test. Dosed by sets, contacts or load.";
  }
  return `Band: ${source.label}`;
}
