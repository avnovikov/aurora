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
  adductors: "adductors",
  abductors: "abductors",
  gastrocnemius: "calves",
  soleus: "calves",
  "tibialis anterior": "calves",
  "rectus abdominis": "abdominals",
  core: "abdominals",
  "transverse abdominis": "abdominals",
  piriformis: "glutes",
  "hip external rotators": "glutes",
  "glute medius": "glutes",
  "gluteus medius": "glutes",
  "gluteus maximus": "glutes",
  "hip adductors": "adductors",
  groin: "adductors",
  "inner thighs": "adductors",
  "lumbar spine": "lower back",
  "erector spinae": "lower back",
  "spinal erectors": "lower back",
  grip: "forearms",
  "wrist flexors": "forearms",
  "wrist extensors": "forearms",
  pecs: "chest",
  "serratus anterior": "chest",
  rhomboids: "middle back",
  "lower traps": "traps",
  "upper back": "middle back",
  "thoracic spine": "middle back",
  neck: "neck",
};

/** Used only when no listed muscle is recognised ("hip flexors" alone, etc.). */
const FALLBACK_BY_CATEGORY: Record<string, MuscleGroup> = {
  push: "chest",
  pull: "lats",
  legs: "quadriceps",
  core: "abdominals",
  skill: "shoulders",
  mobility: "glutes",
  explosive: "quadriceps",
};

export function mapHfPrimaryMuscles(primaryMuscles: string[], category = ""): MuscleEntry[] {
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
    groups.push({ group: FALLBACK_BY_CATEGORY[category] ?? "shoulders", role: "primary" });
  }

  return groups;
}

function mapMuscleToken(token: string): MuscleGroup | undefined {
  const key = token.toLowerCase().trim();
  return MUSCLE_ALIASES[key];
}