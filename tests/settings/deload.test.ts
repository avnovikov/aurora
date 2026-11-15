import { beforeEach, describe, expect, it } from "vitest";
import {
  loadDeloadActive,
  resetDeloadForTests,
  saveDeloadActive,
} from "../../src/settings/deload";
import { deloadNoteHtml } from "../../src/ui/deloadNote";

describe("deload flag storage", () => {
  beforeEach(() => resetDeloadForTests());

  it("defaults to off", () => {
    expect(loadDeloadActive()).toBe(false);
  });

  it("persists start and stop", () => {
    saveDeloadActive(true);
    expect(loadDeloadActive()).toBe(true);
    saveDeloadActive(false);
    expect(loadDeloadActive()).toBe(false);
  });

  it("rejects non-boolean values", () => {
    expect(() => saveDeloadActive("yes" as unknown as boolean)).toThrow(
      /deloadActive must be a boolean/,
    );
  });
});

describe("deloadNoteHtml", () => {
  it("is empty when deload is off", () => {
    expect(deloadNoteHtml(false)).toBe("");
  });

  it("mentions deload when active", () => {
    expect(deloadNoteHtml(true)).toMatch(/Deload week/);
  });
});
