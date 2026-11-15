import type { Difficulty, EffortKind, ExerciseStandards } from "../../domain/types";
import { hasKeyword } from "./keywords";
import type { LadderPlacement } from "./ladder";

const std = (n: number, b: number, i: number, a: number, e: number): ExerciseStandards => ({
  novice: n,
  beginner: b,
  intermediate: i,
  advanced: a,
  elite: e,
});

/**
 * Generic five-tier standards by exercise difficulty (max clean reps / hold s).
 * Anchors: CSEP push-up norms (Payne 2000 doi:10.1139/h00-028), Yang 2019
 * JAMA Netw Open PMID 30768197 (>40 push-ups), USMC PFT pull-ups (5–23),
 * US Army AFT 2025 plank (1:30–3:40) and hand-release push-ups, Strand 2014
 * J Hum Kinet doi:10.2478/hukin-2014-0011 (plank 83–124 s), McGill 1999
 * PMID 10453772 (side bridge ≈70 ± 23 s). Elite-skill rows are extrapolated
 * from coaching sources — no population norms exist.
 */
const REPS: Record<Difficulty, ExerciseStandards> = {
  beginner: std(10, 20, 35, 50, 75),
  intermediate: std(5, 15, 25, 40, 60),
  advanced: std(1, 5, 10, 18, 25),
  elite: std(1, 2, 4, 8, 12),
};

const HOLDS: Record<Difficulty, ExerciseStandards> = {
  beginner: std(20, 45, 90, 150, 220),
  intermediate: std(15, 30, 60, 90, 120),
  advanced: std(5, 10, 20, 30, 45),
  elite: std(2, 5, 10, 15, 25),
};

interface SpecificStandard {
  family: string;
  effort: EffortKind;
  keywords?: readonly string[];
  standards: ExerciseStandards;
  source: string;
}

/** Exercise-specific overrides where a test norm exists. Matched in order. */
const SPECIFIC: readonly SpecificStandard[] = [
  { family: "pull", effort: "hold", keywords: ["dead hang", "deadhang", "active hang", " hang "], standards: std(15, 30, 60, 90, 120), source: "coaching benchmarks (no adult norms)" },
  { family: "anti_extension", effort: "hold", keywords: ["hollow"], standards: std(10, 20, 40, 60, 90), source: "coaching benchmarks" },
  { family: "anti_extension", effort: "hold", keywords: ["plank"], standards: std(30, 60, 90, 150, 220), source: "Strand 2014; US Army AFT 2025" },
  { family: "side_plank", effort: "hold", standards: std(15, 30, 60, 90, 120), source: "McGill 1999" },
  { family: "squat", effort: "hold", standards: std(20, 45, 75, 120, 180), source: "by analogy with plank norms" },
  { family: "squat", effort: "reps", standards: std(15, 30, 50, 75, 100), source: "sit-to-stand medians (Lein 2022)" },
  { family: "calf", effort: "reps", keywords: ["single leg", "one legged"], standards: std(8, 15, 25, 35, 45), source: "Hébert-Losier 2017 PMID 28886865" },
  { family: "glute", effort: "reps", keywords: ["single leg"], standards: std(10, 20, 25, 30, 40), source: "Freckleton 2014 BJSM" },
  { family: "hamstring", effort: "reps", keywords: ["nordic", "glute ham"], standards: std(1, 2, 4, 6, 10), source: "seed Nordic curl standard" },
];

export function standardsFor(
  name: string,
  effort: EffortKind,
  difficulty: Difficulty,
  placement: LadderPlacement | undefined,
): ExerciseStandards {
  const specific = SPECIFIC.find(
    (item) =>
      placement?.family.id === item.family &&
      item.effort === effort &&
      (!item.keywords || hasKeyword(name, item.keywords)),
  );
  if (specific) {
    return specific.standards;
  }
  return (effort === "hold" ? HOLDS : REPS)[difficulty];
}
