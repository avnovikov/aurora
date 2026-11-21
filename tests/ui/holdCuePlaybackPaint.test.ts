/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { paintHoldCountdown } from "../../src/ui/holdCuePlayback";

describe("paintHoldCountdown", () => {
  it("updates the seconds but leaves the cue line empty (voice-only cues)", () => {
    const left = document.createElement("span");
    left.setAttribute("data-work-hold-left", "");
    const cue = document.createElement("p");
    cue.setAttribute("data-hold-cue", "");
    cue.textContent = "stale";
    const root = document.createElement("div");
    root.append(left, cue);

    paintHoldCountdown(root, "[data-work-hold-left]", 5);

    expect(left.textContent).toBe("5");
    expect(cue.textContent).toBe("");
  });
});
