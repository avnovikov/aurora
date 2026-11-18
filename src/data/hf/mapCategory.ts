import type { LoadRegion } from "../seed";
import type { Pattern } from "../../domain/types";

export interface HfCategoryMapping {
  pattern: Pattern;
  regions: LoadRegion[];
}

export function mapHfCategory(category: string): HfCategoryMapping {
  switch (category) {
    case "push":
      return { pattern: "horizontal_push", regions: ["push"] };
    case "pull":
      return { pattern: "vertical_pull", regions: ["pull"] };
    case "legs":
      return { pattern: "squat", regions: ["legs"] };
    case "core":
      return { pattern: "core_compression", regions: ["core"] };
    case "skill":
      return { pattern: "skill", regions: ["skill"] };
    case "mobility":
      return { pattern: "mobility", regions: ["general", "skill"] };
    case "explosive":
      return { pattern: "conditioning", regions: ["general", "legs", "push"] };
    default:
      return { pattern: "conditioning", regions: ["general"] };
  }
}