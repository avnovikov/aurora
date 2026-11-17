# Rep-Set Duration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log duration for rep work sets and speak a pace nudge mid-next-set when the prior set exceeded 2 minutes.

**Architecture:** Stamp `setStartedAtMs` on work enter; `completeSet` writes `durationSeconds` and updates rolling average memory; arm a one-shot cue and fire at half-average (or 60s) on the next same-exercise set.

**Tech Stack:** TypeScript, Vitest, existing coach voice lines.

## Global Constraints

- Rep work sets only; holds unchanged.
- Skip omits duration.
- Slow trigger: `durationSeconds > 120` absolute.
- Cue at `floor(avg/2)` with ≥2 samples, else 60s; cancel if set ends first.

---

### Task 1: Log field + average memory

**Files:** `src/session/setLog.ts`, `src/domain/types.ts`, `src/session/history.ts`, tests

- [ ] Add optional `durationSeconds` + validation; `setStartedAtMs` on `ActiveWorkState`
- [ ] Add memory fields + `recordSetDuration`
- [ ] Pure helpers: `setDurationSeconds`, `slowSetCueDelaySeconds`, `SLOW_SET_SECONDS = 120`

### Task 2: Wire completeSet + session cue

**Files:** `src/ui/sessionControls.ts`, `src/ui/sessionView.ts`, `src/ui/sessionState.ts`, `src/voice/lines.ts`

- [ ] Stamp start on work paint; pass duration; update memory; arm cue
- [ ] Schedule/cancel mid-set `set_pace_nudge`
- [ ] Add coach line variants (TTS/prebuild as project allows)

### Task 3: Verify

- [ ] Vitest for setLog, history average, completeSet duration, cue delay helper
