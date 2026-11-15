import type { ExerciseType } from "../../domain/types";
import type { ExerciseMedia, SeedExercise } from "../seed";
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
    type: inferExerciseType(record.name),
    muscles: mapHfPrimaryMuscles(record.primary_muscles),
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

function inferExerciseType(name: string): ExerciseType {
  const lower = name.toLowerCase();
  if (lower.includes("hold") || lower.includes("plank") || lower.includes("hang")) {
    return "isometric";
  }
  if (lower.includes("negative") || lower.includes("eccentric")) {
    return "eccentric";
  }
  return "dynamic";
}