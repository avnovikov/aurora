---
title: 2026-11-17-spotify-integration
---

# Spotify session integration

## Description
Feasibility research for a Waze-style Spotify remote in Aurora (Rassvet): an in-session player strip that shows now-playing and sends play / pause / skip to the official Spotify app.

## Requirements
- From the session UI, control Spotify playback without leaving the workout.
- Show current track metadata when connected.
- Explicit UX when Spotify is missing, disconnected, or Premium-limited.
- Optional: pause or duck Spotify briefly when coach voice speaks.

## Scope
**In:** Spotify App Remote (or equivalent remote control) on Capacitor Android; session-bar player strip; connect / disconnect; play / pause / skip / now-playing; thin TS adapter mirroring Pulse; optional coach-line pause.
**Out:** In-app Spotify streaming (Web Playback), playlist browser / recommendations, music library product, Apple Music / YouTube Music, rule-engine coupling.

## Affected Areas
`src/voice/` (coach audio), `src/ui/session*` (session shell and bar), `src/session/wakeLock.ts`, Capacitor Android (`android/`, native bridges), possible new `src/music/` adapter, Lightsail or other small backend only if token swap is required.

## Audience
Alexei (product owner / sole user of the private coach) and any agent planning the feature after this research.

## Status
- [x] Research
- [ ] In progress
- [ ] Complete
