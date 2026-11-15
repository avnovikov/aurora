import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../src/style.css", import.meta.url), "utf8");
const main = readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");

function rootBlock(): string {
  const match = /^:root\s*\{([\s\S]*?)^\}/m.exec(css);
  if (!match) throw new Error(":root block missing");
  return match[1];
}

describe("bundled IBM Plex fonts", () => {
  it("defines the body and display font variables on :root", () => {
    const root = rootBlock();
    expect(root).toContain('--font-body: "IBM Plex Sans", Roboto, sans-serif;');
    expect(root).toContain(
      '--font-display: "IBM Plex Sans Condensed", "Roboto Condensed", sans-serif;',
    );
    expect(root).toContain("font-family: var(--font-body);");
  });

  it("has no Arial Narrow / Helvetica Condensed / Impact stacks left", () => {
    expect(css).not.toMatch(/Arial Narrow|Helvetica Condensed|Impact/);
    expect(css).toMatch(/font-family: var\(--font-display\);/);
  });

  it("names the Plex families only through the variables", () => {
    const families = [...css.matchAll(/font-family: ([^;]+);/g)].map((m) => m[1].trim());
    for (const family of families) {
      expect(family).toMatch(/^var\(--font-(body|display)/);
    }
  });

  it("imports exactly the latin weights in use from fontsource", () => {
    const imports = [...main.matchAll(/import\s+"(@fontsource\/[^"]+)";/g)].map((m) => m[1]);
    expect(imports.sort()).toEqual(
      [
        "@fontsource/ibm-plex-sans-condensed/latin-500.css",
        "@fontsource/ibm-plex-sans-condensed/latin-600.css",
        "@fontsource/ibm-plex-sans-condensed/latin-700.css",
        "@fontsource/ibm-plex-sans/latin-400.css",
        "@fontsource/ibm-plex-sans/latin-500.css",
        "@fontsource/ibm-plex-sans/latin-600.css",
      ].sort(),
    );
  });

  it("does not load fonts from the network", () => {
    expect(css).not.toMatch(/fonts\.googleapis|fonts\.gstatic|@import\s+url\(/);
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    expect(html).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
  });
});
