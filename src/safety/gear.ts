import type { EquipmentId, GearNeeds } from "../domain/program";

function isOwned(gear: EquipmentId, equipment: readonly EquipmentId[]): boolean {
  return gear === "body" || equipment.includes(gear);
}

function isGearList(needs: GearNeeds | readonly EquipmentId[]): needs is readonly EquipmentId[] {
  return Array.isArray(needs);
}

/**
 * Gear a move needs that the profile lacks. "body" is always available.
 * Pass the exercise (or any `GearNeeds`): when one `orRequires` set is fully
 * owned nothing is missing; otherwise the unowned `requires` items are listed.
 * A bare list is read as `requires` with no alternatives.
 */
export function missingGear(
  needs: GearNeeds | readonly EquipmentId[] | undefined,
  equipment: readonly EquipmentId[] | undefined,
): EquipmentId[] {
  if (!equipment || !needs) {
    return [];
  }
  const { requires = [], orRequires = [] } = isGearList(needs) ? { requires: needs } : needs;
  const missing = requires.filter((gear) => !isOwned(gear, equipment));
  if (missing.length === 0) {
    return [];
  }
  const alternativeOwned = orRequires.some((set) => set.every((gear) => isOwned(gear, equipment)));
  return alternativeOwned ? [] : missing;
}
