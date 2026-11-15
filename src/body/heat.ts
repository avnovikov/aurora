/** Faintest visible fill, so any trained muscle reads against the black UI. */
export const MIN_HEAT_OPACITY = 0.18;

/**
 * Fill opacity for one muscle: 0 when untrained, otherwise scaled between
 * MIN_HEAT_OPACITY and 1 relative to the hardest-worked group (`maxScore`).
 */
export function heatOpacity(score: number, maxScore: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore)) {
    throw new Error(`heatOpacity needs finite numbers; got score=${score}, max=${maxScore}`);
  }
  if (score <= 0 || maxScore <= 0) {
    return 0;
  }
  const share = Math.min(score / maxScore, 1);
  return MIN_HEAT_OPACITY + (1 - MIN_HEAT_OPACITY) * share;
}

/** Scores are multiples of 0.25: whole numbers stay whole, others drop trailing zeros. */
export function formatLoadScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(2).replace(/0$/, "");
}
