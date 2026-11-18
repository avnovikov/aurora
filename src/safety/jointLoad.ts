import type { JointId } from "../domain/program";

/**
 * Which joints a move stresses and why, per movement family. Impersonal
 * facts for the Library, and the cautions for joints with no avoid rules
 * (see `jointCare.ts`). Only evidence found is encoded; hip and ankle have
 * no entries because nothing was researched for them yet.
 */
export type LoadLevel = "high" | "moderate";

export interface JointLoad {
  joint: JointId;
  level: LoadLevel;
  note: string;
}

interface LoadRule extends JointLoad {
  pattern: RegExp;
}

const RULES: readonly LoadRule[] = [
  {
    joint: "wrist",
    level: "high",
    pattern: /handstand|planche|crow|frog stand|japanese|elbow lever/,
    note: "Weight-bearing wrist extension: press-to-handstand loads the wrist with moments near 40% of body weight and chronic wrist pain is common in handstand practitioners (PMC12550924; gymnast pooled prevalence 53%, PMC12804664). Warm up the wrists and build time gradually.",
  },
  {
    joint: "wrist",
    level: "moderate",
    pattern: /push-up|push up|plank|mountain climber|burpee|bear crawl|crab/,
    note: "Wrist extension under body weight: warm up first; fists or parallettes keep the wrist straighter if it is sore (convention; no calisthenics-specific data).",
  },
  {
    joint: "elbow",
    level: "high",
    pattern: /front lever|back lever|planche|one-arm|one arm|muscle[- ]up|iron cross|human flag|pelican|bicep curl|ice cream/,
    note: "Long static holds and straight-arm or one-arm work load the elbow flexors and forearm tendons: build hold time gradually and stop on tendon pain (coaching sources; no controlled study found).",
  },
  {
    joint: "elbow",
    level: "moderate",
    pattern: /pull-up|chin-up|\bdips?\b|push-up/,
    note: "Repetitive elbow loading: raise weekly volume gradually (workload principle; opinion-level).",
  },
  {
    joint: "shoulder",
    level: "high",
    pattern: /(?<!hip )\bdips?\b/,
    note: "Deep dips take the shoulder to the end of its extension range: stop above the point where the front of the shoulder stretches (McKenzie 2022).",
  },
  {
    joint: "shoulder",
    level: "moderate",
    pattern: /pull-up|chin-up/,
    note: "Impingement risk peaks at the bottom of the pull-up; a pronated grip may suit people returning from injury (secondary source).",
  },
  {
    joint: "knee",
    level: "high",
    pattern: /pistol|shrimp|dragon squat|skater squat|single[- ]leg squat|bulgarian|deficit step-down/,
    note: "One-legged squats load the patellofemoral joint more than two-legged squats at every angle tested: cap depth where the knee stays comfortable (IJSPT 2025).",
  },
  {
    joint: "knee",
    level: "moderate",
    pattern: /lunge|split squat/,
    note: "Longer strides raise posterior cruciate force: shorten the stride if the knee is sensitive (Escamilla, IJSPT).",
  },
  {
    joint: "knee",
    level: "moderate",
    pattern: /sissy|deep squat|hindu squat|sit squats/,
    note: "Compressive load on the menisci and cartilage rises with depth; cruciate shear is low in the first 60° of bend (Escamilla 2001, MSSE).",
  },
  {
    joint: "lumbar",
    level: "high",
    pattern: /sit-up|situp|crunch|v-up|jackknife|jefferson|toe touch/,
    note: "Repeated spinal flexion: skip with flexion-intolerant back pain or a disc injury (Callaghan & McGill 2001).",
  },
];

/** One entry per joint (highest level wins), strongest first. */
export function jointLoadsFor(name: string): JointLoad[] {
  const lower = name.toLowerCase();
  const best = new Map<JointId, JointLoad>();
  for (const { pattern, ...load } of RULES) {
    if (!pattern.test(lower)) {
      continue;
    }
    const current = best.get(load.joint);
    if (!current || (current.level === "moderate" && load.level === "high")) {
      best.set(load.joint, load);
    }
  }
  return [...best.values()].sort((a, b) => Number(b.level === "high") - Number(a.level === "high"));
}
