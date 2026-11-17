import type { PaletteKey } from "../brand/palettes";
import type { Dose, Pattern } from "./types";

export type SessionFocus =
  | "legs"
  | "upper"
  | "abs"
  | "bars"
  | "full_body"
  | "skill"
  | "mobility"
  | "joint_care";

/** What a plan day is for, in the words the athlete uses. */
export type DayKind =
  | "upper"
  | "lower"
  | "core"
  | "full"
  | "skill"
  | "mobility"
  | "joint_care";

/** Which day of a generated block this is, and how it differs from the others. */
/** A: the athlete's working step; B: one step easier; C: the goal's ladder (or weakest) first, using different moves. */
export type BlockEmphasis = "working" | "easier" | "focus";

export interface BlockInfo {
  /** Shared by every day generated together. */
  id: string;
  letter: "A" | "B" | "C";
  emphasis: BlockEmphasis;
}

export interface TemplateSlot {
  id: string;
  label: string;
  exerciseId: string;
  pattern: Pattern;
  dose: Dose;
  restSeconds: number;
  pinned: boolean;
  /**
   * If true, this slot may keep the same exercise when the same zone
   * runs back-to-back (e.g. Legs squat). All other slots rotate.
   */
  allowConsecutiveRepeat?: boolean;
}

export interface SessionDurationTarget {
  minMinutes: number;
  maxMinutes: number;
}

/** Warm-up level: the athlete's tier in the session's target family, in three bands. */
export type WarmupLevel = "beginner" | "intermediate" | "advanced";

/** Warm-up station ids per level (Mobility repeats one list). */
export type WarmupLists = Readonly<Record<WarmupLevel, readonly string[]>>;

export interface SessionTemplate {
  id: string;
  name: string;
  focus: SessionFocus;
  /** North-star hard skills (e.g. freestanding_hs, pistol_squat) */
  targetExerciseIds: string[];
  /**
   * Warm-up stations per level, each in RAMP order (see `WARMUP_STATIONS`).
   * The level comes from the athlete's tier in the target family (`warmupLevelFor`).
   */
  warmupByLevel: WarmupLists;
  /** Optional cool-down stretches offered after the work (may be empty). */
  cooldownStationIds: string[];
  /** Per-template warm-up hold overrides (seconds) by station id. */
  warmupHoldSeconds?: Readonly<Record<string, number>>;
  slots: TemplateSlot[];
  /** Set on generated days (seed days map from `focus`); see `dayTitle`. */
  kind?: DayKind;
  /** Set on days generated as part of a block. */
  block?: BlockInfo;
  /** If true, completing re-appends this template to the queue tail */
  repeat: boolean;
  /** Planned wall-clock band for this session (warmup + work + rests). */
  targetMinutes?: SessionDurationTarget;
}

export interface PlanQueue {
  items: string[];
}

/** Every gear id, in Settings order. Bench (chair, box, step) and wall are always available. */
export const EQUIPMENT_IDS = [
  "body",
  "bar",
  "rings",
  "parallettes",
  "dumbbell",
  "band",
  "partner",
  "suspension",
  "towel",
  "sliders",
  "dip_bars",
  "foot_anchor",
  "stick",
  "ab_wheel",
  "adjustable_bench",
  "vertical_pole",
  "leg_press",
] as const;

export type EquipmentId = (typeof EQUIPMENT_IDS)[number];

export function isEquipmentId(value: unknown): value is EquipmentId {
  return typeof value === "string" && (EQUIPMENT_IDS as readonly string[]).includes(value);
}

/**
 * Gear a move needs. `requires` must all be owned ([] = bodyweight), unless
 * every item of one `orRequires` set is owned instead.
 */
export interface GearNeeds {
  requires?: readonly EquipmentId[];
  orRequires?: ReadonlyArray<readonly EquipmentId[]>;
}

export type JointId =
  | "shoulder"
  | "elbow"
  | "wrist"
  | "hip"
  | "knee"
  | "ankle"
  | "lumbar";
export type JointSide = "left" | "right" | "both";
export type InjuryKind = "dislocation" | "ligament" | "surgery" | "other";

/** A past injury the planner must respect (asked once at setup). */
export interface JointHistoryEntry {
  joint: JointId;
  side: JointSide;
  kind: InjuryKind;
}

export interface UserProfile {
  bodyweightKg: number;
  equipment: EquipmentId[];
  voiceMuted: boolean;
  /** Past joint injuries; empty means none declared. */
  jointHistory: JointHistoryEntry[];
  /** First-run setup (joint history question) has been answered. */
  setupDone: boolean;
  /** Colour palette chosen in Settings; see src/brand/palettes.ts. */
  palette: PaletteKey;
  /** The weight the athlete owns (dumbbell, kettlebell, vest): what "Add weight" puts on in a session. */
  addWeightKg: number;
  /** Pulse sitting still. Bottom of the training bands. */
  restingHeartRateBpm: number;
  /** Highest pulse the athlete reaches. Top of the training bands. */
  maxHeartRateBpm: number;
}

/** How the whole session felt. Legacy history may still store `"failed"`. */
export type SessionEvaluation = "easy" | "on_target" | "difficult" | "wiped";
/** Stored value before the difficult rename; normalize on read. */
export type LegacySessionEvaluation = SessionEvaluation | "failed";

export interface HistoryEntry {
  id: string;
  completedAt: string;
  templateId: string;
  templateName: string;
  evaluation: SessionEvaluation;
  setCount: number;
  exerciseIds: string[];
}
