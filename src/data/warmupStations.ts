import { doodleFor } from "./doodles";
import { EXERCISE_GRAPH } from "./exerciseGraph";
import type { LoadRegion } from "./seed";

/**
 * RAMP warm-up phases (Jeffreys 2007) plus the optional cool-down.
 * Listed in the order a warm-up must run them.
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
  doodlePath?: string;
  cues: string[];
}

interface StationSpec {
  id: string;
  /** Defaults to `id` (stations are named after their Library exercise). */
  exerciseId?: string;
  phase: StationPhase;
  regions: LoadRegion[];
  holdSeconds: number;
  source: string;
  /** Hand-written cues that replace the Library cues. */
  cues?: string[];
  /** Extra cue appended to the Library cues (e.g. how to split a hold). */
  extraCue?: string;
}

const SRC = {
  raise: "RAMP raise (Jeffreys 2007); moderate 5–15 min warm-up (Bishop 2003)",
  mobilise: "RAMP mobilise (Jeffreys 2007)",
  potentiate: "RAMP potentiate: specific drills before the work (Jeffreys 2007)",
  wrist: "Wrist prep: wrist pain in ~53% of gymnasts (DiFiori 2006)",
  serratus: "Serratus and upward rotation, push-up plus (Ludewig 2004)",
  dorsiflexion: "Ankle dorsiflexion limits pistol depth (Dill 2014)",
  strength: "Strength-based warm-ups cut injuries, RR 0.32 (Lauersen 2014)",
  gluteMed: "Glute medius activation (Reiman 2012)",
  balance: "Balance training cuts injuries, RR 0.55 (Lauersen 2014; FIFA 11+)",
  specific: "Specific drills before the main work (FIFA 11+, Soligard 2008)",
  cuff: "Posterior cuff activation (Reinold 2004)",
  scapula: "Scapular control, OSTRC shoulder programme (Andersson 2016)",
  bracing: "McGill-style bracing (secondary sources)",
  shortStatic: "Static ≤30 s per muscle is fine before training (Behm 2016)",
  stretch: "Range: ~60 s per muscle after training (ACSM, Garber 2011)",
  stretchAnkle: "Range: ~60 s per muscle (Garber 2011); dorsiflexion for pistol depth (Dill 2014)",
  stretchShoulder: "Range: ~60 s per muscle (Garber 2011); shoulder flexion for the handstand line",
} as const;

const STRETCH_CUE = "Two easy 30 s holds (switch sides halfway)";

const STATION_SPECS: StationSpec[] = [
  // Raise
  {
    id: "pulse_raiser_march",
    phase: "raise",
    regions: ["general", "legs"],
    holdSeconds: 60,
    source: SRC.raise,
    cues: ["Light bounce", "Arms swing freely", "Breathe through the nose"],
  },
  { id: "ntc_jumping_jacks", phase: "raise", regions: ["general"], holdSeconds: 60, source: SRC.raise },
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
    id: "ankle_rocks",
    phase: "mobilise",
    regions: ["legs"],
    holdSeconds: 60,
    source: SRC.dorsiflexion,
    cues: ["Knee tracks over mid-foot", "Heel stays down as long as possible"],
  },
  {
    id: "wrist_load",
    phase: "mobilise",
    regions: ["skill", "push"],
    holdSeconds: 45,
    source: SRC.wrist,
    cues: ["Fingers spread", "Shift weight gently", "Stop before sharp pain"],
  },
  { id: "hf_167", phase: "mobilise", regions: ["skill"], holdSeconds: 45, source: SRC.wrist },
  { id: "wger_2680", phase: "mobilise", regions: ["skill"], holdSeconds: 45, source: SRC.wrist },
  { id: "hf_152", phase: "mobilise", regions: ["push"], holdSeconds: 45, source: SRC.serratus },
  {
    id: "fedb_childs_pose",
    phase: "mobilise",
    regions: ["general"],
    holdSeconds: 40,
    source: SRC.shortStatic,
    extraCue: "Two 20 s holds",
  },
  { id: "hf_158", phase: "mobilise", regions: ["legs"], holdSeconds: 45, source: SRC.mobilise },
  { id: "hf_157", phase: "mobilise", regions: ["legs"], holdSeconds: 30, source: SRC.mobilise },
  { id: "ntc_arm_circles", phase: "mobilise", regions: ["pull"], holdSeconds: 45, source: SRC.mobilise },
  { id: "wger_1822", phase: "mobilise", regions: ["general"], holdSeconds: 60, source: SRC.mobilise },
  { id: "hf_154", phase: "mobilise", regions: ["core"], holdSeconds: 45, source: SRC.mobilise },
  { id: "hf_169", phase: "mobilise", regions: ["legs"], holdSeconds: 60, source: SRC.mobilise },
  // Activate
  {
    id: "scap_pushup",
    phase: "activate",
    regions: ["skill", "push"],
    holdSeconds: 45,
    source: SRC.serratus,
    cues: ["Arms locked", "Only the shoulder blades move", "Long neck"],
  },
  {
    id: "glute_bridge",
    phase: "activate",
    regions: ["legs", "core"],
    holdSeconds: 45,
    source: SRC.strength,
    cues: ["Ribs down", "Squeeze glutes at the top", "Do not arch the low back"],
  },
  { id: "hollow_hold", phase: "activate", regions: ["core"], holdSeconds: 40, source: SRC.bracing },
  { id: "wger_1202", phase: "activate", regions: ["legs"], holdSeconds: 60, source: SRC.gluteMed },
  { id: "wger_2667", phase: "activate", regions: ["legs"], holdSeconds: 60, source: SRC.balance },
  { id: "wger_578", phase: "activate", regions: ["pull"], holdSeconds: 60, source: SRC.cuff },
  { id: "ntc_prone_ytw", phase: "activate", regions: ["pull"], holdSeconds: 45, source: SRC.scapula },
  { id: "scapular_pull", phase: "activate", regions: ["pull"], holdSeconds: 45, source: SRC.scapula },
  { id: "hf_100", phase: "activate", regions: ["core"], holdSeconds: 60, source: SRC.bracing },
  { id: "hf_116", phase: "activate", regions: ["core"], holdSeconds: 60, source: SRC.bracing },
  { id: "dead_bug", phase: "activate", regions: ["core"], holdSeconds: 45, source: SRC.bracing },
  // Potentiate
  { id: "wall_handstand", phase: "potentiate", regions: ["skill"], holdSeconds: 50, source: SRC.potentiate },
  { id: "fedb_split_squats", phase: "potentiate", regions: ["legs"], holdSeconds: 45, source: SRC.specific },
  { id: "wger_1948", phase: "potentiate", regions: ["legs"], holdSeconds: 45, source: SRC.specific },
  { id: "wger_2690", phase: "potentiate", regions: ["pull"], holdSeconds: 40, source: SRC.potentiate },
  { id: "hf_103", phase: "potentiate", regions: ["core"], holdSeconds: 30, source: SRC.potentiate },
  { id: "bodyweight_squat", phase: "potentiate", regions: ["legs"], holdSeconds: 30, source: SRC.potentiate },
  { id: "fedb_incline_push_up", phase: "potentiate", regions: ["push"], holdSeconds: 30, source: SRC.potentiate },
  // Cool-down (optional; ~60 s per target, 2 × 30 s)
  ...cooldown("wger_2686", ["skill"], SRC.stretch),
  ...cooldown("fedb_kneeling_forearm_stretch", ["skill"], SRC.stretch),
  ...cooldown("ntc_thread_the_needle", ["pull"], SRC.stretchShoulder),
  ...cooldown("fedb_calf_stretch_hands_against_wall", ["legs"], SRC.stretchAnkle),
  ...cooldown("wger_1239", ["legs"], SRC.stretchAnkle),
  ...cooldown("fedb_kneeling_hip_flexor", ["legs"], SRC.stretch),
  ...cooldown("wger_1713", ["push"], SRC.stretch),
  ...cooldown("hf_165", ["core"], SRC.stretch),
  {
    id: "fedb_childs_pose_cooldown",
    exerciseId: "fedb_childs_pose",
    phase: "cooldown",
    regions: ["pull"],
    holdSeconds: 60,
    source: SRC.stretchShoulder,
    extraCue: "Arms long to stretch the lats; two 30 s holds",
  },
  {
    id: "hf_158_cooldown",
    exerciseId: "hf_158",
    phase: "cooldown",
    regions: ["legs"],
    holdSeconds: 60,
    source: SRC.stretch,
    extraCue: "Hold each side 30 s instead of switching",
  },
];

function cooldown(id: string, regions: LoadRegion[], source: string): StationSpec[] {
  return [{ id, phase: "cooldown", regions, holdSeconds: 60, source, extraCue: STRETCH_CUE }];
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
    doodlePath: doodleFor(exerciseId, exercise.doodlePath),
    cues: spec.extraCue ? [...baseCues, spec.extraCue] : [...baseCues],
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
