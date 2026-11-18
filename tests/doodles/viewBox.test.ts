import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const doodleDir = new URL("../../public/doodles/", import.meta.url);
const read = (file: string): string => readFileSync(new URL(file, doodleDir), "utf8");

describe("doodle viewBox", () => {
  it("every public/doodles/*.svg has a numeric viewBox", () => {
    const files = readdirSync(doodleDir).filter((file) => file.endsWith(".svg"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const view = /<svg [^>]*viewBox="([^"]+)"/.exec(read(file))?.[1].split(" ").map(Number) ?? [];
      expect(view, file).toHaveLength(4);
      expect(view.every(Number.isFinite) && view[2] > 0 && view[3] > 0, file).toBe(true);
    }
  });
});
