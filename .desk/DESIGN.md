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
    meaning: "The Vedic goddess of dawn. Fluorescent orange on black."
    colors:
      background: "#0a0a0a"
      surface: "#161616"
      foreground: "#f5f5f0"
      muted: "#a3a3a3"
      accent: "#ff6a13"
      onAccent: "#0a0a0a"
      alert: "#ff2d95"
      edge: "#2c2c2c"
      controlEdge: "#6b6b6b"
  revontulet:
    label: "Revontulet"
    language: "Finnish"
    meaning: "Northern lights, literally fox fires. Full-bleed fluorescent lime."
    colors:
      background: "#ccff00"
      surface: "#e0ff66"
      foreground: "#0a0a0a"
      muted: "#3d4a00"
      accent: "#0a0a0a"
      onAccent: "#ccff00"
      alert: "#c4006a"
      edge: "#9fc700"
      controlEdge: "#4d5c00"
  fajr:
    label: "Fajr"
    language: "Arabic"
    meaning: "First light before sunrise, while the sky is still violet. Cyan on deep purple."
    colors:
      background: "#1e0b4b"
      surface: "#2b1466"
      foreground: "#f3efff"
      muted: "#b3a6e0"
      accent: "#00e5ff"
      onAccent: "#1e0b4b"
      alert: "#ff5c39"
      edge: "#3f2785"
      controlEdge: "#8a78c9"
  eos:
    label: "Eos"
    language: "Greek"
    meaning: "The dawn goddess. Cool metallic silver with electric blue."
    colors:
      background: "#c8cacd"
      surface: "#dfe1e3"
      foreground: "#0b0b0c"
      muted: "#45474b"
      accent: "#0033cc"
      onAccent: "#ffffff"
      alert: "#9e0b22"
      edge: "#a9acb0"
      controlEdge: "#5c5f64"
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
  - "Extra palettes: inspired by early-1990s fluorescent and metallic magazine print; all values chosen for screen and contrast-checked"
---

# Aurora · Rassvet

A private morning training coach. You write the week as slots; the app picks exercise and dose from sleep, pulse, load, missed reps and stalls.

## Voice

Measured, plain, British. Example: "Morning training — measured, not motivated."

## Palettes

Six palettes share one set of roles. `colors` above is Rassvet, the default, and is what proof checks unless a job names another palette. The user picks a palette in Settings.

| Key | Name | Language | Meaning |
|---|---|---|---|
| rassvet | Rassvet | Russian | Dawn; brass on near-black (default) |
| alvorada | Alvorada | Portuguese | Daybreak; ink on paper (light) |
| ushas | Ushas | Sanskrit | Dawn goddess; fluorescent orange on black |
| revontulet | Revontulet | Finnish | Northern lights; fluorescent lime |
| fajr | Fajr | Arabic | Pre-sunrise violet; cyan on purple |
| eos | Eos | Greek | Dawn goddess; silver and electric blue |

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

## Type

IBM Plex Sans for body text and IBM Plex Sans Condensed for headings and big numbers. Both are bundled with the app (no network font loading; the APK must work offline). Sizes come from the scale: base 16, ratio 1.25, nothing below 12px.

## Spacing

A 4px grid. Radius 4 on controls and panels; nothing pill-shaped.

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
