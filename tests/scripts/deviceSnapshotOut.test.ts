import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  auroraLocalStorageFromCdp,
  defaultFixtureName,
  resolveFixturePath,
  sanitizeFixtureName,
} from "../../scripts/lib/deviceSnapshotOut.mjs";

describe("sanitizeFixtureName", () => {
  it("keeps a plain basename and adds .json when missing", () => {
    expect(sanitizeFixtureName("pixel10")).toBe("pixel10.json");
    expect(sanitizeFixtureName("2026-11-19-pixel10.json")).toBe("2026-11-19-pixel10.json");
  });

  it("strips directories and unsafe characters", () => {
    expect(sanitizeFixtureName("../etc/passwd")).toBe("passwd.json");
    expect(sanitizeFixtureName("/tmp/../../evil name!.json")).toBe("evilname.json");
  });

  it("rejects empty results", () => {
    expect(() => sanitizeFixtureName("...")).toThrow(/unsafe fixture name/);
    expect(() => sanitizeFixtureName("!!!")).toThrow(/unsafe fixture name/);
  });
});

describe("resolveFixturePath", () => {
  it("always resolves under the fixture directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "aurora-fixture-"));
    expect(resolveFixturePath(dir, undefined, "a.json")).toBe(join(dir, "a.json"));
    expect(resolveFixturePath(dir, "../../escape.json", "a.json")).toBe(join(dir, "escape.json"));
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
