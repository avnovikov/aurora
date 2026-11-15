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

export interface SessionTemplate {
  id: string;
  name: string;
  focus: SessionFocus;
  /** North-star hard skills (e.g. freestanding_hs, pistol_squat) */
  targetExerciseIds: string[];
  /** Warm-up stations in RAMP order (see `WARMUP_STATIONS`). */
  warmupStationIds: string[];
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

export type EquipmentId =
  | "body"
  | "bar"
  | "rings"
  | "parallettes"
  | "dumbbell"
  | "band";

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
}

export type SessionEvaluation = "easy" | "on_target" | "failed" | "wiped";

export interface HistoryEntry {
  id: string;
  completedAt: string;
  templateId: string;
  templateName: string;
  evaluation: SessionEvaluation;
  setCount: number;
  exerciseIds: string[];
}
