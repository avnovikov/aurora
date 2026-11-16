import type { ExercisePrescription } from "../domain/prescription";
import type { Difficulty, SkillTier } from "../domain/types";
import { doodleFor } from "./doodles";
import { EXERCISE_GRAPH } from "./exerciseGraph";
import type { LoadRegion } from "./seed";

/**
 * RAMP warm-up phases (Jeffreys 2007) plus the optional cool-down.
 * Listed in the order a warm-up must run them. "potentiate" is the
 * submaximal ramp: easier versions of the day's first moves, never the
 * target or a max hold (Abad 2011; Blazevich & Babault 2019).
 */
export const STATION_PHASES = ["raise", "mobilise", "activate", "potentiate", "cooldown"] as const;
export type StationPhase = (typeof STATION_PHASES)[number];

/**
 * One timed station in the warm-up or cool-down view (not a planner prescription).
 * Name, cues and doodle come from the Library exercise it references.
 */
export interface WarmupStation {
  id: string;
  /** Library exercise this station shows. */
  exerciseId: string;
  name: string;
  phase: StationPhase;
  regions: LoadRegion[];
  /** Default station hold (seconds); a template may override it. */
  holdSeconds: number;
  /** Short evidence citation shown on the station. */
  source: string;
  /**
   * Difficulty of the station as dosed here: the Library level, unless the
   * station's partial range or easy dose (high box, ~45°, 2–3 reps) is easier.
   */
  difficulty: Difficulty;
  doodlePath?: string;
  cues: string[];
  /**
   * One side then the other: the hold pauses halfway to change side.
   * Ignored when `prescription` expands into separate per-side steps.
   */
  perSide: boolean;
  /**
   * Pre-parsed hold dose. When set, `buildWarmupView` expands into one step
   * per segment (Library dose wins over a single blob timer).
   */
  prescription?: ExercisePrescription;
}

interface StationSpec {
  id: string;
  /** Defaults to `id` (stations are named after their Library exercise). */
  exerciseId?: string;
  phase: StationPhase;
  regions: LoadRegion[];
  holdSeconds: number;
  source: string;
  /** Overrides the Library level when the station's dose makes it easier. */
  difficulty?: Difficulty;
  /** Hand-written cues that replace the Library cues. */
  cues?: string[];
  /** Extra cues appended to the Library cues (e.g. how to split a hold). */
  extraCues?: string[];
  /** One side then the other (not alternating reps): pause halfway to change side. */
  perSide?: boolean;
  /** Pre-parsed hold dose; expands to multiple timed steps in the warm-up view. */
  prescription?: ExercisePrescription;
}

/** Fixed hold prescription for station specs. */
export function holdDose(
  rounds: number,
  seconds: number,
  scope: ExercisePrescription["scope"] = "total",
): ExercisePrescription {
  return holdBand(rounds, seconds, seconds, scope);
}

/** Hold prescription with a seconds band (warm-up expands at amountMin). */
export function holdBand(
  rounds: number,
  amountMin: number,
  amountMax: number,
  scope: ExercisePrescription["scope"] = "total",
): ExercisePrescription {
  return { effort: "hold", rounds, amountMin, amountMax, scope };
}

/**
 * Per-side (or per-leg) warm-up dose: separate timers, not one blob with a mid switch.
 * `holdSeconds` stays the total work time for overrides / estimates.
 */
function perSideHold(
  secondsPerSide: number,
  rounds = 1,
): Pick<StationSpec, "holdSeconds" | "prescription"> {
  return {
    holdSeconds: secondsPerSide * rounds * 2,
    prescription: holdDose(rounds, secondsPerSide, "perSide"),
  };
}

/** [C] marks coaching consensus where no trial exists (v3 evidence base). */
const SRC = {
  raise: "Raise: temperature (Fradkin 2010; Blazevich 2019)",
  ramp: "Submaximal ramp (Abad 2011; Blazevich & Babault 2019)",
  dynamic: "Controlled dynamic stretching (Behm 2016; Opplert & Babault 2018)",
  mobilise: "RAMP mobilise (Jeffreys 2007)",
  wrist: "[C] Wrist prep: no trial yet (Wolf 2017); wrist pain in ~53% of gymnasts (DiFiori 2006)",
  shoulder: "Shoulder range before overhead and bar work (Kavadlo, PCC)",
  serratus: "Push-up plus: serratus activation (Ekstrom 2003; Cools 2007)",
  lowerTrap: "Prone Y-T-W: lower trapezius (Ekstrom 2003; Cools 2007)",
  dorsiflexion: "Ankle dorsiflexion limits pistol depth (Dill 2014)",
  strength: "Strength drills carry the effect, RR 0.32 (Lauersen 2014; FIFA 11+, HarmoKnee)",
  core: "Core strength, FIFA 11+ (Soligard 2008) and HarmoKnee (Kiani 2010)",
  gluteMed: "Glute medius activation (Reiman 2012)",
  balance: "Balance training cuts injuries, RR 0.55 (Lauersen 2014; FIFA 11+, HarmoKnee)",
  cuff: "Posterior cuff, OSTRC shoulder programme (Andersson 2016; Reinold 2004)",
  scapula: "Scapular control, OSTRC shoulder programme (Andersson 2016)",
  thoracic: "Thoracic mobility, OSTRC shoulder programme aim (Andersson 2016)",
  sleeper: "Internal-rotation range, OSTRC aim (Andersson 2016); static ≤30 s (Behm 2016)",
  bracing: "[C] McGill-style bracing (secondary sources)",
  shortStatic: "Static ≤30 s per muscle is fine before training (Behm 2016)",
  stretch: "Range: ~60 s per muscle after training (ACSM, Garber 2011)",
  stretchAnkle: "Range: ~60 s per muscle (Garber 2011); dorsiflexion for pistol depth (Dill 2014)",
  stretchShoulder: "Range: ~60 s per muscle (Garber 2011); shoulder flexion for the handstand line",
} as const;

/** Every ramp station says it is easy: well below working effort (Bishop 2003). */
export const RAMP_CUE = "Easy, submaximal: 2+ reps in reserve";
/** Ramp cue for holds: a fraction of the max hold, never a max. */
export const RAMP_HOLD_CUE = "Easy, submaximal: ≤50% of your max hold";

const STRETCH_CUE = "Two easy 30 s holds";
const STRETCH_SIDES_CUE = "30 s per side";
/** Cool-down stretch: ~60 s per target as two 30 s holds (Garber 2011). */
const STRETCH_HOLD_SECONDS = 60;

const STATION_SPECS: StationSpec[] = [
  // Raise (default: march + jacks ≈ 80 s; toy soldiers is the usual "Not for me" substitute)
  {
    id: "pulse_raiser_march",
    phase: "raise",
    regions: ["general", "legs"],
    holdSeconds: 40,
    source: SRC.raise,
  },
  {
    id: "ntc_jumping_jacks",
    phase: "raise",
    regions: ["general"],
    holdSeconds: 40,
    source: SRC.raise,
  },
  {
    id: "ntc_toy_soldiers",
    phase: "raise",
    regions: ["general", "legs"],
    holdSeconds: 60,
    source: SRC.raise,
    extraCues: ["Controlled, build the height gradually"],
  },
  // Mobilise
  {
    id: "hip_circles",
    phase: "mobilise",
    regions: ["legs", "general"],
    holdSeconds: 45,
    source: SRC.mobilise,
    cues: ["Slow circles", "Both directions", "Keep ribs quiet"],
  },
  {
    // Coach apps ~40–60 s/side; expand so it is not one 90 s blob.
    id: "ankle_rocks",
    phase: "mobilise",
    regions: ["legs"],
    ...perSideHold(40),
    source: SRC.dorsiflexion,
    cues: [
      "Knee to the wall, foot a hand's width back",
      "Knee tracks over mid-foot",
      "Heel stays down as long as possible",
      "40 s per side",
    ],
  },
  {
    id: "wrist_load",
    phase: "mobilise",
    regions: ["skill", "push"],
    holdSeconds: 45,
    source: SRC.wrist,
    cues: ["Fingers spread", "Shift weight gently", "Stop before sharp pain"],
  },
  { id: "wger_2680", phase: "mobilise", regions: ["skill"], holdSeconds: 60, source: SRC.wrist }, // Wrist rocks
  {
    // Trainers: 30 s front-to-back then 30 s side-to-side per leg (Wodmentor / EōS).
    id: "ntc_leg_swings",
    phase: "mobilise",
    regions: ["legs"],
    ...perSideHold(30, 2),
    source: SRC.dynamic,
    extraCues: [
      "Round 1: front-to-back 30 s per leg; round 2: side-to-side 30 s per leg",
      "Controlled swings, never ballistic",
    ],
  },
  {
    id: "hf_155",
    phase: "mobilise",
    regions: ["pull"],
    ...perSideHold(30),
    source: SRC.thoracic,
    extraCues: ["30 s per side"],
  }, // Quadruped thoracic rotation
  {
    id: "wger_1711", // Sleeper stretch
    phase: "mobilise",
    regions: ["pull"],
    ...perSideHold(20),
    source: SRC.sleeper,
    extraCues: ["Gentle: 20 s per side, no pain"],
  },
  { id: "hf_151", phase: "mobilise", regions: ["push", "pull"], holdSeconds: 45, source: SRC.shoulder }, // Shoulder dislocates
  { id: "hf_152", phase: "mobilise", regions: ["push"], holdSeconds: 45, source: SRC.serratus }, // Wall angel
  {
    id: "fedb_childs_pose",
    phase: "mobilise",
    regions: ["general"],
    holdSeconds: 40,
    source: SRC.shortStatic,
    extraCues: ["Two 20 s holds"],
    prescription: holdDose(2, 20),
  },
  { id: "hf_158", phase: "mobilise", regions: ["legs"], holdSeconds: 45, source: SRC.mobilise }, // 90/90 hip switch
  { id: "hf_157", phase: "mobilise", regions: ["legs"], holdSeconds: 30, source: SRC.dorsiflexion }, // Deep squat hold
  { id: "hf_154", phase: "mobilise", regions: ["core"], holdSeconds: 60, source: SRC.dynamic }, // Cat-cow
  {
    // Dynamic WGS: ~30 s/side (Peloton / Equinox 3–5 s positions × reps), not a 45 s static hold.
    id: "hf_169",
    phase: "mobilise",
    regions: ["legs"],
    ...perSideHold(30),
    source: SRC.dynamic,
    extraCues: ["30 s per side, move through the positions"],
  },
  // Activate
  {
    id: "glute_bridge",
    phase: "activate",
    regions: ["legs", "core"],
    holdSeconds: 60,
    source: SRC.core,
    cues: ["Ribs down", "Squeeze glutes at the top", "Do not arch the low back"],
  },
  {
    id: "fedb_single_leg_glute_bridge",
    phase: "activate",
    regions: ["legs"],
    ...perSideHold(30),
    source: SRC.strength,
    extraCues: ["30 s per leg"],
  },
  { id: "fedb_bodyweight_walking_lunge", phase: "activate", regions: ["legs"], holdSeconds: 60, source: SRC.strength, extraCues: ["Slow and controlled, knee over the toes"] },
  {
    // FIFA 11+: 30 s per leg (we use one set in the warm-up; progress via eyes-closed variant).
    id: "ntc_single_leg_balance",
    phase: "activate",
    regions: ["legs"],
    ...perSideHold(30),
    source: SRC.balance,
    extraCues: ["30 s per leg"],
  },
  {
    id: "wger_2667",
    phase: "activate",
    regions: ["legs"],
    ...perSideHold(30),
    source: SRC.balance,
    extraCues: ["30 s per leg; open the eyes if you wobble off"],
  }, // Single-leg balance, eyes closed
  {
    id: "wger_1202",
    phase: "activate",
    regions: ["legs"],
    ...perSideHold(30),
    source: SRC.gluteMed,
    extraCues: ["30 s per side"],
  }, // Side-lying hip abduction
  {
    // Warm-up activation: ~2 × 10 slow reps (Cools/Ekstrom; coach warm-up 2×8–12).
    id: "ntc_push_up_plus",
    phase: "activate",
    regions: ["push", "skill"],
    holdSeconds: 40,
    source: SRC.serratus,
    extraCues: ["2 × 10 slow reps"],
    prescription: holdDose(2, 20),
  },
  { id: "ntc_prone_ytw", phase: "activate", regions: ["pull"], holdSeconds: 60, source: SRC.lowerTrap }, // Prone Y-T-W raise
  {
    // Reinold/Squat U: light cuff work ~15–20 slow reps ≈ 30 s per side in a warm-up timer.
    id: "wger_578",
    phase: "activate",
    regions: ["pull"],
    ...perSideHold(30),
    source: SRC.cuff,
    extraCues: ["30 s per side, light and slow"],
  }, // Side-lying external rotation
  { id: "scapular_pull", phase: "activate", regions: ["pull"], holdSeconds: 45, source: SRC.scapula, extraCues: ["Easy reps, arms stay straight"] }, // Scapular pull-up
  {
    id: "hf_99",
    phase: "activate",
    regions: ["core"],
    holdSeconds: 90,
    source: SRC.core,
    extraCues: ["3 × 20–30 s"],
    prescription: holdBand(3, 20, 30),
  }, // Forearm plank
  {
    id: "hf_100",
    phase: "activate",
    regions: ["core"],
    holdSeconds: 90,
    source: SRC.core,
    extraCues: ["2 × 20 s on one side, then the other"],
    prescription: holdDose(2, 20, "perSide"),
  }, // Side plank — four timers, not one blob + mid switch
  { id: "wger_2690", phase: "activate", regions: ["pull"], holdSeconds: 30, source: SRC.scapula }, // Active hang
  { id: "hf_116", phase: "activate", regions: ["core"], holdSeconds: 60, source: SRC.bracing }, // Bird dog
  { id: "dead_bug", phase: "activate", regions: ["core"], holdSeconds: 60, source: SRC.bracing, extraCues: ["Slow: exhale as the limbs reach"] }, // Dead bug
  // Potentiate = submaximal ramp: easier versions of the day's first moves
  ramp({
    id: "scap_pushup",
    regions: ["skill", "push"],
    holdSeconds: 45,
    cues: ["Arms locked", "Only the shoulder blades move", "Long neck"],
  }),
  ramp({
    id: "wger_2691",
    regions: ["skill"],
    holdSeconds: 45,
    easyCue: RAMP_HOLD_CUE,
    extraCues: ["2 × 15–20 s"],
    prescription: holdBand(2, 15, 20),
  }), // Pike hold
  ramp({
    id: "ntc_wall_walk_up_45",
    exerciseId: "ntc_wall_walk_up",
    regions: ["skill"],
    holdSeconds: 60,
    // Partial range (~45°) with the feet low on the wall: a beginner dose.
    difficulty: "beginner",
    extraCues: ["Stop at about 45°, never a full handstand", "2–3 easy walk-ups"],
  }),
  ramp({
    id: "ntc_wall_walk_up",
    regions: ["skill"],
    holdSeconds: 60,
    extraCues: ["Stop at about 60°, never a full handstand", "2–3 easy walk-ups"],
  }),
  ramp({
    id: "ntc_chest_to_wall_handstand",
    regions: ["skill"],
    holdSeconds: 45,
    easyCue: RAMP_HOLD_CUE,
    extraCues: ["Two easy 10–15 s holds, walk down between"],
    prescription: holdBand(2, 10, 15),
  }),
  ramp({ id: "bodyweight_squat", regions: ["legs"], holdSeconds: 60 }),
  ramp({
    id: "wger_2557",
    regions: ["legs"],
    ...perSideHold(30),
    extraCues: ["30 s per leg"],
  }), // Supported split squat
  ramp({
    id: "fedb_split_squats",
    regions: ["legs"],
    ...perSideHold(30),
    extraCues: ["30 s per leg"],
  }), // Split squat
  ramp({
    id: "wger_1948", // 1-leg box squat
    regions: ["legs"],
    ...perSideHold(30),
    // To a high box, well short of pistol depth: an intermediate dose.
    difficulty: "intermediate",
    extraCues: ["High box — stop well short of a full pistol", "30 s per leg"],
  }),
  ramp({
    id: "ntc_assisted_pistol",
    regions: ["legs"],
    ...perSideHold(30),
    extraCues: ["Partial depth, hands on the support", "30 s per leg"],
  }),
  ramp({
    id: "pullup_dead_hang",
    regions: ["pull"],
    holdSeconds: 30,
    easyCue: RAMP_HOLD_CUE,
    extraCues: ["One easy 20–30 s hang"],
  }),
  ramp({
    id: "wger_2748", // Jumping pull-up
    regions: ["pull"],
    holdSeconds: 45,
    // Three reps with the legs doing most of the work: a beginner dose.
    difficulty: "beginner",
    extraCues: ["3 easy reps, lower slowly"],
  }),
  ramp({
    id: "pullup_ramp",
    exerciseId: "pullup",
    regions: ["pull"],
    holdSeconds: 30,
    // Two easy strict reps, far from failure: an intermediate dose.
    difficulty: "intermediate",
    extraCues: ["2 easy strict reps, well short of failure"],
  }),
  ramp({
    id: "pullup_ramp_sets",
    exerciseId: "pullup",
    regions: ["pull"],
    holdSeconds: 60,
    extraCues: ["2 easy sets at ≤50% of your max reps", "Rest 20 s between"],
  }),
  ramp({
    id: "hollow_hold_tuck",
    exerciseId: "hollow_hold",
    regions: ["core"],
    holdSeconds: 45,
    easyCue: RAMP_HOLD_CUE,
    extraCues: ["Tuck: knees bent over the hips", "2 × 15 s"],
    prescription: holdDose(2, 15),
  }),
  ramp({
    id: "hollow_hold_ramp",
    exerciseId: "hollow_hold",
    regions: ["core"],
    holdSeconds: 45,
    easyCue: RAMP_HOLD_CUE,
    extraCues: ["~50% effort: stop long before shaking", "2 × 15–20 s"],
    prescription: holdBand(2, 15, 20),
  }),
  ramp({ id: "hf_103", regions: ["core"], holdSeconds: 30 }), // Hollow body rock
  ramp({ id: "fedb_incline_push_up", regions: ["push"], holdSeconds: 45 }), // Incline push-up
  ramp({ id: "push_up_ramp", exerciseId: "hf_2", regions: ["push"], holdSeconds: 45, extraCues: ["One easy set, about half your max"] }), // Standard push-up
  // Cool-down (optional; ~60 s per target, 2 × 30 s)
  cooldownPerSide("wger_2686", ["skill"], SRC.stretch), // Wrist stretch
  cooldown("fedb_kneeling_forearm_stretch", ["skill"], SRC.stretch), // Kneeling forearm stretch
  cooldownPerSide("ntc_thread_the_needle", ["pull"], SRC.stretchShoulder), // Thread the needle
  cooldownPerSide("fedb_calf_stretch_hands_against_wall", ["legs"], SRC.stretchAnkle), // Calf stretch, straight knee
  cooldownPerSide("wger_1239", ["legs"], SRC.stretchAnkle), // Standing calf stretch
  cooldownPerSide("fedb_kneeling_hip_flexor", ["legs"], SRC.stretch), // Kneeling hip flexor stretch
  cooldownPerSide("wger_1713", ["push"], SRC.stretch), // Doorway pec stretch
  cooldown("hf_165", ["core"], SRC.stretch), // Cobra stretch
  {
    id: "fedb_childs_pose_cooldown",
    exerciseId: "fedb_childs_pose",
    phase: "cooldown",
    regions: ["pull"],
    holdSeconds: 60,
    source: SRC.stretchShoulder,
    extraCues: ["Arms long to stretch the lats; two 30 s holds"],
    prescription: holdDose(2, 30),
  },
  {
    id: "hf_158_cooldown",
    exerciseId: "hf_158",
    phase: "cooldown",
    regions: ["legs"],
    holdSeconds: 60,
    source: SRC.stretch,
    extraCues: ["Hold each side 30 s instead of switching"],
    prescription: holdDose(1, 30, "perSide"),
  },
];

interface RampSpec extends Omit<StationSpec, "phase" | "source"> {
  /** First cue; defaults to `RAMP_CUE` (reps). Holds use `RAMP_HOLD_CUE`. */
  easyCue?: string;
}

/** Submaximal ramp station: the easy cue always comes first. */
function ramp({ easyCue = RAMP_CUE, ...spec }: RampSpec): StationSpec {
  return { ...spec, phase: "potentiate", source: SRC.ramp, extraCues: [easyCue, ...(spec.extraCues ?? [])] };
}

/** Cool-down stretch for both sides at once: two 30 s holds. */
function cooldown(id: string, regions: LoadRegion[], source: string): StationSpec {
  return {
    id,
    phase: "cooldown",
    regions,
    holdSeconds: STRETCH_HOLD_SECONDS,
    source,
    extraCues: [STRETCH_CUE],
    prescription: holdDose(2, 30),
  };
}

/** Cool-down stretch: 30 s left then 30 s right as separate timers. */
function cooldownPerSide(id: string, regions: LoadRegion[], source: string): StationSpec {
  return {
    id,
    phase: "cooldown",
    regions,
    holdSeconds: STRETCH_HOLD_SECONDS,
    source,
    extraCues: [STRETCH_SIDES_CUE],
    prescription: holdDose(1, 30, "perSide"),
  };
}

/** Library level as a move difficulty (a move is never "novice"). */
function libraryDifficulty(level: SkillTier | undefined): Difficulty {
  return level === undefined || level === "novice" ? "beginner" : level;
}

function resolveStation(spec: StationSpec): WarmupStation {
  const exerciseId = spec.exerciseId ?? spec.id;
  const exercise = EXERCISE_GRAPH[exerciseId];
  if (!exercise) {
    throw new Error(`Warmup station ${spec.id} references unknown Library exercise ${exerciseId}`);
  }
  const baseCues = spec.cues ?? exercise.cues;
  return {
    id: spec.id,
    exerciseId,
    name: exercise.name,
    phase: spec.phase,
    regions: spec.regions,
    holdSeconds: spec.holdSeconds,
    source: spec.source,
    difficulty: spec.difficulty ?? libraryDifficulty(exercise.difficulty),
    doodlePath: doodleFor(exerciseId, exercise.doodlePath),
    cues: [...baseCues, ...(spec.extraCues ?? [])],
    perSide: spec.perSide === true,
    prescription: spec.prescription,
  };
}

/** Every station with Library name, cues and doodle resolved. */
export const WARMUP_STATIONS: WarmupStation[] = STATION_SPECS.map(resolveStation);

export const WARMUP_STATION_BY_ID: Record<string, WarmupStation> = Object.fromEntries(
  WARMUP_STATIONS.map((station) => [station.id, station]),
);

export function requireWarmupStation(id: string): WarmupStation {
  const station = WARMUP_STATION_BY_ID[id];
  if (!station) {
    throw new Error(`Unknown warmup station: ${id}`);
  }
  return station;
}

/**
 * Stations for a template list, with the template's per-station hold overrides
 * applied (a station's evidence range allows the shorter or longer hold).
 */
export function stationsFor(
  ids: readonly string[],
  holdOverrides: Readonly<Record<string, number>> = {},
): WarmupStation[] {
  return ids.map((id) => {
    const station = requireWarmupStation(id);
    const hold = holdOverrides[id];
    return hold === undefined ? station : { ...station, holdSeconds: hold };
  });
}
