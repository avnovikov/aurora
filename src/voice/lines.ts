/**
 * Scouse-flavoured coach copy. Delivery is calm male British (prebuilt Daniel);
 * wording is Liverpool-leaning — mate, soft jokes — not a HAL clone.
 */

export type CoachLineId =
  | "get_ready"
  | "five"
  | "four"
  | "three"
  | "two"
  | "one"
  | "go"
  | "pulse_not_readable"
  | "session_start"
  | "warmup_done"
  | "set_logged"
  | "session_done";

export interface CoachLine {
  id: CoachLineId;
  /** Stable asset key under /voice/{assetKey}.wav */
  assetKey: string;
  text: string;
}

const GET_READY: CoachLine[] = [
  { id: "get_ready", assetKey: "get_ready", text: "Get ready, mate." },
  {
    id: "get_ready",
    assetKey: "get_ready_b",
    text: "Nearly on, la. Get ready.",
  },
  {
    id: "get_ready",
    assetKey: "get_ready_c",
    text: "Ten seconds. Shake it out, mate.",
  },
];

const GO: CoachLine[] = [
  { id: "go", assetKey: "go", text: "Go on, mate." },
  { id: "go", assetKey: "go_b", text: "Go! You've got this." },
  {
    id: "go",
    assetKey: "go_c",
    text: "Right, off you pop.",
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
    text: "Pulse not readable, mate.",
  },
  {
    id: "pulse_not_readable",
    assetKey: "pulse_not_readable_b",
    text: "Can't see your pulse. Check the strap, la.",
  },
];

const SESSION: CoachLine[] = [
  {
    id: "session_start",
    assetKey: "session_start",
    text: "Morning, mate. Let's get into it.",
  },
  {
    id: "session_start",
    assetKey: "session_start_b",
    text: "Rassvet's up. Soft start, then we graft.",
  },
  {
    id: "warmup_done",
    assetKey: "warmup_done",
    text: "Warmup done. Time for the real work, mate.",
  },
  {
    id: "set_logged",
    assetKey: "set_logged",
    text: "Set in the bank. Nice one.",
  },
  {
    id: "session_done",
    assetKey: "session_done",
    text: "Session done, mate. Sound.",
  },
  {
    id: "session_done",
    assetKey: "session_done_b",
    text: "That's you finished. Cup of tea?",
  },
];

export const ALL_COACH_LINES: CoachLine[] = [
  ...GET_READY,
  ...COUNTS,
  ...GO,
  ...PULSE,
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
