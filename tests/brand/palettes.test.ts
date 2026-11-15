import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COLOUR_ROLES,
  DEFAULT_PALETTE,
  PALETTES,
  PALETTE_KEYS,
  applyPalette,
  isPaletteKey,
  paletteFor,
  roleVariable,
} from "../../src/brand/palettes";

const KEYS = ["rassvet", "alvorada", "ushas", "revontulet", "fajr", "eos"];
const ROLES = [
  "background",
  "surface",
  "foreground",
  "muted",
  "accent",
  "onAccent",
  "alert",
  "edge",
  "controlEdge",
];

/** Reads `palettes:` from .desk/DESIGN.md front matter (two-space YAML, string values only). */
function designPalettes(): Record<string, Record<string, unknown>> {
  const text = readFileSync(new URL("../../.desk/DESIGN.md", import.meta.url), "utf8");
  const front = text.split(/^---$/m)[1];
  const lines = front.split("\n");
  const start = lines.indexOf("palettes:");
  const out: Record<string, Record<string, unknown>> = {};
  let key = "";
  let inColours = false;
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const palette = /^ {2}(\w+):$/.exec(line);
    if (palette) {
      key = palette[1];
      out[key] = { colors: {} };
      inColours = false;
      continue;
    }
    if (/^ {4}colors:$/.test(line)) {
      inColours = true;
      continue;
    }
    const field = /^( {4,6})(\w+): (.+)$/.exec(line);
    if (!field) continue;
    const value = JSON.parse(field[3]) as unknown;
    if (inColours && field[1].length === 6) {
      (out[key].colors as Record<string, unknown>)[field[2]] = value;
    } else {
      out[key][field[2]] = value;
    }
  }
  return out;
}

interface FakeDoc {
  attrs: Record<string, string>;
  vars: Record<string, string>;
  meta: { content: string } | null;
  doc: Document;
}

function fakeDocument(withMeta = true): FakeDoc {
  const attrs: Record<string, string> = {};
  const vars: Record<string, string> = {};
  const meta = withMeta ? { content: "#000000" } : null;
  const doc = {
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attrs[name] = value;
      },
      style: {
        setProperty: (name: string, value: string) => {
          vars[name] = value;
        },
      },
    },
    querySelector: (selector: string) => (selector === 'meta[name="theme-color"]' ? meta : null),
  } as unknown as Document;
  return { attrs, vars, meta, doc };
}

describe("palettes", () => {
  it("has the six palettes in order, Rassvet first and default", () => {
    expect(PALETTE_KEYS).toEqual(KEYS);
    expect(PALETTES.map((p) => p.key)).toEqual(KEYS);
    expect(DEFAULT_PALETTE).toBe("rassvet");
  });

  it("gives every palette label, language, meaning and the nine roles", () => {
    expect([...COLOUR_ROLES]).toEqual(ROLES);
    for (const palette of PALETTES) {
      expect(palette.label).not.toBe("");
      expect(palette.language).not.toBe("");
      expect(palette.meaning).not.toBe("");
      expect(Object.keys(palette.colors).sort()).toEqual([...ROLES].sort());
      for (const value of Object.values(palette.colors)) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("copies the values from .desk/DESIGN.md exactly", () => {
    const design = designPalettes();
    expect(Object.keys(design)).toEqual(KEYS);
    for (const palette of PALETTES) {
      const source = design[palette.key];
      expect(palette.label).toBe(source.label);
      expect(palette.language).toBe(source.language);
      expect(palette.meaning).toBe(source.meaning);
      expect(palette.colors).toEqual(source.colors);
    }
  });

  it("maps camelCase roles to kebab-case CSS variables", () => {
    expect(roleVariable("onAccent")).toBe("--on-accent");
    expect(roleVariable("controlEdge")).toBe("--control-edge");
    expect(roleVariable("background")).toBe("--background");
  });

  it("recognises palette keys and falls back to Rassvet", () => {
    expect(isPaletteKey("fajr")).toBe(true);
    expect(isPaletteKey("neon")).toBe(false);
    expect(isPaletteKey(undefined)).toBe(false);
    expect(paletteFor("eos").key).toBe("eos");
    expect(paletteFor("neon").key).toBe("rassvet");
  });
});

describe("applyPalette", () => {
  it("sets data-palette, every role variable and theme-color", () => {
    const fake = fakeDocument();
    const applied = applyPalette("alvorada", fake.doc);
    expect(applied).toBe("alvorada");
    expect(fake.attrs["data-palette"]).toBe("alvorada");
    const alvorada = paletteFor("alvorada");
    expect(fake.vars["--background"]).toBe("#f4f1ea");
    expect(fake.vars["--accent"]).toBe("#8a6420");
    expect(fake.vars["--on-accent"]).toBe("#ffffff");
    for (const role of ROLES) {
      expect(fake.vars[roleVariable(role as (typeof COLOUR_ROLES)[number])]).toBe(
        alvorada.colors[role as (typeof COLOUR_ROLES)[number]],
      );
    }
    expect(fake.meta?.content).toBe("#f4f1ea");
  });

  it("falls back to Rassvet for unknown keys", () => {
    const fake = fakeDocument();
    expect(applyPalette("neon", fake.doc)).toBe("rassvet");
    expect(fake.attrs["data-palette"]).toBe("rassvet");
    expect(fake.vars["--background"]).toBe("#070708");
    expect(fake.meta?.content).toBe("#070708");
  });

  it("works without a theme-color meta", () => {
    const fake = fakeDocument(false);
    expect(() => applyPalette("ushas", fake.doc)).not.toThrow();
    expect(fake.attrs["data-palette"]).toBe("ushas");
  });
});
