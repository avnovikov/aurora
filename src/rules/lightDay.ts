import type { Dose, Readiness } from "../domain/types";

const LIGHT_DAY_SET_FACTOR = 0.6;
const MIN_SETS = 1;

/** True when morning signals call for a lighter session. */
export function isLightDay(readiness: Readiness): boolean {
  if (readiness.sleepQuality === "poor") {
    return true;
  }
  if (readiness.yesterdayWiped) {
    return true;
  }
  if (readiness.rmssdBelowBand) {
    return true;
  }
  const median = readiness.restingHrMedian14d;
  const hr = readiness.restingHrBpm;
  const highCount = readiness.highHrMorningCount ?? 0;
  if (
    median !== undefined &&
    hr !== undefined &&
    hr >= median + 5 &&
    highCount >= 2
  ) {
    return true;
  }
  return false;
}

/** Fewer sets, stop one rep earlier; exercise unchanged. */
export function applyLightDayDose(dose: Dose): Dose {
  const sets = Math.max(MIN_SETS, Math.round(dose.sets * LIGHT_DAY_SET_FACTOR));
  return {
    ...dose,
    sets,
    targetRir: dose.targetRir + 1,
  };
}
