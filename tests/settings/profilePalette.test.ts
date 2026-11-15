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
