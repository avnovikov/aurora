import type { ExerciseType, MuscleEntry, MuscleGroup, Pattern } from "../../domain/types";
import type { ExerciseMedia, LoadRegion, SeedExercise } from "../seed";
import { hasKeyword } from "../enrich/keywords";
import { decodeEntities, stripTags } from "../enrich/stripTags";
import { patternFromName, regionsForPattern } from "../enrich/patternByName";
import { BAND_EQUIPMENT } from "./selection";
import { WGER_SOURCE, type WgerExerciseRecord } from "./types";

/** wger muscle ids → our 17-group vocabulary. */
const MUSCLE_BY_ID: Record<number, MuscleGroup> = {
  1: "biceps",
  2: "shoulders",
  3: "chest", // serratus anterior
  4: "chest",
  5: "triceps",
  6: "abdominals",
  7: "calves",
  8: "glutes",
  9: "traps",
  10: "quadriceps",
  11: "hamstrings",
  12: "lats",
  13: "biceps", // brachialis
  14: "abdominals", // obliques
  15: "calves", // soleus
};

const MUSCLE_BY_CATEGORY: Record<string, MuscleGroup> = {
  Abs: "abdominals",
  Arms: "triceps",
  Back: "lats",
  Calves: "calves",
  Cardio: "quadriceps",
  Chest: "chest",
  Legs: "quadriceps",
  Shoulders: "shoulders",
};

interface Classification {
  pattern: Pattern;
  regions: LoadRegion[];
}

const MOBILITY_MOTION = ["circles", "swing", " cars ", "rotation", "rock", "switch", "open book", "roll"];
const ISOMETRIC_WORDS = [" hold ", " hang ", "isometric", "isometry", "stance", " l sit", " plank ", "lever ", "planche ", "support", "vacuum", "draw in"];
const ECCENTRIC_WORDS = ["negative", "eccentric"];

/** Per-row licence credit, e.g. "wger.de exercise 42 (CC-BY-SA-4.0, author)". */
export function wgerAttribution(record: Pick<WgerExerciseRecord, "id" | "license" | "licenseAuthor">): string {
  const author = record.licenseAuthor ? `, ${record.licenseAuthor}` : "";
  return `${WGER_SOURCE} exercise ${record.id} (${record.license}${author})`;
}

export function wgerExerciseId(id: number): string {
  if (!Number.isInteger(id) || id < 1) {
    throw new Error(`Invalid wger exercise id: ${id}`);
  }
  return `wger_${id}`;
}

/** Drop wger's duplicate markers ("HD", "(Custom)", left/right) for display. */
const NAME_SUFFIXES = [" (custom)", " hd", ", left leg", ", right leg", " left leg", " right leg", " left", " right"];

export function cleanWgerName(name: string): string {
  let cleaned = name.trim();
  for (const suffix of NAME_SUFFIXES) {
    if (cleaned.toLowerCase().endsWith(suffix)) {
      cleaned = cleaned.slice(0, -suffix.length).trim();
    }
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function wgerDescriptionLines(html: string): string[] {
  const hasList = /<li\b/i.test(html);
  const blocks = hasList
    ? html.split(/<li\b[^>]*>/i).slice(1)
    : html.split(/<\/p>|<br\s*\/?>|\n/i);
  return blocks
    .map((block) => decodeEntities(stripTags(block)))
    .map((line) => line.replaceAll(/\s+/g, " ").trim())
    .filter((line) => line.length > 1);
}

export function mapWgerExerciseRecord(record: WgerExerciseRecord): SeedExercise {
  const name = cleanWgerName(record.name);
  const muscles = mapMuscles(record);
  const { pattern, regions } = classify(record, name);
  const cues = wgerDescriptionLines(record.description);
  const media = record.images.map(toMedia);

  return {
    id: wgerExerciseId(record.id),
    name,
    pattern,
    type: inferType(name, pattern),
    muscles,
    joints: [],
    role: pattern === "mobility" ? "warmup" : "work",
    regions,
    cues,
    description: cues.length > 0 ? cues.join(" ") : undefined,
    media: media.length > 0 ? media : undefined,
    attribution: wgerAttribution(record),
    ...(record.equipment.includes(BAND_EQUIPMENT) ? { requires: ["band" as const] } : {}),
  };
}

function toMedia(image: WgerExerciseRecord["images"][number]): ExerciseMedia {
  return {
    url: image.url,
    license: image.license,
    source: image.author ? `${WGER_SOURCE} / ${image.author}` : WGER_SOURCE,
    mediaType: "image",
  };
}

function mapMuscles(record: WgerExerciseRecord): MuscleEntry[] {
  const out: MuscleEntry[] = [];
  const seen = new Set<MuscleGroup>();
  const add = (id: number, role: MuscleEntry["role"]): void => {
    const group = MUSCLE_BY_ID[id];
    if (group && !seen.has(group)) {
      seen.add(group);
      out.push({ group, role });
    }
  };
  record.muscles.forEach((id) => add(id, "primary"));
  record.musclesSecondary.forEach((id) => add(id, "secondary"));
  if (!out.some((entry) => entry.role === "primary")) {
    const group = MUSCLE_BY_CATEGORY[record.category] ?? "abdominals";
    return [{ group, role: "primary" }, ...out.filter((entry) => entry.group !== group)];
  }
  return out;
}

function classify(record: WgerExerciseRecord, name: string): Classification {
  const byName = patternFromName(name);
  if (byName) {
    const lower = record.category === "Legs" || record.category === "Calves";
    return { pattern: byName, regions: regionsForPattern(byName, name, lower) };
  }
  return classifyByCategory(record, name);
}

const PATTERN_BY_CATEGORY: Record<string, Pattern> = {
  Abs: "core_compression",
  Arms: "horizontal_push",
  Back: "horizontal_pull",
  Calves: "conditioning",
  Cardio: "conditioning",
  Chest: "horizontal_push",
  Legs: "squat",
  Shoulders: "vertical_push",
};

function classifyByCategory(record: WgerExerciseRecord, name: string): Classification {
  const pattern = PATTERN_BY_CATEGORY[record.category] ?? "conditioning";
  const lower = record.category === "Legs" || record.category === "Calves";
  return { pattern, regions: regionsForPattern(pattern, name, lower) };
}

function inferType(name: string, pattern: Pattern): ExerciseType {
  if (hasKeyword(name, ECCENTRIC_WORDS)) {
    return "eccentric";
  }
  if (pattern === "mobility") {
    return hasKeyword(name, MOBILITY_MOTION) ? "dynamic" : "isometric";
  }
  return hasKeyword(name, ISOMETRIC_WORDS) ? "isometric" : "dynamic";
}
