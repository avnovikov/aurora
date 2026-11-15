import { resolveExerciseTiming } from "../../domain/timing";
import { tierIndex } from "../../domain/skillTier";
import type { Difficulty, Pattern } from "../../domain/types";
import type { SeedExercise } from "../seed";
import { isSeedId } from "../sourceRank";
import { DESCRIPTION_SOURCES } from "../generated/descriptionSources";
import { DESCRIPTIONS } from "../generated/descriptions";
import { doodleFor } from "../doodles";
import { cautionsFor } from "./cautions";
import { requiresFor } from "./equipment";
import { placeOnLadder, type LadderPlacement } from "./ladder";
import { wireLadderProgressions, type Placed } from "./progressions";
import { standardsFor } from "./standards";

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

function respectsDifficulty(
  from: Difficulty,
  target: Difficulty | undefined,
  direction: "easier" | "harder",
): boolean {
  if (!target) {
    return false;
  }
  const delta = tierIndex(target) - tierIndex(from);
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
    // Gear-dependent moves stay off the ladders: nobody should be advanced or
    // regressed into a move they cannot do without the gear.
    const placement = exercise.requires?.includes("band") ? undefined : placeOnLadder(exercise.name);
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
    // Hand-curated seed chains are trusted; every other link must respect difficulty.
    if (isSeedId(exercise.id)) {
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
    const requires = requiresFor(exercise.name, exercise.requires);
    if (requires.length > 0) {
      enriched.requires = requires;
    }
    if (wantsStandards(exercise, placement)) {
      const { effort } = resolveExerciseTiming(exercise);
      enriched.standards = standardsFor(exercise.name, effort, difficulty, placement);
      enriched.effort = effort;
    }
    enriched.doodlePath = doodleFor(exercise.id, enriched.doodlePath);
    return withDescription(enriched);
  });
}

/** Curated, merged description replaces raw source text when one exists. */
function withDescription(exercise: SeedExercise): SeedExercise {
  const curated = DESCRIPTIONS[exercise.id];
  const sources = DESCRIPTION_SOURCES[exercise.id];
  return {
    ...exercise,
    ...(sources?.length ? { sources } : {}),
    ...(curated
      ? {
          description: curated.summary,
          steps: curated.steps,
          cues: curated.cues,
          ...(curated.mistakes.length > 0 ? { mistakes: curated.mistakes } : {}),
        }
      : {}),
  };
}
