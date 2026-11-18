# Take your first morning with Aurora

## Overview

The first open needs a fixed path. Aurora · Rassvet is private calisthenics training on Android: British English UI and voice (`en-GB`). This tutorial walks the product once, in one order, with every choice already made for you.

The path is Settings, Library, Plan, Today, Session, Progress, History, Body. By the end you will have filled who you are and what gear you own, read the plan queue without editing it, finished one logged session, and opened the three feedback surfaces.

The tutorial assumes you can sideload an Android APK, train bodyweight or bar work at a beginner or intermediate level, and read short British English on a phone.

Screenshots use the Rassvet palette (brass on near-black). History, Body, and Progress shots include real logged sessions from a device dump, so those screens are not empty.

## Background

Most training apps use a weekday calendar. Aurora does not. It keeps a **plan queue**, an ordered list of upcoming training days. **Today** always runs the first item. Completing a session advances the queue.

The **dose** is the prescribed sets and reps or hold for each station. Sleep quality, optional pain, recent load, and pulse on the Android app can lighten that dose when you start.

Training history, readiness, sleep, pulse, and related health signals stay on the device in version 0.1. On Android they sit in **AuroraSecure**, Keystore-backed storage rather than plaintext. Privacy: [../PRIVACY.md](../PRIVACY.md). Tab names and fields: [../reference/aurora-shell-tabs.md](../reference/aurora-shell-tabs.md).

The tutorial consists of eight parts: setup, Library, Plan, Today, Session, Progress, History, and Body.

## Before you start

1. Install the Aurora APK from the [latest GitHub Release](https://github.com/avnovikov/aurora/releases/latest). Confirm the signing certificate SHA-256 against the root README if you want to verify the file.
2. Keep about 35–45 minutes free for a full first session. A browser preview (`npm run dev -- --host`) is enough for setup and browsing only; a pulse strap needs the Android app.
3. Keep phone sound on. Starting a session turns on the coach voice.
4. Clear floor space and have any gear you own nearby. You will mark gear in Settings; the planner respects what you own.

## Set who you are

On first launch the app opens **Your setup** before the main tab bar. If setup is already done, open **Settings** and use the **You** tab. The fields are the same.

1. Enter bodyweight in kilograms. The value feeds pull-up and dip load estimates.
2. Enter resting heart rate in bpm (pulse sitting still; the bottom of your training bands) and max heart rate in bpm (the top of those bands).

    <img src="../help/screenshots/01-settings.png" width="280" alt="Settings — Your setup">

3. Under Past injuries, tap every joint that still limits you. Moves that load those joints are skipped or eased. Leave chips off if none apply. Changes save as you make them.
4. Open the Gear tab. Turn on every piece of equipment you have (body, bar, parallettes, and so on). The planner will not prescribe moves that need gear you left off.
5. Open Training and leave the defaults. Leave App on the Rassvet palette with voice unmuted.
6. Tap Continue if you are still in first-run setup.
7. On What to train first, tap Upper body, then tap Start with this.

    That choice seeds the plan queue with upper-body days. This tutorial stays on that path.

    <img src="../help/screenshots/01b-settings-area.png" width="280" alt="First area choice">

You should now see the main tab bar: Today, Library, Progress, History, Body, Plan, Settings.

## Look around the Library

1. Tap Library.

    The list is the exercise catalogue. Each row shows name, area · muscle · level, and a short description. Filters sit under the list: Show, Area & muscle, Level. Stretches stay hidden until Show asks for them.

    <img src="../help/screenshots/02-library.png" width="280" alt="Library — Exercises">

2. Tap a Beginner row to open detail. Read the cues and the standards strip if present, then return to the list (swipe right on detail, or use the back control).
3. Do not tap Generate plan or Add to day. Those come after you know how Today works.

Three rules follow. Moves are labelled by area and level. Detail holds cues and standards. You do not edit the plan from Library on this pass.

## Read the Plan queue

1. Tap Plan.

    Coming up lists the queue. The first card is Today. Each card shows the day name (for example Upper body · A), an ≈ minute estimate, warmup and cool-down notes, and the working exercises with Swap, Easier, and more options.

    <img src="../help/screenshots/03-plan.png" width="280" alt="Plan — Coming up">

2. Confirm the first card is labelled Today and that its area is Upper body.
3. Scroll far enough to see Then 2 or Then 3 if present. Leave Swap, Easier, remake, and reorder alone.
4. Note the level controls lower on the page (From my results / named levels). Leave From my results selected.

The queue is what Today will run. You do not need to edit it to train.

## Check in on Today

1. Tap Today.

    You see the next queue day, ≈ minutes, pulse status, sleep chips, optional pain chips, and Start.

    <img src="../help/screenshots/04-today.png" width="280" alt="Today — check-in">

2. If you use a BLE heart-rate strap on the Aurora Android app, tap Connect and wait until the status shows a reading. If you have no strap, leave pulse as “no reading” and continue.
3. Under How did you sleep?, tap Good. Start stays disabled until a sleep choice is made. This tutorial uses Good so you see the normal morning dose; Fair or Poor would lighten it.
4. Leave pain chips off unless something hurts today. Marked pain eases or skips moves that load that joint.
5. Tap Start for the named day (for example Start Upper body · A). The coach voice starts. Keep the volume up.

## Run a Session

The Session replaces the tab bar until you finish. It runs warmup, then work patterns, then cool-down, then a short rating.

1. On the first warmup station, find Elapsed and Left, the stage strip, the station name, the dose (reps for a time, or a hold), the cues, and the doodle.

    <img src="../help/screenshots/05-session.png" width="280" alt="Session — warmup station">

2. Work the station as written. When the prompt says to finish, or when the station clock ends, swipe left (right edge toward left) to commit. Rest and get-ready screens use the same forward swipe. A swipe the other way snaps back.
3. On rest screens, wait for the countdown, or swipe left to skip ahead when the UI allows. If pulse is connected and still high, rest may hold; follow the on-screen prompt.
4. Continue through each work station. Log the reps or hold you actually did when the UI asks. That memory drives Progress and the next Plan.
5. Use Not for me only if a move is unsafe for you today. The session replaces it and continues. Do not use it for ordinary difficulty on this pass.
6. Finish cool-down, then complete the short session rating. The app returns you to the shell and advances the plan queue.

You have now completed one logged morning.

## Open Progress

1. Tap Progress.

    Where you stand has three boards. The **level profile** is pattern-by-pattern standing on novice → elite, with a within-tier percentage. **Weak-links** are moves that sit below your average. **Current readiness** is what to clear next on a path.

    <img src="../help/screenshots/06-progress.png" width="280" alt="Progress — Where you stand">

2. Scroll through all three boards once. After a logged session the profile should show at least some pattern lines. Empty boards mean not enough sets yet.
3. If a readiness row is present, tap it. History opens filtered for that thread. Return with the tab bar, then continue.

Do not change Plan targets from Progress on this pass.

## Open History

1. Tap History.

    Rows list exercises from completed sessions: name, set summary, and when. A banner appears when some rows are session summaries without per-set reps. That limit is real for older logs; new sessions keep set-level detail.

    <img src="../help/screenshots/07-history.png" width="280" alt="History — Logged sets">

2. Tap one exercise name. Library detail opens with that move, and with logged sets when the payload stored them.
3. Return to History, then continue to Body.

## Open Body

1. Tap Body.

    Muscle load shows front and back maps plus a ranked list. Leave the period on Week. Primaries count in full, secondaries half, stabilisers a quarter.

    <img src="../help/screenshots/08-body.png" width="280" alt="Body — Muscle load">

2. Read which areas sit at the top of the list. That is the week’s emphasis from your logged sets.
3. Tap Month once to see the same maps for a longer window, then return to Week.

You have now seen setup, the queue, a full session, and the three feedback surfaces.

## Summary

In this tutorial you filled You and Gear, seeded Upper body, browsed Library, read Plan without editing, checked in on Today, finished a Session with swipe-to-commit, and read Progress, History, and Body after the log.

## Next steps

| Doc | What it holds |
|-----|----------------|
| [Shell tabs reference](../reference/aurora-shell-tabs.md) | Tab, session, and storage lookup |
| [Privacy](../PRIVACY.md) | Local-only data; GDPR and CCPA/CPRA |
| [Terms](../TERMS.md) | Use conditions and disclaimer |
| [Root README](../../README.md) | Install, signing fingerprint, develop commands |
