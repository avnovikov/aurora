import { serialiseCatalogueModule } from "../serialiseCatalogue";
import type { SeedExercise } from "../seed";

export function serialiseHfCatalogueModule(catalogue: SeedExercise[]): string {
  return serialiseCatalogueModule("HF_CATALOGUE", "scripts/import-hf-calisthenics.ts", catalogue);
}
