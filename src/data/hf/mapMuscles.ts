import type { MuscleEntry, MuscleGroup } from "../../domain/types";

const MUSCLE_ALIASES: Record<string, MuscleGroup> = {
  abdominals: "abdominals",
  abs: "abdominals",
  biceps: "biceps",
  calves: "calves",
  chest: "chest",
  forearms: "forearms",
  glutes: "glutes",
  hamstrings: "hamstrings",
  lats: "lats",
  quadriceps: "quadriceps",
  quads: "quadriceps",
  shoulders: "shoulders",
  traps: "traps",
  triceps: "triceps",
  "anterior deltoids": "shoulders",
  deltoids: "shoulders",
  "rear deltoids": "shoulders",
  "lower back": "lower back",
  "middle back": "middle back",
  back: "lats",
  obliques: "abdominals",
  "hip flexors": "quadriceps",
  adductors: "adductors",
  abductors: "abductors",
};

export function mapHfPrimaryMuscles(primaryMuscles: string[]): MuscleEntry[] {
  const groups: MuscleEntry[] = [];
  const seen = new Set<MuscleGroup>();

  for (const raw of primaryMuscles) {
    const group = mapMuscleToken(raw);
    if (!group || seen.has(group)) {
      continue;
    }
    seen.add(group);
    groups.push({ group, role: "primary" });
  }

  if (groups.length === 0) {
    groups.push({ group: "shoulders", role: "primary" });
  }

  return groups;
}

function mapMuscleToken(token: string): MuscleGroup | undefined {
  const key = token.toLowerCase().trim();
  return MUSCLE_ALIASES[key];
}