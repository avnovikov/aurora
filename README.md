# Aurora · Rassvet

Private morning training coach for Android Chrome.

- **Aurora** — GitHub / product name (dawn in English and Portuguese)
- **Rassvet** (Рассвет) — soul mark shown in the app

You write the week as slots. The app picks exercise and dose from sleep, pulse, load, missed reps, and stalls. British English UI and voice (`en-GB`, Scouse TTS when available).

## Develop

```bash
npm install
npm test
npm run smell   # ESLint + SonarJS: cyclomatic ≤10, cognitive ≤15, smells
npm run dev
```

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
