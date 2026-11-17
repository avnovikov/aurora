import type { EffortKind } from "../domain/types";
/**
 * Calm pro-coach copy with light Scouse colour (occasional “mate”).
 * Delivery: Piper northern English male via scripts/prebuild-voice.sh.
 */

export type CoachLineId =
  | "get_ready"
  | "five"
  | "four"
  | "three"
  | "two"
  | "one"
  | "go"
  | "halfway"
  | "rest_banter"
  | "pulse_not_readable"
  | "rest_go_on"
  | "rest_extend"
  | "session_start"
  | "warmup_done"
  | "change_side"
  | "set_logged"
  | "set_pace_nudge"
  | "session_done";

export interface CoachLine {
  id: CoachLineId;
  /** Stable asset key under /voice/{assetKey}.wav */
  assetKey: string;
  text: string;
  /** Only for one kind of timed station: "hold" lines never over reps, rep lines never over holds. */
  only?: EffortKind;
}

const GET_READY: CoachLine[] = [
  { id: "get_ready", assetKey: "get_ready", text: "Get ready..." },
  {
    id: "get_ready",
    assetKey: "get_ready_b",
    text: "Coming up, mate — reset your stance.",
  },
  {
    id: "get_ready",
    assetKey: "get_ready_c",
    text: "Next set in a few — breathe.",
  },
];

const GO: CoachLine[] = [
  { id: "go", assetKey: "go", text: "Go." },
  { id: "go", assetKey: "go_b", text: "You've got this." },
  {
    id: "go",
    assetKey: "go_c",
    text: "Nice and controlled — go.",
  },
];

const COUNTS: CoachLine[] = [
  { id: "five", assetKey: "five", text: "Five." },
  { id: "four", assetKey: "four", text: "Four." },
  { id: "three", assetKey: "three", text: "Three." },
  { id: "two", assetKey: "two", text: "Two." },
  { id: "one", assetKey: "one", text: "One." },
];

const PULSE: CoachLine[] = [
  {
    id: "pulse_not_readable",
    assetKey: "pulse_not_readable",
    text: "Pulse not reading — check the strap, mate.",
  },
  {
    id: "pulse_not_readable",
    assetKey: "pulse_not_readable_b",
    text: "Can't see your pulse. Tighten the band.",
  },
];

export const REST_GO_ON: CoachLine = {
  id: "rest_go_on",
  assetKey: "rest_go_on",
  text: "You seem rested, mate. Want to go on?",
};

export const REST_EXTEND: CoachLine = {
  id: "rest_extend",
  assetKey: "rest_extend",
  text: "Still up, mate. Another 30.",
};

const REST_PULSE: CoachLine[] = [REST_GO_ON, REST_EXTEND];

const HALFWAY: CoachLine[] = [
  { id: "halfway", assetKey: "halfway", text: "Halfway there, mate." },
  { id: "halfway", assetKey: "halfway_b", text: "That's half — hold it there.", only: "hold" },
  {
    id: "halfway",
    assetKey: "halfway_c",
    text: "Halfway, love. Nice and steady.",
  },
  { id: "halfway", assetKey: "halfway_d", text: "Halfway — keep the reps coming.", only: "reps" },
];

const REST_BANTER: CoachLine[] = [
  {
    id: "rest_banter",
    assetKey: "rest_banter",
    text: "Still here? Good — shake it out.",
  },
  {
    id: "rest_banter",
    assetKey: "rest_banter_b",
    text: "Resting hard is a skill, that.",
  },
  {
    id: "rest_banter",
    assetKey: "rest_banter_c",
    text: "Breathe. The next set's not going anywhere.",
  },
  {
    id: "rest_banter",
    assetKey: "rest_banter_d",
    text: "Halfway through the sit-about. You're winning.",
  },
];

const SESSION: CoachLine[] = [
  {
    id: "session_start",
    assetKey: "session_start",
    text: "Morning. Soft start, then we graft.",
  },
  {
    id: "session_start",
    assetKey: "session_start_b",
    text: "Ready when you are, mate.",
  },
  {
    id: "session_start",
    assetKey: "session_start_c",
    text: "Let's get moving — nice and steady.",
  },
  {
    id: "warmup_done",
    assetKey: "warmup_done",
    text: "Warmup done. Real work next.",
  },
  {
    id: "warmup_done",
    assetKey: "warmup_done_b",
    text: "Body's awake. Time for the main sets.",
  },
  {
    id: "change_side",
    assetKey: "change_side",
    text: "Change side, mate.",
  },
  {
    id: "change_side",
    assetKey: "change_side_b",
    text: "Other side when you're ready.",
  },
  {
    id: "set_logged",
    assetKey: "set_logged",
    text: "Set in the bank. Nice one.",
  },
  {
    id: "set_logged",
    assetKey: "set_logged_b",
    text: "Good set — shake it out.",
  },
  {
    id: "set_logged",
    assetKey: "set_logged_c",
    text: "Logged. Take the rest.",
  },
  {
    id: "set_pace_nudge",
    assetKey: "set_pace_nudge",
    text: "Last set ran long — keep these crisp.",
  },
  {
    id: "set_pace_nudge",
    assetKey: "set_pace_nudge_b",
    text: "Over two minutes last time — smoother tempo, mate.",
  },
  {
    id: "set_pace_nudge",
    assetKey: "set_pace_nudge_c",
    text: "That last one dragged — nice clean reps this set.",
  },
  {
    id: "session_done",
    assetKey: "session_done",
    text: "Session done. Sound work today.",
  },
  {
    id: "session_done",
    assetKey: "session_done_b",
    text: "That's you finished — recover well.",
  },
  {
    id: "session_done",
    assetKey: "session_done_c",
    text: "Nice session. Cup of tea?",
  },
];

export const ALL_COACH_LINES: CoachLine[] = [
  ...GET_READY,
  ...COUNTS,
  ...GO,
  ...HALFWAY,
  ...REST_BANTER,
  ...PULSE,
  ...REST_PULSE,
  ...SESSION,
];

export function linesFor(id: CoachLineId): CoachLine[] {
  return ALL_COACH_LINES.filter((line) => line.id === id);
}

export function pickLine(
  id: CoachLineId,
  random: () => number = Math.random,
): CoachLine {
  const options = linesFor(id);
  if (options.length === 0) {
    throw new Error(`No coach lines for id ${id}`);
  }
  const index = Math.floor(random() * options.length);
  return options[Math.min(index, options.length - 1)];
}
