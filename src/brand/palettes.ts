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
    meaning: "The Vedic goddess of dawn. Fluorescent orange page, plum-black type, violet accent (mid-90s Electric Word pages).",
    colors: {
      background: "#ff6a1a",
      surface: "#ff8a45",
      foreground: "#1f0a14",
      muted: "#4a1608",
      accent: "#3a1270",
      onAccent: "#ffffff",
      alert: "#5c0030",
      edge: "#e05200",
      controlEdge: "#6a1e00",
    },
  },
  {
    key: "revontulet",
    label: "Revontulet",
    language: "Finnish",
    meaning: "Northern lights, literally fox fires. Lime page, black type, web blue accent (1995 wired.com archive pages).",
    colors: {
      background: "#99ff33",
      surface: "#c2ff80",
      foreground: "#000000",
      muted: "#2b4a0a",
      accent: "#0033cc",
      onAccent: "#ffffff",
      alert: "#a3001b",
      edge: "#7ad61f",
      controlEdge: "#3d6b0f",
    },
  },
  {
    key: "fajr",
    label: "Fajr",
    language: "Arabic",
    meaning: "First light before sunrise, while the sky is still violet. Violet column, white type, fluorescent orange accent (Tired/Wired pages).",
    colors: {
      background: "#5b2a86",
      surface: "#4c2073",
      foreground: "#ffffff",
      muted: "#e6d4f5",
      accent: "#ff9a3d",
      onAccent: "#1f0a14",
      alert: "#ff9ad2",
      edge: "#7a4aa8",
      controlEdge: "#c7a8e6",
    },
  },
  {
    key: "eos",
    label: "Eos",
    language: "Greek",
    meaning: "The rosy-fingered dawn goddess. Warm paper, fluorescent magenta accent (mid-90s front-of-book pages).",
    colors: {
      background: "#fbf6ee",
      surface: "#ffffff",
      foreground: "#1a0f14",
      muted: "#6b5560",
      accent: "#d0006f",
      onAccent: "#ffffff",
      alert: "#b33a00",
      edge: "#f2d2de",
      controlEdge: "#8a6f7a",
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
