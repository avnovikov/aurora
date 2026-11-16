# Art Director notes, round 1

Job 20261116-1100-progress-session-settings-polish. I read the round-0 renders (`renders/round-0/<screen>/phone.png` in Rassvet, plus the Alvorada and Ushas copies), the four proof files, and the shared stylesheet in `.desk/out/20261116-1100-progress-session-settings-polish/*.html`. The `<style>` block from line 12 to line 444 is the same in all four files, so make each shared change once and copy it to all four.

Rules for every note: colour comes only from the role variables. Type sizes come only from 12.8 / 16 / 20 / 25 / 31.25 / 39px. Spacing sits on the 4px grid. Every control, every number and every dose stays exactly as it is.

What I do not re-raise: anything the earlier review fixed (`.desk/out/20261116-1015-progress-session-settings-review/review.md`). I also leave out the owner decisions: the h1 in the accent, the casing of exercise names, and Pull-up appearing under two targets.

---

## All screens (shared stylesheet, apply once)

A1. **Typography: eyebrows are 12px, which is off the scale.** This fixes the proof failures on "Progress", "Settings", every "Target · …" line, "Past injuries", "Equipment you have" and "Added weight". Also correct the letterspacing to the standard's 0.06em.
`.eyebrow { font-size: 12.8px; line-height: 16px; letter-spacing: 0.06em; }`
Fix the related small labels in the same pass:
`.exercise-next-label { font-size: 12.8px; line-height: 16px; }` (NEXT / THEN / BEYOND)
`.chip-row-label { font-size: 12.8px; line-height: 16px; letter-spacing: 0.06em; }` (11.2px today, which is under the 12px floor. It does not render on these four screens, but it is in the stylesheet that gets ported.)

A2. **Typography and hierarchy: the bottom tab bar labels are 12px (off the scale), and the current tab is marked by colour alone.** This fixes the proof failures on Today / Library / Progress / Body / Plan / Settings. The bar is also 48px tall, under the standard's 56–64px. The standard asks for a non-colour cue on the current tab. Mark it in foreground, which frees the accent for the page.
`.tab-bar { background: var(--surface); }`
`.tab-bar button { font-size: 12.8px; line-height: 16px; min-height: 56px; padding: 12px 4px; border-top: 2px solid transparent; }`
`.tab-bar button.active { color: var(--foreground); font-weight: 600; border-top-color: var(--foreground); }`

A3. **Typography: `.tagline`, `.about` and `.reason` are 0.95rem (15.2px), which is off the scale.** This fixes the proof failures on "1 step to go", "4 steps to go", "Target reached" and "Knee".
`.tagline, .about, .reason { font-size: 16px; line-height: 24px; }` (`.hint` keeps its own 0.8rem = 12.8px rule)

A4. **Typography: the h1 is 2.4rem (38.4px), which sits just under the 39px step. The base h2 is 1.6rem (25.6px), just over 25.**
`h1 { font-size: 39px; line-height: 44px; }` `h2 { font-size: 25px; line-height: 32px; }` (`.chain-title` keeps its 20px override)

A5. **Typography: the session labels are 13px, which passes proof but is not a scale step.** Bring them to the exact step so all small text on the four screens is the same size.
`.session-clock-label, .session .chalk-now, .session .session-phase, .session .session-attention .eyebrow, .session .station-source, .session .session-why .reason, .session .hint, .session-bar-status { font-size: 12.8px; }` (keep their current line heights)

---

## Progress

P1. **Hierarchy and colour: in every move block the PB uses the accent, so the accent appears twice per block (the move name and the PB). The PB is also 13.6px, off the scale** (proof: "PB · 10 reps", "PB · 25s", "PB · 6 reps"). Keep the accent on the move name and its rule. Set the PB in foreground at body size so the figure reads.
`.personal-best-inline { margin: 4px 0 0; color: var(--foreground); font-size: 16px; line-height: 24px; letter-spacing: 0; font-variant-numeric: tabular-nums; }`

P2. **Typography: the next-move line is 13.6px, off the scale** (proof: "Pistol squat", "Hanging knee raise", "Pike Push-Up", "Muscle-up" after NEXT/THEN/BEYOND). Set it to body size in muted, so the block reads in three steps: move (accent, 600), PB (foreground), next (muted).
`.exercise-next { margin: 4px 0 0; font-size: 16px; line-height: 24px; color: var(--muted); }`

P3. **Typography: the status footnote under each block is 13.6px, off the scale** (proof: "Beginner level · 0 of 2 sessions…", "Intermediate level · …", "Not started on this path yet"). It is a footnote to the block, so set it at the small step with tabular figures.
`.chain-reason { margin: 8px 0 0; font-size: 12.8px; line-height: 16px; font-variant-numeric: tabular-nums; }`

P4. **Hierarchy: "1 step to go" is the answer to the page's question, but it sits in muted grey under the title like a caption.** Once A3 sets it to 16px, set it in foreground. It then reads second, after the target title.
`.progress-card > .tagline { margin: 4px 0 0; color: var(--foreground); font-variant-numeric: tabular-nums; }`

P5. **Spacing and rhythm: inside a target the eyebrow sits about 16px above its title, while targets sit only 20px apart, so the groups do not separate. The block padding (10.4px) and chip gaps (5.6px) are off the 4px grid.**
`.progress-card > .eyebrow { margin: 0 0 4px; }`
`.chain-title { margin: 0; }`
`.chain-card { margin-top: 32px; padding-bottom: 24px; }`
`.path-preview { gap: 8px; margin: 12px 0 16px; }`
`.path-step { padding: 4px 8px; }` (keep 12.8px)
`.exercise-block { margin: 0; padding: 12px 16px; }`

Sign-off for Progress:
- The proof run shows zero type-scale failures and zero contrast failures.
- In each move block the accent appears only on the current move name and its left rule. The PB is foreground; the next move is muted.
- The top of each target reads, in order: eyebrow, title, "n steps to go" in foreground. Targets are separated by clearly more space than the lines inside a target.
- The tab bar is 56px tall. The current tab is foreground, 600 weight, with a 2px top bar.
- Every number (PBs, sessions, steps) is unchanged, and the chips match the current file.
- All of the above holds in Rassvet, Alvorada and Ushas.

---

## Session, working set

S1. **Contrast and composition: the first screen ends in the middle of a sentence. "A fundamental two-leg squat that builds" is sliced by the sticky bar** (the proof contrast failure, 1.0:1). Make the hero fill the first viewport above the bar, so the fold falls in the gap above the summary and the doodle centres in the free space. The session-top is about 100px and the bar about 193px.
`.session-hero { display: flex; flex-direction: column; min-height: calc(100dvh - 296px); }`
`.session-frame { flex: 1 0 auto; display: flex; align-items: center; justify-content: center; }`
The UI Designer must check in the phone render that the bar's top edge (about y 651) lands in `.session-read`'s 32px top padding and touches no text. If it misses, adjust 296px by 4px steps until it does.

S2. **Typography: the dose note is 0.9rem (14.4px), off the scale** (proof: "Stop with 3 reps left in reserve"). It is the instruction under the figure, so set it at body size. Keep it centred under the centred figure, in foreground, with the text exactly as it is.
`.dose-note { margin: 8px 0 0; font-size: 16px; line-height: 24px; }`

S3. **Spacing: the bar has a 16px left edge and a 24px right edge, while every block above it runs on 24px.** So "Log set" sticks out 8px on the left. Put everything in the bar on the 24px edge, and keep the 44px targets by pulling the quiet buttons' padding into the margin.
`.session-bar { padding: 16px 24px; }`
`.session-bar-status { padding-left: 0; }`
`.session-bar .work-actions .btn-quiet:first-of-type { margin-left: -12px; }` (the text "Couldn't finish" lines up at x = 24)
`.session-bar .pulse-chip { margin-left: -8px; }` (keeps the 4px alert rule for "Pulse lost". The text lines up at x = 24)

Sign-off for Session:
- The proof run shows zero type-scale failures and zero contrast failures.
- In the 390 × 844 phone render, the first screen shows the clock, rail, set, move, figure with steppers, dose note, "Add your 12 kg" and the doodle, then the bar. No line of text is cut by the bar's top edge.
- "Log set", "Couldn't finish", "Pulse no reading" and every block above them share one 24px left edge.
- The accent appears only on "12".
- Every control (−, +, Add your 12 kg, How to, Why this dose, Log set, Couldn't finish, Skip set, Strap and its two actions) is present and at least 44px.
- All of the above holds in Rassvet, Alvorada and Ushas.

---

## Settings, You

Y1. **Colour: every selected chip (Knee, Left, Ligament or tendon) is accent border, accent text and accent tint.** With the tab underline, that puts the accent on four things, and in Ushas the tint turns muddy. The job standard says selected states use foreground weight, not a second accent, and Plan and Today already do this. This changes the "checked chips keep their tint" line of the earlier note 11 to follow the standard. Scope it to Settings so Library is untouched:
`.settings .row button.selected, .settings .row button[aria-pressed="true"] { border: 2px solid var(--foreground); padding: 7px 15px; color: var(--foreground); font-weight: 600; background: color-mix(in srgb, var(--foreground) 12%, var(--surface)); }` (7/15px padding offsets the extra 1px of border against Y3's 8/16px, so chips do not jump in size when selected; keep the ✓ tick, so the state never depends on colour)

Y2. **Typography and composition: the "Knee" sub-heading is 15.2px (proof failure), muted, and sits like a stray caption. The four injury-kind chips float under Left / Right / Both with no visible label, so they read as a third side option.**
Markup change: replace `<p class="tagline">Knee</p>` with `<p class="hj-label" id="hj-side-label">Which knee</p>` above the side row. Insert `<p class="hj-label" id="hj-kind-label">What happened</p>` above the kind row. Change the two groups' `aria-label` to `aria-labelledby` pointing at those ids. In code, the joint name stays in the label ("Which shoulder", "Which hip").
`.hj-label { margin: 0; font-size: 16px; line-height: 24px; font-weight: 600; color: var(--foreground); }`
`.hj-detail { margin: 8px 0 24px; padding-left: 16px; border-left: 2px solid var(--edge); }` (ties the group to the selected joint)
`.hj-detail .row { margin: 8px 0 0; }`
`.hj-detail .row + .hj-label { margin-top: 24px; }`

Y3. **Spacing: the chip padding (10.4 / 14.4px) and the input padding (10.4px) are off the 4px grid, and neither control carries the brand's radius 4.**
`.settings .row { gap: 8px; margin: 8px 0 24px; }`
`.settings .row button { min-height: 44px; padding: 8px 16px; border-radius: 4px; }`
`.settings .field input[type="number"] { min-height: 48px; margin-top: 8px; padding: 12px; border-radius: 4px; }`
`.settings-panel > .eyebrow { margin-top: 32px; }` `.settings-panel > .eyebrow + .hint { margin: 4px 0 0; }`

Sign-off for Settings, You:
- The proof run shows zero type-scale failures and zero contrast failures.
- The accent appears only on the h1 (owner decision) and the You tab underline. No chip uses the accent in any palette.
- Selected chips show a 2px foreground border, 600 weight and the ✓.
- The knee group reads as one indented unit under "Which knee" and "What happened", and the kind chips no longer read as a side option.
- All seven joint chips, three side chips, four kind chips and the bodyweight field (78) are present, each at least 44px.
- All of the above holds in Rassvet, Alvorada and Ushas.

---

## Settings, Gear

G1. **Colour: Bodyweight, Pull-up bar and Dumbbell or kettlebell are three accent-tinted chips on a screen whose accent belongs to the Gear tab underline.** Apply Y1 here (it is the same rule). It also fixes the muddy tint in Alvorada and Ushas.

G2. **Spacing: the same chip and input fixes as Y3 apply** (the same selectors, already covered). Here the 32px above "Added weight" separates the equipment group from the weight group more clearly than the current 24px.

G3. **Typography: "Equipment you have" and "Added weight" are 12px.** A1 fixes this. Nothing beyond it.

Sign-off for Settings, Gear:
- The proof run shows zero type-scale failures and zero contrast failures.
- The accent appears only on the h1 and the Gear tab underline.
- The three selected chips are foreground with a 2px border, 600 weight and the ✓.
- All six equipment chips and the weight field (12) are present, each at least 44px.
- The equipment group and the weight group read as two groups by space alone.
- All of the above holds in Rassvet, Alvorada and Ushas.

---

## Recommendation for the owner (not a note, not to change here)

The h1 in the accent is now the only accent use on Settings beyond the tab underline, and on Progress it competes with five accent move names. Once these notes land, setting the app-wide `h1 { color: var(--foreground); }` would leave every screen with exactly one accent job.
