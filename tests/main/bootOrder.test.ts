import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("main.ts boot order (#116)", () => {
  it("migrates plaintext storage before memory v1→v2", () => {
    const source = readFileSync(resolve("src/main.ts"), "utf8");
    const plaintext = source.indexOf("migratePlaintextToSecureStorage()");
    const memory = source.indexOf("ensureMemoryMigrated()");
    expect(plaintext).toBeGreaterThan(-1);
    expect(memory).toBeGreaterThan(-1);
    expect(plaintext).toBeLessThan(memory);
  });
});
