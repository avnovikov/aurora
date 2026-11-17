# Aurora · Rassvet

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat)](LICENSE)
[![CI](https://github.com/avnovikov/aurora/actions/workflows/ci.yml/badge.svg)](https://github.com/avnovikov/aurora/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/avnovikov/aurora?include_prereleases&style=flat)](https://github.com/avnovikov/aurora/releases)

**v0.1.0 — first release (from the poc line).**

Private morning training coach for Android.

You write the week as slots. The app picks exercise and dose from sleep, pulse, load, missed reps, and stalls. British English UI and voice (`en-GB`).

**[Get the APK · v0.1.0](https://github.com/avnovikov/aurora/releases/latest)** — download from the latest GitHub Release and sideload on Android.

---

## Install

Download the APK from the [latest GitHub Release](https://github.com/avnovikov/aurora/releases/latest) and sideload on Android.

## Develop

```bash
npm install
npm test && npm run smell && npm run build
npm run dev -- --host   # LAN URL → Android Chrome
```

Capacitor Android (BLE pulse): `npm run cap:sync` then `npm run cap:open`. App id `com.aurora.rassvet`. Integration branch: **`poc`**. Optional Lightsail: `docs/deploy/lightsail.md`.
## Privacy & data (local only)

Aurora keeps training history, readiness, sleep, pulse, and related health signals **on the device**. There is no cloud account and no server sync of health data in 0.1. On Android, sensitive values use **Keystore-backed AuroraSecure** storage instead of plaintext.

## Terms

See [docs/TERMS.md](docs/TERMS.md) — Terms & Conditions for local-only processing and secure on-device storage of health-related data. **Not medical advice.**

## Licence

[MIT](LICENSE) — Copyright (c) 2026 avnovikov (same as [HotspotTriage](https://github.com/avnovikov/HotspotTriage)).

## Stack

TypeScript, Vite, Vitest, Capacitor Android.

## Catalogue

Exercise catalogue imports follow each source’s licence (wger CC, MuscleWiki non-profit notice, etc.).

---

Aurora · Rassvet v0.1.0 — local only. en-GB.
