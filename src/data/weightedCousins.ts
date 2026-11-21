/**
 * Curated unweighted → weighted twins for session Add weight (#251).
 * Twin names are wger English display names; resolved to ids after import.
 */
export const WEIGHTED_COUSIN_BY_UNWEIGHTED_ID: Readonly<Record<string, string>> = {
  hip_hinge: "Dumbbell Deadlift",
  hf_85: "Single-Leg Deadlift with Dumbbell",
  bodyweight_squat: "Dumbbell Front Squat",
  bulgarian_split: "Bulgarian Squat with Dumbbells",
  hf_79: "Dumbbell Lunges Walking",
  reverse_lunge: "Dumbbell Rear Lunge",
  step_up: "Weighted Step-ups",
  calf_raise: "Dumbbell Calf Raise",
  hf_2: "Weighted push-ups",
  fedb_bodyweight_mid_row: "Renegade Row",
  glute_bridge: "Dumbbell Hip Thrust",
  hf_87: "Dumbbell Hip Thrust",
  fedb_single_leg_glute_bridge: "Dumbbell Single-leg Hip Thrust",
  wger_1913: "Dumbbell Single-leg Hip Thrust",
};

/** wger names that must enter the catalogue as weighted cousins. */
export const WEIGHTED_COUSIN_WGER_NAMES: ReadonlySet<string> = new Set(
  Object.values(WEIGHTED_COUSIN_BY_UNWEIGHTED_ID),
);

/** Resolve weightedId links once catalogue ids are known (by display name). */
export function weightedIdByUnweightedId(
  nameToId: ReadonlyMap<string, string>,
): Readonly<Record<string, string>> {
  const links: Record<string, string> = {};
  for (const [fromId, twinName] of Object.entries(WEIGHTED_COUSIN_BY_UNWEIGHTED_ID)) {
    const twinId = nameToId.get(twinName);
    if (!twinId) {
      throw new Error(`Weighted cousin missing from catalogue: ${twinName} (for ${fromId})`);
    }
    links[fromId] = twinId;
  }
  return links;
}
