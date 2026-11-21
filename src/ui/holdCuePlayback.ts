import { speakExactLine } from "../voice/coachVoice";
import { holdCueAt, type HoldCueEvent } from "../voice/holdCue";

/** Speak the cue scheduled for `left` once; no-ops when already spoken or absent. */
export function speakDueHoldCue(
  left: number,
  schedule: readonly HoldCueEvent[],
  spoken: Set<number>,
): void {
  const due = holdCueAt(left, schedule);
  if (!due || spoken.has(left)) {
    return;
  }
  spoken.add(left);
  void speakExactLine({
    id: due.lineId,
    assetKey: due.assetKey,
    text: due.text,
  });
}

/**
 * Paint countdown seconds into `root`. Spoken hold cues stay voice-only —
 * clear any cue line under the big timer.
 */
export function paintHoldCountdown(
  root: HTMLElement,
  leftSelector: string,
  left: number,
): void {
  setText(root, leftSelector, String(Math.max(left, 0)));
  setText(root, "[data-hold-cue]", "");
}

function setText(root: HTMLElement, selector: string, text: string): void {
  const el = root.querySelector(selector);
  if (!el) {
    return;
  }
  el.textContent = text;
}
