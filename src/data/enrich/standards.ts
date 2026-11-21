import type {
  Difficulty,
  EffortKind,
  ExerciseStandards,
  StandardsSource,
} from "../../domain/types";
import { enduraRuleFor } from "./enduraStandards";
import { RESEARCHED_STANDARDS } from "./researchedStandards";
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
 * Prefer Endura / coaching composites via `enduraStandardsFor` and SPECIFIC first.
 * Anchors for leftovers: CSEP push-up norms (Payne 2000), Yang 2019, USMC PFT,
 * US Army AFT 2025, Strand 2014, McGill 1999. Elite-skill rows are extrapolated.
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

/**
 * Coaching composites and leftover literature when Endura has no twin.
 * Plan work moves without Endura: #189 design § plan coaching composite.
 */
const SPECIFIC: readonly SpecificStandard[] = [
  {
    family: "pull",
    effort: "hold",
    keywords: ["dead hang", "deadhang", "active hang", " hang "],
    standards: std(15, 30, 60, 90, 120),
    source: "coaching composite (dead hang; no adult norms)",
  },
  {
    family: "anti_extension",
    effort: "hold",
    keywords: ["hollow"],
    standards: std(10, 20, 45, 60, 90),
    source: "coaching composite (hollow; Gravity + hollow tables)",
  },
  // Forearm plank → Endura via enduraStandardsFor; side plank stays McGill.
  { family: "side_plank", effort: "hold", standards: std(15, 30, 60, 90, 120), source: "McGill 1999" },
  { family: "squat", effort: "hold", standards: std(20, 45, 75, 120, 180), source: "by analogy with plank norms" },
  // Bilateral BW squat → Endura; other squat-family reps without Endura keep Lein-ish floor.
  { family: "squat", effort: "reps", standards: std(15, 30, 50, 75, 100), source: "sit-to-stand medians (Lein 2022); Endura wins for BW squat names" },
  {
    family: "calf",
    effort: "reps",
    keywords: ["single leg", "one legged"],
    standards: std(8, 15, 25, 35, 45),
    source: "Hébert-Losier 2017 PMID 28886865 (Endura twin also applied by name)",
  },
  {
    family: "compression",
    effort: "reps",
    keywords: ["knee raise", "knee raises"],
    standards: std(3, 8, 12, 15, 20),
    source: "coaching composite (hanging knee raise entry ~10)",
  },
  {
    family: "anti_extension",
    effort: "reps",
    keywords: ["dead bug"],
    standards: std(4, 8, 12, 16, 20),
    source: "coaching composite (dead bug programming 8–12/side)",
  },
  {
    family: "balance",
    effort: "hold",
    keywords: ["freestanding", "free standing"],
    standards: std(2, 5, 10, 30, 60),
    source: "coaching composite (FIG 2s; freestanding 10→30s)",
  },
  {
    family: "balance",
    effort: "hold",
    keywords: ["wall handstand", "chest to wall", "chest-to-wall", "wall walk"],
    standards: std(10, 20, 30, 60, 90),
    source: "coaching composite (30s wall entry; 60s extended)",
  },
  {
    family: "hamstring",
    effort: "reps",
    keywords: ["hip hinge", "good morning"],
    standards: std(5, 10, 15, 20, 30),
    source: "coaching composite (hip hinge patterning)",
  },
  {
    family: "scapular",
    effort: "reps",
    keywords: ["scapular push", "scap push", "push up plus", "push-up plus"],
    standards: std(5, 10, 15, 20, 30),
    source: "coaching composite (PT scap push 3×10–15)",
  },
  {
    family: "pull",
    effort: "reps",
    keywords: ["scapular pull", "scap pull"],
    standards: std(3, 6, 10, 15, 20),
    source: "coaching composite (scapular pull-up activation)",
  },
];

/** A tier band and where it comes from; no standards when tiers do not apply. */
export interface StandardsPick {
  standards?: ExerciseStandards;
  source: StandardsSource;
}

export interface StandardsQuery {
  id: string;
  name: string;
  effort: EffortKind;
  difficulty: Difficulty;
  placement: LadderPlacement | undefined;
}

/**
 * Tier band for a Library move, first hit wins: an Endura twin, the coaching
 * list (SPECIFIC), the researched table by id (#262), then the generic table
 * by difficulty. A researched `not_max_test` row means no standards at all.
 */
export function standardsFor(query: StandardsQuery): StandardsPick {
  const { id, name, effort, difficulty, placement } = query;
  const endura = enduraRuleFor(name, effort);
  if (endura) {
    return { standards: endura.standards, source: { kind: "endura", label: endura.source } };
  }

  const specific = SPECIFIC.find(
    (item) =>
      placement?.family.id === item.family &&
      item.effort === effort &&
      (!item.keywords || hasKeyword(name, item.keywords)),
  );
  if (specific) {
    return { standards: specific.standards, source: { kind: "coaching", label: specific.source } };
  }

  const researched = RESEARCHED_STANDARDS[id];
  if (researched?.kind === "not_max_test") {
    return { source: { kind: "none", label: researched.source } };
  }
  if (researched?.standards) {
    return { standards: researched.standards, source: { kind: researched.kind, label: researched.source } };
  }
  return {
    standards: (effort === "hold" ? HOLDS : REPS)[difficulty],
    source: { kind: "generic", label: "Generic by difficulty" },
  };
}
