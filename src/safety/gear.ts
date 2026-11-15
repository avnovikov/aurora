import type { EquipmentId } from "../domain/program";

/** Gear a move needs that the profile lacks. "body" is always available. */
export function missingGear(
  requires: readonly EquipmentId[] | undefined,
  equipment: readonly EquipmentId[] | undefined,
): EquipmentId[] {
  if (!equipment) {
    return [];
  }
  return (requires ?? []).filter((gear) => gear !== "body" && !equipment.includes(gear));
}
