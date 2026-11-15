import type { PlanQueue, SessionTemplate } from "../domain/program";
import type { Dose, Exercise, Pattern } from "../domain/types";

export type LoadRegion = "legs" | "push" | "pull" | "core" | "skill" | "general";

export interface ExerciseMedia {
  url: string;
  license: string;
  source: string;
  mediaType: string;
}

export interface SeedExercise extends Exercise {
  role?: "warmup" | "work";
  regions: LoadRegion[];
  doodlePath?: string;
  cues: string[];
  description?: string;
  media?: ExerciseMedia[];
  attribution?: string;
}

export interface SeedSlot {
  id: string;
  label: string;
  exerciseId: string;
  pattern: Pattern;
  dose: Dose;
  restSeconds: number;
  pinned: boolean;
}

export interface StarterProgram {
  id: string;
  name: string;
  sessionLabel: string;
  slots: SeedSlot[];
  warmupExerciseIds: string[];
}

function ex(partial: SeedExercise): SeedExercise {
  assertSeedExercise(partial);
  return partial;
}

function assertSeedExercise(exercise: SeedExercise): void {
  if (!exercise.id || !exercise.name) {
    throw new Error("Seed exercise requires id and name");
  }
  if (exercise.muscles.length === 0) {
    throw new Error(`Seed exercise ${exercise.id} needs muscles`);
  }
}

export const SEED_EXERCISES: SeedExercise[] = [
  ex({
    id: "pulse_raiser_march",
    name: "March in place",
    pattern: "conditioning",
    type: "dynamic",
    muscles: [{ group: "quadriceps", role: "primary" }],
    joints: ["hip", "knee", "ankle"],
    role: "warmup",
    regions: ["general", "legs"],
    doodlePath: "/doodles/doodle-lunge.jpg",
    cues: ["Light bounce", "Arms swing freely", "Breathe through the nose"],
  }),
  ex({
    id: "hip_circles",
    name: "Hip circles",
    pattern: "mobility",
    type: "dynamic",
    muscles: [{ group: "glutes", role: "primary" }],
    joints: ["hip"],
    role: "warmup",
    regions: ["legs", "general"],
    doodlePath: "/doodles/doodle-glute-bridge.jpg",
    cues: ["Slow circles", "Both directions", "Keep ribs quiet"],
  }),
  ex({
    id: "ankle_rocks",
    name: "Ankle rocks",
    pattern: "mobility",
    type: "dynamic",
    muscles: [{ group: "calves", role: "primary" }],
    joints: ["ankle", "knee"],
    role: "warmup",
    regions: ["legs"],
    doodlePath: "/doodles/doodle-calf-raise.jpg",
    cues: ["Knee tracks over mid-foot", "Heel stays down as long as possible"],
  }),
  ex({
    id: "wrist_load",
    name: "Wrist load",
    pattern: "mobility",
    type: "isometric",
    muscles: [{ group: "forearms", role: "primary" }],
    joints: ["wrist"],
    role: "warmup",
    regions: ["skill", "push"],
    doodlePath: "/doodles/doodle-wrist-load.jpg",
    cues: ["Fingers spread", "Shift weight gently", "Stop before sharp pain"],
  }),
  ex({
    id: "scap_pushup",
    name: "Scapular push-up",
    pattern: "horizontal_push",
    type: "dynamic",
    muscles: [
      { group: "chest", role: "primary" },
      { group: "shoulders", role: "stabilizer" },
    ],
    joints: ["shoulder"],
    role: "warmup",
    regions: ["skill", "push"],
    doodlePath: "/doodles/doodle-scap-pushup.jpg",
    cues: ["Arms locked", "Only the shoulder blades move", "Long neck"],
  }),
  ex({
    id: "bodyweight_squat",
    name: "Bodyweight squat",
    pattern: "squat",
    type: "dynamic",
    muscles: [
      { group: "quadriceps", role: "primary" },
      { group: "glutes", role: "secondary" },
    ],
    joints: ["hip", "knee", "ankle"],
    easierId: undefined,
    harderId: "bulgarian_split",
    role: "work",
    regions: ["legs"],
    doodlePath: "/doodles/doodle-bodyweight-squat.jpg",
    cues: ["Feet under hips", "Knees track toes", "Stand tall at the top"],
  }),
  ex({
    id: "bulgarian_split",
    name: "Bulgarian split squat",
    pattern: "squat",
    type: "dynamic",
    muscles: [
      { group: "quadriceps", role: "primary" },
      { group: "glutes", role: "secondary" },
    ],
    joints: ["hip", "knee", "ankle"],
    easierId: "bodyweight_squat",
    harderId: "pistol_squat",
    role: "work",
    regions: ["legs"],
    doodlePath: "/doodles/doodle-bulgarian-split.jpg",
    cues: ["Rear foot light", "Front heel stays down", "Torso tall"],
  }),
  ex({
    id: "pistol_squat",
    name: "Pistol squat",
    pattern: "squat",
    type: "dynamic",
    muscles: [
      { group: "quadriceps", role: "primary" },
      { group: "glutes", role: "secondary" },
    ],
    joints: ["hip", "knee", "ankle"],
    easierId: "bulgarian_split",
    role: "work",
    regions: ["legs"],
    doodlePath: "/doodles/doodle-pistol-squat.jpg",
    cues: ["Control the descent", "Reach the free leg forward", "No collapse at the bottom"],
  }),
  ex({
    id: "hip_hinge",
    name: "Hip hinge",
    pattern: "hinge",
    type: "dynamic",
    muscles: [
      { group: "hamstrings", role: "primary" },
      { group: "glutes", role: "primary" },
      { group: "lower back", role: "stabilizer" },
    ],
    joints: ["hip", "lumbar"],
    harderId: "nordic_curl",
    role: "work",
    regions: ["legs"],
    doodlePath: "/doodles/doodle-hip-hinge.jpg",
    cues: ["Soft knees", "Push hips back", "Spine long"],
  }),
  ex({
    id: "nordic_curl",
    name: "Nordic curl",
    pattern: "hinge",
    type: "eccentric",
    muscles: [{ group: "hamstrings", role: "primary" }],
    joints: ["knee", "hip"],
    easierId: "hip_hinge",
    role: "work",
    regions: ["legs"],
    doodlePath: "/doodles/doodle-nordic-curl.jpg",
    cues: ["Slow lower", "Catch with hands if needed", "Squeeze glutes"],
  }),
  ex({
    id: "wall_handstand",
    name: "Wall handstand hold",
    pattern: "skill",
    type: "isometric",
    muscles: [
      { group: "shoulders", role: "primary" },
      { group: "abdominals", role: "stabilizer" },
    ],
    joints: ["wrist", "shoulder", "cervical"],
    easierId: "elevated_pike",
    harderId: "freestanding_hs",
    role: "work",
    regions: ["skill"],
    doodlePath: "/doodles/doodle-wall-handstand.jpg",
    cues: ["Hollow ribs", "Push the floor away", "Look at the hands"],
  }),
  ex({
    id: "elevated_pike",
    name: "Elevated pike push-up",
    pattern: "vertical_push",
    type: "dynamic",
    muscles: [
      { group: "shoulders", role: "primary" },
      { group: "triceps", role: "secondary" },
    ],
    joints: ["shoulder", "elbow", "wrist"],
    harderId: "wall_handstand",
    role: "work",
    regions: ["skill", "push"],
    doodlePath: "/doodles/doodle-elevated-pike.jpg",
    cues: ["Hips high", "Elbows track back", "Soft landing of the head path"],
  }),
  ex({
    id: "freestanding_hs",
    name: "Freestanding handstand attempt",
    pattern: "skill",
    type: "isometric",
    muscles: [
      { group: "shoulders", role: "primary" },
      { group: "abdominals", role: "stabilizer" },
    ],
    joints: ["wrist", "shoulder"],
    easierId: "wall_handstand",
    role: "work",
    regions: ["skill"],
    doodlePath: "/doodles/doodle-freestanding-hs.jpg",
    cues: ["Kick to balance", "Exit cleanly", "Stop when form breaks"],
  }),
  ex({
    id: "glute_bridge",
    name: "Glute bridge",
    pattern: "hinge",
    type: "dynamic",
    muscles: [{ group: "glutes", role: "primary" }],
    joints: ["hip"],
    role: "warmup",
    regions: ["legs"],
    doodlePath: "/doodles/doodle-glute-bridge.jpg",
    cues: ["Ribs down", "Squeeze at the top", "No overarching"],
  }),
  ex({
    id: "dead_bug",
    name: "Dead bug",
    pattern: "core_anti_extension",
    type: "dynamic",
    muscles: [{ group: "abdominals", role: "primary" }],
    joints: ["lumbar"],
    role: "work",
    regions: ["core"],
    cues: ["Low back glued down", "Opposite arm and leg", "Slow breath out"],
  }),
  ex({
    id: "hollow_hold",
    name: "Hollow body hold",
    pattern: "core_anti_extension",
    type: "isometric",
    muscles: [{ group: "abdominals", role: "primary" }],
    joints: ["lumbar"],
    easierId: "dead_bug",
    harderId: "hanging_knee_raise",
    role: "work",
    regions: ["core"],
    cues: ["Ribs down", "Arms by ears if you can", "Lower back pressed"],
  }),
  ex({
    id: "hanging_knee_raise",
    name: "Hanging knee raise",
    pattern: "core_compression",
    type: "dynamic",
    muscles: [{ group: "abdominals", role: "primary" }],
    joints: ["lumbar", "shoulder"],
    easierId: "hollow_hold",
    role: "work",
    regions: ["core", "pull"],
    cues: ["Dead hang first", "Knees up without swinging", "Control the lower"],
  }),
  ex({
    id: "pullup_dead_hang",
    name: "Dead hang",
    pattern: "vertical_pull",
    type: "isometric",
    muscles: [
      { group: "lats", role: "primary" },
      { group: "forearms", role: "secondary" },
    ],
    joints: ["shoulder", "elbow", "wrist"],
    harderId: "scapular_pull",
    role: "work",
    regions: ["pull"],
    cues: ["Shoulders packed", "Quiet legs", "Breathe"],
  }),
  ex({
    id: "scapular_pull",
    name: "Scapular pull-up",
    pattern: "vertical_pull",
    type: "dynamic",
    muscles: [
      { group: "lats", role: "primary" },
      { group: "traps", role: "secondary" },
    ],
    joints: ["shoulder"],
    easierId: "pullup_dead_hang",
    harderId: "pullup",
    role: "work",
    regions: ["pull"],
    cues: ["Arms stay straight", "Depress the scapulae", "Pause at the top"],
  }),
  ex({
    id: "pullup",
    name: "Pull-up",
    pattern: "vertical_pull",
    type: "dynamic",
    muscles: [
      { group: "lats", role: "primary" },
      { group: "biceps", role: "secondary" },
    ],
    joints: ["shoulder", "elbow"],
    easierId: "scapular_pull",
    role: "work",
    regions: ["pull"],
    cues: ["Chest to bar path", "No kip for strength sets", "Full hang between reps"],
  }),
];

export const SEED_GRAPH: Record<string, SeedExercise> = Object.fromEntries(
  SEED_EXERCISES.map((exercise) => [exercise.id, exercise]),
);

export const SESSION_TEMPLATES: SessionTemplate[] = [
  {
    id: "tmpl_legs",
    name: "Legs",
    focus: "legs",
    targetExerciseIds: ["pistol_squat"],
    repeat: true,
    warmupExerciseIds: [
      "pulse_raiser_march",
      "hip_circles",
      "ankle_rocks",
      "glute_bridge",
    ],
    slots: [
      {
        id: "legs_squat",
        label: "Squat",
        exerciseId: "bodyweight_squat",
        pattern: "squat",
        dose: { sets: 3, reps: 8, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 90,
        pinned: false,
      },
      {
        id: "legs_hinge",
        label: "Hinge",
        exerciseId: "hip_hinge",
        pattern: "hinge",
        dose: { sets: 3, reps: 8, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 90,
        pinned: false,
      },
    ],
  },
  {
    id: "tmpl_abs",
    name: "Abs / Core",
    focus: "abs",
    targetExerciseIds: ["hanging_knee_raise"],
    repeat: true,
    warmupExerciseIds: ["pulse_raiser_march", "hip_circles"],
    slots: [
      {
        id: "core_hollow",
        label: "Hollow",
        exerciseId: "hollow_hold",
        pattern: "core_anti_extension",
        dose: { sets: 3, reps: 20, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 60,
        pinned: false,
      },
      {
        id: "core_dead_bug",
        label: "Dead bug",
        exerciseId: "dead_bug",
        pattern: "core_anti_extension",
        dose: { sets: 3, reps: 8, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 45,
        pinned: false,
      },
    ],
  },
  {
    id: "tmpl_skill_hs",
    name: "Skill",
    focus: "skill",
    targetExerciseIds: ["freestanding_hs"],
    repeat: true,
    warmupExerciseIds: ["wrist_load", "scap_pushup"],
    slots: [
      {
        id: "skill_wall_hs",
        label: "Wall HS",
        exerciseId: "wall_handstand",
        pattern: "skill",
        dose: { sets: 4, reps: 20, targetRir: 3, addedLoadKg: 0 },
        restSeconds: 60,
        pinned: false,
      },
      {
        id: "skill_pike",
        label: "Pike",
        exerciseId: "elevated_pike",
        pattern: "vertical_push",
        dose: { sets: 3, reps: 6, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 90,
        pinned: false,
      },
    ],
  },
  {
    id: "tmpl_bars",
    name: "Bars",
    focus: "bars",
    targetExerciseIds: ["pullup"],
    repeat: true,
    warmupExerciseIds: ["pulse_raiser_march", "scap_pushup"],
    slots: [
      {
        id: "bars_hang",
        label: "Hang",
        exerciseId: "pullup_dead_hang",
        pattern: "vertical_pull",
        dose: { sets: 3, reps: 20, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 60,
        pinned: false,
      },
      {
        id: "bars_scap",
        label: "Scap pull",
        exerciseId: "scapular_pull",
        pattern: "vertical_pull",
        dose: { sets: 3, reps: 6, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 90,
        pinned: false,
      },
    ],
  },
  {
    id: "tmpl_full",
    name: "Full body",
    focus: "full_body",
    targetExerciseIds: ["pistol_squat", "pullup", "freestanding_hs"],
    repeat: true,
    warmupExerciseIds: [
      "pulse_raiser_march",
      "hip_circles",
      "wrist_load",
      "scap_pushup",
    ],
    slots: [
      {
        id: "full_squat",
        label: "Squat",
        exerciseId: "bodyweight_squat",
        pattern: "squat",
        dose: { sets: 2, reps: 8, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 75,
        pinned: false,
      },
      {
        id: "full_pull",
        label: "Pull",
        exerciseId: "scapular_pull",
        pattern: "vertical_pull",
        dose: { sets: 2, reps: 6, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 75,
        pinned: false,
      },
      {
        id: "full_core",
        label: "Core",
        exerciseId: "hollow_hold",
        pattern: "core_anti_extension",
        dose: { sets: 2, reps: 20, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 45,
        pinned: false,
      },
    ],
  },
];

export const TEMPLATE_BY_ID: Record<string, SessionTemplate> = Object.fromEntries(
  SESSION_TEMPLATES.map((template) => [template.id, template]),
);

/** Default queue: Legs ×3, Skill (handstand target), Abs/Core, Bars */
export const DEFAULT_PLAN_QUEUE: PlanQueue = {
  items: [
    "tmpl_legs",
    "tmpl_legs",
    "tmpl_legs",
    "tmpl_skill_hs",
    "tmpl_abs",
    "tmpl_bars",
  ],
};

/** @deprecated Prefer queue + SESSION_TEMPLATES — kept for older tests */
export const STARTER_PROGRAM: StarterProgram = {
  id: "tmpl_legs",
  name: "Legs",
  sessionLabel: "Today",
  warmupExerciseIds: SESSION_TEMPLATES[0].warmupExerciseIds,
  slots: SESSION_TEMPLATES[0].slots,
};

export function doodleFor(exerciseId: string): string | undefined {
  return SEED_GRAPH[exerciseId]?.doodlePath;
}

export function cuesFor(exerciseId: string): string[] {
  return SEED_GRAPH[exerciseId]?.cues ?? [];
}

export function templateToStarter(template: SessionTemplate): StarterProgram {
  return {
    id: template.id,
    name: template.name,
    sessionLabel: template.name,
    warmupExerciseIds: template.warmupExerciseIds,
    slots: template.slots,
  };
}
