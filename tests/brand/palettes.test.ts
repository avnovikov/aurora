import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COLOUR_ROLES,
  DEFAULT_PALETTE,
  PALETTES,
  PALETTE_KEYS,
  applyPalette,
  heartRateVariable,
  isPaletteKey,
  paletteFor,
  roleVariable,
} from "../../src/brand/palettes";
import { HEART_RATE_ZONES } from "../../src/pulse/hrZones";

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

/** Reads `palettes:` from docs/design/DESIGN.md front matter (two-space YAML, string values only). */
function designPalettes(): Record<string, Record<string, unknown>> {
  const text = readFileSync(new URL("../../docs/design/DESIGN.md", import.meta.url), "utf8");
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

  it("copies the values from docs/design/DESIGN.md exactly", () => {
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

  it("applies the 90s-print-derived palettes", () => {
    const fake = fakeDocument();
    applyPalette("ushas", fake.doc);
    expect(fake.vars["--background"]).toBe("#ff6a1a");
    expect(fake.vars["--foreground"]).toBe("#1f0a14");
    expect(fake.vars["--accent"]).toBe("#3a1270");
    expect(fake.meta?.content).toBe("#ff6a1a");
    applyPalette("revontulet", fake.doc);
    expect(fake.vars["--background"]).toBe("#99ff33");
    expect(fake.vars["--accent"]).toBe("#0033cc");
    applyPalette("fajr", fake.doc);
    expect(fake.vars["--background"]).toBe("#5b2a86");
    expect(fake.vars["--accent"]).toBe("#ff9a3d");
    applyPalette("eos", fake.doc);
    expect(fake.vars["--background"]).toBe("#fbf6ee");
    expect(fake.vars["--accent"]).toBe("#d0006f");
  });

  it("works without a theme-color meta", () => {
    const fake = fakeDocument(false);
    expect(() => applyPalette("ushas", fake.doc)).not.toThrow();
    expect(fake.attrs["data-palette"]).toBe("ushas");
  });
});

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.04045) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("heart-rate zone colours", () => {
  it("gives every palette a readable colour for each of the five bands", () => {
    for (const palette of PALETTES) {
      expect(Object.keys(palette.heartRate).sort()).toEqual([...HEART_RATE_ZONES].sort());
      for (const zone of HEART_RATE_ZONES) {
        const colour = palette.heartRate[zone];
        expect(colour).toMatch(/^#[0-9a-f]{6}$/);
        expect(contrast(colour, palette.colors.surface), `${palette.key} ${zone}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("publishes the colours as --hr-* variables when the palette is applied", () => {
    const fake = fakeDocument();
    applyPalette("ushas", fake.doc);
    const ushas = paletteFor("ushas");
    for (const zone of HEART_RATE_ZONES) {
      expect(fake.vars[heartRateVariable(zone)]).toBe(ushas.heartRate[zone]);
    }
  });
});

describe("style.css color-scheme", () => {
  it("marks exactly the light-background palettes as color-scheme light", () => {
    const css = readFileSync(new URL("../../src/style.css", import.meta.url), "utf8");
    const marked = [...css.matchAll(/:root\[data-palette="(\w+)"\]/g)].map((m) => m[1]).sort();
    const light = PALETTES.filter((p) => luminance(p.colors.background) > 0.18)
      .map((p) => p.key)
      .sort();
    expect(light).toEqual(["alvorada", "eos", "revontulet", "ushas"]);
    expect(marked).toEqual(light);
  });
});
