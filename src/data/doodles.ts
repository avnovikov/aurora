import { GENERATED_DOODLES, REPLACED_DOODLE_IDS } from "./generated/doodleMap";

/**
 * Which doodle to show: a hand-drawn one wins, unless its animated SVG is
 * marked as a replacement (the drawing shows the wrong move); otherwise the
 * animated SVG fills in where nothing was drawn.
 */
export function doodleFor(exerciseId: string, handDrawn: string | undefined): string | undefined {
  const animated = GENERATED_DOODLES[exerciseId];
  if (animated && REPLACED_DOODLE_IDS.includes(exerciseId)) {
    return animated;
  }
  return handDrawn ?? animated;
}
