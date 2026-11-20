# Aurora shell tabs

## Scope

The Capacitor Android shell and the web preview share one tab bar. Tab ids and labels are defined in `src/ui/shell.ts` in this order: Today, Library, Progress, History, Body, Plan, Settings.

A **Session** is not a tab. It replaces the shell while a workout runs, then returns to the tab bar.

Screenshots: `docs/help/screenshots/`. First-time walkthrough: [../tutorial/take-your-first-morning-with-aurora.md](../tutorial/take-your-first-morning-with-aurora.md). Local-only health data: [../PRIVACY.md](../PRIVACY.md).

## Tab bar

| Tab | What it shows | Screenshot |
| :---- | :---- | :---- |
| Today | Next plan-queue day; ≈ minutes; pulse status and Connect; sleep check-in (required before Start); optional pain; Start; optional “Train something else today” | [04-today.png](../help/screenshots/04-today.png) |
| Library | Exercise catalogue; search; filters Show / Area & muscle / Level; detail (cues, standards, personal bests, plan actions when available) | [02-library.png](../help/screenshots/02-library.png) |
| Progress | Level profile by movement pattern (novice→elite, within-tier %); weak-links; current readiness toward Targets (rows open History for that thread) | [06-progress.png](../help/screenshots/06-progress.png) |
| History | Monday-start weeks, newest first: session count and Mon–Sun effort strip (Easy · On target · Difficult · Wiped as 1–4 steps); session cards, newest open; exercise rows with reps per set, avg bpm, PB n or new PB; summary-only sessions show “N sets logged”; a row opens the exercise page and Back returns | [07-history.png](../help/screenshots/07-history.png), [07b-history-week.png](../help/screenshots/07b-history-week.png), [07c-history-exercise.png](../help/screenshots/07c-history-exercise.png) |
| Body | Balance headline and caricature; windows Overall (older sessions fade) / Month / 3 months / Half year / Year; front/back figure by level (Heavy / Moderate / Light / Not trained, dashed); five pairs Push v Pull, Upper v Lower, Front v Back, Squat v Hinge, Abs v Lower back (Even / Mostly X / No X, within 2:1); Consider adding: up to three Library moves for the light side, owned gear only, Back returns with the same window | [08-body.png](../help/screenshots/08-body.png), [08b-body-balance.png](../help/screenshots/08b-body-balance.png) |
| Plan | Ordered queue of upcoming days (not a weekday calendar); Today is the first card; area days and skill paths with Targets; per-exercise Swap / Easier; remake area or skill; reorder; add days; plan level | [03-plan.png](../help/screenshots/03-plan.png) |
| Settings | Sub-tabs You / Gear / Training / App: bodyweight, resting and max HR, injuries, equipment, training defaults, palette, voice | [01-settings.png](../help/screenshots/01-settings.png) |

## Session (not a tab)

| Surface | What it shows | Screenshot |
| :---- | :---- | :---- |
| Session | Warmup → work patterns → cool-down → rating; elapsed / left; dose; cues; doodle; forward swipe (left) to finish set or station; rest / get ready; pulse strip; Not for me | [05-session.png](../help/screenshots/05-session.png) |

## First-run surfaces (before the tab bar)

| Surface | What it shows | Screenshot |
| :---- | :---- | :---- |
| Your setup | Bodyweight, resting/max HR, past injuries; Continue | [01-settings.png](../help/screenshots/01-settings.png) |
| What to train first | Area chips Upper body / Lower body / Core / Full body; Start with this / Skip for now | [01b-settings-area.png](../help/screenshots/01b-settings-area.png) |

## Plan queue terms

| Term | Meaning |
| :---- | :---- |
| Plan queue | Ordered list of day ids; Today runs the first item; completing a session advances the queue |
| Target | Skill end-goal on a path (e.g. freestanding handstand, muscle-up); Plan days train the current step; Progress shows distance toward it |
| Dose | Prescribed sets and reps or hold for a station; may be lightened by sleep, pain, load, or pulse at start; does not replace the Target |
| Area day | A queue card built for Upper body, Lower body, Core, Full body, Mobility, Joint care, or a skill path aimed at a Target |

## On-device storage

| Mechanism | Where | Notes |
| :---- | :---- | :---- |
| AuroraSecure | Android Keystore-backed bridge (`window.AuroraSecure`) | Used for sensitive `aurora.poc.*` values in 0.1 |
| localStorage | Browser / unit tests when the bridge is absent | Plaintext; for local preview only |

Common keys include `aurora.poc.profile.v1`, `aurora.poc.planQueue.v1`, `aurora.poc.planDays.v1`, `aurora.poc.history.v1`, `aurora.poc.memory.v1` / `aurora.poc.memory.v2`, `aurora.poc.session.v1`.
