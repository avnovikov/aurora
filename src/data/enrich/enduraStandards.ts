import type { EffortKind, ExerciseStandards } from "../../domain/types";
import { hasKeyword, normaliseForKeywords } from "./keywords";

/**
 * Endura men age 20–29 bodyweight standards → Aurora five-tier floors.
 * Spec: docs/superpowers/specs/2026-11-19-endura-standards-calibration-design.md (#189).
 *
 * Endura N/I/A/E map to Aurora beginner/intermediate/advanced/elite.
 * Aurora novice = max(1, round(0.67 × Endura Novice)).
 */
export function fromEndura(
  novice: number,
  intermediate: number,
  advanced: number,
  elite: number,
): ExerciseStandards {
  assertAscending(novice, intermediate, advanced, elite);
  return {
    novice: Math.max(1, Math.round(novice * 0.67)),
    beginner: novice,
    intermediate,
    advanced,
    elite,
  };
}

/** Scale every tier (assisted ×1.2, harder ÷1.2). Ceil so assisted never under-rounds. */
export function scaleStandards(
  base: ExerciseStandards,
  factor: number,
): ExerciseStandards {
  if (factor <= 0 || !Number.isFinite(factor)) {
    throw new Error(`scale factor must be a positive finite number; got ${factor}`);
  }
  const scale = (value: number) => Math.max(1, Math.ceil(value * factor));
  return {
    novice: scale(base.novice),
    beginner: scale(base.beginner),
    intermediate: scale(base.intermediate),
    advanced: scale(base.advanced),
    elite: scale(base.elite),
  };
}

interface EnduraRule {
  /** Matched in order; first hit wins. */
  match: (name: string) => boolean;
  effort: EffortKind;
  standards: ExerciseStandards;
  source: string;
}

const ASSISTED = 1.2;
const HARDER = 1 / ASSISTED;

/** Endura push-up men 20–29; also the push-up family band (bandFamilies.ts). */
export const ENDURA_PUSH_UP = fromEndura(17, 22, 29, 36);
const DIP = fromEndura(8, 18, 30, 42);
const PULL = fromEndura(4, 8, 13, 18);
/** Endura split squat men 20–29; also the lunge family band (bandFamilies.ts). */
export const ENDURA_SPLIT_SQUAT = fromEndura(6, 15, 28, 45);
const PISTOL = fromEndura(2, 5, 9, 15);
const PIKE = fromEndura(7, 18, 35, 58);
const PLANK = fromEndura(55, 105, 165, 270);

/**
 * Exact Endura twins and derived assisted/harder rows. Order matters:
 * more specific names before generic "push-up" / "pull-up".
 *
 * The plain push-up, pull-up, incline push-up and straight-bar dip bands go to
 * the exact twin only (#262). A harder or easier variant (Hindu push-up, L-sit
 * pull-up, low incline push-up, archer straight-bar dip, the Australian
 * pull-up rows) falls through and gets a band derived from its neighbour in
 * the researched table.
 */
const RULES: readonly EnduraRule[] = [
  // --- Push variants (Endura pages) ---
  rule(["wall push"], "reps", scaleStandards(ENDURA_PUSH_UP, ASSISTED), "Endura push-up ×1.2 (wall-assisted)"),
  // Medium grip is the standard grip, so it is the same move.
  ruleExact(["incline push up", "incline push ups", "incline push up medium"], "reps", fromEndura(15, 35, 65, 100), "Endura incline push-up men 20–29"),
  rule(["decline push"], "reps", fromEndura(6, 16, 30, 48), "Endura decline push-up men 20–29"),
  rule(["diamond push"], "reps", fromEndura(5, 15, 30, 50), "Endura diamond push-up men 20–29"),
  rule(["close grip push", "close-grip push", "close grip press"], "reps", fromEndura(5, 15, 30, 50), "Endura close/diamond push-up men 20–29"),
  rule(["wide push", "wide grip push"], "reps", fromEndura(14, 20, 28, 34), "Endura-wide proxy from push-up men 20–29"),
  rule(["clap push"], "reps", fromEndura(3, 8, 15, 25), "Endura clap-style proxy (harder push)"),
  rule(["archer push"], "reps", fromEndura(2, 6, 12, 20), "Endura archer-style proxy (harder push)"),
  rule(["one arm push", "one-arm push", "single arm push"], "reps", fromEndura(1, 3, 6, 12), "Endura one-arm push proxy"),
  rule(["ring push"], "reps", fromEndura(8, 15, 24, 36), "Endura ring push proxy from push-up"),
  rule(["elevated pike", "feet elevated pike"], "reps", scaleStandards(PIKE, HARDER), "Endura pike ÷1.2 (elevated)"),
  rule(["pike push"], "reps", PIKE, "Endura pike push-up men 20–29"),
  rule(["handstand push", "hspu"], "reps", fromEndura(2, 6, 15, 28), "Endura handstand push-up men 20–29"),
  ruleExact(
    ["push up", "push ups", "pushup", "pushups", "standard push up", "press up", "press ups"],
    "reps",
    ENDURA_PUSH_UP,
    "Endura push-up men 20–29",
  ),

  // --- Dips ---
  rule(["bench dip", "chair dip", "floor dip", "dips between two"], "reps", scaleStandards(DIP, ASSISTED), "Endura parallel dip ×1.2 (bench/chair)"),
  rule(["ring dip"], "reps", fromEndura(3, 8, 15, 25), "Endura ring dip proxy (harder than parallel)"),
  ruleExact(["straight bar dip", "straight bar dips"], "reps", fromEndura(5, 12, 22, 35), "Endura straight-bar dip proxy"),
  rule(["parallel bar dip", "parallel-bar dip"], "reps", DIP, "Endura bodyweight dip men 20–29"),
  // bare "Dips" / "dip" after specifics
  ruleExact(["dips", "dip"], "reps", DIP, "Endura bodyweight dip men 20–29"),

  // --- Pull / chin / MU ---
  rule(["ring muscle"], "reps", fromEndura(1, 4, 8, 14), "Endura ring muscle-up men 20–29"),
  // Endura elite 20 sat above the pull-up's 18; capped at floor(18 ÷ 1.2) = 15 (#262).
  rule(["muscle up", "muscle-up"], "reps", fromEndura(2, 6, 12, 15), "Endura muscle-up men 20–29, elite capped below pull-up"),
  rule(["one arm pull", "one-arm pull", "single arm pull"], "reps", fromEndura(1, 2, 4, 8), "Endura one-arm pull proxy"),
  rule(["commando pull"], "reps", fromEndura(3, 7, 12, 17), "Endura commando pull proxy"),
  rule(["close grip pull", "close-grip pull"], "reps", fromEndura(4, 9, 14, 20), "Endura close-grip pull proxy"),
  rule(["wide grip pull", "wide-grip pull"], "reps", fromEndura(3, 7, 12, 17), "Endura wide-grip pull proxy"),
  // An Australian chin-up is a row, not a chin-up (#262).
  {
    effort: "reps",
    standards: fromEndura(6, 14, 24, 35),
    source: "Endura chin-up men 20–29",
    match: (name) => !normaliseForKeywords(name).includes(" australian ") && hasKeyword(name, ["chin up", "chin-up"]),
  },
  rule(["neutral grip pull", "neutral-grip pull"], "reps", PULL, "Endura pull-up men 20–29 (neutral ≈ strict)"),
  ruleExact(["pull up", "pull ups", "pullup", "pullups", "standard pull up"], "reps", PULL, "Endura pull-up men 20–29"),

  // --- Lower body ---
  rule(["supported split", "assisted split"], "reps", scaleStandards(ENDURA_SPLIT_SQUAT, ASSISTED), "Endura split squat ×1.2 (supported)"),
  rule(["bulgarian"], "reps", fromEndura(7, 18, 34, 55), "Endura BW Bulgarian split squat men 20–29"),
  rule(["split squat"], "reps", ENDURA_SPLIT_SQUAT, "Endura split squat men 20–29"),
  rule(["assisted pistol"], "reps", scaleStandards(PISTOL, ASSISTED), "Endura pistol ×1.2 (assisted)"),
  rule(["pistol"], "reps", PISTOL, "Endura pistol squat men 20–29"),
  rule(["nordic"], "reps", fromEndura(1, 3, 7, 12), "Endura BW Nordic curl men 20–29"),
  rule(["single leg glute", "single-leg glute", "one leg glute"], "reps", fromEndura(12, 30, 52, 80), "Endura single-leg glute bridge men 20–29"),
  rule(["glute bridge"], "reps", fromEndura(17, 33, 55, 83), "Endura glute bridge men 20–29"),
  rule(["single leg calf", "single-leg calf", "one legged calf", "one-legged calf"], "reps", fromEndura(8, 15, 25, 35), "Hébert-Losier-aligned / Endura calf family"),
  rule(["calf raise"], "reps", fromEndura(25, 60, 100, 150), "Endura BW calf raise men 20–29"),
  rule(["bodyweight squat", "air squat"], "reps", fromEndura(25, 50, 85, 130), "Endura bodyweight squat men 20–29"),
  // generic "squat" only when it is clearly the bilateral BW squat name
  ruleExact(["squat"], "reps", fromEndura(25, 50, 85, 130), "Endura bodyweight squat men 20–29"),

  // --- Holds ---
  rule(["forearm plank", "front plank"], "hold", PLANK, "Endura forearm plank men 20–29"),
  ruleExact(["plank"], "hold", PLANK, "Endura forearm plank men 20–29"),
];

/** The Endura row (band and source label) for this name, or null. */
export function enduraRuleFor(
  name: string,
  effort: EffortKind,
): { standards: ExerciseStandards; source: string } | null {
  const hit = RULES.find((rule) => rule.effort === effort && rule.match(name));
  return hit ? { standards: hit.standards, source: hit.source } : null;
}

function rule(
  keywords: readonly string[],
  effort: EffortKind,
  standards: ExerciseStandards,
  source: string,
): EnduraRule {
  return {
    effort,
    standards,
    source,
    match: (name) => hasKeyword(name, keywords),
  };
}

/** Exact normalised name only (avoids "Hindu Squat", "plank hip dips", "Hindu Push-Up"). */
function ruleExact(
  exact: readonly string[],
  effort: EffortKind,
  standards: ExerciseStandards,
  source: string,
): EnduraRule {
  const needles = new Set(exact.map((name) => name.toLowerCase()));
  return {
    effort,
    standards,
    source,
    match: (name) => needles.has(normaliseForKeywords(name).trim()),
  };
}

function assertAscending(
  novice: number,
  intermediate: number,
  advanced: number,
  elite: number,
): void {
  if (!(novice > 0 && intermediate >= novice && advanced >= intermediate && elite >= advanced)) {
    throw new Error(
      `Endura floors must be positive and non-decreasing; got ${novice}/${intermediate}/${advanced}/${elite}`,
    );
  }
}
