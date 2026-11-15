# Desk design foundation

Date: 2026-11-15
Branch: `feature/desk-design-foundation`

## Goal

Give the Desk Studio plugin (`desk@deskstudio`) a brand file and project settings for Aurora, so later redesign jobs (`/desk:design-review --fix`, `/desk:design-system`) refine the current identity instead of guessing. Add six named, user-selectable palettes so the app is no longer dark-only.

## Decisions

- **Direction: refine, don't replace.** Keep the dark, quiet, brass-accent identity and the voice "measured, not motivated". The redesign improves hierarchy, layout and consistency inside it.
- **Target system, not a snapshot.** DESIGN.md states where the CSS should end up, not what it is today. Today's CSS has 12 font sizes, uneven rem spacing and about 15 hard-coded hex values; proof checks against the target.
- **Six palettes, one set of roles.** Every palette fills the same nine roles: background, surface, foreground, muted, accent, onAccent, alert, edge, controlEdge. `onAccent` is new because the Revontulet and Eos accents need a specific text colour.
- **Palette names are words for dawn or the aurora**, written in English letters:

  | Key | Name | Language | Look |
  |---|---|---|---|
  | rassvet | Rassvet | Russian | Default. Brass on near-black (today's look) |
  | alvorada | Alvorada | Portuguese | Light. Ink on paper |
  | ushas | Ushas | Sanskrit | Fluorescent orange on black |
  | revontulet | Revontulet | Finnish | Full-bleed fluorescent lime, black ink |
  | fajr | Fajr | Arabic | Cyan on deep purple |
  | eos | Eos | Greek | Silver with electric blue |

- **The fluorescent and metallic palettes are inspired by early-1990s magazine print.** The values are screen approximations; fluorescent inks are outside sRGB. The app never uses any publication's name or branding.
- **Proof checks against Rassvet by default.** The plugin's palette check flattens `colors:` into one list. Putting every palette there would let almost any pixel pass, so the other five live under `palettes:`. Proof ignores that section; the next plan uses it.
- **Type:** IBM Plex Sans (body) and IBM Plex Sans Condensed (headings, big numbers). Base 16, ratio 1.25, minimum 12px. Today neither font is actually loaded, so on Android the text falls back to Roboto.
- **Spacing:** 4px grid, radius 4.
- **Quality preset: `best`.** Fable directs, Opus roughs, Sonnet polishes.

## Contrast

Checked with the WCAG 2 formula. Every palette meets:

- foreground on background and on surface: at least 12:1
- muted on background and on surface: at least 5.7:1
- accent on background, and onAccent on accent: at least 4.7:1
- alert on background: at least 5.0:1. Eos's alert was darkened from `#c8102e` (3.6:1) to `#9e0b22` (5.1:1).
- controlEdge on background and on surface: at least 3.1:1

## Files

- `.desk/DESIGN.md`: front matter (colors, palettes, type, spacing, logo, platform, sources), voice, palette table, role definitions, Do and Don't rules.
- `.desk/project.json`: `best` preset, framework `vanilla-ts+vite`, constraints (platform, viewport, en-GB, palettes, bundled fonts, no invented dosing).
- `.desk/.gitignore`: ignores `jobs/`, `events.jsonl` and `dashboard.runtime.json`.

Verified: the plugin's own parser (`proof/brand.mjs` `readBrand`) reads the file. It finds 8 distinct default colours, the type settings and the 4px unit, and all six palettes parse with all nine roles.

## Out of scope (next plan)

1. Replace hard-coded colours in `src/style.css` with role custom properties (`--background`, `--accent` and so on).
2. Generate the palette CSS from one TypeScript source of truth, and add a Settings palette picker that shows label and meaning and saves the choice in the profile.
3. Update `<meta name="theme-color">` when the palette changes.
4. Bundle the IBM Plex Sans and IBM Plex Sans Condensed font files.
5. Replace the default Vite favicon with a Rassvet mark (`/desk:brand-kit`).
6. Run `/desk:design-review` on each main screen against DESIGN.md.
