# POC Morning Runnable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a local `npm run dev` Aurora/Rassvet session you can open on the phone tomorrow morning: check-in → warmup → legs + handstand work → log sets → rest voice.

**GitHub issues:**
- Epic: [#2](https://github.com/avnovikov/aurora/issues/2) morning-runnable POC
- [#3](https://github.com/avnovikov/aurora/issues/3) unit tests
- [#4](https://github.com/avnovikov/aurora/issues/4) UI + smell split
- [#5](https://github.com/avnovikov/aurora/issues/5) merge into `poc` after gates
- [#6](https://github.com/avnovikov/aurora/issues/6) HF Apache-2.0 import (later)
- [#7](https://github.com/avnovikov/aurora/issues/7) Bluetooth + Lightsail (later)

**Architecture:** Pure domain/rules stay DOM-free. A thin client shell drives check-in, chalk notches, set logging, and `speechSynthesis`. Persistence is `localStorage` for the POC (IndexedDB/server later). Integration line is branch `poc`; feature work branches from `poc` and merges back only after `npm test` + `npm run smell` pass.

**Tech Stack:** Vite, TypeScript, Vitest, ESLint SonarJS, vanilla DOM (no React for POC speed).

## Global Constraints

- British English UI copy (`en-GB`); prefer Scouse TTS when available.
- Product title Aurora; soul mark Rassvet in UI.
- Background `#070708`, brass `#c4a574`, coral `#e15a4a` for pulse/pain only.
- Logged sets immutable; next-set reps editable during rest only.
- Merge into `poc` only after clean-code review + `npm test` + `npm run smell`.
- Do not merge to `main` without explicit OK.
- YAGNI: no Lightsail, no Bluetooth required for tomorrow (Connect pulse can be a stub that still runs the shout path when “signal lost” is simulated).

## Branching

1. Create `poc` from current foundation tip.
2. Create `feature/poc-morning-session` from `poc`.
3. Implement on the feature branch.
4. Gate: tests + smell; then merge into `poc`.

## File map

| Path | Responsibility |
|------|----------------|
| `src/data/seed.ts` | Exercises, chains, starter morning program, doodle paths |
| `src/rules/warmupPlan.ts` | Build continuous warmup list (~10 min) |
| `src/rules/planSession.ts` | Resolve working slots via `resolveSlot` |
| `src/session/setLog.ts` | Immutable append-only set log + next-set edit |
| `src/session/storage.ts` | localStorage load/save for readiness + active workout |
| `src/voice/restCue.ts` | Get ready / 5…1 / Go |
| `src/voice/pulseAlert.ts` | “Pulse not readable” |
| `src/ui/app.ts` | Screen router: check-in → session |
| `src/ui/checkIn.ts` | Sleep + optional pain + start |
| `src/ui/sessionView.ts` | Chalk line, warmup/work, reps, swipe finish |
| `src/main.ts` | Boot |
| `src/style.css` | Morning black UI |
| `tests/**` | Unit tests for planners and set log |

---

### Task 1: Branch setup

**Files:** none (git only)

- [ ] **Step 1:** From `feature/slot-resolver-foundation`, create and push `poc`.
- [ ] **Step 2:** Create `feature/poc-morning-session` from `poc`.

---

### Task 2: Seed data

**Files:**
- Create: `src/data/seed.ts`
- Create: `tests/data/seed.test.ts`

**Produces:** `SEED_GRAPH`, `STARTER_PROGRAM`, `doodleFor(exerciseId)`

- [ ] **Step 1:** Write failing test that starter program has warmup pool + legs + handstand slots.
- [ ] **Step 2:** Implement seed with bodyweight squat chain, hip hinge, wall handstand, wrist load; map doodle jpg paths under `/doodles/`.
- [ ] **Step 3:** `npm test` green; commit.

---

### Task 3: Warmup planner

**Files:**
- Create: `src/rules/warmupPlan.ts`
- Create: `tests/rules/warmupPlan.test.ts`

**Produces:** `planWarmup(regions, pool) → WarmupStep[]` with `gapSeconds` 5 same-area / 10 cross-area.

- [ ] **Step 1:** Failing tests for gap rules and ~10 min target.
- [ ] **Step 2:** Minimal implementation; keep cognitive complexity ≤15.
- [ ] **Step 3:** Tests + smell; commit.

---

### Task 4: Session plan + set log

**Files:**
- Create: `src/rules/planSession.ts`
- Create: `src/session/setLog.ts`
- Create: `src/session/storage.ts`
- Create: `tests/rules/planSession.test.ts`
- Create: `tests/session/setLog.test.ts`

**Produces:** frozen workout; `appendSet` (immutable); `editNextReps`; persistence keys.

- [ ] **Step 1:** Failing tests for light-day poor sleep cutting sets; append rejects mutation of past sets.
- [ ] **Step 2:** Implement; commit after tests + smell.

---

### Task 5: Voice helpers

**Files:**
- Create: `src/voice/restCue.ts`
- Create: `src/voice/pulseAlert.ts`
- Create: `tests/voice/restCue.test.ts` (pure schedule of cue times)

- [ ] **Step 1:** Pure `cueSchedule(remainingSeconds)` returns events; TTS wrapper thin.
- [ ] **Step 2:** Tests; commit.

---

### Task 6: Today UI (runnable)

**Files:**
- Create: `src/ui/app.ts`, `checkIn.ts`, `sessionView.ts`
- Modify: `src/main.ts`, `src/style.css`

- [ ] **Step 1:** Check-in: Good / Fair / Poor sleep; optional hip/knee/shoulder/wrist pain; Start session (unlocks speech).
- [ ] **Step 2:** Session: chalk notches; warmup auto-advance with gaps; working straight sets; huge reps; rest timer + voice; doodle image; swipe finish; save after each set.
- [ ] **Step 3:** Manual: `npm run dev` — full morning path.
- [ ] **Step 4:** `npm test` + `npm run smell` + `npm run build`; commit.

---

### Task 7: Merge into `poc`

- [ ] **Step 1:** Confirm tests + smell + build green.
- [ ] **Step 2:** Merge `feature/poc-morning-session` → `poc` (fast-forward or merge commit).
- [ ] **Step 3:** Push `poc`. Do **not** merge to `main` without explicit OK.

## Tomorrow morning runbook

```bash
cd /Users/alexei/Documents/calistenics
git checkout poc
npm install
npm run dev -- --host
```

Open the printed HTTPS/LAN URL in Android Chrome on the same Wi‑Fi. Complete check-in, run warmup, log sets.
