# Session pulse on History — Design Spec

**Status:** Approved for implementation  
**Date:** 2026-11-19  
**GitHub:** [#184](https://github.com/avnovikov/aurora/issues/184) (this work); follow-up [#185](https://github.com/avnovikov/aurora/issues/185)  
**Locale:** British English UI  
**Related:** Capacitor BLE HR ([2026-11-15-capacitor-ble-hr-design.md](./2026-11-15-capacitor-ble-hr-design.md)); warmup lighten ([2026-11-17-warmup-pulse-lighten-design.md](./2026-11-17-warmup-pulse-lighten-design.md))  
**Follow-up:** Progress UI redo — exercise-level reps (`20 / 25 / 30`) plus a small pulse signal ([#185](https://github.com/avnovikov/aurora/issues/185)).

## 1. Problem

A finished session with a connected heart-rate strap stores sets and evaluation in AuroraSecure history, but **no strap BPM**. Device snapshot 2026-11-19 confirmed: history has set logs and zero pulse fields.

Root cause: live BPM only updates the session chip. Warmup samples stay in memory for the lighten gate. Work-phase BPM is never buffered into the set log or `HistoryEntry`.

## 2. Goals

- Persist strap BPM for debugging and History:
  - **Session timeseries** (full workout).
  - **Average BPM per exercise**.
  - **Average BPM per logged set**.
- Show those on the **History** tab.
- Keep data on the existing history key (AuroraSecure).

## 3. Non-goals

- Progress tab redesign (follow-up issue).
- Changing BLE connect / silence / shout behaviour.
- Cloud sync or background HR when the app is killed.
- Replacing warmup `aurora.poc.warmupHr.v1` averages (lighten baseline stays as today).

## 4. Capture (live session)

In-memory buffer for the open session:

```ts
type PulseSample = {
  t: number;          // epoch ms
  bpm: number;        // whole bpm
  phase: SessionPhase;
  exerciseId: string | null; // set when phase is work for a known move
};
```

Rules:

1. On each strap BPM (same path as the chip, including native notify), append a sample.
2. **Downsample to ≤ 1 sample per second** (keep the latest bpm in that second).
3. While in **work**, tag `exerciseId` with the active work exercise; warmup / rest / get-ready / cooldown use `exerciseId: null`.
4. On disconnect or no strap: stop appending; keep samples already taken.
5. Set window: remember `setStartedAtMs` (already on work state); set average uses samples with `t` in `[setStartedAtMs, loggedAt]`.

## 5. Persist

### 5.1 Set log / history set row

Optional on `SetLogEntry` and `HistorySetRecord`:

```ts
averageBpm?: number; // whole bpm; omit if no samples in the set window
```

Filled when the set is logged (completed / failed), from the buffer window above. Skipped sets: omit.

### 5.2 History entry

Optional on `HistoryEntry`:

```ts
pulse?: {
  series: { t: number; bpm: number }[];
  byExercise: {
    exerciseId: string;
    averageBpm: number;   // whole bpm
    sampleCount: number;
  }[];
};
```

- `series`: downsampled session samples (no phase/exerciseId needed once committed).
- `byExercise`: mean of samples whose `exerciseId` matches while that move was active work.
- **Omit `pulse` entirely** when `series.length === 0`.
- Legacy history rows unchanged (no `pulse`, no set `averageBpm`).

Storage path: existing `aurora.poc.history.v1` via `createKeyValueStore` → AuroraSecure. Export backup and device snapshots pick it up automatically.

## 6. History UI

- Set rows that have `averageBpm`: show e.g. `Avg pulse 142` in the meta line.
- When a session has `pulse.byExercise`, surface exercise averages near that session’s exercise grouping (or on drill-in).
- When `pulse.series` exists: one compact **session pulse** block (sparkline or short readable series — not a dense dashboard).
- No strap session: History looks as today.

## 7. Acceptance criteria

1. Strap connected through a session with logged sets → history entry has `pulse.series`, `pulse.byExercise`, and set rows include `averageBpm` when samples existed in the set window.
2. No strap (or no samples) → history omits `pulse`; sets omit `averageBpm`.
3. Device snapshot / Settings export includes the new fields under history.
4. Vitest covers: 1 Hz downsample, set-window average, by-exercise average, commit omits empty pulse, History present shows avg when present.
5. Warmup lighten path still records warmup averages as today (unchanged contract).

## 8. Risks

- History JSON size grows with long sessions; 1 Hz cap keeps a ~60-minute session around a few thousand points — acceptable for local secure storage.
- Sim “Pulse ok” does not stream BPM; only real strap (or a future sim that emits bpm) fills the buffer — document in tests.
