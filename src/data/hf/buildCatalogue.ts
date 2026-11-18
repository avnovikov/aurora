import type { SeedExercise } from "../seed";
import { mapHfExerciseRecord } from "./mapHfExercise";
import { wireHfProgressionLinks } from "./wireProgressions";
import type { HfExerciseRecord } from "./types";

export function buildHfCatalogue(records: HfExerciseRecord[]): SeedExercise[] {
  const mapped = records.map(mapHfExerciseRecord);
  return wireHfProgressionLinks(records, mapped);
}

export function parseHfJsonl(content: string): HfExerciseRecord[] {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line, index) => {
    try {
      return JSON.parse(line) as HfExerciseRecord;
    } catch {
      throw new Error(`Invalid JSONL at line ${index + 1}`);
    }
  });
}