---
name: "Aurora"
colors:
  background: "#070708"
  surface: "#121214"
  foreground: "#e8e8ea"
  muted: "#9a9a9e"
  accent: "#c4a574"
  onAccent: "#070708"
  alert: "#e15a4a"
  edge: "#2a2a2e"
  controlEdge: "#636369"
palettes:
  rassvet:
    label: "Rassvet"
    language: "Russian"
    meaning: "Dawn. The soul mark; brass on near-black."
    default: true
    colors:
      background: "#070708"
      surface: "#121214"
      foreground: "#e8e8ea"
      muted: "#9a9a9e"
      accent: "#c4a574"
      onAccent: "#070708"
      alert: "#e15a4a"
      edge: "#2a2a2e"
      controlEdge: "#636369"
  alvorada:
    label: "Alvorada"
    language: "Portuguese"
    meaning: "Daybreak. Full morning light; ink on paper."
    colors:
      background: "#f4f1ea"
      surface: "#ffffff"
      foreground: "#161514"
      muted: "#5f5b55"
      accent: "#8a6420"
      onAccent: "#ffffff"
      alert: "#b3261e"
      edge: "#dcd6ca"
      controlEdge: "#8a847a"
  ushas:
    label: "Ushas"
    language: "Sanskrit"
    meaning: "The Vedic goddess of dawn. Fluorescent orange page, plum-black type, violet accent."
    colors:
      background: "#ff6a1a"
      surface: "#ff8a45"
      foreground: "#1f0a14"
      muted: "#4a1608"
      accent: "#3a1270"
      onAccent: "#ffffff"
      alert: "#5c0030"
      edge: "#e05200"
      controlEdge: "#6a1e00"
  revontulet:
    label: "Revontulet"
    language: "Finnish"
    meaning: "Northern lights, literally fox fires. Lime page, black type, web blue accent."
    colors:
      background: "#99ff33"
      surface: "#c2ff80"
      foreground: "#000000"
      muted: "#2b4a0a"
      accent: "#0033cc"
      onAccent: "#ffffff"
      alert: "#a3001b"
      edge: "#7ad61f"
      controlEdge: "#3d6b0f"
  fajr:
    label: "Fajr"
    language: "Arabic"
    meaning: "First light before sunrise, while the sky is still violet. Violet column, white type, fluorescent orange accent."
    colors:
      background: "#5b2a86"
      surface: "#4c2073"
      foreground: "#ffffff"
      muted: "#e6d4f5"
      accent: "#ff9a3d"
      onAccent: "#1f0a14"
      alert: "#ff9ad2"
      edge: "#7a4aa8"
      controlEdge: "#c7a8e6"
  eos:
    label: "Eos"
    language: "Greek"
    meaning: "The rosy-fingered dawn goddess. Warm paper, fluorescent magenta accent."
    colors:
      background: "#fbf6ee"
      surface: "#ffffff"
      foreground: "#1a0f14"
      muted: "#6b5560"
      accent: "#d0006f"
      onAccent: "#ffffff"
      alert: "#b33a00"
      edge: "#f2d2de"
      controlEdge: "#8a6f7a"
type:
  family: "IBM Plex Sans"
  headingFamily: "IBM Plex Sans Condensed"
  headingWeight: 600
  bodyWeight: 400
  base: 16
  ratio: 1.25
  minSize: 12
spacing:
  unit: 4
  radius: 4
logo:
  path: null
  clearSpace: "0.5x height"
  note: "No mark yet. public/favicon.svg is still the Vite default; a Rassvet mark is outstanding."
platform:
  target: "Android phone (Capacitor APK), optional Chrome PWA"
  width: "28rem column, one-handed"
  locale: "en-GB"
sources:
  - "src/style.css (:root custom properties, font stacks, sizes, spacing)"
  - "src/brand/identity.ts (names, tagline, about line)"
  - "README.md (product description, British English)"
  - "index.html (theme-color #070708)"
  - "Extra palettes: sampled from mid-1990s WIRED inside pages (Electric Word, Tired/Wired) and the 1995 wired.com archive pages (Internet Archive scans and Wayback captures); brightened for screen and contrast-checked"
---

# Aurora · Rassvet

Private calisthenics training. You set who you are and what to train; the app keeps a plan queue and picks exercise and dose from sleep, pulse, load, missed reps and stalls.

## Voice

Measured, plain, British. Example: "Morning training — measured, not motivated."

## Palettes

Six palettes share one set of roles. `colors` above is Rassvet, the default, and is what proof checks unless a job names another palette. The user picks a palette in Settings.

| Key | Name | Language | Meaning |
|---|---|---|---|
| rassvet | Rassvet | Russian | Dawn; brass on near-black (default) |
| alvorada | Alvorada | Portuguese | Daybreak; ink on paper (light) |
| ushas | Ushas | Sanskrit | Dawn goddess; fluorescent orange page, violet accent |
| revontulet | Revontulet | Finnish | Northern lights; lime page, web blue accent |
| fajr | Fajr | Arabic | Pre-sunrise violet; white type, fluorescent orange accent |
| eos | Eos | Greek | Rosy-fingered dawn; warm paper, fluorescent magenta |

Roles:

- **background**: the page.
- **surface**: panels and cards on the page.
- **foreground**: body text and headings.
- **muted**: secondary text, labels, units.
- **accent**: the one thing to do or read next.
- **onAccent**: text and icons on an accent fill.
- **alert**: loss, warning, a missed or lost reading.
- **edge**: dividers and panel borders (decorative).
- **controlEdge**: borders of interactive controls.

Every pair used for text meets 4.5:1, and controlEdge meets 3:1 on both background and surface, in every palette.

### Draft palettes (not shipped)

Two candidates (issue #280). They are kept out of the front matter until they ship, because the palette tests require the front matter to match `src/brand/palettes.ts` exactly. To ship one, move its block into `palettes:` and copy it to `palettes.ts`. Research and the contrast script are in `docs/working/2026-11-21-zorya-shachar-palettes/`.

| Key | Name | Language | Meaning |
|---|---|---|---|
| zorya | Zorya | Ukrainian | Зоря, the dawn star and the Slavic dawn goddess. Sky-blue page, white type, sunflower accent. |
| shachar | Shachar | Hebrew | שחר, dawn. Pastel apricot page, ink type, tekhelet blue accent. |

Zorya is the loud one: a saturated page like Ushas, Revontulet and Fajr, and the first with a blue page. Shachar is the first pastel page. It works the way a screened fluorescent ink prints, a light tint that still glows, and it sits between Alvorada's paper and Ushas's orange.

| Role | Zorya | Shachar |
|---|---|---|
| background | `#0057b7` | `#ffd9c7` |
| surface | `#004a9c` | `#ffe9de` |
| foreground | `#ffffff` | `#1a0f14` |
| muted | `#d6e6ff` | `#5c4038` |
| accent | `#ffd500` | `#1f4fa3` |
| onAccent | `#0b1a33` | `#ffffff` |
| alert | `#ffccd5` | `#a3001b` |
| edge | `#2a74c9` | `#f2bfa8` |
| controlEdge | `#9fc3f0` | `#8a6a5e` |
| hr easy | `#bfe0ff` | `#1a4f8b` |
| hr steady | `#a8f0c0` | `#146c3e` |
| hr work | `#ffd500` | `#7a4a00` |
| hr hard | `#ffb15a` | `#a33b00` |
| hr max | `#ffb0dc` | `#9a0058` |

Lowest measured contrast. Zorya: accent on background 4.85:1, alert on background 4.87:1, hard band on surface 4.75:1, controlEdge on background 3.79:1. Shachar: steady band on surface 5.54:1, accent on background 5.91:1, controlEdge on background 3.72:1. Zorya is a dark palette and Shachar a light one, for `color-scheme`.

## Type

IBM Plex Sans for body text and IBM Plex Sans Condensed for headings and big numbers. Both are bundled with the app (no network font loading; the APK must work offline). Sizes come from the scale: base 16, ratio 1.25, nothing below 12px.

## Spacing

A 4px grid. Radius 4 on controls and panels; nothing pill-shaped.

## Exercise names

Show every exercise name in sentence case: "Hollow body hold", not "Hollow Body Hold". Three kinds of word keep their capitals:

- Proper nouns: Bulgarian, Romanian, Nordic, Copenhagen, Cossack, Russian, Jefferson, Spiderman and the rest of the list in `src/library/displayName.ts`.
- Letter shapes: the single capital in L-sit, V-up, W-raise, Y-T-W.
- Abbreviations: TRX, IT band, CARs.

`displayExerciseName` applies this at display time. Stored names, ids and anything the planner reads stay as the library has them.

## Do

- Use the accent once per screen, on the next action or the key number.
- Keep alert for loss or warning only.
- Take every colour from a role. A screen must work in all six palettes without changes.
- Design for one hand on a phone: primary actions in the lower half, targets at least 44px.
- Write British English.
- Show doses exactly as the coaching rules give them.

## Don't

- Hard-code a hex colour in a component.
- Use motivational copy, emoji, confetti or celebration effects.
- Use gradients, except the existing faint dot texture on the page.
- Invent, round or hint at reps, holds or loads that the rules did not produce.
- Use the name, logo or branding of any magazine or publication the palettes were inspired by.
