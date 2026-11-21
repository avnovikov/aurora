import type { EffortKind, ExerciseStandards, StandardsSource } from "../../domain/types";

/**
 * Skill ladders (#262, user decision 8): a tierless move on one of these
 * paths, or on a catalogue chain that holds a skill-pattern move, may take
 * the band of the previous level on its path.
 */
export const SKILL_LADDERS: ReadonlySet<string> = new Set([
  "planche",
  "front_lever",
  "back_lever",
  "rings_cross",
  "human_flag",
  "balance",
  "compression",
]);

/** Guard 2: "definitely not in 100s" for a skill. A copied band's elite must stay below this. */
export const PATH_PREVIOUS_ELITE_LIMIT = 100;

export interface PathStep {
  id: string;
  name: string;
  easierId?: string;
  effort?: EffortKind;
  standards?: ExerciseStandards;
}

export type PathPreviousResult =
  | { standards: ExerciseStandards; source: StandardsSource; previousId: string }
  | { excluded: "no_previous_same_effort" | "elite_in_hundreds"; previousId?: string };

/**
 * User decision 8 (#262): a tierless move on a skill path takes the same band
 * as the previous level on that path, the nearest easier step that counts the
 * same thing (reps or hold seconds). Steps with no band or another effort are
 * walked past. A band whose elite is 100 or more is never copied. Pure and
 * deterministic: it walks `easierId` links only and stops on a cycle.
 */
export function pathPreviousBand(
  move: PathStep,
  byId: ReadonlyMap<string, PathStep>,
): PathPreviousResult {
  const seen = new Set<string>([move.id]);
  let cursor = move.easierId ? byId.get(move.easierId) : undefined;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    if (cursor.standards && cursor.effort === move.effort) {
      if (cursor.standards.elite >= PATH_PREVIOUS_ELITE_LIMIT) {
        return { excluded: "elite_in_hundreds", previousId: cursor.id };
      }
      return {
        standards: { ...cursor.standards },
        source: { kind: "path_previous", label: `Same as previous level: ${cursor.name}` },
        previousId: cursor.id,
      };
    }
    cursor = cursor.easierId ? byId.get(cursor.easierId) : undefined;
  }
  return { excluded: "no_previous_same_effort" };
}
