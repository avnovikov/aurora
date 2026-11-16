import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GENERATED_DOODLES } from "../../src/data/generated/doodleMap";
import { renderDoodleSvg } from "../../src/doodles/renderSvg";
import { DOODLE_SPECS } from "../../src/doodles/specs";

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

  it("committed files carry the current fit (re-run npm run doodles)", () => {
    for (const spec of DOODLE_SPECS) {
      const file = GENERATED_DOODLES[spec.id].replace("/doodles/", "");
      expect(read(file) === renderDoodleSvg(spec), file).toBe(true);
    }
  });
});
