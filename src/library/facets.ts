import type { SeedExercise } from "../data/seed";
import type { MuscleGroup } from "../domain/types";

/**
 * Library-only facets derived from each move's *primary* muscles. They sit
 * beside `regions` (which the planner's variety rotation still uses) and
 * never change it.
 */
export type MuscleBucket =
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "core"
  | "glutes_hips"
  | "quads"
  | "hamstrings_calves";

export type Area = "upper" | "lower" | "core" | "full";
export type AreaFilter = Area | "all";
export type MuscleFilter = MuscleBucket | "all";

export const MUSCLE_BUCKETS: ReadonlyArray<{ id: MuscleBucket; label: string }> = [
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "shoulders", label: "Shoulders" },
  { id: "arms", label: "Arms" },
  { id: "core", label: "Core" },
  { id: "glutes_hips", label: "Glutes & hips" },
  { id: "quads", label: "Quads" },
  { id: "hamstrings_calves", label: "Hamstrings & calves" },
];

export const AREAS: ReadonlyArray<{ id: Area; label: string }> = [
  { id: "upper", label: "Upper body" },
  { id: "lower", label: "Lower body" },
  { id: "core", label: "Core" },
  { id: "full", label: "Full body" },
];

/** Neck has no bucket: its few moves are mobility drills. */
const BUCKET_BY_GROUP: Partial<Record<MuscleGroup, MuscleBucket>> = {
  chest: "chest",
  lats: "back",
  "middle back": "back",
  traps: "back",
  shoulders: "shoulders",
  biceps: "arms",
  triceps: "arms",
  forearms: "arms",
  abdominals: "core",
  "lower back": "core",
  glutes: "glutes_hips",
  abductors: "glutes_hips",
  adductors: "glutes_hips",
  quadriceps: "quads",
  hamstrings: "hamstrings_calves",
  calves: "hamstrings_calves",
};

const UPPER = new Set<MuscleBucket>(["chest", "back", "shoulders", "arms"]);
const LOWER = new Set<MuscleBucket>(["glutes_hips", "quads", "hamstrings_calves"]);

const ALIASES: Readonly<Record<string, MuscleBucket>> = {
  abs: "core",
  abdominals: "core",
  lats: "back",
  traps: "back",
  delts: "shoulders",
  biceps: "arms",
  triceps: "arms",
  forearms: "arms",
  glutes: "glutes_hips",
  hips: "glutes_hips",
  quadriceps: "quads",
  hamstrings: "hamstrings_calves",
  calves: "hamstrings_calves",
};

/** Smallest query that may match a muscle or area word (avoids "a" matching all). */
const MIN_FACET_TEXT = 3;

type WithMuscles = Pick<SeedExercise, "muscles">;

/** hide = training moves and mobility drills only; only = stretches; all = everything. */
export type StretchFilter = "hide" | "only" | "all";

/** The Library hides stretches until asked. */
export const DEFAULT_STRETCH: StretchFilter = "hide";

export const STRETCH_FILTERS: ReadonlyArray<{ id: StretchFilter; label: string }> = [
  { id: "hide", label: "No stretches" },
  { id: "only", label: "Stretches only" },
  { id: "all", label: "Everything" },
];

/** Static holds that are strengthening, neck or balance drills, not stretches. */
const NOT_A_STRETCH = /wrist load|isometric neck|chin tuck|head (tilts|turns)|pelvic tilt|balance|deep squat hold/;

/**
 * A stretch is a mobility move that is a static hold, or that says "stretch"
 * in its name (dynamic stretches included). Dynamic drills such as circles,
 * CARs and leg swings are mobility, not stretches, and stay visible.
 */
export function isStretch(exercise: Pick<SeedExercise, "pattern" | "type" | "name">): boolean {
  if (exercise.pattern !== "mobility") {
    return false;
  }
  const name = exercise.name.toLowerCase();
  if (name.includes("stretch")) {
    return true;
  }
  return exercise.type === "isometric" && !NOT_A_STRETCH.test(name);
}

export function matchesStretchFilter(
  exercise: Pick<SeedExercise, "pattern" | "type" | "name">,
  filter: StretchFilter,
): boolean {
  if (filter === "all") {
    return true;
  }
  return isStretch(exercise) === (filter === "only");
}

export function primaryBuckets(exercise: WithMuscles): MuscleBucket[] {
  const buckets = exercise.muscles
    .filter((entry) => entry.role === "primary")
    .map((entry) => BUCKET_BY_GROUP[entry.group])
    .filter((bucket): bucket is MuscleBucket => bucket !== undefined);
  return [...new Set(buckets)];
}

/**
 * Upper and lower primaries together make Full body; otherwise whichever
 * side has a primary; Core only when no upper or lower muscle is primary
 * (so a plank with shoulder work as a primary counts as Upper).
 */
export function areaOf(exercise: WithMuscles): Area | undefined {
  const buckets = primaryBuckets(exercise);
  const upper = buckets.some((bucket) => UPPER.has(bucket));
  const lower = buckets.some((bucket) => LOWER.has(bucket));
  if (upper && lower) {
    return "full";
  }
  if (upper) {
    return "upper";
  }
  if (lower) {
    return "lower";
  }
  return buckets.includes("core") ? "core" : undefined;
}

export function matchesFacets(
  exercise: WithMuscles,
  area: AreaFilter = "all",
  muscle: MuscleFilter = "all",
): boolean {
  if (area !== "all" && areaOf(exercise) !== area) {
    return false;
  }
  return muscle === "all" || primaryBuckets(exercise).includes(muscle);
}

/** True when `text` names one of the move's primary muscles, buckets or its area. */
export function matchesFacetText(exercise: WithMuscles, text: string): boolean {
  const query = text.trim().toLowerCase();
  if (query.length < MIN_FACET_TEXT) {
    return false;
  }
  const area = areaOf(exercise);
  if (area && AREAS.some((item) => item.id === area && item.label.toLowerCase().includes(query))) {
    return true;
  }
  const groups = exercise.muscles
    .filter((entry) => entry.role === "primary")
    .map((entry) => entry.group as string);
  if (groups.some((group) => group.includes(query))) {
    return true;
  }
  const aliased = ALIASES[query];
  const buckets = primaryBuckets(exercise);
  if (aliased && buckets.includes(aliased)) {
    return true;
  }
  return MUSCLE_BUCKETS.some(
    (bucket) => buckets.includes(bucket.id) && bucket.label.toLowerCase().includes(query),
  );
}
