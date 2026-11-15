import type { JointHistoryEntry } from "../domain/program";
import { describeEntry } from "../settings/jointHistory";
import { jointLoadsFor } from "./jointLoad";
import { movementRisks, type MovementRisk } from "./movementRisk";

export interface JointVerdict {
  /** Never prescribe: swap for a safer move of the same pattern. */
  avoid: boolean;
  /** Short notes for the session card, one per flagged joint. */
  cautions: string[];
}

interface RuleSet {
  avoid: MovementRisk[];
  caution: MovementRisk[];
}

const ADVICE: Record<MovementRisk, string> = {
  shoulder_end_range: "end-range shoulder position under load",
  shoulder_transition: "violent shoulder transition (kip / muscle-up)",
  shoulder_loaded: "heavy overhead or deep-stretch shoulder load — keep it controlled, stop before the stretch bites",
  knee_lateral: "sideways knee load",
  knee_impact: "impact landings — land soft, stop if the knee complains",
  knee_deep_flexion: "deep knee bend under load — cap depth where it feels solid",
};

/**
 * Conservative rules from joint mechanics (see the spec for the evidence):
 * shoulder instability is provoked by loaded abduction + external rotation
 * and extension; the knee's collateral ligaments resist frontal-plane load.
 */
function rulesFor(entry: JointHistoryEntry): RuleSet {
  if (entry.joint === "shoulder") {
    return {
      avoid: ["shoulder_end_range", "shoulder_transition"],
      caution: ["shoulder_loaded"],
    };
  }
  if (entry.joint === "knee") {
    const structural = entry.kind === "ligament" || entry.kind === "surgery";
    return {
      avoid: structural ? ["knee_lateral", "knee_impact"] : ["knee_lateral"],
      caution: structural
        ? ["knee_deep_flexion"]
        : ["knee_impact", "knee_deep_flexion"],
    };
  }
  return { avoid: [], caution: [] };
}

/** Rule hit for one history entry: avoid/caution risks, else a high joint load. */
function entryVerdict(
  entry: JointHistoryEntry,
  name: string,
  risks: ReadonlySet<MovementRisk>,
): { avoid: boolean; note: string } | null {
  const rules = rulesFor(entry);
  const hitAvoid = rules.avoid.find((risk) => risks.has(risk));
  const hitCaution = rules.caution.find((risk) => risks.has(risk));
  const hit = hitAvoid ?? hitCaution;
  if (hit) {
    return { avoid: hitAvoid !== undefined, note: ADVICE[hit] };
  }
  const load = jointLoadsFor(name).find(
    (item) => item.joint === entry.joint && item.level === "high",
  );
  return load ? { avoid: false, note: load.note } : null;
}

export function assessExercise(
  name: string,
  history: readonly JointHistoryEntry[],
): JointVerdict {
  const risks = movementRisks(name);
  const verdict: JointVerdict = { avoid: false, cautions: [] };
  for (const entry of history) {
    const hit = entryVerdict(entry, name, risks);
    if (hit) {
      verdict.avoid ||= hit.avoid;
      verdict.cautions.push(`${describeEntry(entry)}: ${hit.note}`);
    }
  }
  return verdict;
}
