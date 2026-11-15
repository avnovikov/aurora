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

A private morning training coach. You write the week as slots; the app picks exercise and dose from sleep, pulse, load, missed reps and stalls.

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
