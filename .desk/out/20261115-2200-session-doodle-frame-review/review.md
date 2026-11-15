# Review: Aurora Session screen, doodle placement

Input `.desk/out/20261115-2140-session-screen-redesign/final-plex.html` (copied to `source.html`, not edited). Standard: app screen (job-local, `.desk/jobs/20261115-2200-session-doodle-frame-review/standard.md`). Size: phone 390x844. Revised file: `final.html` (built from `final.src.html` + `.desk/fonts/fonts-plex.css` + six doodles from `public/doodles/`).

## Scores

| | Hierarchy | Type | Spacing | Colour | Composition | Originality | Brand | Copy | Avg | Pass |
|---|---|---|---|---|---|---|---|---|---|---|
| Before | 8 | 8 | 7 | 9 | 5 | 7 | 8 | 9 | 7.6 | no |
| After round 1 | 9 | 8 | 8 | 9 | 8 | 8 | 9 | 9 | 8.5 | yes |

## Notes (Art Director, applied in round 1)

1. Composition: delete `.split` and `.stage`; hero is label, h1, dose, then `<div class="frame">` full width under the dose. The doodle no longer shares a row with 59s.
2. Composition: `.doodle{width:100%;height:auto;max-width:100%;margin:0}`, no fixed height, no negative margins, no overflow crop. `.frame{margin:24px 0 0;color:var(--foreground);--doodle-head:var(--background)}`, no box. `.dose` margin 24px top; `.fig` stays 95px for arm's length; `.read` top padding 32px.
3. Brand: `html data-pose="toy-soldiers"` plus six `html[data-pose=x] .doodle[data-pose=x]{display:block}` rules; mock-only pose select.
4. Brand: palette blocks keyed `:root, html[data-palette="rassvet"]` and `html[data-palette="…"]`, DESIGN.md values unchanged.
5. Typography: stacks `"IBM Plex Sans",sans-serif` and `"IBM Plex Sans Condensed",sans-serif`; Plex inlined; "Inter" appears nowhere in the file.
6. Typography (Creative Director): unit "s" in `--muted`, so the accent is on 59 only.

## Accessibility (applied)

- 2.2.2: SMIL doodles pause at frame 0 under `prefers-reduced-motion` (script). A visible Pause control is **not** added; that needs the app owner's call (open).
- 4.1.3: `.pulse` is `role="status"`; Strap sim buttons wired, closing the disclosure and returning focus to its summary (2.4.3).
- 1.3.1: dose reads "general 59 seconds" (dot and "s" `aria-hidden`, hidden "seconds"); rail `role="list"`, redundant `title`s dropped; "Pay attention to" is an `h2`; mock controls in `<aside aria-label="Mock controls">`.
- 2.4.11: `scroll-padding-bottom:96px` for the sticky bar. 2.4.2: title "Aurora · Session · Toy soldiers".
- Each doodle names itself (`role="img"`, "Doodle for <pose>"); hidden poses use `display:none` only.

## Copy

No changes in the mock: every string is signed off. For the app's copy: "Warmup" vs "warm-up"/"Cool-down", "Pulse ok" → "Pulse OK", "Controlled, build…" → "Stay controlled, build…", "Raise: temperature" is unclear, citations may want "et al.". New mock label: "Mock only · pose (doodle only)".

## Proof

- Before: pass.
- Round 1, six poses + five palettes + active-hang in all six palettes: no layout or clipping failures; Plex detected (font check passes). Flags left, all classified:
  - Contrast on cue list / citation in full-page captures: the sticky Pulse bar drawn over content below 844px (capture artefact; static-bar render passes).
  - "Pulse lost" contrast in Revontulet, Fajr, Eos: button inside the closed Strap `<details>` (known false positive).
  - Doodle artwork labels: "wrists" (wrist rocks) just under 12px, "shoulders down" (active hang) 2.8:1 in Alvorada and Eos. Inside the SVG art; out of scope.

## Open

- Creative Director round-1 notes not applied, because they conflict with the doodle rule (`width:100%; height:auto`, aspect from the viewBox): a fixed 212px frame so text doesn't move 65px between 1.6:1 and 2.37:1 poses; left-aligning narrow figures; tighter dose-to-figure gap (most of it is whitespace inside the viewBoxes); 4px "59"–"s" gap.
- Doodle set: tighten viewBoxes (toy soldiers has headroom; wall handstand reads as a sliver), enlarge and recolour lens labels for light palettes.
- Visible Pause motion control (WCAG 2.2.2) on the real screen.

Renders: `renders/` here (before, after full-length, each pose); all proofs in `.desk/jobs/20261115-2200-session-doodle-frame-review/renders/`.
