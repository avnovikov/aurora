import { exerciseNameKey } from "./nameKey";
import type { SeedExercise } from "./seed";

/** HF names for seed movements that the name key alone doesn't catch. */
const SAME_AS_SEED: Readonly<Record<string, string>> = {
  "Standard Pull-Up": "pullup",
  "Scapula Push-Up": "scap_pushup",
  "Handstand Hold": "freestanding_hs",
  "Bar Muscle-Up": "muscle_up",
  "Nordic Hamstring Curl": "nordic_curl",
};

export interface MergeResult {
  catalogue: SeedExercise[];
  /** Removed duplicate id → seed id that absorbed it. */
  redirects: Record<string, string>;
}

/**
 * Imported moves that duplicate a hand-curated seed move are folded into the
 * seed entry: the seed keeps id, chain, cues and standards and gains the
 * duplicate's media; links to the removed id are redirected.
 */
export function mergeSeedDuplicates(seed: SeedExercise[], imported: SeedExercise[]): MergeResult {
  const seedByKey = new Map(seed.map((item) => [exerciseNameKey(item.name), item.id]));
  const seedIds = new Set(seed.map((item) => item.id));
  const redirects: Record<string, string> = {};
  for (const item of imported) {
    const target = SAME_AS_SEED[item.name] ?? seedByKey.get(exerciseNameKey(item.name));
    if (target && seedIds.has(target)) {
      redirects[item.id] = target;
    }
  }

  const redirect = (id: string | undefined): string | undefined => (id ? (redirects[id] ?? id) : id);
  const absorbed = new Map<string, SeedExercise[]>();
  for (const item of imported) {
    const target = redirects[item.id];
    if (target) {
      absorbed.set(target, [...(absorbed.get(target) ?? []), item]);
    }
  }

  const mergedSeed = seed.map((item) => {
    const extras = absorbed.get(item.id) ?? [];
    const media = [...(item.media ?? []), ...extras.flatMap((extra) => extra.media ?? [])];
    return media.length > 0 ? { ...item, media } : item;
  });
  const kept = imported
    .filter((item) => !redirects[item.id])
    .map((item) => {
      const easierId = redirect(item.easierId);
      const harderId = redirect(item.harderId);
      return {
        ...item,
        easierId: easierId === item.id ? undefined : easierId,
        harderId: harderId === item.id ? undefined : harderId,
      };
    });
  return { catalogue: [...mergedSeed, ...kept], redirects };
}
