import type { MuscleEntry, Pattern } from "../domain/types";

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function formatPattern(pattern: Pattern): string {
  return pattern.replaceAll("_", " ");
}

function muscleRoleLabel(role: MuscleEntry["role"]): string {
  if (role === "primary") {
    return "primary";
  }
  if (role === "secondary") {
    return "secondary";
  }
  return "stabiliser";
}

function formatMuscleEntry(entry: MuscleEntry): string {
  return `${entry.group} (${muscleRoleLabel(entry.role)})`;
}

export function formatMuscles(muscles: MuscleEntry[]): string {
  return muscles.map(formatMuscleEntry).join(" · ");
}