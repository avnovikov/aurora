# Aurora · Rassvet

Private morning training coach for Android (Capacitor APK + optional Chrome PWA).

- **Aurora** — GitHub / product name (dawn in English and Portuguese)
- **Rassvet** (Рассвет) — soul mark shown in the app

You write the week as slots. The app picks exercise and dose from sleep, pulse, load, missed reps, and stalls. British English UI and voice (`en-GB`, Scouse TTS when available).

## Test (local)

```bash
git checkout poc
npm install
npm test          # unit tests
npm run smell     # complexity / smell gate
npm run build     # production bundle → dist/
npm run voice:prebuild   # optional: rebuild Scouse-copy WAVs (needs macOS `say`)
```

### Phone (Android Chrome)

```bash
npm run dev -- --host
```

1. Note the LAN URL Vite prints (e.g. `http://192.168.x.x:5173`).
2. Open it in **Chrome** on the phone (same Wi‑Fi).
3. Tap **Start session** once (unlocks audio).
4. Optional: Chrome menu → **Install app** (manifest is present).
5. Voice works; strap HR needs the **Android APK** (below), not LAN HTTP.

### Android APK (heart-rate strap)

```bash
npm run cap:sync    # Vite build → android/
npm run cap:open    # Android Studio (local JDK required)
```

App id: `com.aurora.rassvet`. Uses `@capacitor-community/bluetooth-le` (MIT). Sideload the debug APK; in a session tap **Connect pulse**. Spec: `docs/superpowers/specs/2026-11-15-capacitor-ble-hr-design.md`. Issues: [#7](https://github.com/avnovikov/aurora/issues/7), [#19](https://github.com/avnovikov/aurora/issues/19), [#20](https://github.com/avnovikov/aurora/issues/20).

#### Wake lock smoke check

The screen stays awake during a session (`src/session/wakeLock.ts`, Screen Wake Lock API).

1. Start a session on the phone and leave it untouched past the screen timeout — the screen should not dim.
2. Switch to another app/tab and back — the lock is released while hidden and re-acquired on return.
3. Finish the session — the lock is released and normal timeout resumes.

Unsupported browsers (or plain-HTTP origins that deny it) silently skip the lock.

### Preview production build locally

```bash
npm run build && npm run preview -- --host
```

## Deploy (Lightsail — optional, not `ks-ui-app`)

Not required for BLE. Optional HTTPS host for PWA / later sync: smallest Lightsail in **`eu-west-1`**.

```bash
npm run build
# rsync -avz --delete dist/ ubuntu@<aurora-host>:/var/www/aurora/
```

Runbook: `docs/deploy/lightsail.md` and `scripts/deploy-lightsail.sh`.

Integration branch: **`poc`**. Do not merge to `main` without explicit OK.

## Smell / complexity

HotspotTriage here is Python-oriented, so TypeScript uses **ESLint + eslint-plugin-sonarjs**:

- `complexity` (cyclomatic) max **10**
- `sonarjs/cyclomatic-complexity` threshold **10**
- `sonarjs/cognitive-complexity` max **15**
- SonarJS recommended smell rules

Run `npm run smell` before larger commits.

## Stack

TypeScript, Vite, Vitest, ESLint/SonarJS, Capacitor Android. Rule engine is pure (no DOM / Bluetooth). Optional Lightsail host (separate from KS `ks-ui-app`).

## Licence

Private. Exercise catalog imports follow each source’s licence (wger CC, MuscleWiki non-profit notice, etc.).
