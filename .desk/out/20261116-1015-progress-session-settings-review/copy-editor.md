# Copy edit: Progress, session working set, Settings

Voice: measured, plain, British (en-GB). No number, rep, hold or load is changed; only the words around them. 16 changes, most important first. Items marked (all) apply across screens.

## Cross-screen term conflicts (read first)

- Own weight vs body weight: Settings You tab says "Bodyweight (kg)" (your body), Gear tab says "Weight you own (kg)" under "Your weight" (kit you add), and the session says "Add weight · 16 kg". "Your weight" reads as body mass. Rename the Gear block to "Added weight" throughout.
- "Aurora" is named once (Settings) and never explained. "Sessions" and "plan" are used for the same thing in Settings hints.
- "Standard", "level", "path", "chain", "tier" are all used for progression; a lay athlete sees "standard" and "path" without a definition.

## Progress

1. src/progress/chainMap.ts, status line
   - Current: `${tierNote}${done} of ${SESSIONS_AT_STANDARD_TO_ADVANCE} sessions at the standard to move up` (renders "Beginner level · 0 of 2 sessions at the standard to move up")
   - Replace: `${tierNote}${done} of ${SESSIONS_AT_STANDARD_TO_ADVANCE} sessions at target reps to move up` (renders "Beginner level · 0 of 2 sessions at target reps to move up")
   - Reason: "the standard" is undefined jargon. Only safe if "standard" means hit the prescribed reps or hold; confirm against skillDose.ts. If it means something else, use "sessions done well" and keep the numbers.

2. src/ui/progressView.ts, step count
   - Current: `${card.stepsToTarget} ${noun} away` ("1 step away", "4 steps away")
   - Replace: `${card.stepsToTarget} ${noun} to go`
   - Reason: "away" is vague; "to go" reads as progress. Number untouched.

3. src/ui/progressView.ts, empty state
   - Current: `Progress follows the skills you aim the plan at — not the whole catalogue.`
   - Replace: `Progress tracks the skills you set as targets.`
   - Reason: em dash banned, "not X, but Y" move, shorter.

4. src/ui/progressView.ts, empty state hint
   - Current: `In Library, open a skill with a path and tap Generate plan, or set a target on Plan.`
   - Replace: `Open a skill in Library and choose Generate plan, or set a target in Plan.`
   - Reason: cuts "with a path" jargon; "tap" and "choose" should match the app's other verbs; one clean sentence.

5. src/ui/progressView.ts, unlinked path
   - Current: `Path not linked yet`
   - Replace: `No progression for this skill yet`
   - Reason: "linked" is a developer term.

6. src/ui/progressView.ts, hint on unstarted card
   - Current: `Suggested start on this path`
   - Replace: `Suggested starting point`
   - Reason: shorter, no "path".

7. src/ui/progressView.ts, HR line
   - Current: `Resting HR trend: no HR history yet`
   - Replace: `Resting heart rate: no readings yet`
   - Reason: expand HR, "history" and "trend" with nothing to trend.

8. src/progress/chainMap.ts, no-history reason
   - Current: `No history yet — log a session or set a level in Library`
   - Replace: `No history yet. Log a session or set your level in Library.`
   - Reason: em dash, two sentences.

9. src/progress/chainMap.ts, stall reason
   - Current: `Stuck: ${memory.sessionsBelowFloor} sessions in a row below the minimum; ${action}` with `Aurora may step you back to ${easierName}` / `there is no easier step on this path`
   - Replace: `${memory.sessionsBelowFloor} sessions in a row below the minimum. ${action}` with `Aurora may step you back to ${easierName}.` / `There is no easier step on this path.`
   - Reason: semicolon, lowercase fragment after punctuation, "Stuck:" is blunt and the numbers already say it. Name Aurora once in Settings (item 12).

10. src/progress/chainMap.ts, advance reason
    - Current: `Standard met: ready to move up to ${harderName}`
    - Replace: `Target reps met. Ready to move up to ${harderName}.`
    - Reason: same "standard" fix as item 1, sentence form.

11. src/progress/chainMap.ts, light-day note
    - Current: ` · last session was a light day`
    - Replace: ` · last session was a lighter day`
    - Reason: comparative reads naturally; confirm "light day" is not a product term. Low priority.

## Session working set

12. src/ui/sessionWeightControls.ts, add-weight button (all)
    - Current: `Add weight · ${addKg} kg`
    - Replace: `Add ${addKg} kg`
    - Reason: shorter, a verb plus the thing; the "weight" noun clashes with body weight. Number untouched.

13. src/ui/sessionDoseNote.ts, effort note
    - Current: `Stop with ${rir} rep${rir === 1 ? "" : "s"} in the tank`
    - Replace: `Stop with ${rir} rep${rir === 1 ? "" : "s"} left in reserve`
    - Reason: "in the tank" is gym slang, unclear to a first-timer and not plain. Keeps the number; the plural logic is unchanged.

14. src/ui/sessionDoseNote.ts, hold note
    - Current: `Seconds · stop before you shake`
    - Replace: `Count in seconds. Stop before your form breaks.`
    - Reason: "shake" is ambiguous (tremor is normal in holds); "form breaks" says what matters. Judgment call.

15. src/ui/sessionChalk.ts, set actions
    - Current: `Failed`, `Skip`, and `Strap` (summary), `Pulse ${state.bpm ?? "—"}`
    - Replace: `Missed reps` for Failed (or `Couldn't finish`), `Skip set` for Skip, `Heart-rate strap` for Strap, `Pulse ${state.bpm ?? "no reading"}`
    - Reason: bare "Failed" reads as a judgement, bare "Skip" does not say what is skipped, "Strap" is meaningless alone, and an em dash as a value is unclear. Verify `Failed` wiring is unchanged (words only).

16. src/ui/sessionChalk.ts, stepper and rail
    - Current: `aria-label="Stations"`, `Pay attention to`, `How to`
    - Replace: `aria-label="Exercises in this session"`, `Watch for`, `How to do it`
    - Reason: "Stations" is circuit-gym jargon; "How to" is an incomplete phrase. The visible header uses `1 of 5 · Squat · next Split squat`, where "Squat" is a movement group, not the exercise: consider `1 of 5, squat pattern`. Not changed here as it comes from the planner.

## Settings

17. src/ui/settingsPage.ts, added weight block (all)
    - Current: eyebrow `Your weight`; label `Weight you own (kg)`; hint `A dumbbell, kettlebell or vest. In a session, Add weight starts here.`
    - Replace: eyebrow `Added weight`; label `Weight you add (kg)`; hint `A dumbbell, kettlebell or vest. Sessions offer this as the starting load.`
    - Reason: separates it from Bodyweight (item 0 above), removes self-reference to a button label.

18. src/ui/settingsView.ts, validation messages
    - Current: `Enter 30 kg or more.` and `Enter a weight from 0.5 to 100 kg.`
    - Replace: `Enter your weight as 30 kg or more.` and `Enter a weight between 0.5 and 100 kg.`
    - Reason: first one fails to say what to enter; second "from 0.5 to" is fine but "between ... and" is the plainer pair. Limits unchanged. The gear render also shows "Saved." above the invalid field: a save message beside an error contradicts it; show Saved only when the field is valid (behaviour note for the builder).

19. src/ui/settingsPage.ts, injuries
    - Current: `Past joint injuries`, `Aurora skips or eases moves that load these joints.`, chip `Other / niggles`, chip `Ligament / tendon`, side chips `left` `right` `both`
    - Replace: `Past injuries`, `Moves that load these joints are skipped or eased.`, `Other niggles`, `Ligament or tendon`, `Left` `Right` `Both` (sentence case)
    - Reason: plain, drops the unexplained brand name in a hint, no slashes, sentence-case chips match "Lower back". The Knee sub-heading in the render reads as a stray label; use `Which knee` and `What happened`.

20. src/ui/settingsPage.ts, training and autosave
    - Current: `Deload week`, `A lighter dose for a week, with no level-ups.`, `Mute coach voice`, `Changes save as you make them.`, `Everything is stored on this phone only. Export a copy to keep it safe.`
    - Replace: `Easier week`, `Lighter sessions for a week, with no moves up a level.`, `Mute voice cues`, `Changes save as you make them.` (keep), `Everything stays on this phone. Export a copy to keep it safe.`
    - Reason: "Deload" and "dose" are coaching jargon for a lay athlete; keep "deload" only if the audience owns it. Confirm "Easier week" with the owner (status messages `Deload week on.` / `Deload week off.` in settingsView.ts must change to match).

## Spelling check (en-GB)

No US spellings found in the listed files. "Catalogue", "Palette", "Programme" not used; "Dumbbell", "Parallettes" fine. Title Case stragglers to fix for sentence case: none in source; chip names from the exercise data (`Dragon Squat`, `Pike Hold (Floor)`, `Pike Push-Up`, `Press to Handstand`, `Ring Muscle-Up`) are title case while neighbours (`Box squat`, `Dead hang`) are sentence case. Fix in the exercise names data: `Dragon squat`, `Pike hold (floor)`, `Pike push-up`, `Press to handstand`, `Ring muscle-up`. Same fix for `Freestanding handstand attempt`, which is already sentence case.

Heading note: `Toward your targets` is US-leaning; use `Towards your targets` (src/ui/progressView.ts).

## Unverified

- That "the standard" means target reps met (no source seen).
- That "light day" is not a defined product term.
