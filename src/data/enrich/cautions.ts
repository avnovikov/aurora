import type { SeedExercise } from "../seed";
import { hasKeyword } from "./keywords";
import type { LadderPlacement } from "./ladder";

interface CautionRule {
  note: string;
  keywords?: readonly string[];
  families?: readonly string[];
  minRank?: number;
  when?: (exercise: SeedExercise) => boolean;
}

/** Evidence-based safety notes (sources in each note; see evidence doc). */
const RULES: readonly CautionRule[] = [
  {
    families: ["flexion"],
    note: "Repeated spinal flexion: skip with flexion-intolerant back pain or a disc injury; keep volume moderate (Callaghan & McGill 2001; Contreras & Schoenfeld 2011).",
  },
  {
    keywords: ["bench dip", "chair dip", "floor dip", "between two benches"],
    note: "Takes the shoulder to ~100% of its extension range — prefer bar dips; skip with front-of-shoulder pain (McKenzie 2022).",
  },
  {
    keywords: ["kipping", " kip "],
    note: "Build strict pull-ups and scapular control before kipping.",
  },
  {
    keywords: ["jefferson"],
    note: "Loaded spinal flexion: start unloaded, progress slowly, skip with a back injury.",
  },
  {
    keywords: ["neck circles", "neck half circles", "neck cars", "head tilts", "head turns", "clockwise neck"],
    note: "Slow, pain-free range only; stop if dizzy, vision changes or sudden neck pain.",
  },
  {
    keywords: ["neck bridge"],
    note: "End-range cervical loading: only with prior neck conditioning; skip with any neck symptoms.",
  },
  {
    keywords: ["behind head"],
    note: "Skip with shoulder instability or pain; stop short of end range (Kolber 2010).",
  },
  {
    keywords: ["depth jump", "depth drop"],
    note: "Master landings, squat jumps and box jumps first (NSCA plyometric guidance).",
  },
  {
    families: ["planche", "front_lever", "back_lever", "rings_cross", "human_flag"],
    note: "High connective-tissue load on elbow, biceps tendon and shoulder: build the easier holds first and stop on joint pain.",
  },
  {
    keywords: ["dragon flag"],
    note: "Build a solid hollow hold and hanging leg raise first; stop on low-back pain.",
  },
  {
    keywords: ["handstand", "planche", "crow", "frog stand", "wrist load", "elbow lever"],
    note: "Warm up the wrists and build time on hands gradually; stop with persistent wrist pain.",
  },
  {
    keywords: ["wall sit", "wall squat", "isometric squat", "to failure"],
    note: "Breathe steadily — no breath-holding; avoid to-failure holds with uncontrolled high blood pressure (Edwards 2023).",
  },
  {
    when: (exercise) => exercise.pattern === "mobility" && exercise.type === "isometric",
    note: "Before strength work keep static holds under 60 s per muscle, then warm up dynamically (Behm 2016).",
  },
];

export function cautionsFor(exercise: SeedExercise, placement: LadderPlacement | undefined): string[] {
  return RULES.filter((rule) => {
    if (rule.when) {
      return rule.when(exercise);
    }
    if (rule.families) {
      return placement !== undefined && rule.families.includes(placement.family.id);
    }
    return rule.keywords !== undefined && hasKeyword(exercise.name, rule.keywords);
  }).map((rule) => rule.note);
}
