import type { EffortKind } from "../domain/types";
import { getKettlebellCoachContext } from "./coachContext";

/**
 * Calm pro-coach copy with light Scouse colour (occasional “mate”).
 * Delivery: Piper northern English male via scripts/prebuild-voice.sh.
 * Kettlebell sessions may hear “comrade” (phonetic bake: kahm-rahd).
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
  | "hold_done"
  | "change_side"
  | "set_logged"
  | "set_pace_nudge"
  | "session_done";

export interface CoachLine {
  id: CoachLineId;
  /** Stable asset key under /voice/{assetKey}.wav */
  assetKey: string;
  text: string;
  /** Piper input when it should differ from `text` (phonetic accent). */
  bakeText?: string;
  /** Only for one kind of timed station: "hold" lines never over reps, rep lines never over holds. */
  only?: EffortKind;
  /** Eligible only when kettlebell coach context is on. */
  kettlebellOnly?: boolean;
}

/** Chance to pick a kettlebellOnly twin when context is on and twins exist. */
export const COMRADE_PICK_CHANCE = 0.2;

const COMRADE_BAKE = "kahm-rahd";

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
  {
    id: "get_ready",
    assetKey: "get_ready_comrade",
    text: "Coming up, comrade — reset your stance.",
    bakeText: `Coming up, ${COMRADE_BAKE} — reset your stance.`,
    kettlebellOnly: true,
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

export const REST_GO_ON_COMRADE: CoachLine = {
  id: "rest_go_on",
  assetKey: "rest_go_on_comrade",
  text: "You seem rested, comrade. Want to go on?",
  bakeText: `You seem rested, ${COMRADE_BAKE}. Want to go on?`,
  kettlebellOnly: true,
};

export const REST_EXTEND: CoachLine = {
  id: "rest_extend",
  assetKey: "rest_extend",
  // Keep in sync with REST_ADD_SECONDS in restCue.ts (enforced in restPulse.test.ts).
  text: "Still up, mate. Another 30.",
};

export const REST_EXTEND_COMRADE: CoachLine = {
  id: "rest_extend",
  assetKey: "rest_extend_comrade",
  text: "Still up, comrade. Another 30.",
  bakeText: `Still up, ${COMRADE_BAKE}. Another 30.`,
  kettlebellOnly: true,
};

const REST_PULSE: CoachLine[] = [
  REST_GO_ON,
  REST_GO_ON_COMRADE,
  REST_EXTEND,
  REST_EXTEND_COMRADE,
];

const HALFWAY: CoachLine[] = [
  { id: "halfway", assetKey: "halfway", text: "Halfway there, mate." },
  { id: "halfway", assetKey: "halfway_b", text: "That's half — hold it there.", only: "hold" },
  {
    id: "halfway",
    assetKey: "halfway_c",
    text: "Halfway, love. Nice and steady.",
  },
  { id: "halfway", assetKey: "halfway_d", text: "Halfway — keep the reps coming.", only: "reps" },
  {
    id: "halfway",
    assetKey: "halfway_comrade",
    text: "Halfway there, comrade.",
    bakeText: `Halfway there, ${COMRADE_BAKE}.`,
    kettlebellOnly: true,
  },
  {
    id: "halfway",
    assetKey: "halfway_comrade_c",
    text: "Halfway, comrade. Nice and steady.",
    bakeText: `Halfway, ${COMRADE_BAKE}. Nice and steady.`,
    kettlebellOnly: true,
  },
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
    id: "hold_done",
    assetKey: "hold_done",
    text: "Stop there, mate.",
  },
  {
    id: "hold_done",
    assetKey: "hold_done_b",
    text: "Enough, lad.",
  },
  {
    id: "hold_done",
    assetKey: "hold_done_c",
    text: "That'll do.",
  },
  {
    id: "hold_done",
    assetKey: "hold_done_d",
    text: "Done.",
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
    id: "change_side",
    assetKey: "change_side_comrade",
    text: "Change side, comrade.",
    bakeText: `Change side, ${COMRADE_BAKE}.`,
    kettlebellOnly: true,
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
    id: "set_pace_nudge",
    assetKey: "set_pace_nudge_comrade",
    text: "Over two minutes last time — smoother tempo, comrade.",
    bakeText: `Over two minutes last time — smoother tempo, ${COMRADE_BAKE}.`,
    kettlebellOnly: true,
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

export interface PickLineOptions {
  /** Override session KB flag. Default: `getKettlebellCoachContext()`. */
  kettlebellContext?: boolean;
  /** Keep lines whose `only` matches (or is unset). */
  effort?: EffortKind;
}

export function pickLine(
  id: CoachLineId,
  random: () => number = Math.random,
  options: PickLineOptions = {},
): CoachLine {
  const kettlebellContext =
    options.kettlebellContext ?? getKettlebellCoachContext();
  const pool = eligibleLines(id, kettlebellContext, options.effort);
  if (pool.length === 0) {
    throw new Error(`No coach lines for id ${id}`);
  }

  const comrades = pool.filter((line) => line.kettlebellOnly === true);
  const normals = pool.filter((line) => line.kettlebellOnly !== true);

  if (
    kettlebellContext &&
    comrades.length > 0 &&
    normals.length > 0 &&
    random() < COMRADE_PICK_CHANCE
  ) {
    return pickUniform(comrades, random);
  }

  return pickUniform(normals.length > 0 ? normals : pool, random);
}

function eligibleLines(
  id: CoachLineId,
  kettlebellContext: boolean,
  effort: EffortKind | undefined,
): CoachLine[] {
  return linesFor(id).filter((line) => {
    if (line.kettlebellOnly === true && !kettlebellContext) {
      return false;
    }
    if (effort !== undefined && line.only !== undefined && line.only !== effort) {
      return false;
    }
    return true;
  });
}

function pickUniform(lines: readonly CoachLine[], random: () => number): CoachLine {
  if (lines.length === 0) {
    throw new Error("pickUniform requires at least one line");
  }
  const index = Math.floor(random() * lines.length);
  return lines[Math.min(index, lines.length - 1)]!;
}
