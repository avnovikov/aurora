# UX heuristic review: Aurora / Rassvet coaching app

**Mode:** full
**Primary task:** Find an exercise in Library (filters, search, open, back); edit a plan day (Move, Remove, Add days, Level); check in and train (warm-up “Not for me” and swipe, then log a work set); glance at Settings, Progress, and Body.

Evidence is the shipping UI in `src/ui`, `src/library`, and `src/styles`, the desk screens in `.worktrees/desk-design/.desk/ref/`, and the last 25 closed issues plus open [#82](https://github.com/avnovikov/aurora/issues/82). The live app was not driven in a browser.

## Scorecard

| # | Heuristic | Score | Notes |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 2 | Clocks, the Library count, the sleep gate, and Plan status lines tell you where you are. A pain swap, a warm-up exclusion, and the Progress heart-rate line do not report what actually changed. |
| 2 | Match between system and the real world | 2 | Days, doses, and filter chips use training language. “Make this day” inserts a block, and Body plus the exercise page still show catalogue muscle ids. |
| 3 | User control and freedom | 1 | A started session has no exit. A removed day cannot be put back. The Level sheet opens itself again after you close it. |
| 4 | Consistency and standards | 2 | Chips, panels, and Library meta lines match each other. “Not for me” is explained and undoable on Plan, and a bare button on the warm-up. |
| 5 | Error prevention | 2 | Start stays off until sleep is chosen, and the end-of-session rating ignores the finishing tap. Removing a day, remaking a day, excluding a warm-up move, and swiping a work set all commit immediately. |
| 6 | Recognition rather than recall | 3 | Filter triggers show the current value; the dose and the station name stay on screen. Plan actions and the swipe hint sit under a long read. |
| 7 | Flexibility and efficiency of use | 3 | Search, swipe, drag, Swap, Easier, and Generate versus Add are real shortcuts. Export does not hand you a file, and the exercise actions sit below the instructions. |
| 8 | Aesthetic and minimalist design | 3 | The work screen leads with the move and the dose. The Level paragraph, the Body scoring formula, and the strap row compete with the task when they are open. |
| 9 | Help users recognize, diagnose, and recover from errors | 3 | An invalid bodyweight or added weight names the allowed range and keeps the number (`src/ui/settingsView.ts`). A removed day is announced in a status line and stays gone. |
| 10 | Help and documentation | 3 | Check-in, dose, empty Progress, and the hidden-stretch hint are written as tasks. Pain and warm-up “Not for me” do not say what the tap changes. |

## Findings

| Sev | Heuristic | Location | Issue | Why | Fix |
| --- | --- | --- | --- | --- | --- |
| HIGH | H3 | Session, whole screen. `src/ui/app.ts` `renderSessionView` replaces the shell; `src/ui/sessionView.ts` `saveSession` / boot resume | Once Start is tapped there is no Stop, Back, or Leave. The tab bar is gone. The only way out is to finish or skip every set, then answer “How was that?”, which calls `advancePlanAfterSession()`. A relaunch resumes the same session. | Peak-End: the only ending advances the plan. An accidental start, or a session you cannot finish today, has no emergency exit that leaves the queue where it was. | Add “End session” that asks whether to keep today’s place in the plan, then clear the saved session and return to Today. |
| HIGH | H5 | Plan day summary, the ×. `src/ui/planPage.ts` `plan-day-remove` inside `<summary>`; `src/ui/planView.ts` `removeQueueItem` | × deletes that day on the first tap. The page says “Removed {title}.” and offers no Undo. The control is 44×44 and sits in the same summary you tap to open the day (`src/styles/plan.css`). | Fitts: the destructive target shares the open-day row. “Not for me” on the same page already keeps an undo token (`excludeFromDay` / `undoExclude`). | Confirm with the day name, or show Undo on that status line and restore the queue item. |
| HIGH | H5 | Plan, open day, “Make this day”. `src/plan/dayEdits.ts` `makeDay`; `src/ui/planView.ts` `remake` | One area chip drops the day and inserts a block. Later days are spaced two slots apart (`BLOCK_SPACING` in `src/plan/blockActions.ts`). The status afterwards is “This day is now {area}; two more follow later in the plan.” | The label matches “change this day.” The result matches “replace this day with a three-day block.” | Name the control “Replace with a block” and say that before the tap, or change only the open day. |
| HIGH | H5 | Warm-up station, “Not for me”. `src/ui/sessionChalk.ts`; `src/ui/sessionView.ts` `onWarmupNotForMe` | The button calls `excludeExercise` with no confirm, no status, and no Undo. `rewriteWarmupStepsAfterExclude` keeps the current station running, so the screen looks unchanged. Plan’s same action says “Keep this move out of all your sessions” and offers Undo (`src/ui/planPage.ts`). | Forgiveness: a quiet button during a timed station commits a permanent exclusion. The athlete has to remember to restore it later in the Library. | Use the Plan sentence, confirm, toast what changed, and offer Undo. Skip or replace the station you are on so the tap is visible. |
| HIGH | H1 | Today check-in, then the work screen. `src/ui/checkIn.ts`; `src/rules/resolveSlot.ts` `painSwap`; `src/ui/sessionChalk.ts` “Why this dose” | “Any pain today?” does not say the session will change. Plan and Today previews are built with `painJoints: []` (`src/plan/dayPreview.ts`). A swap’s reason (`Pain on loaded joint; swapped to …`) is inside a collapsed “Why this dose”. | Progressive disclosure hides the consequence at the moment of the choice, then hides it again when the move on screen differs from the plan. | On the pain row, say these joints are eased or swapped today. When a swap happens, name the planned move and the replacement above the fold. |
| MEDIUM | H3 | Library dock, Show / Area & muscle / Level. `src/library/filterPanels.ts` `panelHtml`; `src/styles/library.css` `.lib-sheet` | The sheet opens upward over the list (`bottom: 100%`, up to 60vh) and has no close control. Closing it means tapping the summary again. | Already filed as [#82](https://github.com/avnovikov/aurora/issues/82). Scored here so the heuristic is honest. Do not open a second issue. | Add the × from #82. |
| MEDIUM | H3 | Plan, Level panel. `src/ui/planPage.ts` `levelPanelHtml` | Any level other than “From my results” renders the panel open (`level.open \|\| active`), including the long note about what the level does and does not change. Closing it lasts until the next edit; `act()` repaints and opens it again. | The summary already says “Level · Beginner”. The paragraph is forced back onto the page on every edit. | Let a chosen level stay collapsed. Keep the value on the summary. |
| MEDIUM | H5 | Work set, the whole swipe stage. `src/ui/sessionSwipe.ts` `forwardOnly`; `src/ui/sessionControls.ts` work → `completeSet(..., "completed")` | A left swipe of about one third of the width, or a flick, logs the set as completed at the prescribed reps and starts rest. The only warning is “Log each set below, or swipe left…” at the bottom of the cues (`src/ui/sessionChalk.ts`). There is no undo. | The stage includes the hero and the instructions, so a drag while reading or adjusting reps is the same gesture as “I finished this set.” | Keep swipe as the shortcut, and add Undo on the rest screen for the set just logged. Ignore swipes that start on the rep stepper. |
| MEDIUM | H7 | Exercise page. `src/library/libraryDetail.ts` `detailHtml` versus `.worktrees/desk-design/.desk/ref/exercise.html` | Generate plan, Add to the plan, and Not for me sit in `.ex-tray` after How to, cues, mistakes, standards, and Your level. The desk screen places Plan and Not for me directly under the summary (around the “Generate plan” button in `exercise.html`). | Closed issue #37 asked for plan actions near the top. The shipping order makes every “add this” trip a scroll through the instructions. | Match the desk order: summary, then Plan and Not for me, then How to. |
| MEDIUM | H2 | Exercise “Muscles:” line and Body. `src/library/present.ts` `formatMuscles`; `src/ui/bodyView.ts` `renderLoadRow` | The meta line says “Glutes & hips” (`src/library/metaLine.ts`, and the desk exercise screen). The next line says “Muscles: glutes (primary)”. Body bars and the map use the same raw groups (“abdominals”, “lower back”). The Body subtitle explains the 1 / ½ / ¼ scoring rule. | Jakob: the filters taught one vocabulary. The detail page and Body answer in catalogue ids. | Reuse the Library bucket labels on both screens. Move the scoring rule behind the chart. |
| LOW | H1 | Progress, under every state. `src/ui/progressView.ts` `NO_HR_HISTORY_NOTE` | The page always ends with “Resting heart rate: no readings yet”, including when targets and history exist. The string is a constant. | A status line that cannot change reads as a broken meter. | Show a reading when one exists, and omit the line until then. |
| LOW | H7 | Settings → App → Export backup. `src/ui/settingsPage.ts`; `src/ui/settingsView.ts` `wireApp` | “Export a copy to keep it safe” writes the JSON into a `<pre>` on the page. There is no download, share, or copy. | The backup task stops one step short of a copy the phone can keep. | Download or share a file, and say where it went. |

## Strengths

- Library filters name their current value on the trigger, the header counts results, and Clear filters appears when a filter is off its default (`src/library/filterPanels.ts`, `src/library/libraryList.ts`). List rows use the same area · muscle · level line as the chips. That is the follow-through from closed issues #36 and #37.
- Plan “Not for me” says the move leaves every session, substitutes in place, and keeps Undo on that row (`src/ui/planPage.ts`, `src/ui/planView.ts`). Swap with no legal substitute says so (`data-swap-empty`).
- Today will not start until sleep is chosen, and it says why (`src/ui/checkIn.ts`). The session shows elapsed and remaining time, a station rail, and Log set / Couldn’t finish / Skip set pinned in the bottom bar (`src/ui/sessionChalk.ts`). The end rating stays disabled for 400ms so the last swipe cannot answer it (`src/ui/evaluationView.ts`).

## Out of scope / not verified

- Not clicked through in a running browser. Behaviour is from source; the desk PNGs and HTML are the visual reference and, on the exercise page, disagree with `detailHtml` order.
- Accessibility (focus, contrast, names) was not scored. Tab labels are 12.8px in a six-column bar (`src/style.css`). Point that at an accessibility pass.
- A Laws of UX pass was not scored. Fitts, Peak-End, and progressive disclosure are cited only in Why. Run `ux-principles` for a separate list.
- Onboarding, voice lines, and deload dosing were not walked.
- In the browser (no Capacitor), the session strap offers “Pulse ok” and “Pulse lost” (`src/ui/sessionChalk.ts` `pulseControlsHtml`). Native shows Connect / Disconnect. Worth a look if the PWA is a real training surface.
- [#82](https://github.com/avnovikov/aurora/issues/82) is the Library sheet close control. It is on the scorecard above and is not proposed again.

## Issue backlog

Proposed only. Nothing was filed.

**HIGH — Session: leave without advancing the plan**

Start replaces the app and saves the session, and the next launch resumes it (`src/ui/app.ts`, `src/ui/sessionView.ts`). Skipping through to “How was that?” still runs `advancePlanAfterSession()`. Add End session, ask whether today should stay next, then clear the saved session and return to Today.

**HIGH — Plan: confirm or undo the day ×**

The × in each day summary calls `removeQueueItem` immediately and only writes “Removed {title}.” (`src/ui/planPage.ts`, `src/ui/planView.ts`). It sits on the control used to open the day. Confirm with the day name, or put Undo on that status and restore the queue item.

**HIGH — Plan: “Make this day” should change one day**

An area chip under “Make this day” drops that day and inserts a spaced block (`makeDay`, `BLOCK_SPACING`). The explanation appears only after the tap (“two more follow later”). Either rename it to “Replace with a block” and say that on the button, or remake only the open day.

**HIGH — Warm-up: “Not for me” excludes the move with no signal**

The warm-up button calls `excludeExercise` and leaves the current station on screen (`src/ui/sessionView.ts`, `rewriteWarmupStepsAfterExclude`). Plan already explains “Keep this move out of all your sessions” and offers Undo. Use that sentence, confirm, show what was excluded, offer Undo, and advance or replace the station so the tap is visible.

**HIGH — Check-in: say that pain changes today’s moves**

Pain is collected as optional and never described (`src/ui/checkIn.ts`). The swap reason is computed in `painSwap` and shown only inside collapsed “Why this dose”, while Plan and Today previews assume no pain. Say on the pain row that those joints are eased or swapped, and when the session starts name the planned move and the replacement in the hero.

**MEDIUM — Plan: let Level stay closed**

Choosing anything other than “From my results” forces the Level panel open, and the next edit opens it again (`level.open || active` in `src/ui/planPage.ts`). The summary already carries the value. Stay collapsed after the athlete closes it.

**MEDIUM — Work set: a swipe logs the set as done**

A left swipe on the work stage calls `completeSet` with `completed` at the prescribed reps (`src/ui/sessionControls.ts`). The hint is at the bottom of the cues, and rest has no Undo. Keep the shortcut, ignore swipes that start on the stepper, and offer Undo for the set just logged.

**MEDIUM — Exercise page: put Plan and Not for me under the summary**

`detailHtml` places Generate plan, Add to the plan, and Not for me after How to, cues, standards, and Your level. The desk exercise screen puts them under the summary. Match that order so adding or excluding a move does not require reading the whole page first.
