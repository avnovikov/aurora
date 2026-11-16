import type {
  EquipmentId,
  PlanQueue,
  SessionTemplate,
  WarmupLevel,
  WarmupLists,
} from "../domain/program";
import type { Dose, Exercise, ExerciseStandards, Pattern, SkillTier } from "../domain/types";

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
  /** Level at which this move is typically a working exercise. */
  difficulty?: SkillTier;
  /** Evidence-based safety notes shown in the Library. */
  cautions?: string[];
  /** Gear this move needs beyond bodyweight (Library only; never auto-planned). */
  requires?: EquipmentId[];
  /** How-to steps (curated house style). */
  steps?: string[];
  /** Common faults to avoid. */
  mistakes?: string[];
  /** Where the merged description text came from (attribution). */
  sources?: string[];
}

export interface SeedSlot {
  id: string;
  label: string;
  exerciseId: string;
  pattern: Pattern;
  dose: Dose;
  restSeconds: number;
  pinned: boolean;
  allowConsecutiveRepeat?: boolean;
}

export interface StarterProgram {
  id: string;
  name: string;
  sessionLabel: string;
  slots: SeedSlot[];
  /** Target skills; the warm-up level comes from the athlete's tier in their family. */
  targetExerciseIds?: readonly string[];
  warmupByLevel: WarmupLists;
  cooldownStationIds: string[];
  warmupHoldSeconds?: Readonly<Record<string, number>>;
}

function ex(partial: SeedExercise): SeedExercise {
  assertSeedExercise(partial);
  return {
    ...partial,
    effort: partial.effort ?? seedDefaultEffort(partial.type),
    secondsPerRep: partial.secondsPerRep ?? seedDefaultSecondsPerRep(partial),
  };
}

function seedDefaultEffort(
  type: SeedExercise["type"],
): NonNullable<SeedExercise["effort"]> {
  if (type === "isometric") {
    return "hold";
  }
  return "reps";
}

function seedDefaultSecondsPerRep(partial: SeedExercise): number {
  if (partial.type === "isometric") {
    return 1;
  }
  if (partial.type === "eccentric") {
    return 5;
  }
  return 3.5;
}

function assertSeedExercise(exercise: SeedExercise): void {
  if (!exercise.id || !exercise.name) {
    throw new Error("Seed exercise requires id and name");
  }
  if (exercise.muscles.length === 0) {
    throw new Error(`Seed exercise ${exercise.id} needs muscles`);
  }
}

/** Work-heavy band; prebuilt warmup is a short fixed sequence, not a 10 min fill. */
const SESSION_BAND = { minMinutes: 25, maxMinutes: 45 } as const;
/** Short optional prehab session (prebuilt warmup + pinned mobility). */
const MOBILITY_BAND = { minMinutes: 10, maxMinutes: 20 } as const;

/** Rep or hold-second floors by skill tier (literature-inspired). */
function std(
  novice: number,
  beginner: number,
  intermediate: number,
  advanced: number,
  elite: number,
): ExerciseStandards {
  return { novice, beginner, intermediate, advanced, elite };
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
    doodlePath: "/doodles/doodle-march-in-place.jpg",
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
    doodlePath: "/doodles/doodle-hip-circles.jpg",
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
    id: "shrimp_squat",
    name: "Shrimp squat",
    pattern: "squat",
    type: "dynamic",
    muscles: [
      { group: "quadriceps", role: "primary" },
      { group: "glutes", role: "secondary" },
    ],
    joints: ["hip", "knee", "ankle"],
    easierId: "bulgarian_split",
    harderId: "pistol_squat",
    role: "work",
    regions: ["legs"],
    doodlePath: "/doodles/doodle-shrimp-squat.jpg",
    cues: ["Hold the rear foot", "Knee tracks forward", "Stay tall"],
  }),
  ex({
    id: "cossack_squat",
    name: "Cossack squat",
    pattern: "squat",
    type: "dynamic",
    muscles: [
      { group: "quadriceps", role: "primary" },
      { group: "adductors", role: "secondary" },
    ],
    joints: ["hip", "knee", "ankle"],
    easierId: "bodyweight_squat",
    role: "work",
    regions: ["legs"],
    doodlePath: "/doodles/doodle-cossack-squat.jpg",
    cues: ["Sit into one hip", "Other leg straight", "Heel down on the working side"],
  }),
  ex({
    id: "step_up",
    name: "Step-up",
    pattern: "squat",
    type: "dynamic",
    muscles: [
      { group: "quadriceps", role: "primary" },
      { group: "glutes", role: "secondary" },
    ],
    joints: ["hip", "knee", "ankle"],
    easierId: "bodyweight_squat",
    harderId: "bulgarian_split",
    role: "work",
    regions: ["legs"],
    doodlePath: "/doodles/doodle-step-up.jpg",
    cues: ["Drive through the whole foot", "Stand tall on top", "Control the lower"],
  }),
  ex({
    id: "reverse_lunge",
    name: "Reverse lunge",
    pattern: "squat",
    type: "dynamic",
    muscles: [
      { group: "quadriceps", role: "primary" },
      { group: "glutes", role: "secondary" },
    ],
    joints: ["hip", "knee", "ankle"],
    easierId: "bodyweight_squat",
    harderId: "bulgarian_split",
    role: "work",
    regions: ["legs"],
    doodlePath: "/doodles/doodle-lunge.jpg",
    cues: ["Step back lightly", "Front knee tracks", "Push back to stand"],
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
    id: "calf_raise",
    name: "Calf raise",
    pattern: "conditioning",
    type: "dynamic",
    muscles: [{ group: "calves", role: "primary" }],
    joints: ["ankle"],
    role: "work",
    regions: ["legs"],
    doodlePath: "/doodles/doodle-calf-raise.jpg",
    cues: ["Full range", "Pause at the top", "Soft knees"],
    secondsPerRep: 2.5,
    defaultRestSeconds: 45,
  }),
  ex({
    id: "single_leg_calf_raise",
    name: "Single-leg calf raise",
    pattern: "conditioning",
    type: "dynamic",
    muscles: [{ group: "calves", role: "primary" }],
    joints: ["ankle"],
    easierId: "calf_raise",
    role: "work",
    regions: ["legs"],
    doodlePath: "/doodles/doodle-calf-raise.jpg",
    cues: ["Light touch for balance", "Full range", "Equal work both sides"],
    secondsPerRep: 2.5,
    defaultRestSeconds: 45,
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
    /** Used in warmup pools and as Abs accessory work. */
    role: "work",
    regions: ["legs", "core"],
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
    doodlePath: "/doodles/doodle-dead-bug.jpg",
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
    doodlePath: "/doodles/doodle-hollow-hold.jpg",
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
    doodlePath: "/doodles/doodle-hanging-knee-raise.jpg",
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
    doodlePath: "/doodles/doodle-dead-hang.jpg",
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
    doodlePath: "/doodles/doodle-scapular-pull.jpg",
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
    harderId: "muscle_up",
    role: "work",
    regions: ["pull"],
    doodlePath: "/doodles/doodle-pullup.jpg",
    cues: ["Chest to bar path", "No kip for strength sets", "Full hang between reps"],
  }),
  ex({
    id: "muscle_up",
    name: "Muscle-up",
    pattern: "vertical_pull",
    type: "dynamic",
    muscles: [
      { group: "lats", role: "primary" },
      { group: "triceps", role: "secondary" },
      { group: "chest", role: "secondary" },
    ],
    joints: ["shoulder", "elbow", "wrist"],
    easierId: "pullup",
    role: "work",
    regions: ["pull"],
    doodlePath: "/doodles/doodle-muscle-up.jpg",
    cues: ["Strict pull first", "Hips to bar then sit-up", "Lock out above the bar"],
  }),
];

/** Literature-inspired max clean reps / hold seconds by tier (seed work moves). */
const SEED_STANDARDS: Record<string, ExerciseStandards> = {
  scap_pushup: std(5, 10, 15, 25, 40),
  bodyweight_squat: std(8, 15, 25, 40, 60),
  bulgarian_split: std(3, 6, 10, 15, 20),
  pistol_squat: std(1, 3, 8, 12, 15),
  shrimp_squat: std(2, 4, 8, 12, 15),
  cossack_squat: std(5, 8, 12, 16, 20),
  step_up: std(6, 10, 15, 20, 25),
  reverse_lunge: std(6, 10, 15, 20, 25),
  hip_hinge: std(8, 12, 20, 30, 40),
  nordic_curl: std(1, 2, 4, 6, 10),
  calf_raise: std(10, 15, 25, 40, 50),
  /** Hébert-Losier 2017 PMID 28886865: healthy median ≈ 21–24 reps. */
  single_leg_calf_raise: std(8, 15, 25, 35, 45),
  wall_handstand: std(10, 20, 40, 60, 90),
  elevated_pike: std(3, 5, 8, 12, 15),
  freestanding_hs: std(5, 10, 20, 40, 60),
  glute_bridge: std(8, 12, 20, 30, 40),
  dead_bug: std(5, 8, 12, 16, 20),
  hollow_hold: std(10, 20, 40, 60, 90),
  hanging_knee_raise: std(3, 6, 10, 15, 20),
  pullup_dead_hang: std(10, 20, 40, 60, 90),
  scapular_pull: std(3, 6, 10, 15, 20),
  /** USMC PFT (men 21–25): 5 reps minimum, 23 maximum. */
  pullup: std(1, 5, 10, 18, 25),
  muscle_up: std(1, 2, 3, 5, 8),
};

function withSeedStandards(exercise: SeedExercise): SeedExercise {
  const standards = exercise.standards ?? SEED_STANDARDS[exercise.id];
  return standards ? { ...exercise, standards } : exercise;
}

export const SEED_GRAPH: Record<string, SeedExercise> = Object.fromEntries(
  SEED_EXERCISES.map((exercise) => {
    const enriched = withSeedStandards(exercise);
    return [enriched.id, enriched];
  }),
);

/** Keep catalogue rows aligned with graph (standards attached). */
for (let i = 0; i < SEED_EXERCISES.length; i += 1) {
  SEED_EXERCISES[i] = withSeedStandards(SEED_EXERCISES[i]);
}

/**
 * Raise for every warm-up: march then jumping jacks.
 * "Not for me" swaps them via resolveWarmupStations (often to toy soldiers).
 */
const WARMUP_RAISE = ["pulse_raiser_march", "ntc_jumping_jacks"] as const;

/** Raise + the session's mobilise drills, then each level's activate and ramp. */
function tieredWarmup(
  mobilise: readonly string[],
  byLevel: Readonly<Record<WarmupLevel, readonly string[]>>,
): WarmupLists {
  const head = [...WARMUP_RAISE, ...mobilise];
  return {
    beginner: [...head, ...byLevel.beginner],
    intermediate: [...head, ...byLevel.intermediate],
    advanced: [...head, ...byLevel.advanced],
  };
}

/** One list for every level (Mobility: no levels, no ramp). */
function sameForEveryLevel(ids: readonly string[]): WarmupLists {
  return { beginner: ids, intermediate: ids, advanced: ids };
}

/** Bars activation for every level: OSTRC cuff and scapula, push-up plus, Y-T-W. */
const BARS_ACTIVATE = ["wger_578", "ntc_push_up_plus", "ntc_prone_ytw", "scapular_pull"];

/**
 * Strength templates sized for ~30–45 min wall-clock
 * (prebuilt warmup sequence + work + ACSM/NSCA rests).
 * Strength compounds use 90–120 s rest; core/accessory 45–60 s.
 */
export const SESSION_TEMPLATES: SessionTemplate[] = [
  {
    id: "tmpl_legs",
    name: "Legs",
    focus: "legs",
    targetExerciseIds: ["pistol_squat"],
    repeat: true,
    targetMinutes: SESSION_BAND,
    // v3 Legs: FIFA 11+ / HarmoKnee balance and strength, then a squat ramp.
    warmupByLevel: tieredWarmup(["ankle_rocks"], {
      beginner: ["ntc_single_leg_balance", "glute_bridge", "bodyweight_squat", "wger_2557"],
      intermediate: [
        "ntc_single_leg_balance",
        "fedb_single_leg_glute_bridge",
        "fedb_bodyweight_walking_lunge",
        "fedb_split_squats",
        "wger_1948",
      ],
      advanced: [
        "wger_2667",
        "fedb_single_leg_glute_bridge",
        "fedb_bodyweight_walking_lunge",
        "wger_1948",
        "ntc_assisted_pistol",
      ],
    }),
    cooldownStationIds: [
      "fedb_calf_stretch_hands_against_wall",
      "wger_1239",
      "fedb_kneeling_hip_flexor",
      "hf_158_cooldown",
    ],
    slots: [
      {
        id: "legs_squat",
        label: "Squat",
        exerciseId: "bodyweight_squat",
        pattern: "squat",
        dose: { sets: 4, reps: 10, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 90,
        pinned: false,
        allowConsecutiveRepeat: true,
      },
      {
        id: "legs_split",
        label: "Split squat",
        exerciseId: "bulgarian_split",
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
      {
        id: "legs_posterior",
        label: "Nordic",
        exerciseId: "nordic_curl",
        pattern: "hinge",
        dose: { sets: 3, reps: 5, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 90,
        pinned: false,
      },
      {
        id: "legs_calf",
        label: "Calf",
        exerciseId: "calf_raise",
        pattern: "conditioning",
        dose: { sets: 3, reps: 12, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 45,
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
    targetMinutes: SESSION_BAND,
    // v3 Abs: 11+ / HarmoKnee core strength plus dead bug [C], then an easy hollow.
    warmupByLevel: tieredWarmup([], {
      beginner: ["glute_bridge", "hf_99", "hf_100", "dead_bug", "hollow_hold_tuck"],
      intermediate: ["glute_bridge", "hf_99", "hf_100", "dead_bug", "hollow_hold_ramp"],
      advanced: ["glute_bridge", "hf_99", "hf_100", "dead_bug", "hollow_hold_ramp"],
    }),
    cooldownStationIds: [
      "hf_165",
      "fedb_childs_pose_cooldown",
    ],
    slots: [
      {
        id: "core_dead_bug",
        label: "Dead bug",
        exerciseId: "dead_bug",
        pattern: "core_anti_extension",
        dose: { sets: 4, reps: 10, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 45,
        pinned: false,
      },
      {
        id: "core_hollow",
        label: "Hollow",
        exerciseId: "hollow_hold",
        pattern: "core_anti_extension",
        dose: { sets: 4, reps: 30, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 45,
        pinned: false,
        allowConsecutiveRepeat: true,
      },
      {
        id: "core_hang",
        label: "Knee raise",
        exerciseId: "hanging_knee_raise",
        pattern: "core_compression",
        dose: { sets: 4, reps: 8, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 60,
        pinned: false,
      },
      {
        id: "core_bridge",
        label: "Bridge",
        exerciseId: "glute_bridge",
        pattern: "hinge",
        dose: { sets: 3, reps: 12, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 45,
        pinned: false,
      },
      {
        id: "core_hollow_finisher",
        label: "Hollow finish",
        exerciseId: "hollow_hold",
        pattern: "core_anti_extension",
        dose: { sets: 3, reps: 25, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 45,
        pinned: false,
        // Intentional second hollow: same move twice is the Abs finisher pattern.
        allowConsecutiveRepeat: true,
      },
    ],
  },
  {
    id: "tmpl_skill_hs",
    name: "Skill",
    focus: "skill",
    targetExerciseIds: ["freestanding_hs"],
    repeat: true,
    targetMinutes: SESSION_BAND,
    // v3 Skill: wrist rocks [C], push-up plus and Y-T-W (Cools; Ekstrom), then a
    // wall ramp that never reaches the work set's max hold.
    warmupByLevel: tieredWarmup(["wger_2680"], {
      beginner: ["ntc_push_up_plus", "ntc_prone_ytw", "hf_99", "wger_2691", "ntc_wall_walk_up_45"],
      intermediate: ["ntc_push_up_plus", "ntc_prone_ytw", "hf_100", "wger_2691", "ntc_wall_walk_up"],
      advanced: [
        "ntc_push_up_plus",
        "ntc_prone_ytw",
        "hf_100",
        "ntc_wall_walk_up",
        "ntc_chest_to_wall_handstand",
      ],
    }),
    cooldownStationIds: [
      "wger_2686",
      "fedb_kneeling_forearm_stretch",
      "fedb_childs_pose_cooldown",
      "ntc_thread_the_needle",
    ],
    slots: [
      {
        id: "skill_wall_hs",
        label: "Wall HS",
        exerciseId: "wall_handstand",
        pattern: "skill",
        dose: { sets: 5, reps: 30, targetRir: 3, addedLoadKg: 0 },
        restSeconds: 60,
        pinned: false,
        allowConsecutiveRepeat: true,
      },
      {
        id: "skill_pike",
        label: "Pike",
        exerciseId: "elevated_pike",
        pattern: "vertical_push",
        dose: { sets: 4, reps: 6, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 90,
        pinned: false,
      },
      {
        id: "skill_free",
        label: "Freestanding",
        exerciseId: "freestanding_hs",
        pattern: "skill",
        dose: { sets: 4, reps: 20, targetRir: 3, addedLoadKg: 0 },
        restSeconds: 60,
        pinned: false,
      },
      {
        id: "skill_scap",
        label: "Scap push-up",
        exerciseId: "scap_pushup",
        pattern: "horizontal_push",
        dose: { sets: 3, reps: 10, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 45,
        pinned: false,
      },
    ],
  },
  {
    id: "tmpl_bars",
    name: "Bars",
    focus: "bars",
    /** North star: muscle-up. Working pull-up is the current capability in slots. */
    targetExerciseIds: ["muscle_up"],
    repeat: true,
    targetMinutes: SESSION_BAND,
    // v3 Bars: OSTRC shoulder programme (cuff, scapula, thoracic, IR range),
    // then an easy pull ramp. No muscle-up drills.
    warmupByLevel: tieredWarmup(["hf_155"], {
      beginner: [...BARS_ACTIVATE, "pullup_dead_hang", "wger_2748"],
      intermediate: ["wger_1711", ...BARS_ACTIVATE, "wger_2748", "pullup_ramp"],
      advanced: ["wger_1711", ...BARS_ACTIVATE, "pullup_ramp_sets"],
    }),
    cooldownStationIds: [
      "wger_1713",
      "fedb_childs_pose_cooldown",
      "fedb_kneeling_forearm_stretch",
      "ntc_thread_the_needle",
    ],
    slots: [
      {
        id: "bars_hang",
        label: "Hang",
        exerciseId: "pullup_dead_hang",
        pattern: "vertical_pull",
        dose: { sets: 4, reps: 30, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 60,
        pinned: false,
      },
      {
        id: "bars_scap",
        label: "Scap pull",
        exerciseId: "scapular_pull",
        pattern: "vertical_pull",
        dose: { sets: 4, reps: 8, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 90,
        pinned: false,
      },
      {
        id: "bars_pull",
        label: "Pull-up",
        exerciseId: "pullup",
        pattern: "vertical_pull",
        dose: { sets: 4, reps: 5, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 120,
        pinned: false,
        allowConsecutiveRepeat: true,
      },
      {
        id: "bars_core",
        label: "Hollow",
        exerciseId: "hollow_hold",
        pattern: "core_anti_extension",
        dose: { sets: 3, reps: 30, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 45,
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
    targetMinutes: SESSION_BAND,
    // v3 Full body: 11+-style strength and balance, then squat → push-up ramp.
    warmupByLevel: tieredWarmup([], {
      beginner: ["ntc_push_up_plus", "ntc_single_leg_balance", "hf_99", "bodyweight_squat", "fedb_incline_push_up"],
      intermediate: [
        "fedb_bodyweight_walking_lunge",
        "ntc_push_up_plus",
        "ntc_single_leg_balance",
        "hf_99",
        "bodyweight_squat",
        "push_up_ramp",
      ],
      advanced: [
        "fedb_bodyweight_walking_lunge",
        "ntc_push_up_plus",
        "ntc_single_leg_balance",
        "hf_99",
        "bodyweight_squat",
        "push_up_ramp",
      ],
    }),
    cooldownStationIds: [
      "fedb_calf_stretch_hands_against_wall",
      "fedb_kneeling_hip_flexor",
      "fedb_childs_pose_cooldown",
      "wger_2686",
    ],
    slots: [
      {
        id: "full_squat",
        label: "Squat",
        exerciseId: "bodyweight_squat",
        pattern: "squat",
        dose: { sets: 3, reps: 10, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 75,
        pinned: false,
        allowConsecutiveRepeat: true,
      },
      {
        id: "full_pull",
        label: "Pull",
        exerciseId: "pullup",
        pattern: "vertical_pull",
        dose: { sets: 3, reps: 5, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 105,
        pinned: false,
      },
      {
        id: "full_pike",
        label: "Pike",
        exerciseId: "elevated_pike",
        pattern: "vertical_push",
        dose: { sets: 3, reps: 6, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 90,
        pinned: false,
      },
      {
        id: "full_hinge",
        label: "Hinge",
        exerciseId: "hip_hinge",
        pattern: "hinge",
        dose: { sets: 3, reps: 8, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 75,
        pinned: false,
      },
      {
        id: "full_core",
        label: "Core",
        exerciseId: "hollow_hold",
        pattern: "core_anti_extension",
        dose: { sets: 3, reps: 25, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 45,
        pinned: false,
      },
      {
        id: "full_split",
        label: "Split",
        exerciseId: "bulgarian_split",
        pattern: "squat",
        dose: { sets: 2, reps: 8, targetRir: 2, addedLoadKg: 0 },
        restSeconds: 75,
        pinned: false,
      },
    ],
  },
  {
    id: "tmpl_mobility",
    name: "Mobility",
    focus: "mobility",
    // No north-star skill: this is optional prehab, not a progression chain.
    targetExerciseIds: [],
    // Optional one-off; completing it drops it from the queue.
    repeat: false,
    targetMinutes: MOBILITY_BAND,
    // v3 Mobility: one list, no ramp (no strength work follows) and no
    // transition rest; controlled dynamic drills (Behm 2016; Opplert 2018).
    warmupByLevel: sameForEveryLevel([
      "pulse_raiser_march",
      "ntc_jumping_jacks",
      "ntc_leg_swings",
      "hf_169",
      "ankle_rocks",
      "hf_154",
    ]),
    cooldownStationIds: [],
    // Every slot is pinned: resolveSlot never advances / regresses these
    // exercises, and the variety rule never swaps them for strength work.
    slots: [
      {
        id: "mob_wrist",
        label: "Wrist load",
        exerciseId: "wrist_load",
        pattern: "mobility",
        dose: { sets: 2, reps: 30, targetRir: 3, addedLoadKg: 0 },
        restSeconds: 20,
        pinned: true,
      },
      {
        id: "mob_hip",
        label: "Hip circles",
        exerciseId: "hip_circles",
        pattern: "mobility",
        dose: { sets: 2, reps: 10, targetRir: 3, addedLoadKg: 0 },
        restSeconds: 20,
        pinned: true,
      },
      {
        id: "mob_ankle",
        label: "Ankle rocks",
        exerciseId: "ankle_rocks",
        pattern: "mobility",
        dose: { sets: 2, reps: 12, targetRir: 3, addedLoadKg: 0 },
        restSeconds: 20,
        pinned: true,
      },
      {
        id: "mob_scap",
        label: "Scap push-up",
        exerciseId: "scap_pushup",
        pattern: "horizontal_push",
        dose: { sets: 2, reps: 10, targetRir: 3, addedLoadKg: 0 },
        restSeconds: 30,
        pinned: true,
      },
      {
        id: "mob_bridge",
        label: "Glute bridge",
        exerciseId: "glute_bridge",
        pattern: "hinge",
        dose: { sets: 2, reps: 12, targetRir: 3, addedLoadKg: 0 },
        restSeconds: 30,
        pinned: true,
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
  targetExerciseIds: SESSION_TEMPLATES[0].targetExerciseIds,
  warmupByLevel: SESSION_TEMPLATES[0].warmupByLevel,
  cooldownStationIds: SESSION_TEMPLATES[0].cooldownStationIds,
  warmupHoldSeconds: SESSION_TEMPLATES[0].warmupHoldSeconds,
  slots: SESSION_TEMPLATES[0].slots,
};

export function doodleFor(exerciseId: string): string | undefined {
  return SEED_GRAPH[exerciseId]?.doodlePath;
}

export function templateToStarter(template: SessionTemplate): StarterProgram {
  return {
    id: template.id,
    name: template.name,
    sessionLabel: template.name,
    targetExerciseIds: template.targetExerciseIds,
    warmupByLevel: template.warmupByLevel,
    cooldownStationIds: template.cooldownStationIds,
    warmupHoldSeconds: template.warmupHoldSeconds,
    slots: template.slots,
  };
}
