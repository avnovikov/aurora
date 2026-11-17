import { describe, expect, it } from "vitest";
import {
  shouldAddRest,
  shouldOfferRestedGoOn,
} from "../../src/ui/restPulse";

describe("shouldOfferRestedGoOn", () => {
  it("asks when the pulse is steady with more than 10 seconds left", () => {
    expect(
      shouldOfferRestedGoOn({
        zone: "steady",
        secondsLeft: 11,
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

  it("stays quiet in work, hard, and max", () => {
    expect(
      shouldOfferRestedGoOn({ zone: "work", secondsLeft: 40, alreadyAsked: false }),
    ).toBe(false);
    expect(
      shouldOfferRestedGoOn({ zone: "hard", secondsLeft: 40, alreadyAsked: false }),
    ).toBe(false);
    expect(
      shouldOfferRestedGoOn({ zone: "max", secondsLeft: 40, alreadyAsked: false }),
    ).toBe(false);
  });

  it("asks only once", () => {
    expect(
      shouldOfferRestedGoOn({
        zone: "steady",
        secondsLeft: 40,
        alreadyAsked: true,
      }),
    ).toBe(false);
  });

  it("stays quiet in the last 10 seconds", () => {
    expect(
      shouldOfferRestedGoOn({
        zone: "steady",
        secondsLeft: 10,
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
  it("adds time while the pulse is above steady", () => {
    expect(shouldAddRest("work")).toBe(true);
    expect(shouldAddRest("hard")).toBe(true);
    expect(shouldAddRest("max")).toBe(true);
  });

  it("ends the rest when the pulse is steady or easy", () => {
    expect(shouldAddRest("steady")).toBe(false);
    expect(shouldAddRest("easy")).toBe(false);
  });

  it("ends the rest when there is no reading", () => {
    expect(shouldAddRest(null)).toBe(false);
  });
});
