import type { Pattern } from "../domain/types";

const LABELS: Record<Pattern, string> = {
  horizontal_push: "Horizontal push",
  vertical_push: "Vertical push",
  horizontal_pull: "Horizontal pull",
  vertical_pull: "Vertical pull",
  squat: "Squat",
  hinge: "Hinge",
  core_compression: "Core compression",
  core_anti_extension: "Core anti-extension",
  skill: "Skill",
  conditioning: "Conditioning",
  mobility: "Mobility",
};

export function patternLabel(pattern: Pattern): string {
  const label = LABELS[pattern];
  if (!label) {
    return pattern;
  }
  return label;
}

export function isPattern(value: string): value is Pattern {
  return Object.hasOwn(LABELS, value);
}
