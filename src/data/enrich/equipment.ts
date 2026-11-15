import type { EquipmentId } from "../../domain/program";
import { normaliseForKeywords } from "./keywords";

/**
 * Gear a move needs beyond bodyweight, from its name. First matching rule
 * wins, so specific cases (ring dip, korean dip) come before generic ones.
 * Benches, chairs, walls and the floor are assumed to exist. Bands arrive
 * pre-tagged from the wger import.
 */
const RULES: ReadonlyArray<readonly [RegExp, readonly EquipmentId[]]> = [
  // Floor or stretch moves that share a name with a gear move.
  [/bent knee iron cross|iron crosses stretch|chin tuck|chin to chest|elbow lever|floor windshield/, []],
  [/\brings?\b|\btrx\b|suspended|suspension|iron cross|maltese cross|victorian|pelican|ice cream/, ["rings"]],
  [/dumbbell|kettlebell/, ["dumbbell"]],
  [/bench dip|chair dip|floor dip|between two benches/, []],
  [/korean dip|straight bar dip|straight bar support/, ["bar"]],
  [/parallel bar|parallettes?|l sit dip|plyo dip|forward lean dip|(?<!hip )\bdips? /, ["parallettes"]],
  [/pull up|pullup|chin up|grip chin|sternum chins|side to side chins|typewriter pull|commando|headbanger/, ["bar"]],
  [/hang|muscle up|toes to bar|(front|back) lever|skin the cat|human flag|windshield|bar pullover/, ["bar"]],
  [/inverted row|bodyweight mid row|australian|scapular pull|scapula pull|burpee pull/, ["bar"]],
];

export function requiresFor(
  name: string,
  existing: readonly EquipmentId[] = [],
): EquipmentId[] {
  const haystack = normaliseForKeywords(name);
  const matched = RULES.find(([pattern]) => pattern.test(haystack))?.[1] ?? [];
  return [...new Set([...existing, ...matched])];
}
