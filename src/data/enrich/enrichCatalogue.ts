import { resolveExerciseTiming } from "../../domain/timing";
import type { Pattern, SkillTier } from "../../domain/types";
import type { SeedExercise } from "../seed";
import { DESCRIPTION_SOURCES } from "../generated/descriptionSources";
import { DESCRIPTIONS } from "../generated/descriptions";
import { cautionsFor } from "./cautions";
import { placeOnLadder, type LadderPlacement } from "./ladder";
import { wireLadderProgressions, type Placed } from "./progressions";
import { standardsFor } from "./standards";

type Difficulty = Exclude<SkillTier, "novice">;

const DEFAULT_DIFFICULTY: Partial<Record<Pattern, Difficulty>> = {
  skill: "advanced",
  vertical_pull: "intermediate",
  vertical_push: "intermediate",
};

/** Families whose conditioning-pattern members still get tier standards. */
const CONDITIONING_WITH_STANDARDS = new Set(["plyo", "calf"]);

function difficultyOf(exercise: SeedExercise, placement: LadderPlacement | undefined): Difficulty {
  if (placement) {
    return placement.tier;
  }
  const source = exercise.difficulty;
  if (source && source !== "novice") {
    return source;
  }
  return DEFAULT_DIFFICULTY[exercise.pattern] ?? "beginner";
}

function wantsStandards(exercise: SeedExercise, placement: LadderPlacement | undefined): boolean {
  if (exercise.standards || exercise.role === "warmup" || exercise.pattern === "mobility") {
    return false;
  }
  if (exercise.pattern === "conditioning") {
    return placement !== undefined && CONDITIONING_WITH_STANDARDS.has(placement.family.id);
  }
  return true;
}

const TIER_ORDER: Record<SkillTier, number> = {
  novice: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  elite: 4,
};

/** Hand-curated seed chains are trusted; every other link must respect difficulty. */
function isSeed(exercise: SeedExercise): boolean {
  return !/^(hf|ntc|fedb|wger)_/.test(exercise.id);
}

function respectsDifficulty(
  from: Difficulty,
  target: Difficulty | undefined,
  direction: "easier" | "harder",
): boolean {
  if (!target) {
    return false;
  }
  const delta = TIER_ORDER[target] - TIER_ORDER[from];
  return direction === "easier" ? delta <= 0 : delta >= 0;
}

/**
 * Adds level, tier standards, ladder progressions and safety notes. Hand-set
 * values (seed links/standards, HF and NTC links) are never overwritten.
 */
export function enrichCatalogue(catalogue: SeedExercise[]): SeedExercise[] {
  const placements = new Map<string, LadderPlacement>();
  const placed: Placed[] = [];
  for (const exercise of catalogue) {
    const placement = placeOnLadder(exercise.name);
    if (placement) {
      placements.set(exercise.id, placement);
      placed.push({ exercise, placement });
    }
  }
  const links = wireLadderProgressions(placed);
  const difficulties = new Map(
    catalogue.map((exercise) => [exercise.id, difficultyOf(exercise, placements.get(exercise.id))]),
  );

  const pickLink = (
    exercise: SeedExercise,
    difficulty: Difficulty,
    direction: "easier" | "harder",
    ...candidates: Array<string | undefined>
  ): string | undefined => {
    if (isSeed(exercise)) {
      return candidates.find(Boolean);
    }
    return candidates.find(
      (id) => id !== undefined && respectsDifficulty(difficulty, difficulties.get(id), direction),
    );
  };

  return catalogue.map((exercise) => {
    const placement = placements.get(exercise.id);
    const difficulty = difficulties.get(exercise.id) ?? "beginner";
    const ladder = links.get(exercise.id);
    const cautions = cautionsFor(exercise, placement);
    const enriched: SeedExercise = {
      ...exercise,
      difficulty,
      easierId: pickLink(exercise, difficulty, "easier", exercise.easierId, ladder?.easierId),
      harderId: pickLink(exercise, difficulty, "harder", exercise.harderId, ladder?.harderId),
    };
    if (cautions.length > 0) {
      enriched.cautions = cautions;
    }
    applyDescription(enriched);
    if (wantsStandards(exercise, placement)) {
      const { effort } = resolveExerciseTiming(exercise);
      enriched.standards = standardsFor(exercise.name, effort, difficulty, placement);
      enriched.effort = effort;
    }
    return enriched;
  });
}

/** Curated, merged description replaces raw source text when one exists. */
function applyDescription(exercise: SeedExercise): void {
  const curated = DESCRIPTIONS[exercise.id];
  const sources = DESCRIPTION_SOURCES[exercise.id];
  if (sources?.length) {
    exercise.sources = sources;
  }
  if (!curated) {
    return;
  }
  exercise.description = curated.summary;
  exercise.steps = curated.steps;
  exercise.cues = curated.cues;
  if (curated.mistakes.length > 0) {
    exercise.mistakes = curated.mistakes;
  }
}
