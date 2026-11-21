import { describe, expect, it } from "vitest";
import {
  REST_ADD_SECONDS,
  shouldAddRest,
  shouldOfferRestedGoOn,
} from "../../src/ui/restPulse";
import { REST_EXTEND } from "../../src/voice/lines";
import { GET_READY_AT_SECONDS_LEFT } from "../../src/voice/restCue";

describe("shouldOfferRestedGoOn", () => {
  it("asks when the pulse is easy just above Get ready", () => {
    expect(
      shouldOfferRestedGoOn({
        zone: "easy",
        secondsLeft: GET_READY_AT_SECONDS_LEFT + 1,
        alreadyAsked: false,
      }),
    ).toBe(true);
  });

  it("asks when the pulse is easy", () => {
    expect(
      shouldOfferRestedGoOn({
        zone: "easy",
        secondsLeft: 40,
        alreadyAsked: false,
      }),
    ).toBe(true);
  });

  it.each(["steady", "work", "hard", "max"] as const)(
    "stays quiet in %s",
    (zone) => {
      expect(
        shouldOfferRestedGoOn({ zone, secondsLeft: 40, alreadyAsked: false }),
      ).toBe(false);
    },
  );

  it("asks only once", () => {
    expect(
      shouldOfferRestedGoOn({
        zone: "easy",
        secondsLeft: 40,
        alreadyAsked: true,
      }),
    ).toBe(false);
  });

  it("stays quiet in the Get ready window", () => {
    expect(
      shouldOfferRestedGoOn({
        zone: "easy",
        secondsLeft: GET_READY_AT_SECONDS_LEFT,
        alreadyAsked: false,
      }),
    ).toBe(false);
  });

  it("stays quiet without a reading", () => {
    expect(
      shouldOfferRestedGoOn({
        zone: null,
        secondsLeft: 40,
        alreadyAsked: false,
      }),
    ).toBe(false);
  });
});

describe("shouldAddRest", () => {
  it.each(["work", "hard", "max"] as const)(
    "adds time while the pulse is in %s",
    (zone) => {
      expect(shouldAddRest(zone)).toBe(true);
    },
  );

  it("ends the rest when the pulse is steady or easy", () => {
    expect(shouldAddRest("steady")).toBe(false);
    expect(shouldAddRest("easy")).toBe(false);
  });

  it("ends the rest when there is no reading", () => {
    expect(shouldAddRest(null)).toBe(false);
  });
});

describe("REST_EXTEND copy", () => {
  it("names the same seconds the timer adds", () => {
    expect(REST_EXTEND.text).toBe(
      `Still up, mate. Another ${REST_ADD_SECONDS}.`,
    );
  });
});
