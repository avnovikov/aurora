# Aurora · Rassvet

Private morning training coach for Android Chrome.

- **Aurora** — GitHub / product name (dawn in English and Portuguese)
- **Rassvet** (Рассвет) — soul mark shown in the app

You write the week as slots. The app picks exercise and dose from sleep, pulse, load, missed reps, and stalls. British English UI and voice (`en-GB`, Scouse TTS when available).

## Develop

```bash
npm install
npm test
npm run dev
```

## Stack

TypeScript, Vite, Vitest. Rule engine is pure (no DOM / Bluetooth). Hosted later on AWS Lightsail (separate from KS `ks-ui-app`).

## Licence

Private. Exercise catalog imports follow each source’s licence (wger CC, MuscleWiki non-profit notice, etc.).
