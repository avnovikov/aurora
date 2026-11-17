import type { EffortKind } from "./types";

/** Which side a per-side hold segment is for (left then right, repeated). */
export type HoldSide = "left" | "right";

/**
 * Pre-parsed Library dose: rounds × amount, for the whole body or each side.
 * Descriptions are parsed into this once; runtime does not read cue text.
 */
export interface ExercisePrescription {
  effort: EffortKind;
  /** Number of rounds (≥ 1). */
  rounds: number;
  /** Seconds or reps (inclusive). */
  amountMin: number;
  amountMax: number;
  /** `perSide` doubles segments (left then right each round). */
  scope: "total" | "perSide";
}

/** One timed hold produced by expanding a hold prescription. */
export interface HoldSegment {
  seconds: number;
  side?: HoldSide;
}

/**
 * Expand a hold prescription into timed segments.
 * Warm-up uses `amountMin` per segment (the floor of the authored band).
 */
export function expandHoldPrescription(
  prescription: ExercisePrescription,
): HoldSegment[] {
  assertHoldPrescription(prescription);
  const seconds = prescription.amountMin;
  const perSide = prescription.scope === "perSide";
  const segments: HoldSegment[] = [];
  for (let round = 0; round < prescription.rounds; round += 1) {
    if (perSide) {
      segments.push({ seconds, side: "left" }, { seconds, side: "right" });
    } else {
      segments.push({ seconds });
    }
  }
  return segments;
}

/** Both band ends are real numbers (NaN would slip past every comparison). */
function hasAmountBand(prescription: Pick<ExercisePrescription, "amountMin" | "amountMax">): boolean {
  return Number.isFinite(prescription.amountMin) && Number.isFinite(prescription.amountMax);
}

/** Clamp a working amount into the prescription band (work dosing). */
export function clampToPrescription(
  amount: number,
  prescription: Pick<ExercisePrescription, "amountMin" | "amountMax">,
): number {
  if (!hasAmountBand(prescription) || prescription.amountMin > prescription.amountMax) {
    throw new Error(
      `prescription amountMin (${prescription.amountMin}) must be ≤ amountMax (${prescription.amountMax})`,
    );
  }
  return Math.min(prescription.amountMax, Math.max(prescription.amountMin, amount));
}

function assertHoldPrescription(prescription: ExercisePrescription): void {
  if (prescription.effort !== "hold") {
    throw new Error(
      `expandHoldPrescription requires effort "hold"; got ${prescription.effort}`,
    );
  }
  if (!Number.isInteger(prescription.rounds) || prescription.rounds < 1) {
    throw new Error(
      `prescription rounds must be an integer ≥ 1; got ${prescription.rounds}`,
    );
  }
  if (
    !hasAmountBand(prescription) ||
    prescription.amountMin <= 0 ||
    prescription.amountMax <= 0 ||
    prescription.amountMin > prescription.amountMax
  ) {
    throw new Error(
      `prescription amountMin must be > 0 and ≤ amountMax; got ${prescription.amountMin}–${prescription.amountMax}`,
    );
  }
  if (prescription.scope !== "total" && prescription.scope !== "perSide") {
    throw new Error(`Unknown prescription scope: ${prescription.scope}`);
  }
}
