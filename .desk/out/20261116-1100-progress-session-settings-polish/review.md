# Review --fix: Progress, working set, Settings (You, Gear)

App screens, phone 390px. Sources: snapshots of the live app (`progress.html`, `session-work.html`, `settings-you.html`, `settings-gear.html` in this folder, as polished). Desks: Art Director (Opus), UI Designer (Sonnet), Creative Director (Opus). Earlier pass with Accessibility and Copy Editor: `../20261116-1015-progress-session-settings-review/`.

## Scores (Creative Director, averages)

| Screen | Before (earlier pass) | Round 1 | Round 2 |
|---|---|---|---|
| Progress | 6.0 | 8.3, send back | **8.6, pass** |
| Working set | 7.0 | 8.5, pass | **8.8, pass** |
| Settings, You | 6.6 | 8.8, pass | **8.8, pass** |
| Settings, Gear | 6.6 | 8.5, pass | **8.8, pass** |

Same scores in Rassvet, Alvorada and Ushas.

## Proof
46 failures in round 0 (type off the 1.25 scale), 3 after round 1, 1 after round 2. The one left is text scrolled under the sticky Log set bar at the 844px fold (the checker reads the bar's pixels), judged not a fault by the Creative Director.

## What changed (ported into `src/`)
- All screens: eyebrows and tab-bar labels 12.8px; tab bar 56px on surface, current tab in foreground with a 2px top bar (not colour alone); body taglines 16/24; h1 39/44, h2 25/32; session small text 12.8px.
- Progress: the ladder as a sequence with decorative arrows, the current step underlined, the target bold; target name 25px above the accent move; PB in foreground at 16px; 40px between targets, no rules.
- Working set: dose note 16px; doodle compact and centred; bar padding aligned to the content edge; "Pulse: no reading"; hint "Log each set below, or swipe to finish this exercise" (the swipe finishes the exercise, so the reviewer's "move between sets" was corrected).
- Settings: selected chips in foreground with a 2px border (accent kept for the page); injury questions as labelled groups ("Which knee", "What happened"); 44px chips, 48px inputs; Gear helper "Sessions offer it on moves that take load."

## Open, for the owner
- Page h1 in the accent next to the accent tab underline on Settings (app-wide style).
- Doodle assets drawn off-centre in their viewBox (worked around by centring the image).
- Exercise names' casing and Pull-up under two targets (data).
- Cost: not recorded; the desks ran as ordinary agents, so the plugin's usage hooks did not fire.
