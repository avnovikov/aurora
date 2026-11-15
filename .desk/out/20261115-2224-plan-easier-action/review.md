# Review: Aurora Plan screen, Easier on every exercise row

App screen, phone 390px. Source `source.html` (the signed-off `20261115-2201-plan-not-for-me/final.html`). Revised: `final.html`. Edit source: `work.html` (fonts and doodles linked; `build.mjs inline` makes final.html).

## Scores (Creative Director)

| Axis | Before | After |
|---|---|---|
| Hierarchy | 8 | 9 |
| Typography | 8 | 9 |
| Spacing | 8 | 9 |
| Colour | 7 | 9 |
| Composition | 6 | 8 |
| Originality | 7 | 8 |
| Brand | 6 | 9 |
| Copy | 6 | 9 |
| **Average** | **7.0** (under bar) | **8.8** (pass) |

## Notes applied (round 1, `.desk/jobs/20261115-2224-plan-easier-action/notes-round-1.md`)

1. **Composition, copy.** I added `<button class="plan-ex-easier" aria-label="Easier: <exercise>, <day>">Easier</button>` after Swap on all 28 rows. Its name copies the Swap name, qualifiers included.
2. **Composition.** Each row now has two lines:
   - The name and dose span the full 316px, so every name stays on one line.
   - Below them, Swap and Easier sit as an equal pair, each 80 × 44 and bordered like Swap, never accent.
   - ⋯ sits alone at the right end of the action line.
   - DOM and focus order match what you see.
3. **Spacing, undo state.** The undo state keeps the signed-off two-column layout: status on the left, Undo 116 × 44 on the right.
4. **Doodle.** The doodle figure sits on grid row 3, 12px under the actions. It is full width, `width:100%; height:auto`, with no max-height, object-fit or negative margin. All six check doodles are whole.
5. **Brand, colour.** The Ushas, Revontulet, Fajr and Eos blocks now use the values in the current `.desk/DESIGN.md`. Rassvet and Alvorada already matched.

## Accessibility (`findings-a11y.md`)
- **Major, fixed (4.1.2 / 2.4.6):** the Easier names are unique because they keep the "(Hollow)" and "(Hollow finish)" qualifiers.
- **Fixed (1.4.4):** Swap and Easier are `min-width:80px; width:auto`, so the label never overflows when text is enlarged.
- **Fixed (2.4.3):** moving ⋯ onto the action line puts focus order in step with what you see.
- **Open, minor (4.1.2):** Swap keeps `aria-pressed="false"` from the signed-off file, though nothing toggles it. Remove it unless Swap is a real toggle in the app.
- **Open, minor (4.1.2):** `aria-expanded` sits on rows that have no doodle to expand. This predates the change.

## Copy (`findings-copy.md`)
No changes. Noted but locked: "Single-Leg Romanian Deadlift" and "Sliding Leg Curl" are in Title Case, and the hint uses a straight apostrophe in "night's".

## Proof
- **Round 0:** 1 flag, the known 1.0:1 false positive on transparent buttons.
- **Round 1:** passed with 0 failures.
- **Renders:** under `.desk/jobs/20261115-2224-plan-easier-action/renders/round-{0,1}/`. They cover the full page, the menu and undo states, six doodles and five palettes.
- **Verified:**
  - 28 Easier buttons.
  - All visible text other than "Easier" is identical to the signed-off file.
  - No Inter.
  - No hex outside the palette lines.
