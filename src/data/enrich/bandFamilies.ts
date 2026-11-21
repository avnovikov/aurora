import type { EffortKind, ExerciseStandards, Pattern, SkillTier } from "../../domain/types";
import { ENDURA_PUSH_UP, ENDURA_SPLIT_SQUAT } from "./enduraStandards";
import { hasKeyword } from "./keywords";

/**
 * Family bands (#262, user decisions 2026-11-21). The ordinary moves of a
 * family vary in difficulty, but the user expects them in one band, so every
 * member takes the family's band whatever its own source (Endura page,
 * coaching list, seed, research row or computed chain). Skill moves and
 * anything advanced or elite are not members and keep their own bands.
 * Spec: docs/superpowers/specs/2026-11-21-researched-tier-standards-design.md
 */
export interface BandFamily {
  id: "push-up" | "lunge" | "row" | "crunch";
  /** Library label, shown in place of the move's own source. */
  label: string;
  standards: ExerciseStandards;
  patterns: readonly Pattern[];
  /** A member's name contains one of these (normalised, lower-case). */
  keywords: readonly string[];
  /** Skill moves: a name containing one of these is never a member. */
  skills: readonly string[];
}

/** Only ordinary moves are members: a beginner or intermediate work move counted in reps. */
const MEMBER_DIFFICULTIES: ReadonlySet<SkillTier> = new Set(["beginner", "intermediate"]);

const std = (n: number, b: number, i: number, a: number, e: number): ExerciseStandards => ({
  novice: n,
  beginner: b,
  intermediate: i,
  advanced: a,
  elite: e,
});

export const BAND_FAMILIES: readonly BandFamily[] = [
  {
    id: "push-up",
    label: "Push-up family band (Endura push-up)",
    standards: ENDURA_PUSH_UP,
    patterns: ["horizontal_push"],
    keywords: ["push up", "pushup", "press up"],
    // Hindu and pike push-ups are harder (user, 2026-11-21); pike and handstand
    // push-ups keep their own Endura pages.
    skills: ["one arm", "single arm", "archer", "planche", "maltese", "typewriter", "clap", "superman", "hindu", "pike", "handstand", "hspu"],
  },
  {
    id: "lunge",
    label: "Lunge family band (Endura split squat)",
    standards: ENDURA_SPLIT_SQUAT,
    patterns: ["squat"],
    keywords: ["lunge", "split squat"],
    skills: ["pistol", "shrimp", "skater", "jump"],
  },
  {
    id: "row",
    label: "Row family band (bent-knee row norms)",
    // TopEndSports bent-knee horizontal pull-up norms with the FITNESSGRAM
    // modified pull-up, as the third pass set the inverted row.
    standards: std(7, 10, 13, 20, 25),
    patterns: ["horizontal_pull", "vertical_pull"],
    keywords: [" row", "australian"],
    skills: ["one arm", "single arm", "archer", "front lever"],
  },
  {
    id: "crunch",
    label: "Crunch and sit-up family band",
    // The sourced crunch band (StrengthLevel, Cooper Institute), which the sit-up already took.
    standards: std(16, 24, 40, 60, 85),
    patterns: ["core_compression"],
    keywords: ["crunch", "sit up", "situp"],
    skills: ["v up", "jackknife", "dragon", "hanging", "gorilla"],
  },
];

export interface FamilyQuery {
  name: string;
  role: "warmup" | "work" | undefined;
  effort: EffortKind | undefined;
  difficulty: SkillTier | undefined;
  pattern: Pattern;
}

/** The family this move belongs to, or null. Only a move that has a max-rep band is ever asked. */
export function bandFamilyFor(move: FamilyQuery): BandFamily | null {
  if (move.role !== "work" || move.effort !== "reps" || !move.difficulty || !MEMBER_DIFFICULTIES.has(move.difficulty)) {
    return null;
  }
  return (
    BAND_FAMILIES.find(
      (family) =>
        family.patterns.includes(move.pattern) &&
        hasKeyword(move.name, family.keywords) &&
        !hasKeyword(move.name, family.skills),
    ) ?? null
  );
}
