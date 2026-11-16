# Art Director notes: Progress, session working set, Settings

Job 20261116-1015-progress-session-settings-review. Judged from the four renders (390 wide, Rassvet). Every fix uses colour roles only, so it holds in all six palettes. No note adds a rep, hold or load the planner did not produce.

## Progress (`renders/progress.png`)

1. **Colour.** About twenty items on the page are in the accent: the h1, five target titles, the start, now and target chips, and five current-move names. Nothing reads first. Keep the accent only on `.exercise-current` (the move you are on). In `src/style.css` add `.progress-shell h1 { color: var(--foreground); }`. Set `.chain-title` to `color: var(--foreground);`. Set `.path-step.path-start, .path-step.path-now` to `color: var(--foreground); border-color: var(--controlEdge);`. Set `.path-step.path-target` to `color: var(--foreground); border-color: var(--foreground);` and keep `font-weight: 600`.

2. **Copy / hierarchy.** The Pull-up card says "Target reached" and then "Intermediate level · 0 of 2 sessions at the standard to move up". The two lines contradict each other, and the second is a progress count toward a target the athlete has already met. In `src/progress/chainMap.ts` (the `reason` at line ~252), when the card's steps to target is 0, return `${tierNote}target reached` instead of the sessions count. Do not show a count toward the "Beyond" move.

3. **Typography.** The target name (`.chain-title`: 1rem, uppercase, 0.08em tracking) is smaller than the current move under it (`.exercise-current`: 1.15rem). Read top to bottom, the order is backwards. In `src/style.css` set `.chain-title { font-size: 1.25rem; text-transform: none; letter-spacing: 0; margin: 0 0 4px; }`. Set `.exercise-current` to `font-size: 1rem;`.

4. **Brand fit.** `.exercise-block` uses `background: linear-gradient(...)`, and DESIGN.md bans gradients. In `src/style.css` change it to `background: var(--surface); border-left: 2px solid var(--foreground);`. Panels then read as surface, the same way in light palettes (Alvorada, Eos) and loud ones (Ushas, Revontulet).

5. **Colour / contrast.** The "NEXT", "THEN" and "BEYOND" labels use `--muted-dim` at 0.7rem. That is under the 4.5:1 text rule and below the 12px floor. In `src/style.css` set `.exercise-next-label { color: var(--muted); font-size: 0.75rem; }`.

6. **Copy.** Move names mix title case and sentence case: "Dragon Squat", "Pike Hold (Floor)", "Pike Push-Up", "Press to Handstand", "Ring Muscle-Up" sit next to "Pull-up" and "Box squat". Change the display names in the exercise data (`src/data/`, the source for `EXERCISE_GRAPH`) to sentence case: "Dragon squat", "Pike hold (floor)", "Pike push-up", "Press to handstand", "Ring muscle-up".

## Session working set (`renders/session-work.png`)

7. **Hierarchy.** "Log set" is an outline button with accent text, and the 12 above it uses the same accent. The figure and the action compete, and the action reads as secondary. Keep the accent on the dose figure. Make the action a solid block: in `src/styles/session.css` set `.session-bar .work-actions .cta { background: var(--foreground); color: var(--background); border-color: var(--foreground); }`.

8. **Colour.** "Stop with 3 reps in the tank" (`.dose-note`) is a third accent element on the screen. In `src/style.css` set `.dose-note { color: var(--foreground); text-align: left; }` so it lines up with the left edge of "Add weight" and the title. Keep the text exactly as the rule gives it.

9. **Composition.** The + stepper stops at about x=314, while the content edge is x=366, so the dose row is lopsided against the full-width timer bar above it. In `src/styles/session.css` add `justify-content: space-between;` to `.session-dose.work-reps-row` so the minus and plus buttons sit on the two content edges.

## Settings (`renders/settings-you.png`, `renders/settings-gear.png`)

10. **Copy / state.** The Gear tab shows "Saved." in the accent while the field holds 0 under the alert "Enter a weight from 0.5 to 100 kg." The screen says two opposite things. In `src/ui/settingsView.ts`, clear `[data-settings-status]` on every event that paints the error (the `input` path as well as `change`). Call `commit()` only after a valid value.

11. **Colour.** The "Your setup" h1, the selected tab label, its underline and every checked chip are all accent, so the accent does not point at anything. In `src/style.css` add `.settings h1 { color: var(--foreground); }`. Set `.settings-tab.selected { color: var(--foreground); border-bottom-color: var(--accent); }`, which leaves the underline as the one accent mark. Checked chips keep their tint and tick.

12. **Copy / spacing.** "YOUR WEIGHT" / "Weight you own (kg)" on Gear is easy to confuse with "Bodyweight (kg)" on You. Rename them in `src/ui/settingsPage.ts`: eyebrow "Added weight", label "Weight you can add (kg)". Also give the status line some space: `.settings-status { margin: 8px 0 8px; }`, since "Saved." currently sits 4px under the tab rule and touches the eyebrow.

## What already works

The session screen has a clear spine: the timer, then the move, then one big figure, with every control at 48px or more in the bottom bar. Settings tabs at 48px and full-word equipment chips with a tick read well one-handed.
Progress status lines are now in plain British words, the "Beyond" label is honest, and the error copy gives the exact valid range.
