# Aurora · Rassvet

Private morning training coach for Android Chrome.

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
5. Voice + wake lock work best; **Web Bluetooth needs HTTPS** (use deploy below for the strap).

### Preview production build locally

```bash
npm run build && npm run preview -- --host
```

## Deploy (Lightsail — own instance, not `ks-ui-app`)

Target: smallest Lightsail in **`eu-west-1`**, static `dist/` behind Nginx + Let’s Encrypt HTTPS.

```bash
npm run build
# then sync dist/ to the instance, e.g.:
# rsync -avz --delete dist/ ubuntu@<aurora-host>:/var/www/aurora/
```

Scaffold / runbook: `docs/deploy/lightsail.md` and `scripts/deploy-lightsail.sh` (on `poc` as they land).  
**Do not** deploy onto KS `ks-ui-app`. Creating the instance needs your AWS OK (cost).

Integration branch: **`poc`**. Do not merge to `main` without explicit OK.

## Smell / complexity

HotspotTriage here is Python-oriented, so TypeScript uses **ESLint + eslint-plugin-sonarjs**:

- `complexity` (cyclomatic) max **10**
- `sonarjs/cyclomatic-complexity` threshold **10**
- `sonarjs/cognitive-complexity` max **15**
- SonarJS recommended smell rules

Run `npm run smell` before larger commits.

## Stack

TypeScript, Vite, Vitest, ESLint/SonarJS. Rule engine is pure (no DOM / Bluetooth). Hosted later on AWS Lightsail (separate from KS `ks-ui-app`).

## Licence

Private. Exercise catalog imports follow each source’s licence (wger CC, MuscleWiki non-profit notice, etc.).
