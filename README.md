# Aurora · Rassvet

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat)](LICENSE)
[![CI](https://github.com/avnovikov/aurora/actions/workflows/ci.yml/badge.svg)](https://github.com/avnovikov/aurora/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/avnovikov/aurora?include_prereleases&style=flat)](https://github.com/avnovikov/aurora/releases)

**v0.1.1 — from the `mvp` line.** App id `com.aurora.alvorada` (registered in Android Developer Console).

**Aurora** is private, local-first calisthenics training for Android. **Rassvet** (Рассвет, “dawn”) is the soul mark shown in the app. The UI and spoken voice are British English (`en-GB`).

The Library has **617 exercises** (strength progressions, holds, and mobility). Major calisthenics apps advertise roughly **350+** (Madbarz), **700+** (Calisteniapp), and **1,000+** (Thenx) — Aurora sits in the middle on catalogue size, without a subscription.

Aurora is for people who train calisthenics at home and want each session adapted to recovery, available equipment, and recent performance. Training apps usually give you a weekday calendar and a static template. Sleep, joints, and pulse change what you should do before you start. Aurora keeps a **plan queue** instead — an ordered list of upcoming training days — and adjusts the **dose** from sleep, optional pain, recent load, missed reps, stalls, and (on Android) a Bluetooth heart-rate strap.

## Why I wrote it

Three gaps in the apps I used are why I wrote Aurora.

1. Those apps did not remember my joint problems: past injuries, and joints I need to skip or ease. Aurora stores them and eases or skips the moves that load those joints.
2. Those apps did not change the plan when I plateaued — when progress had stalled and the same work kept coming back. Aurora changes the plan when progress stalls.
3. A typical app of this kind costs about £60 a year. I give Aurora away free as in beer (no charge) and free as in speech (the source is under the MIT licence).

## Download

**[Download Aurora v0.1.1 for Android](https://github.com/avnovikov/aurora/releases/latest)**

Install the APK by allowing installation from your browser or file manager when Android asks.

**Updates with [Obtainium](https://github.com/ImranR98/Obtainium):** add the repo URL `https://github.com/avnovikov/aurora`, or open the one-tap link [Add Aurora in Obtainium](obtainium://add/https://github.com/avnovikov/aurora) on a phone that already has Obtainium installed.

<img src="docs/help/screenshots/04-today.png" width="280" alt="Today — check-in">

*The Today screen: Aurora shows the next queued session, asks how you slept and whether anything hurts, and lets you connect a heart-rate strap before you start.*

New to Aurora? Follow the [First-morning tutorial](docs/tutorial/take-your-first-morning-with-aurora.md) for a guided walkthrough from setup through your first session (Settings → Library → Plan → Today → Session → Progress → History → Body).

---

## Requirements

- An Android phone or tablet (minimum Android 6 / API 23)
- The Aurora APK from [GitHub Releases](https://github.com/avnovikov/aurora/releases/latest)
- Optional: a Bluetooth heart-rate strap (connection works in the Android app only)

App id: `com.aurora.alvorada`.

---

## How Aurora works

### Plan as a queue

A **plan queue** is an ordered list of upcoming training days, not a Monday–Sunday calendar. **Today** always runs the first day in the queue. Completing a session advances the queue.

An **area day** is a planned training day focused on one body area or goal: Upper body, Lower body, Core, Full body, Mobility, Joint care, or a specific skill (for example a handstand or muscle-up path).

### Set up once

Enter bodyweight, resting and maximum heart rate, past injuries, and the gear you own. First-run screens collect that before the main tab bar appears.

### Adapt the dose

A **station** is one exercise or movement block in a session. It may prescribe one or more sets, repetitions, or a hold time.

The **dose** is the prescribed work for each station: sets, repetitions, or hold time. Poor sleep or marked pain lightens that work when you start. Recent load, missed reps, stalls, and pulse can also lighten it.

### Train in one flow

When you start, a **Session** temporarily replaces the main tab bar with a guided flow: warm-up stations → work → cool-down → a short rating. When you finish, you return to the tabs.

Swipe left to complete the current set or station. During **Rest** and **Get ready** (the short period before the next set), swipe left to end the wait and continue.

### Progress signals

On **Progress**, **current readiness** shows how close you are to the dose standard on your active goals (explicit plan targets and implied next steps). Separate from that, the morning check-in (sleep and optional pain) feeds how light today’s dose is.

---

## The main tabs

The Android app’s main tab bar, in order:

| Tab | What it shows |
|-----|----------------|
| Today | Next day in the plan queue; ≈ minutes; pulse Connect; sleep check-in (required before Start); optional pain |
| Library | Exercise catalogue; search; filters Show / Area & muscle / Level; detail with cues, standards, personal bests |
| Progress | Level profile by movement pattern (novice→elite, within-tier %); weak-links; current readiness |
| History | Logged sets (exercise · set · reps or hold · when); older rows may be session summaries only |
| Body | Muscle load front/back map and ranked list; Week / Month / Quarter / Half year / Year |
| Plan | Queue of upcoming days; Swap / Easier; remake area or skill; reorder; add days; plan level |
| Settings | You / Gear / Training / App |

<img src="docs/help/screenshots/03-plan.png" width="280" alt="Plan — Coming up">

*The Plan screen: upcoming days in queue order. Today is the first card.*

<img src="docs/help/screenshots/05-session.png" width="280" alt="Session — station">

*A Session: one station at a time — cues, dose, and a left swipe to finish the set or station.*

<img src="docs/help/screenshots/06-progress.png" width="280" alt="Progress — Where you stand">

*Progress: level by movement pattern, then current readiness on active goals.*

Screenshots for every surface live under `docs/help/screenshots/`.

---

## Tutorial

The [First-morning tutorial](docs/tutorial/take-your-first-morning-with-aurora.md) is the detailed walkthrough with screenshots. Use it once you have the APK installed; this README stays at orientation level.

For a compact tab and Session lookup: [Shell-tab reference](docs/reference/aurora-shell-tabs.md).

---

## Docs

| Document | Contents |
|----------|----------|
| [First-morning tutorial](docs/tutorial/take-your-first-morning-with-aurora.md) | Guided walkthrough with screenshots |
| [Shell-tab reference](docs/reference/aurora-shell-tabs.md) | Tabs, Session, first-run screens, plan-queue terms, storage keys |
| [Terms](docs/TERMS.md) | Use conditions, licence, medical disclaimer |
| [Privacy](docs/PRIVACY.md) | Local-only data; GDPR and CCPA/CPRA checklist |
| [Development guide](docs/development.md) | Local preview, Android build, tests, branches, snapshots |
| [Lightsail deployment](docs/deploy/lightsail.md) | Optional HTTPS hosting for a later PWA experiment |

---

## Install details

1. Download the APK from the [latest GitHub Release](https://github.com/avnovikov/aurora/releases/latest).
2. Open the file on the phone and allow installation from that source when Android asks.
3. Optional but recommended if you have Android SDK build tools: verify the signing certificate.

To get updates without checking Releases by hand, install [Obtainium](https://github.com/ImranR98/Obtainium), then Add App with `https://github.com/avnovikov/aurora` (or use [Add Aurora in Obtainium](obtainium://add/https://github.com/avnovikov/aurora)). Leave prereleases off unless you want betas.

### Optional but recommended: verify the APK

```bash
apksigner verify --print-certs path/to/app-release.apk
```

Compare the `SHA-256 digest` in the output with:

```text
ff5e2dd6fd5ba34b3baca196a7e442a6492a5a22d786dc040e9850ac8529f3a6
```

If the values do not match, do not install the APK.

Release APKs are signed locally. The signing keystore is not stored in Git or used by CI. See `android/keystore.properties.example`.

Heart-rate-strap connection requires the Android app.

---

## Privacy and data (local only)

Training history, sleep answers, pulse readings, pain or joint notes, profile settings, the plan queue, and session logs remain on your device. There is no cloud account and no server sync of that data in 0.1.

Uninstalling Aurora or clearing its app storage permanently deletes your local data. Aurora does not provide cloud backup or account recovery.

On Android, sensitive `aurora.poc.*` values go through **AuroraSecure** (Keystore-backed). A local browser preview used only for development may fall back to plaintext `localStorage`.

Full policy: [docs/PRIVACY.md](docs/PRIVACY.md). Terms of use: [docs/TERMS.md](docs/TERMS.md). **Not medical advice.** Stop if you feel pain, dizziness, or distress.

---

## Develop

Aurora is a TypeScript, Vite, Vitest, and Capacitor Android project. The planning, dose, and progression logic is pure TypeScript with no browser DOM or Bluetooth dependencies, so it is easier to test and reuse.

For local development, Android development, testing, quality checks, branch policy, and device snapshots, see the [Development guide](docs/development.md).

---

## Catalogue

Exercise catalogue imports follow each source’s licence: wger (CC), MuscleWiki (non-profit notice), free-exercise-db, Hugging Face calisthenics imports, and in-house NTC-style cues. Using the catalogue does not transfer those upstream rights beyond what those licences allow.

---

## Licence

[MIT](LICENSE) — Copyright (c) 2026 avnovikov.

---

## Known limitations in v0.1.1

Older history entries created before set-level logging may appear only as session summaries rather than individual sets. Heart-rate-strap connection is available only in the Android app. There is no cloud sync and no account recovery if you lose the phone.
