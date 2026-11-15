/**
 * The six dawn palettes. Values are copied from `.desk/DESIGN.md` (front matter,
 * `palettes:`) and are already contrast-checked; change them there first.
 */

export const COLOUR_ROLES = [
  "background",
  "surface",
  "foreground",
  "muted",
  "accent",
  "onAccent",
  "alert",
  "edge",
  "controlEdge",
] as const;

export type ColourRole = (typeof COLOUR_ROLES)[number];

export const PALETTE_KEYS = ["rassvet", "alvorada", "ushas", "revontulet", "fajr", "eos"] as const;

export type PaletteKey = (typeof PALETTE_KEYS)[number];

export interface Palette {
  key: PaletteKey;
  label: string;
  language: string;
  meaning: string;
  colors: Record<ColourRole, string>;
}

export const DEFAULT_PALETTE: PaletteKey = "rassvet";

export const PALETTES: readonly Palette[] = [
  {
    key: "rassvet",
    label: "Rassvet",
    language: "Russian",
    meaning: "Dawn. The soul mark; brass on near-black.",
    colors: {
      background: "#070708",
      surface: "#121214",
      foreground: "#e8e8ea",
      muted: "#9a9a9e",
      accent: "#c4a574",
      onAccent: "#070708",
      alert: "#e15a4a",
      edge: "#2a2a2e",
      controlEdge: "#636369",
    },
  },
  {
    key: "alvorada",
    label: "Alvorada",
    language: "Portuguese",
    meaning: "Daybreak. Full morning light; ink on paper.",
    colors: {
      background: "#f4f1ea",
      surface: "#ffffff",
      foreground: "#161514",
      muted: "#5f5b55",
      accent: "#8a6420",
      onAccent: "#ffffff",
      alert: "#b3261e",
      edge: "#dcd6ca",
      controlEdge: "#8a847a",
    },
  },
  {
    key: "ushas",
    label: "Ushas",
    language: "Sanskrit",
    meaning: "The Vedic goddess of dawn. Fluorescent orange on black.",
    colors: {
      background: "#0a0a0a",
      surface: "#161616",
      foreground: "#f5f5f0",
      muted: "#a3a3a3",
      accent: "#ff6a13",
      onAccent: "#0a0a0a",
      alert: "#ff2d95",
      edge: "#2c2c2c",
      controlEdge: "#6b6b6b",
    },
  },
  {
    key: "revontulet",
    label: "Revontulet",
    language: "Finnish",
    meaning: "Northern lights, literally fox fires. Full-bleed fluorescent lime.",
    colors: {
      background: "#ccff00",
      surface: "#e0ff66",
      foreground: "#0a0a0a",
      muted: "#3d4a00",
      accent: "#0a0a0a",
      onAccent: "#ccff00",
      alert: "#c4006a",
      edge: "#9fc700",
      controlEdge: "#4d5c00",
    },
  },
  {
    key: "fajr",
    label: "Fajr",
    language: "Arabic",
    meaning: "First light before sunrise, while the sky is still violet. Cyan on deep purple.",
    colors: {
      background: "#1e0b4b",
      surface: "#2b1466",
      foreground: "#f3efff",
      muted: "#b3a6e0",
      accent: "#00e5ff",
      onAccent: "#1e0b4b",
      alert: "#ff5c39",
      edge: "#3f2785",
      controlEdge: "#8a78c9",
    },
  },
  {
    key: "eos",
    label: "Eos",
    language: "Greek",
    meaning: "The dawn goddess. Cool metallic silver with electric blue.",
    colors: {
      background: "#c8cacd",
      surface: "#dfe1e3",
      foreground: "#0b0b0c",
      muted: "#45474b",
      accent: "#0033cc",
      onAccent: "#ffffff",
      alert: "#9e0b22",
      edge: "#a9acb0",
      controlEdge: "#5c5f64",
    },
  },
];

export function isPaletteKey(value: unknown): value is PaletteKey {
  return typeof value === "string" && (PALETTE_KEYS as readonly string[]).includes(value);
}

/** The palette for `key`, or Rassvet when the key is unknown. */
export function paletteFor(key: unknown): Palette {
  const wanted = isPaletteKey(key) ? key : DEFAULT_PALETTE;
  return PALETTES.find((palette) => palette.key === wanted)!;
}

/** CSS custom property for a role: `onAccent` → `--on-accent`. */
export function roleVariable(role: ColourRole): string {
  return "--" + role.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
}

/**
 * Recolours the app: `data-palette` on `<html>`, the role custom properties,
 * and the browser/status-bar theme colour. Returns the key actually applied.
 */
export function applyPalette(key: unknown, doc: Document = document): PaletteKey {
  const palette = paletteFor(key);
  const html = doc.documentElement;
  html.setAttribute("data-palette", palette.key);
  for (const role of COLOUR_ROLES) {
    html.style.setProperty(roleVariable(role), palette.colors[role]);
  }
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = palette.colors.background;
  }
  return palette.key;
}
