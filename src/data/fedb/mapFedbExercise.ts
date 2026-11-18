import type {
  SkillTier,
  ExerciseType,
  MuscleEntry,
  MuscleGroup,
  Pattern,
} from "../../domain/types";
import type { LoadRegion, SeedExercise } from "../seed";
import { FEDB_RECLASSIFY } from "./selection";
import { FEDB_ATTRIBUTION, type FedbExerciseRecord } from "./types";

const MUSCLE_GROUPS = new Set<MuscleGroup>([
  "abdominals",
  "abductors",
  "adductors",
  "biceps",
  "calves",
  "chest",
  "forearms",
  "glutes",
  "hamstrings",
  "lats",
  "lower back",
  "middle back",
  "neck",
  "quadriceps",
  "shoulders",
  "traps",
  "triceps",
]);

const LOWER_BODY = new Set<MuscleGroup>([
  "quadriceps",
  "hamstrings",
  "glutes",
  "calves",
  "adductors",
  "abductors",
]);

const DYNAMIC_STRETCH = /circle|dynamic|swing|leg raises|groiners|world/i;
const VERTICAL_PULL = /pull|chin|muscle up|hang|gorilla/i;
const HANGING = /hang|parallel bars|chin|muscle up/i;

export function fedbExerciseId(sourceId: string): string {
  const slug = sourceId
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length > 0)
    .join("_");
  if (!slug) {
    throw new Error(`Invalid free-exercise-db id: ${sourceId}`);
  }
  return `fedb_${slug}`;
}

export function mapFedbExerciseRecord(record: FedbExerciseRecord): SeedExercise {
  const muscles = mapMuscles(record);
  const primary = muscles.filter((m) => m.role === "primary").map((m) => m.group);
  const override = FEDB_RECLASSIFY[record.name];
  const isStretch = record.category === "stretching" && !override;
  const { pattern, regions } = override ?? classify(record, primary);
  const instructions = record.instructions.map((line) => line.trim()).filter(Boolean);

  return {
    id: fedbExerciseId(record.id),
    name: record.name.trim(),
    pattern,
    type: override?.type ?? inferType(record, isStretch),
    muscles,
    joints: [],
    role: isStretch ? "warmup" : "work",
    regions,
    cues: instructions,
    description: instructions.length > 0 ? instructions.join(" ") : undefined,
    difficulty: FEDB_LEVEL[record.level] ?? "beginner",
    attribution: FEDB_ATTRIBUTION,
  };
}

/** Source level; the movement-family ladder overrides it where one applies. */
const FEDB_LEVEL: Record<string, SkillTier> = {
  beginner: "beginner",
  intermediate: "intermediate",
  expert: "advanced",
};

function mapMuscles(record: FedbExerciseRecord): MuscleEntry[] {
  const out: MuscleEntry[] = [];
  const seen = new Set<MuscleGroup>();
  const push = (raw: string, role: MuscleEntry["role"]): void => {
    const group = raw.toLowerCase().trim() as MuscleGroup;
    if (MUSCLE_GROUPS.has(group) && !seen.has(group)) {
      seen.add(group);
      out.push({ group, role });
    }
  };
  record.primaryMuscles.forEach((m) => push(m, "primary"));
  record.secondaryMuscles.forEach((m) => push(m, "secondary"));
  if (out.length === 0) {
    throw new Error(`free-exercise-db record ${record.id} has no known muscles`);
  }
  return out;
}

function inferType(record: FedbExerciseRecord, isStretch: boolean): ExerciseType {
  if (isStretch) {
    return DYNAMIC_STRETCH.test(record.name) ? "dynamic" : "isometric";
  }
  if (record.force === "static" || /plank|hold|hang\b|isometric/i.test(record.name)) {
    return "isometric";
  }
  return "dynamic";
}

interface Classification {
  pattern: Pattern;
  regions: LoadRegion[];
}

function classify(record: FedbExerciseRecord, primary: MuscleGroup[]): Classification {
  const lower = primary.some((group) => LOWER_BODY.has(group));
  if (record.category === "stretching") {
    return { pattern: "mobility", regions: lower ? ["general", "legs"] : ["general"] };
  }
  if (record.category === "plyometrics" || record.category === "cardio") {
    if (primary.includes("chest") || primary.includes("triceps")) {
      return { pattern: "horizontal_push", regions: ["push", "general"] };
    }
    return { pattern: "conditioning", regions: ["general", "legs"] };
  }
  return classifyStrength(record, primary);
}

/** Default pattern/regions by the first primary muscle of a strength move. */
const STRENGTH_BY_MUSCLE: Partial<Record<MuscleGroup, Classification>> = {
  shoulders: { pattern: "vertical_push", regions: ["push"] },
  quadriceps: { pattern: "squat", regions: ["legs"] },
  calves: { pattern: "conditioning", regions: ["legs"] },
  hamstrings: { pattern: "hinge", regions: ["legs"] },
  glutes: { pattern: "hinge", regions: ["legs"] },
  adductors: { pattern: "hinge", regions: ["legs"] },
  abductors: { pattern: "hinge", regions: ["legs"] },
  "lower back": { pattern: "hinge", regions: ["legs", "core"] },
};

const PULL_MUSCLES = new Set<MuscleGroup>(["lats", "biceps", "middle back"]);
const PUSH_MUSCLES = new Set<MuscleGroup>(["chest", "triceps"]);
const FALLBACK: Classification = { pattern: "mobility", regions: ["general"] };

function classifyStrength(
  record: FedbExerciseRecord,
  primary: MuscleGroup[],
): Classification {
  const main = primary[0];
  const name = record.name;
  if (main === "abdominals") {
    const regions: LoadRegion[] = HANGING.test(name) ? ["core", "pull"] : ["core"];
    const pattern = record.force === "static" ? "core_anti_extension" : "core_compression";
    return { pattern, regions };
  }
  if (PULL_MUSCLES.has(main)) {
    const pattern = VERTICAL_PULL.test(name) ? "vertical_pull" : "horizontal_pull";
    return { pattern, regions: ["pull"] };
  }
  if (PUSH_MUSCLES.has(main)) {
    const pattern = /dip|handstand/i.test(name) ? "vertical_push" : "horizontal_push";
    return { pattern, regions: ["push"] };
  }
  return STRENGTH_BY_MUSCLE[main] ?? FALLBACK;
}
