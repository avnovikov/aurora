import type { ExerciseType } from "../../domain/types";
import type { ExerciseMedia, SeedExercise } from "../seed";
import { hasKeyword } from "../enrich/keywords";
import { mapHfCategory } from "./mapCategory";
import { filterAllowedHfMediaLinks } from "./licenseLinks";
import { mapHfPrimaryMuscles } from "./mapMuscles";
import { hfExerciseId } from "./normalise";
import { HF_DATASET_ATTRIBUTION, type HfExerciseRecord } from "./types";

export function mapHfExerciseRecord(record: HfExerciseRecord): SeedExercise {
  const { pattern, regions } = mapHfCategory(record.category);
  const media = toExerciseMedia(filterAllowedHfMediaLinks(record.links));
  const description = record.description.trim();

  return {
    id: hfExerciseId(record.id),
    name: record.name.trim(),
    pattern,
    type: inferExerciseType(record.name, record.category),
    muscles: mapHfPrimaryMuscles(record.primary_muscles, record.category),
    joints: [],
    role: "work",
    regions,
    cues: description ? [description] : [],
    description: description || undefined,
    media: media.length > 0 ? media : undefined,
    attribution: HF_DATASET_ATTRIBUTION,
  };
}

function toExerciseMedia(links: HfExerciseRecord["links"]): ExerciseMedia[] {
  return links.map((link) => ({
    url: link.url,
    license: link.license ?? "",
    source: link.source,
    mediaType: link.type,
  }));
}

/** Static positions held for time (skills, holds, wall sit). */
const ISOMETRIC_WORDS = [
  " hold", " plank ", " hang ", "wall sit", " l sit ", " v sit ", "lever ", "planche ", "support",
  "crow", "human flag", " cross ", "manna", "handstand ", "back bridge", "neck bridge", "japanese handstand",
];
const MOVING_WORDS = [
  "push", "pull", " row", "raise", "dip", "rock", "walk", "press", "jump", " tap", "reach",
  "rotation", "twist", "climber",
];
/** Mobility moves that are done as movement, not held. */
const MOBILITY_MOTION = ["circle", "rotation", "switch", "cat cow", "dislocate", "angel", "curl", "windmill", "greatest", "hang", "dorsiflexion"];

function inferExerciseType(name: string, category: string): ExerciseType {
  if (hasKeyword(name, ["negative", "eccentric"])) {
    return "eccentric";
  }
  if (category === "mobility") {
    return hasKeyword(name, MOBILITY_MOTION) ? "dynamic" : "isometric";
  }
  const isometric = hasKeyword(name, ISOMETRIC_WORDS) && !hasKeyword(name, MOVING_WORDS);
  return isometric ? "isometric" : "dynamic";
}
