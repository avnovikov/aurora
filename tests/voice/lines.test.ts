import { describe, expect, it } from "vitest";
import { ALL_COACH_LINES, linesFor, pickLine } from "../../src/voice/lines";

describe("coach lines", () => {
  it("keeps light mate colour and multi-variant ready/go", () => {
    const ready = linesFor("get_ready");
    const go = linesFor("go");
    expect(ready.length).toBeGreaterThan(1);
    expect(go.length).toBeGreaterThan(1);
    expect(ALL_COACH_LINES.some((line) => /\bmate\b/i.test(line.text))).toBe(
      true,
    );
    expect(go.some((line) => /got this|controlled|Go\./i.test(line.text))).toBe(
      true,
    );
  });

  it("pickLine is deterministic for a fixed random", () => {
    const first = pickLine("session_start", () => 0);
    const again = pickLine("session_start", () => 0);
    expect(first.assetKey).toBe(again.assetKey);
  });

  it("every line has a unique asset key", () => {
    const keys = ALL_COACH_LINES.map((line) => line.assetKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
