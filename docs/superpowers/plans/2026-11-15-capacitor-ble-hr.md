# Capacitor BLE heart-rate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap Aurora in Capacitor Android and stream BLE heart-rate into the existing pulse-lost shout path without Lightsail.

**Architecture:** Pure `hrParse` + thin `hrMonitor` adapter over `@capacitor-community/bluetooth-le`; session UI connects/disconnects and updates `PulseWatchState` / BPM. Rules stay BLE-free.

**Tech Stack:** Vite, TypeScript, Capacitor 7/8, `@capacitor-community/bluetooth-le`, Vitest, ESLint SonarJS.

## Global Constraints

- British English UI (`en-GB`).
- Product Aurora / soul Rassvet.
- Merge into `poc` only after `npm test` + `npm run smell`; do not merge to `main` without explicit OK.
- No Lightsail provision in this plan.
- App id: `com.aurora.alvorada`.

**GitHub issues:** parent [#7](https://github.com/avnovikov/aurora/issues/7); children for Cap shell, HR parse/monitor, session UI.

## File map

| Path | Responsibility |
|------|----------------|
| `src/pulse/hrParse.ts` | Parse HR measurement characteristic → bpm |
| `src/pulse/hrMonitor.ts` | Connect / notify / disconnect via BleClient |
| `tests/pulse/hrParse.test.ts` | Packet fixtures |
| `src/ui/sessionChalk.ts` | Connect / Disconnect / BPM display |
| `src/ui/sessionControls.ts` | Wire connect handlers |
| `src/ui/sessionView.ts` | Feed BPM into pulse watch |
| `capacitor.config.ts` | App id + webDir `dist` |
| `android/` | Cap-generated native project |
| `docs/deploy/lightsail.md` | Note Cap path for HR |
| `README.md` | Sideload / sync commands |

---

### Task 1: Pure HR parse (TDD)

**Files:**
- Create: `src/pulse/hrParse.ts`
- Test: `tests/pulse/hrParse.test.ts`

**Produces:** `parseHeartRateMeasurement(data: DataView): number | null`

- [ ] **Step 1:** Failing tests for flags byte (uint8 vs uint16 HR), empty buffer → null.
- [ ] **Step 2:** Minimal implementation.
- [ ] **Step 3:** `npm test` green; commit.

---

### Task 2: hrMonitor adapter + session wiring

**Files:**
- Create: `src/pulse/hrMonitor.ts`
- Modify: `src/ui/sessionChalk.ts`, `sessionControls.ts`, `sessionView.ts`, `sessionTypes.ts` as needed
- Test: extend pulse tests if silence glue changes

**Produces:** `connectHeartRate(onBpm)`, `disconnectHeartRate()`, `isNativePulseAvailable()`

- [ ] **Step 1:** Implement adapter; on web without Cap, Connect shows clear message / no-op.
- [ ] **Step 2:** UI: Connect pulse, Disconnect, live BPM; keep sim buttons for web.
- [ ] **Step 3:** On BPM, set `pulse.connected`, `lastValidAtMs`, `state.bpm`.
- [ ] **Step 4:** `npm test` + `npm run smell`; commit.

---

### Task 3: Capacitor Android shell

**Files:**
- Create: `capacitor.config.ts`, `android/` (generated)
- Modify: `package.json` scripts, `.gitignore`, `README.md`, `docs/deploy/lightsail.md`

- [ ] **Step 1:** Add `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor-community/bluetooth-le`.
- [ ] **Step 2:** `npm run build` then `npx cap add android` / `cap sync`.
- [ ] **Step 3:** AndroidManifest BLE permissions + `neverForLocation` init flag in monitor.
- [ ] **Step 4:** Document `npm run cap:sync` / `cap:open` and JDK requirement; update #7 comments.
- [ ] **Step 5:** Commit (android/ included unless huge binary noise — follow Cap defaults).

---

### Task 4: Close out issues

- [ ] Comment + close child issues; update #7 with Cap decision and remaining Lightsail optional work.
- [ ] Merge feature branch into `poc` after gates (no `main` without OK).
