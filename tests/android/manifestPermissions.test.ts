import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MANIFEST_PATH = resolve(
  process.cwd(),
  "android/app/src/main/AndroidManifest.xml",
);

function readManifest(): string {
  return readFileSync(MANIFEST_PATH, "utf8");
}

function permissionBlocks(manifest: string, name: string): string[] {
  const escaped = name.replace(/\./g, "\\.");
  const re = new RegExp(`<uses-permission\\b[^>]*android:name="${escaped}"[^>]*?/?>`, "g");
  return manifest.match(re) ?? [];
}

describe("AndroidManifest privacy posture (Cronos / Codeberg)", () => {
  it("does not grant INTERNET (local-only v0.1)", () => {
    const manifest = readManifest();
    const blocks = permissionBlocks(manifest, "android.permission.INTERNET");
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block).toMatch(/tools:node="remove"/);
    }
  });

  it("strips location permissions (BLE scan is neverForLocation)", () => {
    const manifest = readManifest();
    for (const name of [
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
    ]) {
      const blocks = permissionBlocks(manifest, name);
      expect(blocks.length, name).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block).toMatch(/tools:node="remove"/);
      }
    }
  });

  it("keeps BLUETOOTH_SCAN with neverForLocation for optional Pulse HR", () => {
    const manifest = readManifest();
    const blocks = permissionBlocks(manifest, "android.permission.BLUETOOTH_SCAN");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatch(/android:usesPermissionFlags="neverForLocation"/);
    expect(blocks[0]).toMatch(/tools:replace="android:usesPermissionFlags"/);
    expect(blocks[0]).not.toMatch(/tools:node="remove"/);
  });

  it("does not require bluetooth_le hardware (Pulse strap is optional)", () => {
    const manifest = readManifest();
    expect(manifest).toMatch(
      /android:name="android\.hardware\.bluetooth_le"\s+android:required="false"/,
    );
    expect(manifest).not.toMatch(
      /android:name="android\.hardware\.bluetooth_le"\s+android:required="true"/,
    );
  });
});
