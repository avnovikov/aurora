# Capacitor BLE heart-rate — Design Spec

**Status:** approved (2026-11-15)  
**GitHub:** [#7](https://github.com/avnovikov/aurora/issues/7) and child issues  
**Locale:** British English UI

## 1. Goal

Ship a sideloadable Android shell around the existing Aurora Vite UI so a BLE heart-rate strap can stream BPM into the Today session pulse path (coral flash + “Pulse not readable” shout on silence). **No Lightsail required for HR.**

## 2. Decision

| Option | Choice |
|--------|--------|
| Transport | **Capacitor Android** + `@capacitor-community/bluetooth-le` (MIT) |
| Not chosen for v1 | Web Bluetooth-only PWA (needs HTTPS/`adb localhost`) |
| Hosting | Lightsail remains optional later for HTTPS backup/sync — out of scope here |

## 3. Architecture

```
Vite UI
  → src/pulse/hrMonitor.ts   connect / subscribe / disconnect
  → src/pulse/hrParse.ts     pure parse of 0x2A37 payload → bpm
  → session pulse watch      lastValidAtMs + shouldShoutPulseLost
  → Capacitor BleClient      service 0x180D, characteristic 0x2A37
```

- Rule engine stays free of DOM / BLE / Capacitor.
- Browser `npm run dev` keeps **Pulse ok / Pulse lost** simulators; real Connect is enabled when Capacitor native bridge is present (or a explicit “try native” path that no-ops with a clear message on web).

## 4. Deliverables

1. Capacitor Android project; app id `com.aurora.alvorada`.
2. Plugin + Android 12 BLE permissions (`BLUETOOTH_SCAN` with `neverForLocation` where applicable).
3. Pure HR parse + silence integration tests (no device).
4. Session UI: **Connect pulse** / **Disconnect**; live BPM; existing shout path on ≥5 s silence while connected.
5. npm scripts: `cap:sync`, `cap:open`; README sideload notes.
6. Docs: update `docs/deploy/lightsail.md` §6 — HR via Capacitor; Lightsail not a BLE prerequisite.

## 5. Out of scope

- iOS, Play Store publishing  
- IndexedDB → server sync  
- Lightsail instance provision  
- Background HR when the app is killed  

## 6. Risks

- Local JDK / Android Studio needed to produce an APK on this machine.  
- Some straps need system pairing before GATT notifications. Target: standard Heart Rate Profile (e.g. Polar-style).

## 7. Done when

- `npm test` + `npm run smell` green.  
- On a phone APK: connect strap → BPM updates → silence → shout path fires.  
- Related GitHub issues closed or moved with comment.
