import type { Pattern } from "../../domain/types";
import type { LoadRegion } from "../seed";
import { hasKeyword } from "./keywords";

/**
 * Movement pattern inferred from an exercise name. Ordered: the first rule
 * that matches wins, so specific movements precede generic body-part words.
 * Keywords match on a normalised name (see `normaliseForKeywords`).
 */
const RULES: ReadonlyArray<readonly [Pattern, readonly string[]]> = [
  ["mobility", ["stretch", "pancake", "yoga", " pose ", "chin tuck", "wrist rock", " neck "]],
  ["vertical_push", ["handstand", "pike push", "pike hold", " dip", " support ", "bar hold"]],
  ["horizontal_push", [" push up", "pushup", " press up", "planche", "chest fly"]],
  ["vertical_pull", [" pull up", "pullup", " chin", "muscle up", " hang ", "lever"]],
  [
    "squat",
    ["squat", "lunge", " step up", "wall sit", "quad sets", "push off", "reverse nordic", "knee extension"],
  ],
  [
    "hinge",
    [
      "bridge", "hip thrust", "deadlift", " rdl ", "good morning", "nordic", "hamstring curl",
      "hamstring kick", "glute", "kickback", "clam", "hydrant", "abduction", "adduction",
      "hyperextension", "superman", "skydiver", "arabesque", "scorpion", "elephant walk", "lateral walk",
    ],
  ],
  [
    "horizontal_pull",
    [" row", " rowing", "face pull", " y raise", "retraction", "trap 3", " w raise", "snow angel", "traction", " curl ", "shrug"],
  ],
  ["core_anti_extension", ["plank", "hollow", "draw in", "vacuum", "rollout", "roll out", "wheel", "dead bug", "deadbug", "bird dog"]],
  [
    "core_compression",
    [
      "crunch", " sit up", "situp", "sit outs", "leg raise", "knee raise", "knee tuck", "toes to bar",
      " v up", "vup", " v sit", " l sit", " l hold", "corkscrew", "toe taps", "reach ups", "knee slides",
      "wood chop", "twist", "levitation", "abdominal", "oblique", "iron cross", "roll overs",
    ],
  ],
  [
    "conditioning",
    [
      " jack", "jump", " hop ", " hops ", "skip", "bronco", "march", " jog", "high knee", "shuffle",
      "snap down", "landing", "crawl", "bear walk", "calf raise", "claps",
    ],
  ],
  [
    "mobility",
    [
      "circles", "swing", " cars ", "happy baby", "open book", "sphinx", "rotation", "tilt", "head turns",
      "prayer", "bretzel", "shinbox", "rock back", "splits", "sit & reach", "roll down", "crossover", "balance",
    ],
  ],
];

export function patternFromName(name: string): Pattern | undefined {
  return RULES.find(([, keywords]) => hasKeyword(name, keywords))?.[0];
}

const FIXED_REGIONS: Record<Pattern, LoadRegion[]> = {
  horizontal_push: ["push"],
  vertical_push: ["push"],
  horizontal_pull: ["pull"],
  vertical_pull: ["pull"],
  squat: ["legs"],
  hinge: ["legs"],
  core_anti_extension: ["core"],
  core_compression: ["core"],
  conditioning: ["general", "legs"],
  skill: ["skill"],
  mobility: ["general"],
};

const SKILL_WORDS = ["handstand", "planche", "lever", "muscle up"];
const BAR_WORDS = [" hang", " bar ", "toes to bar", "rings"];

export function regionsForPattern(pattern: Pattern, name: string, lowerBody: boolean): LoadRegion[] {
  const base = [...FIXED_REGIONS[pattern]];
  if (pattern === "mobility" && lowerBody) {
    base.push("legs");
  }
  if ((pattern === "core_anti_extension" || pattern === "core_compression") && hasKeyword(name, BAR_WORDS)) {
    base.push("pull");
  }
  if (hasKeyword(name, SKILL_WORDS) && !base.includes("skill")) {
    base.push("skill");
  }
  return base;
}
