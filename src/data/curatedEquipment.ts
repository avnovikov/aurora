import type { EquipmentId } from "../domain/program";
import { CURATED_EQUIPMENT } from "./generated/equipment";

/**
 * Evidenced gear for one Library exercise (#111). Bench (chair, box, step)
 * and wall are always available, so they never appear.
 */
export interface CuratedEquipment {
  /** All needed; [] means bodyweight only. */
  requires: EquipmentId[];
  /** Alternative sets: owning every item of any one also suffices. */
  orRequires?: EquipmentId[][];
  confidence: "high" | "medium" | "low";
  /** Source URL, or the in-house file the move's text lives in. */
  evidence: string;
  note?: string;
}

/** The curated gear for this exercise; throws when it has none, so a new move cannot ship unaudited. */
export function curatedEquipmentFor(exerciseId: string): CuratedEquipment {
  const entry = CURATED_EQUIPMENT[exerciseId];
  if (!entry) {
    throw new Error(
      `No curated equipment for ${exerciseId}: add a row to data/curated/equipment-audit.tsv and run npm run equipment:compile`,
    );
  }
  return entry;
}
