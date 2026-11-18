import type { SeedExercise } from "../data/seed";
import { missingGear } from "./gear";
import type { EquipmentId, JointHistoryEntry, JointId } from "../domain/program";

/**
 * Library moves worth knowing for each joint with a past injury: scapular and
 * rotator-cuff work for the shoulder, hip and landing control for the knee.
 * Names, not ids, so imports can renumber; a test checks every name resolves.
 * Evidence levels per move are in the library evidence doc (§7).
 */
export const PREHAB_NAMES: Partial<Record<JointId, readonly string[]>> = {
  shoulder: [
    "Side-lying External Rotation",
    "Scapular push-up",
    "Scapular pull-up",
    "Prone Y-T-W raise",
    "Prone Scapular Retraction - Arms at Side",
    "Serratus Wall Slide Stretch",
    "Band pull-apart with external rotation",
    "Band pull-aparts",
    "Banded Scapular Retraction",
    "Seated Band Row",
  ],
  knee: [
    "Copenhagen Adduction Exercise",
    "Single-Leg Soft-Landing Holds",
    "Deficit Step-Down",
    "Tibialis Raise",
    "Side Lying Hip Abduction",
    "Clamshell",
    "Banded Clamshell",
    "Band Terminal Knee extension",
    "Glute bridge",
  ],
  hip: [
    "Clamshell",
    "Banded Clamshell",
    "Side Lying Hip Abduction",
    "Glute bridge",
    "Copenhagen Adduction Exercise",
  ],
  lumbar: ["Dead bug", "Bird Dog", "Side Plank"],
  ankle: ["Calf raise", "Tibialis Raise", "Ankle rocks", "Single-Leg Balance with Eyes Closed"],
  wrist: ["Wrist load", "Wrist Circles"],
};

/**
 * Prehab moves for the joints in `history`, no repeats, history order. With
 * `equipment` given, moves needing gear the user lacks are left out.
 */
export function prehabFor(
  history: readonly JointHistoryEntry[],
  catalogue: readonly SeedExercise[],
  equipment?: readonly EquipmentId[],
): SeedExercise[] {
  const hasGear = (item: SeedExercise): boolean => missingGear(item, equipment).length === 0;
  const byName = new Map(catalogue.map((item) => [item.name.toLowerCase(), item]));
  const seen = new Set<string>();
  const found: SeedExercise[] = [];
  for (const entry of history) {
    for (const name of PREHAB_NAMES[entry.joint] ?? []) {
      const item = byName.get(name.toLowerCase());
      if (item && hasGear(item) && !seen.has(item.id)) {
        seen.add(item.id);
        found.push(item);
      }
    }
  }
  return found;
}
