import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_HEART_RATE_BPM,
  DEFAULT_RESTING_HEART_RATE_BPM,
  isValidMaxHeartRate,
  isValidRestingHeartRate,
  loadProfile,
  MAX_MAX_HEART_RATE_BPM,
  MAX_RESTING_HEART_RATE_BPM,
  MIN_MAX_HEART_RATE_BPM,
  MIN_RESTING_HEART_RATE_BPM,
  saveProfile,
} from "../../src/settings/profile";
import { useMemoryStorage } from "../helpers/storage";

const KEY = "aurora.poc.profile.v1";

describe("heart rate on the profile", () => {
  describe("with no saved profile", () => {
    useMemoryStorage();
    it("starts at a resting pulse of 60 and a max of 185", () => {
      const profile = loadProfile();
      expect(profile.restingHeartRateBpm).toBe(DEFAULT_RESTING_HEART_RATE_BPM);
      expect(profile.maxHeartRateBpm).toBe(DEFAULT_MAX_HEART_RATE_BPM);
      expect(DEFAULT_RESTING_HEART_RATE_BPM).toBe(60);
      expect(DEFAULT_MAX_HEART_RATE_BPM).toBe(185);
    });
  });

  describe("with a profile saved before heart rate existed", () => {
    useMemoryStorage(() => ({
      [KEY]: JSON.stringify({ bodyweightKg: 82, setupDone: true }),
    }));
    it("keeps the old fields and fills in the default bands", () => {
      const profile = loadProfile();
      expect(profile.bodyweightKg).toBe(82);
      expect(profile.restingHeartRateBpm).toBe(60);
      expect(profile.maxHeartRateBpm).toBe(185);
    });
  });

  describe("with a saved heart rate outside the range", () => {
    useMemoryStorage(() => ({
      [KEY]: JSON.stringify({ bodyweightKg: 82, restingHeartRateBpm: 200, maxHeartRateBpm: 90 }),
    }));
    it("keeps the profile and restores the default bands", () => {
      const profile = loadProfile();
      expect(profile.bodyweightKg).toBe(82);
      expect(profile.restingHeartRateBpm).toBe(60);
      expect(profile.maxHeartRateBpm).toBe(185);
    });
  });

  describe("saving", () => {
    useMemoryStorage();
    it("round-trips a resting and max pulse inside the allowed range", () => {
      saveProfile({ ...loadProfile(), restingHeartRateBpm: 48, maxHeartRateBpm: 192 });
      const profile = loadProfile();
      expect(profile.restingHeartRateBpm).toBe(48);
      expect(profile.maxHeartRateBpm).toBe(192);
    });

    it("accepts only whole bpm in range, and the ranges cannot collapse the bands", () => {
      expect(isValidRestingHeartRate(MIN_RESTING_HEART_RATE_BPM)).toBe(true);
      expect(isValidRestingHeartRate(MAX_RESTING_HEART_RATE_BPM)).toBe(true);
      expect(isValidRestingHeartRate(MIN_RESTING_HEART_RATE_BPM - 1)).toBe(false);
      expect(isValidRestingHeartRate(60.5)).toBe(false);
      expect(isValidMaxHeartRate(MIN_MAX_HEART_RATE_BPM)).toBe(true);
      expect(isValidMaxHeartRate(MAX_MAX_HEART_RATE_BPM)).toBe(true);
      expect(isValidMaxHeartRate(MAX_MAX_HEART_RATE_BPM + 1)).toBe(false);
      expect(MIN_MAX_HEART_RATE_BPM - MAX_RESTING_HEART_RATE_BPM).toBeGreaterThanOrEqual(40);
      expect(() => saveProfile({ ...loadProfile(), maxHeartRateBpm: 90 })).toThrow(/maxHeartRateBpm/);
    });
  });
});
