/**
 * Where a doodle should draw the eye: a brass highlight on the working body
 * part and, for small movements, a zoomed inset that plays in sync.
 * Kept apart from the pose specs so either can change without the other.
 */

/** Body segments that can be highlighted (per side where it applies). */
export type Segment =
  | `upperArm.${"near" | "far"}`
  | `forearm.${"near" | "far"}`
  | `hand.${"near" | "far"}`
  | `shoulder.${"near" | "far"}`
  | `thigh.${"near" | "far"}`
  | `shin.${"near" | "far"}`
  | `foot.${"near" | "far"}`
  | "lumbar"
  | "thoracic"
  | "neck"
  | "pelvis";

export interface Focus {
  /** Figure points the inset centres on (names from `figurePoints`, e.g. "wrist.near"). */
  joints: string[];
  /** Segments drawn with the brass highlight. */
  highlight: Segment[];
  /** Inset magnification; 0 or absent = highlight only, no inset. */
  zoom?: number;
  /** Short label under the inset, e.g. "wrists". */
  label?: string;
  /** Rig units kept round the focus joints in the inset (default 30); smaller lets a tiny part zoom further. */
  margin?: number;
  /** Draw the floor line (y = 0) in the inset, for contact with the ground. */
  floor?: boolean;
  /** Multiplies the inset label size (default 1). */
  labelScale?: number;
}

const BOTH_WRISTS: Focus = {
  joints: ["elbow.near", "wrist.near", "hand.near"],
  highlight: ["forearm.near", "hand.near", "forearm.far", "hand.far"],
  zoom: 3,
  label: "wrists",
};

const SHOULDER_BLADES: Focus = {
  joints: ["shoulder.near", "chest", "neck"],
  highlight: ["shoulder.near", "shoulder.far", "thoracic"],
  zoom: 2.5,
  label: "shoulder blades",
};

/**
 * Doodles whose point is a small or local movement. Insets where the motion
 * is too small to read at phone size; highlight only where the whole body
 * still tells the story. Sides come from the solved poses (near = bright).
 */
export const FOCUS_BY_ID: Readonly<Record<string, Focus>> = {
  // Wrists (handstand/skill prep and cool-down)
  wrist_load: BOTH_WRISTS,
  wger_2680: BOTH_WRISTS, // Wrist rocks
  fedb_kneeling_forearm_stretch: BOTH_WRISTS,
  hf_167: { joints: ["wrist.near", "hand.near"], highlight: ["forearm.near", "hand.near", "forearm.far", "hand.far"], zoom: 4, label: "wrists" }, // Wrist circles
  wger_2686: { joints: ["wrist.near", "hand.near"], highlight: ["forearm.near", "hand.near"], zoom: 3, label: "wrist" }, // Wrist stretch
  // Ankles and calves (pistol depth)
  ankle_rocks: {
    joints: ["knee.near", "ankle.near", "toe.near"],
    highlight: ["shin.near", "foot.near"],
    zoom: 2.2,
    label: "ankle",
  },
  fedb_calf_stretch_hands_against_wall: {
    joints: ["knee.far", "ankle.far", "toe.far"],
    highlight: ["shin.far", "foot.far"],
    zoom: 2,
    label: "calf",
  },
  wger_1239: {
    joints: ["knee.far", "ankle.far", "toe.far"],
    highlight: ["shin.far", "foot.far"],
    zoom: 2,
    label: "calf",
  }, // Standing calf stretch
  hf_166: {
    joints: ["knee.near", "ankle.near", "toe.near"],
    highlight: ["shin.near", "foot.near"],
    zoom: 2,
    label: "ankle",
  }, // Wall ankle dorsiflexion
  wger_2667: {
    joints: ["knee.near", "ankle.near", "toe.near"],
    highlight: ["shin.near", "foot.near"],
    zoom: 2,
    label: "ankle",
  }, // Single-leg balance
  hf_93: {
    joints: ["ankle.near", "toe.near"],
    highlight: ["shin.near", "foot.near"],
    zoom: 3,
    label: "toes up",
  }, // Tibialis raise
  // Calf raises: the heel drop and rise on the step edge
  calf_raise: {
    joints: ["ankle.near", "toe.near"],
    highlight: ["shin.near", "foot.near"],
    zoom: 3.2,
    label: "heels",
  },
  single_leg_calf_raise: {
    joints: ["ankle.near", "toe.near"],
    highlight: ["shin.near", "foot.near"],
    zoom: 3.2,
    label: "heel",
  },
  // Hips
  fedb_kneeling_hip_flexor: { joints: [], highlight: ["thigh.far", "pelvis"] },
  hf_161: { joints: [], highlight: ["thigh.near", "pelvis"] }, // Couch stretch
  wger_1202: { joints: [], highlight: ["thigh.far", "pelvis"] }, // Side-lying hip abduction
  hip_circles: { joints: [], highlight: ["pelvis", "lumbar"] },
  // Shoulders and shoulder blades
  scap_pushup: SHOULDER_BLADES,
  wger_468: SHOULDER_BLADES, // Prone scapular retraction
  wger_2690: {
    joints: ["shoulder.near", "shoulder.far", "neck"],
    highlight: ["shoulder.near", "shoulder.far", "neck"],
    zoom: 2,
    label: "shoulders down",
  }, // Active hang
  scapular_pull: {
    joints: ["shoulder.near", "shoulder.far", "neck"],
    highlight: ["shoulder.near", "shoulder.far", "neck"],
    zoom: 2,
    label: "shoulder blades down",
  },
  wger_578: {
    joints: ["shoulder.far", "elbow.far", "hand.far"],
    highlight: ["upperArm.far", "forearm.far"],
    zoom: 2,
    label: "rotator cuff",
  }, // Side-lying external rotation
  ntc_prone_ytw: { joints: [], highlight: ["shoulder.near", "shoulder.far", "upperArm.near"] },
  hf_31: { joints: [], highlight: ["upperArm.near", "forearm.near", "shoulder.near"] }, // Planche lean: shoulders past the wrists
  ntc_hand_release_push_up: { joints: [], highlight: ["forearm.near", "hand.near", "forearm.far", "hand.far"] }, // Hands lift off
  // Finger push-up: the tented hand, palm off the floor, on the fingertips.
  wger_1217: {
    joints: ["wrist.near", "hand.near"],
    highlight: ["hand.near"],
    zoom: 7,
    margin: 4,
    floor: true,
    label: "fingertips",
    labelScale: 1.8,
  },
  // Spine
  hf_154: { joints: [], highlight: ["lumbar", "thoracic"] }, // Cat-cow
};
