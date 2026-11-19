import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  HARD_RECALL,
  informativeTokens,
  loadAllowlistIds,
  looksLikeTemplate,
  scoreFidelity,
  tokenRecall,
  type FidelityAllowlist,
} from "../../src/data/describe/fidelity";
import { buildSourceCorpus } from "../../src/data/describe/sourceCorpus";
import type { CuratedDescription } from "../../src/data/describe/types";
import { DESCRIPTIONS } from "../../src/data/generated/descriptions";
import { LIBRARY_CATALOGUE } from "../../src/data/libraryCatalogue";
import type { WgerExerciseRecord } from "../../src/data/wger/types";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function sourceCorpus() {
  const fedbJson = await readFile(path.join(repoRoot, "data/raw/free-exercise-db.json"), "utf8");
  const wgerRaw = JSON.parse(
    await readFile(path.join(repoRoot, "data/raw/wger-exercises.json"), "utf8"),
  ) as WgerExerciseRecord[];
  return buildSourceCorpus(fedbJson, wgerRaw);
}

const sample: CuratedDescription = {
  id: "x",
  summary: "A hip hinge with a kettlebell that loads the posterior chain.",
  steps: [
    "Stand with the kettlebell between your feet.",
    "Hinge at the hips and grip the handle.",
    "Drive the hips forward to stand tall.",
  ],
  cues: ["Hips back", "Flat back"],
  mistakes: ["Rounding the spine"],
};

describe("fidelity scoring", () => {
  it("scores high recall when curated keeps informative source tokens", () => {
    const source =
      "Stand with the kettlebell between your feet. Hinge at the hips and grip the handle. Drive the hips forward.";
    expect(tokenRecall(source, [sample.summary, ...sample.steps, ...sample.cues].join(" "))).toBeGreaterThan(
      0.5,
    );
  });

  it("scores low recall when curated drops the original cues", () => {
    const source =
      "Clean and press a kettlebell overhead with one arm. Keep the bell locked out while you hinge sideways into a windmill.";
    const generic =
      "Set up for the move with a braced torso. Perform the movement with control. Return to the start with control.";
    expect(tokenRecall(source, generic)).toBeLessThan(HARD_RECALL);
    expect(looksLikeTemplate(generic)).toBe(true);
  });

  it("ignores stopwords when building informative tokens", () => {
    expect(informativeTokens("the and or to of kettlebell hinge")).toEqual(
      new Set(["kettlebell", "hinge"]),
    );
  });

  it("hard-fails templated low-recall curated text", () => {
    const curated: CuratedDescription = {
      id: "bad",
      summary: "Set up for the move with a braced torso and stay tall.",
      steps: ["Set up for the move with a braced torso.", "Perform the movement with control."],
      cues: ["Stay braced"],
      mistakes: [],
    };
    const score = scoreFidelity({
      id: "bad",
      name: "Bad",
      sourceCorpus:
        "Stand tall and press a kettlebell overhead. Keep the lockout while you hinge into the windmill and reach the free hand to the floor.",
      sourceChars: 140,
      curated,
      allowlistIds: new Set(),
    });
    expect(score.thinSource).toBe(false);
    expect(score.template).toBe(true);
    expect(score.hardFail).toBe(true);
  });

  it("allowlists thin or non-instructional originals automatically", () => {
    const thin = scoreFidelity({
      id: "thin",
      name: "Thin",
      sourceCorpus: "Stand tall.",
      sourceChars: 10,
      curated: sample,
      allowlistIds: new Set(),
    });
    expect(thin.thinSource).toBe(true);
    expect(thin.hardFail).toBe(false);
    expect(thin.allowlisted).toBe(true);

    const videoOnly = scoreFidelity({
      id: "video",
      name: "Video",
      sourceCorpus: "See this instructive video: https://www.youtube.com/watch?v=abc123.",
      sourceChars: 70,
      curated: sample,
      allowlistIds: new Set(),
    });
    expect(videoOnly.thinSource).toBe(true);
    expect(videoOnly.hardFail).toBe(false);
  });

  it("hard-fails template fills even when some source tokens remain", () => {
    const curated: CuratedDescription = {
      id: "kb",
      summary: "Kettlebell Windmill is a mobility exercise with a kettlebell, done with steady control through the full range.",
      steps: [
        "Set up for Kettlebell Windmill with a kettlebell with a braced torso and stable base.",
        "Move through a full range with control, then return without losing posture.",
      ],
      cues: ["Stay braced"],
      mistakes: [],
    };
    const score = scoreFidelity({
      id: "kb",
      name: "Kettlebell Windmill",
      sourceCorpus:
        "Place a kettlebell in front of your lead foot and clean and press it overhead. Keeping the kettlebell locked out, hinge sideways until the free hand nears the floor.",
      sourceChars: 180,
      curated,
      allowlistIds: new Set(),
    });
    expect(score.template).toBe(true);
    expect(score.hardFail).toBe(true);
  });
});

describe("catalogue fidelity gate", () => {
  it("has no hard fails against original source corpus", async () => {
    const allowlist = loadAllowlistIds(
      JSON.parse(
        await readFile(path.join(repoRoot, "data/curated/description-fidelity-allowlist.json"), "utf8"),
      ) as FidelityAllowlist,
    );
    const corpus = await sourceCorpus();
    const hardFails = LIBRARY_CATALOGUE.flatMap((exercise) => {
      const curated = DESCRIPTIONS[exercise.id];
      const source = corpus.get(exercise.id);
      if (!curated || !source) {
        return [`missing:${exercise.id}`];
      }
      const score = scoreFidelity({
        id: exercise.id,
        name: exercise.name,
        sourceCorpus: source.corpus,
        sourceChars: source.sourceChars,
        curated,
        allowlistIds: allowlist,
      });
      return score.hardFail
        ? [`${score.id}:recall=${score.recall.toFixed(3)}:template=${score.template}`]
        : [];
    });
    expect(hardFails).toEqual([]);
  }, 120_000);
});
