/**
 * Movement-level risk tags. The catalogue only knows which joints a move
 * touches; it cannot say *how* (lateral knee load, end-range shoulder under
 * load). Tags come from the move's name — an explicit, reviewable list —
 * because most imported moves carry no joint data at all.
 */
export type MovementRisk =
  | "shoulder_end_range"
  | "shoulder_transition"
  | "shoulder_loaded"
  | "knee_lateral"
  | "knee_impact"
  | "knee_deep_flexion";

const RULES: ReadonlyArray<readonly [MovementRisk, RegExp]> = [
  [
    "shoulder_end_range",
    /skin the cat|german hang|shoulder dislocate|back lever|iron cross|maltese|victorian|straight-arm press|bar pullover|ring fly/,
  ],
  ["shoulder_transition", /muscle[- ]up|kipping/],
  [
    "shoulder_loaded",
    /(?<!hip )\bdips?\b|handstand|planche|front lever|elbow lever|manna|human flag|dive bomber|headbanger|pike push|dead hang|one handed hang/,
  ],
  [
    "knee_lateral",
    /lateral lunge|cossack|skater|side lunge|lateral shuffle|lateral hop|side standing long jump|carioca|curtsy|crossover reverse lunge|sumo squat|skating/,
  ],
  [
    "knee_impact",
    /jump|\bhops?\b|bound|burpee|squat thrust|high knees|fast feet|skipping|jacks|sprints/,
  ],
  [
    "knee_deep_flexion",
    /pistol|shrimp|sissy|dragon squat|deep squat|hindu squat|nordic|sit squats|archer squat|deficit step-down/,
  ],
];

export function movementRisks(name: string): Set<MovementRisk> {
  const lower = name.toLowerCase();
  return new Set(
    RULES.filter(([, pattern]) => pattern.test(lower)).map(([risk]) => risk),
  );
}
