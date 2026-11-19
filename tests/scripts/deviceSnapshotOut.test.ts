import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  auroraLocalStorageFromCdp,
  defaultFixtureName,
  resolveFixturePath,
  sanitizeFixtureName,
} from "../../scripts/lib/deviceSnapshotOut.mjs";

/** Fixed absolute dir for path math only — no real mkdir/tmpdir. */
const FIXTURE_DIR = "/aurora-test-fixtures";

describe("sanitizeFixtureName", () => {
  it("keeps a plain basename and adds .json when missing", () => {
    expect(sanitizeFixtureName("pixel10")).toBe("pixel10.json");
    expect(sanitizeFixtureName("2026-11-19-pixel10.json")).toBe("2026-11-19-pixel10.json");
  });

  it("strips directories and unsafe characters", () => {
    expect(sanitizeFixtureName("../etc/passwd")).toBe("passwd.json");
    expect(sanitizeFixtureName("/var/evil name!.json")).toBe("evilname.json");
  });

  it("rejects empty results", () => {
    expect(() => sanitizeFixtureName("...")).toThrow(/unsafe fixture name/);
    expect(() => sanitizeFixtureName("!!!")).toThrow(/unsafe fixture name/);
  });
});

describe("resolveFixturePath", () => {
  it("always resolves under the fixture directory", () => {
    expect(resolveFixturePath(FIXTURE_DIR, undefined, "a.json")).toBe(join(FIXTURE_DIR, "a.json"));
    expect(resolveFixturePath(FIXTURE_DIR, "../../escape.json", "a.json")).toBe(
      join(FIXTURE_DIR, "escape.json"),
    );
  });
});

describe("defaultFixtureName", () => {
  it("builds date-model.json with a sanitized model", () => {
    expect(defaultFixtureName("2026-11-19T12:00:00.000Z", "Pixel 10")).toBe("2026-11-19-pixel10.json");
  });
});

describe("auroraLocalStorageFromCdp", () => {
  it("keeps only aurora.* keys on a plain object", () => {
    expect(auroraLocalStorageFromCdp({ "aurora.poc.profile.v1": { bodyweightKg: 80 } })).toEqual({
      "aurora.poc.profile.v1": { bodyweightKg: 80 },
    });
  });

  it("rejects non-objects and non-aurora keys", () => {
    expect(() => auroraLocalStorageFromCdp(null)).toThrow(/plain object/);
    expect(() => auroraLocalStorageFromCdp([])).toThrow(/plain object/);
    expect(() => auroraLocalStorageFromCdp({ other: 1 })).toThrow(/unexpected localStorage key/);
  });
});
