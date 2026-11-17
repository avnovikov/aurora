import { describe, expect, it } from "vitest";
import { loadProfile, saveProfile } from "../../src/settings/profile";
import { useMemoryStorage } from "../helpers/storage";

const KEY = "aurora.poc.profile.v1";

describe("profile palette", () => {
  describe("with no saved profile", () => {
    useMemoryStorage();
    it("defaults to Rassvet", () => {
      expect(loadProfile().palette).toBe("rassvet");
    });
  });

  describe("with a profile saved before palettes existed", () => {
    useMemoryStorage(() => ({
      [KEY]: JSON.stringify({
        bodyweightKg: 82,
        equipment: ["body", "rings"],
        voiceMuted: false,
        jointHistory: [],
        setupDone: true,
      }),
    }));
    it("loads the old fields and defaults the palette to Rassvet", () => {
      const profile = loadProfile();
      expect(profile.bodyweightKg).toBe(82);
      expect(profile.setupDone).toBe(true);
      expect(profile.palette).toBe("rassvet");
    });
  });

  describe("with gear saved before the #111 items existed", () => {
    useMemoryStorage(() => ({
      [KEY]: JSON.stringify({
        bodyweightKg: 80,
        equipment: ["body", "bar", "parallettes", "dumbbell", "band"],
        voiceMuted: false,
        jointHistory: [],
        setupDone: true,
      }),
    }));
    it("loads the selection unchanged, and saves new items", () => {
      const profile = loadProfile();
      expect(profile.equipment).toEqual(["body", "bar", "parallettes", "dumbbell", "band"]);
      expect(profile.setupDone).toBe(true);
      saveProfile({ ...profile, equipment: [...profile.equipment, "dip_bars", "towel"] });
      expect(loadProfile().equipment).toEqual(["body", "bar", "parallettes", "dumbbell", "band", "dip_bars", "towel"]);
    });
  });

  describe("with a gear id this build does not know", () => {
    useMemoryStorage(() => ({
      [KEY]: JSON.stringify({ bodyweightKg: 80, equipment: ["body", "jetpack", "rings"], setupDone: true }),
    }));
    it("drops that id and keeps the rest of the profile; saving one is refused", () => {
      const profile = loadProfile();
      expect(profile.equipment).toEqual(["body", "rings"]);
      expect(profile.setupDone).toBe(true);
      expect(() => saveProfile({ ...profile, equipment: ["jetpack" as never] })).toThrow(/unknown/);
    });
  });

  describe("with an unknown saved palette", () => {
    useMemoryStorage(() => ({ [KEY]: JSON.stringify({ setupDone: true, palette: "neon" }) }));
    it("keeps the rest of the profile and falls back to Rassvet", () => {
      const profile = loadProfile();
      expect(profile.setupDone).toBe(true);
      expect(profile.palette).toBe("rassvet");
    });
  });

  describe("saving", () => {
    useMemoryStorage();
    it("round-trips the chosen palette", () => {
      saveProfile({ ...loadProfile(), palette: "fajr" });
      expect(loadProfile().palette).toBe("fajr");
    });

    it("rejects an unknown palette on save", () => {
      expect(() => saveProfile({ ...loadProfile(), palette: "neon" as never })).toThrow();
    });
  });
});
