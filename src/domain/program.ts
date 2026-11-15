import type { Dose, Pattern } from "./types";

export type SessionFocus =
  | "legs"
  | "upper"
  | "abs"
  | "bars"
  | "full_body"
  | "skill"
  | "mobility";

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
  /** Stations for the one-tap warmup mini-session (see `WARMUP_STATIONS`). */
  warmupStationIds: string[];
  slots: TemplateSlot[];
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
  | "dumbbell";

export interface UserProfile {
  bodyweightKg: number;
  equipment: EquipmentId[];
  voiceMuted: boolean;
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
