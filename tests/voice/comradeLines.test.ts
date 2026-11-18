import { afterEach, describe, expect, it } from "vitest";
import {
  setKettlebellCoachContext,
  getKettlebellCoachContext,
} from "../../src/voice/coachContext";
import {
  COMRADE_PICK_CHANCE,
  pickLine,
  type CoachLineId,
} from "../../src/voice/lines";

const COMRADE_IDS: CoachLineId[] = [
  "get_ready",
  "halfway",
  "change_side",
  "set_pace_nudge",
  "rest_go_on",
  "rest_extend",
];

afterEach(() => {
  setKettlebellCoachContext(false);
});

describe("comrade coach lines", () => {
  it("never picks kettlebellOnly lines when context is off", () => {
    setKettlebellCoachContext(false);
    for (const id of COMRADE_IDS) {
      for (let i = 0; i < 40; i += 1) {
        const line = pickLine(id, () => i / 40, { kettlebellContext: false });
        expect(line.kettlebellOnly, id).toBeFalsy();
      }
    }
  });

  it("can pick a comrade twin when context is on and the first roll is under chance", () => {
    const line = pickLine("get_ready", () => 0, { kettlebellContext: true });
    expect(line.kettlebellOnly).toBe(true);
    expect(line.text).toMatch(/comrade/i);
    expect(line.bakeText).toMatch(/kahm-rahd/);
  });

  it("stays on normal lines when the comrade gate roll misses", () => {
    // First random() is the 0.2 gate; 0.5 misses. Second picks index 0 of normals.
    const rolls = [0.5, 0];
    let i = 0;
    const line = pickLine("get_ready", () => rolls[i++] ?? 0, {
      kettlebellContext: true,
    });
    expect(line.kettlebellOnly).toBeFalsy();
  });

  it("hits comrade about COMRADE_PICK_CHANCE of the time under a flat seed", () => {
    const n = 1000;
    let hits = 0;
    for (let i = 0; i < n; i += 1) {
      const gate = i / n;
      let usedGate = false;
      const random = (): number => {
        if (!usedGate) {
          usedGate = true;
          return gate;
        }
        return 0;
      };
      if (pickLine("change_side", random, { kettlebellContext: true }).kettlebellOnly) {
        hits += 1;
      }
    }
    expect(hits / n).toBeCloseTo(COMRADE_PICK_CHANCE, 5);
  });

  it("defaults pickLine to the session coach context flag", () => {
    setKettlebellCoachContext(true);
    expect(getKettlebellCoachContext()).toBe(true);
    const line = pickLine("rest_extend", () => 0);
    expect(line.assetKey).toBe("rest_extend_comrade");
  });
});
