import { describe, expect, it } from "vitest";
import { holdCueText, type HoldCueEvent } from "../../src/voice/holdCue";

function cue(atSecondsLeft: number, text: string): HoldCueEvent {
  return {
    atSecondsLeft,
    text,
    lineId: "halfway",
    assetKey: "halfway",
  };
}

describe("holdCueText", () => {
  it("returns the scheduled line at the mid second", () => {
    expect(holdCueText(6, [cue(6, "Halfway there, mate.")])).toBe(
      "Halfway there, mate.",
    );
  });

  it("is null when no cue is due", () => {
    expect(holdCueText(10, [cue(6, "Halfway there, mate.")])).toBeNull();
  });
});
