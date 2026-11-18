import { buildSourceCatalogue, type SourceBuildResult } from "../buildSourceCatalogue";
import { serialiseCatalogueModule } from "../serialiseCatalogue";
import type { SeedExercise } from "../seed";
import { mapWgerExerciseRecord, wgerDisplayName } from "./mapWgerExercise";
import { WGER_SAME_AS_EXISTING, isWgerCandidate } from "./selection";
import type { WgerExerciseRecord } from "./types";

export type WgerBuildResult = SourceBuildResult<WgerExerciseRecord>;

/** Bodyweight subset of wger, minus names already in `existing` (or repeated in wger). */
export function buildWgerCatalogue(
  records: WgerExerciseRecord[],
  existing: SeedExercise[],
): WgerBuildResult {
  const byId = [...records].sort((a, b) => a.id - b.id);
  return buildSourceCatalogue(byId, existing, {
    isCandidate: isWgerCandidate,
    map: mapWgerExerciseRecord,
    aliases: WGER_SAME_AS_EXISTING,
    displayName: (record) => wgerDisplayName(record),
  });
}

interface WgerApiExercise {
  id: number;
  category: { name: string };
  muscles: Array<{ id: number }>;
  muscles_secondary: Array<{ id: number }>;
  equipment: Array<{ name: string }>;
  license: { short_name: string };
  license_author: string | null;
  images: Array<{ image: string; license: number; license_author: string | null }>;
  translations: Array<{ language: number; name: string; description: string }>;
}

const ENGLISH = 2;
const LICENSE_BY_ID: Record<number, string> = {
  1: "CC-BY-SA-3.0",
  2: "CC-BY-SA-4.0",
  3: "CC0",
  4: "CC-BY-4.0",
  5: "ODbL",
};

/** Reduce the wger API payload to English-only fields we use. */
export function slimWgerApiResults(results: WgerApiExercise[]): WgerExerciseRecord[] {
  return results.flatMap((item) => {
    const english = item.translations.find((t) => t.language === ENGLISH);
    if (!english) {
      return [];
    }
    return [
      {
        id: item.id,
        name: english.name.trim(),
        description: english.description,
        category: item.category.name,
        muscles: item.muscles.map((m) => m.id),
        musclesSecondary: item.muscles_secondary.map((m) => m.id),
        equipment: item.equipment.map((e) => e.name),
        license: item.license.short_name.replace(" ", "-").replace(/-(\d)$/, "-$1.0"),
        licenseAuthor: item.license_author ?? "",
        images: item.images.flatMap((img) => {
          const license = LICENSE_BY_ID[img.license];
          return license ? [{ url: img.image, license, author: img.license_author ?? "" }] : [];
        }),
      },
    ];
  });
}

export function serialiseWgerCatalogueModule(catalogue: SeedExercise[]): string {
  return serialiseCatalogueModule("WGER_CATALOGUE", "scripts/import-wger.ts", catalogue);
}
