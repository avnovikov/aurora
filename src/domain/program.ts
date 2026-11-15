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
}

export interface SessionTemplate {
  id: string;
  name: string;
  focus: SessionFocus;
  /** North-star hard skills (e.g. freestanding_hs, pistol_squat) */
  targetExerciseIds: string[];
  warmupExerciseIds: string[];
  slots: TemplateSlot[];
  /** If true, completing re-appends this template to the queue tail */
  repeat: boolean;
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
