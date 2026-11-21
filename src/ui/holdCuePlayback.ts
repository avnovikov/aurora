import { speakExactLine } from "../voice/coachVoice";
import { holdCueAt, holdCueText, type HoldCueEvent } from "../voice/holdCue";

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

/** Paint countdown seconds and the on-screen cue line into `root`. */
export function paintHoldCountdown(
  root: HTMLElement,
  leftSelector: string,
  left: number,
  schedule: readonly HoldCueEvent[],
): void {
  setText(root, leftSelector, String(Math.max(left, 0)));
  setText(root, "[data-hold-cue]", holdCueText(left, schedule) ?? "");
}

function setText(root: HTMLElement, selector: string, text: string): void {
  const el = root.querySelector(selector);
  if (!el) {
    return;
  }
  el.textContent = text;
}
