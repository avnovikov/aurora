# Creative Director scores: progress, session, settings review

Job 20261116-1015-progress-session-settings-review. Scored from the four renders only (390×844 @2x, Rassvet). Bar: every axis 8 or above and an average of 8.5 or above.

---

## 1. Progress (renders/progress.png)

```
scores: hierarchy 6, typography 6, spacing 7, colour 5, composition 6, originality 6, brand 6, copy 6
average: 6.0
pass: no
notes:
- hierarchy: after "Toward your targets", five identical target blocks compete at the same weight. Nothing says which target is closest or which is today's. Promote the nearest target (1 step away, most recent session) to first place, with the step count at 40px Condensed 600, and render the other four as compact rows.
- typography: I count six text treatments (tracked caps eyebrow, tracked caps brass title, Condensed card title, body, small caps NEXT/THEN, chips at two weights). Drop the tracked caps on target titles: set them as Condensed 600 at 25px in sentence case, and keep tracked caps for the eyebrow only. Fix the "move / up" widow by cutting the status line to "Beginner · 0 of 2 sessions to move up".
- spacing: the status line sits 16px under the card but 32px above the divider, so it reads as the footer of the wrong block. Move it directly under the "N steps away" line, with 8px between, and keep 32px between blocks.
- colour: brass appears about 25 times (five target titles, five card titles, every PB, two chip states per path, the headline, the nav). The current chip and the target chip differ only by weight. Use brass for one thing per block, the next step chip and its PB. Set target titles and card titles in foreground, and mark the target chip with a foreground border plus a "target" label instead of bold brass.
- composition: each block nests a box inside a box (bordered chips above a panel with a brass rule), and the same Pull-up card appears twice (under Muscle-up and under Pull-up). Merge targets that share a path into one block and remove the duplicate card.
- originality: a stack of identical cards is the first layout anyone would make. Draw the path as one line of steps with the current step marked on it (the chips already hold the data). That is the move that would make this page Aurora's own.
- brand: the accent is used as decoration, against "accent once per screen". The fix is the colour note above.
- copy: casing is mixed ("Pike Hold (Floor)", "Pike Push-Up", "Dragon Squat", "Ring Muscle-Up" against "Bodyweight squat", "Dead hang"). Use sentence case for every move name. "4 steps away" shows only two chips before the target, so the count and the chips disagree; make them match. Change "Resting HR trend: no HR history yet" to "Resting pulse: no readings yet".
polish:
- "Target reached" deserves the "Beyond" move as the next step in brass. It is the one place where the accent would mean "do this next".
```

Single change that raises the score most: **one brass element per target block.** Take brass off the target titles, the card titles and the target chip, and keep it only on the next-step chip and its PB. This moves colour and brand to 7 or 8 and lets a hierarchy emerge.

---

## 2. Session, working set (renders/session-work.png)

```
scores: hierarchy 8, typography 7, spacing 7, colour 7, composition 7, originality 7, brand 7, copy 6
average: 7.0
pass: no
notes:
- typography: the timers "11:01" and "22:10" are 700 white at about 22px, so they shout at the same weight as the exercise title. Set them to 600 at 20px in muted, with the labels at 12px. The stepper "-" is a hyphen: use U+2212 so it matches the "+".
- spacing: "Log set" starts at x=16 (32px @2x) while the content column starts at x=24. Align the bar's left edge to 24. The "+" stepper ends at x=314, not at the right margin of 366, so the number group is neither centred nor full width. Put the "+" at the right margin, or centre the whole -/12/+ group.
- colour: there are three brass items (12, "Stop with 3 reps in the tank", "Log set"). Set the tank line in foreground or muted, so brass marks the dose and the action only. "Strap" is a white bold bordered button with the same visual weight as "Log set". Drop it to muted text with a controlEdge border.
- composition: the doodle sits in a centred band about 200px tall with empty space either side, and the rest of the screen is left aligned. Left-align the figure to the 24px column, or cut its height to 140px and raise the description above the fold. Centred "Stop with 3 reps…" breaks the left axis too: left-align it under the number.
- originality: the big-number set screen is strong and specific. The doodle reads as clip art at this size. Ink it in muted at a 2px stroke so it reads as an illustration, not a placeholder.
- brand: "Add weight · 16 kg" in muted underline sits close to the dose and reads as a prescribed load. See copy.
- copy: "Add weight · 16 kg" reads as "add 16 kg", which is a load the rules did not give (a breach of the no-invented-doses rule). Write "Add weight (you have 16 kg)" or "Hold your 16 kg". In the description, cut "fundamental", so it reads "A two-leg squat for quads and glutes; grooves the pattern."
polish:
- A filled brass "Log set" (onAccent text) would settle the bottom bar: it is the one thing to do next.
```

Single change that raises the score most: **rewrite "Add weight · 16 kg" so it states what the athlete owns, not a load to add** (for example, "Add weight (you have 16 kg)"). It is the only item on the screen that breaks a must-be-true rule, and it lifts copy and brand to 8.

---

## 3. Settings (renders/settings-you.png, renders/settings-gear.png)

```
scores: hierarchy 7, typography 7, spacing 7, colour 6, composition 7, originality 6, brand 7, copy 6
average: 6.6
pass: no
notes:
- hierarchy: the brass headline "Your setup", the brass active tab and up to three brass selected chips all read first together. Set the headline in foreground (it is a label, not an action) and let the active tab carry the brass.
- typography: there are two label systems: tracked caps eyebrows ("PAST JOINT INJURIES", "YOUR WEIGHT") and 20px muted sentence labels ("Bodyweight (kg)", "Knee", "Weight you own (kg)"). Pick one: sentence labels at 16px 600 foreground. The tabs at about 20px 600 are larger than the field labels; set them to 16px 600.
- spacing: "Saved." sits 12px under the tab rule and 28px above the eyebrow, so it looks like part of the tab bar. Move it to the footer line, next to "Changes save as you make them.". Put 24px above the injury type chips (Dislocation…) and give them a label.
- colour: selected chips use a brass border, a brass tint and a brass tick, and the tick alone would carry the state. Keep the tick and the border in foreground on the surface fill. That frees brass for the active tab only.
- composition: on You, the injury type chips (Dislocation / Ligament / Surgery / Other) float under "left right both" with no label, so they read as a third side option. Add the label "Kind of injury" and indent the knee group 16px under the Knee chip, so it reads as a child of it.
- originality: a stack of chip grids and inputs is template settings. That is acceptable for a settings page, but the tabs are the only shaped element. Give each tab a one-line plain answer at the top (for example, "Sessions plan for: bodyweight, pull-up bar, dumbbell") before the controls.
- brand: casing is mixed ("left right both" against "Shoulder", "Lower back"). Use sentence case throughout: "Left", "Right", "Both".
- copy: "Saved." shows while the field holds the invalid 0, and the error under it says it was not saved. Suppress "Saved." whenever a field is invalid. "YOUR WEIGHT / Weight you own (kg)" on Gear collides with "Bodyweight (kg)" on You. Rename it to "Heaviest dumbbell or kettlebell (kg)" and show it only under the selected "Dumbbell or kettlebell" chip.
polish:
- "Used for pull-up and dip load." could become "Used to work out pull-up and dip load." The current wording is clear enough to ship.
```

Single change that raises the score most: **make the Gear weight field part of the dumbbell choice.** Rename "Your weight / Weight you own (kg)" to "Heaviest dumbbell or kettlebell (kg)", nest it under the selected "Dumbbell or kettlebell" chip, and stop showing "Saved." while it is invalid. This removes the bodyweight confusion and the contradictory status in one move.

---

## Summary

| Screen | Average | Lowest axis | Verdict |
| --- | --- | --- | --- |
| Progress | 6.0 | colour 5 | send back |
| Session, working set | 7.0 | copy 6 | send back |
| Settings | 6.6 | colour 6, originality 6, copy 6 | send back |
