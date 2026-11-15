import { describe, expect, it } from "vitest";
import { restCueText } from "../../src/ui/sessionRest";
import type { RestCueEvent } from "../../src/voice/restCue";

function cue(atSecondsLeft: number, text: string): RestCueEvent {
  return {
    atSecondsLeft,
    kind: "get_ready",
    text,
    lineId: "get_ready",
    assetKey: "get_ready_a",
  };
}

describe("restCueText", () => {
  it("returns cue copy when a schedule event matches", () => {
    expect(restCueText(10, [cue(10, "Get ready, mate.")])).toBe(
      "Get ready, mate.",
    );
  });

  it("returns null when only the countdown should show", () => {
    expect(restCueText(42, [cue(10, "Get ready, mate.")])).toBeNull();
  });

  it("keeps British cue wording untouched", () => {
    expect(restCueText(5, [cue(5, "Nearly there, mate.")])).toBe(
      "Nearly there, mate.",
    );
  });
});
