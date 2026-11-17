import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_COACH_LINES } from "../../src/voice/lines";

const VOICE_DIR = "public/voice";

/** The model `scripts/prebuild-voice.sh` bakes with by default. */
function scriptModel(): string {
  const script = readFileSync("scripts/prebuild-voice.sh", "utf8");
  const match = /AURORA_PIPER_MODEL:-[^}]*\/([^/}]+\.onnx)\}/.exec(script);
  if (!match?.[1]) {
    throw new Error("prebuild-voice.sh has no default model");
  }
  return match[1];
}

/** assetKey → { model, text } from data/voice-manifest.tsv (written by the bake). */
function manifest(): Map<string, { model: string; text: string }> {
  const rows = readFileSync("data/voice-manifest.tsv", "utf8").trim().split("\n").slice(1);
  return new Map(
    rows.map((row) => {
      const [key = "", model = "", text = ""] = row.split("\t");
      return [key, { model, text }];
    }),
  );
}

/** Channels, sample rate and bit depth from a WAV's fmt chunk. */
function wavFormat(path: string): string {
  const wav = readFileSync(path);
  const fmt = wav.indexOf("fmt ");
  if (wav.toString("ascii", 0, 4) !== "RIFF" || fmt === -1) {
    throw new Error(`${path} is not a WAV`);
  }
  const channels = wav.readUInt16LE(fmt + 10);
  const rate = wav.readUInt32LE(fmt + 12);
  const bits = wav.readUInt16LE(fmt + 22);
  return `${channels} ch ${rate} Hz ${bits} bit`;
}

describe("coach voice pack", () => {
  it("every line is baked once, from its app text, by the same voice, in one format", () => {
    const baked = manifest();
    const keys = ALL_COACH_LINES.map((line) => line.assetKey).sort();

    expect([...baked.keys()].sort()).toEqual(keys);
    for (const line of ALL_COACH_LINES) {
      expect(baked.get(line.assetKey)).toEqual({ model: scriptModel(), text: line.text });
    }

    const wavs = readdirSync(VOICE_DIR).filter((file) => file.endsWith(".wav"));
    expect(wavs.map((file) => file.replace(/\.wav$/, "")).sort()).toEqual(keys);
    const formats = new Set(wavs.map((file) => wavFormat(`${VOICE_DIR}/${file}`)));
    expect([...formats]).toEqual(["1 ch 22050 Hz 16 bit"]);
  });
});
