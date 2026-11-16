import { EXERCISE_GRAPH } from "../data/exerciseGraph";
import type { DayKind, SessionFocus, SessionTemplate } from "../domain/program";
import { displayExerciseName } from "../library/displayName";

/** The four strength areas the athlete can ask for; Skill needs a named move. */
export type AreaKind = Extract<DayKind, "upper" | "lower" | "core" | "full">;

export const AREA_KINDS: readonly AreaKind[] = ["upper", "lower", "core", "full"];

/** The seed Mobility day: also lends its warm-up, dose convention and time band to Joint care. */
export const MOBILITY_TEMPLATE_ID = "tmpl_mobility";

export const DAY_KIND_LABELS: Record<DayKind, string> = {
  upper: "Upper body",
  lower: "Lower body",
  core: "Core",
  full: "Full body",
  skill: "Skill",
  mobility: "Mobility",
  joint_care: "Joint care",
};

const KIND_BY_FOCUS: Record<SessionFocus, DayKind> = {
  legs: "lower",
  upper: "upper",
  abs: "core",
  bars: "upper",
  full_body: "full",
  skill: "skill",
  mobility: "mobility",
  joint_care: "joint_care",
};

const FOCUS_BY_KIND: Record<DayKind, SessionFocus> = {
  lower: "legs",
  upper: "upper",
  core: "abs",
  full: "full_body",
  skill: "skill",
  mobility: "mobility",
  joint_care: "joint_care",
};

function kindOfFocus(focus: SessionFocus): DayKind {
  return KIND_BY_FOCUS[focus];
}

export function focusOfKind(kind: DayKind): SessionFocus {
  return FOCUS_BY_KIND[kind];
}

export function kindOfTemplate(template: Pick<SessionTemplate, "kind" | "focus">): DayKind {
  return template.kind ?? kindOfFocus(template.focus);
}

/** "Skill: Freestanding handstand" for a named skill, else the kind's label. */
export function skillTitle(targetExerciseId: string | undefined): string {
  const name = targetExerciseId ? EXERCISE_GRAPH[targetExerciseId]?.name : undefined;
  return name ? `${DAY_KIND_LABELS.skill}: ${displayExerciseName(name)}` : DAY_KIND_LABELS.skill;
}

/**
 * What to call a day. Generated days carry their own name ("Upper body · A");
 * seed days show under area names (Legs: Lower body, Bars: Upper body, Skill:
 * the named move) so existing queues read the same as new ones.
 */
export function dayTitle(template: SessionTemplate): string {
  if (template.kind) {
    return template.name;
  }
  const kind = kindOfFocus(template.focus);
  return kind === "skill" ? skillTitle(template.targetExerciseIds[0]) : DAY_KIND_LABELS[kind];
}
