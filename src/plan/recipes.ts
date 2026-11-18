import type { Pattern } from "../domain/types";
import type { AreaKind } from "./dayKinds";

/** Strength areas a ladder belongs to; `full` moves count in any of them. */
type LadderArea = Exclude<AreaKind, "full">;

/** One slot of an area day: a movement ladder, filled with the athlete's step. */
export interface LadderSlotSpec {
  id: string;
  label: string;
  family: string;
  /** Pattern for the slot when the move itself does not say otherwise. */
  pattern: Pattern;
}

const PUSH: LadderSlotSpec = { id: "push", label: "Push", family: "push_up", pattern: "horizontal_push" };
const PULL: LadderSlotSpec = { id: "pull", label: "Pull", family: "pull", pattern: "vertical_pull" };
const OVERHEAD: LadderSlotSpec = { id: "overhead", label: "Overhead push", family: "overhead_push", pattern: "vertical_push" };
const ROW: LadderSlotSpec = { id: "row", label: "Row", family: "row", pattern: "horizontal_pull" };
const SINGLE_LEG: LadderSlotSpec = { id: "single_leg", label: "Single-leg squat", family: "squat_single", pattern: "squat" };
const HAMSTRING: LadderSlotSpec = { id: "hamstring", label: "Hamstring", family: "hamstring", pattern: "hinge" };
const GLUTE: LadderSlotSpec = { id: "glute", label: "Glute", family: "glute", pattern: "hinge" };
const CALF: LadderSlotSpec = { id: "calf", label: "Calf", family: "calf", pattern: "conditioning" };
const ANTI_EXTENSION: LadderSlotSpec = { id: "anti_extension", label: "Anti-extension", family: "anti_extension", pattern: "core_anti_extension" };
const COMPRESSION: LadderSlotSpec = { id: "compression", label: "Compression", family: "compression", pattern: "core_compression" };
const ANTI_EXTENSION_2: LadderSlotSpec = { id: "anti_extension_2", label: "Anti-extension 2", family: "anti_extension", pattern: "core_anti_extension" };
const SIDE_PLANK: LadderSlotSpec = { id: "side_plank", label: "Side plank", family: "side_plank", pattern: "core_anti_extension" };

/**
 * What each strength area trains. Fixed on purpose: the ladders already carry
 * the progression, so a day is the same recipe at a different step.
 */
export const AREA_RECIPES: Readonly<Record<AreaKind, readonly LadderSlotSpec[]>> = {
  upper: [PUSH, PULL, OVERHEAD, ROW],
  lower: [SINGLE_LEG, HAMSTRING, GLUTE, CALF],
  // Five slots like the seed Abs / Core day (two anti-extension moves, compression, a glute
  // bridge), which keeps the session inside the library's 25 to 45 minute band.
  core: [ANTI_EXTENSION, COMPRESSION, SIDE_PLANK, ANTI_EXTENSION_2, GLUTE],
  full: [PUSH, PULL, SINGLE_LEG, HAMSTRING, ANTI_EXTENSION],
};

/** Area of every ladder a day can be built from. Members from another area are ignored. */
export const FAMILY_AREA: Readonly<Record<string, LadderArea>> = {
  push_up: "upper",
  pull: "upper",
  overhead_push: "upper",
  row: "upper",
  dip: "upper",
  scapular: "upper",
  balance: "upper",
  planche: "upper",
  front_lever: "upper",
  back_lever: "upper",
  rings_cross: "upper",
  human_flag: "upper",
  squat_single: "lower",
  squat: "lower",
  hamstring: "lower",
  glute: "lower",
  adductor: "lower",
  calf: "lower",
  plyo: "lower",
  anti_extension: "core",
  compression: "core",
  side_plank: "core",
  flexion: "core",
};
