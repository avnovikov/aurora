# Session pulse on History (#184) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist strap BPM (≤1 Hz series, per-exercise averages, per-set averages) onto History via AuroraSecure and show them on the History tab.

**Architecture:** Pure in-session `pulseSessionBuffer` records downsampled samples. Session UI appends on each BPM notify and stamps `averageBpm` when a set is logged. `commitSessionEvaluation` attaches optional `HistoryEntry.pulse`. History feed/present surfaces set avg and a compact session series.

**Tech Stack:** TypeScript, Vitest, existing session/history UI.

## Global Constraints

- British English UI (`en-GB`).
- Spec: `docs/superpowers/specs/2026-11-19-session-pulse-history-design.md`.
- Omit `pulse` / set `averageBpm` when no samples.
- Do not change warmup lighten `warmupHr` contract.
- Progress UI redo is out of scope (#185).
- Branch: `feature/184-session-pulse-history` from `origin/mvp`; PR to `mvp` with `Closes #184`.

## File map

| Path | Responsibility |
|------|----------------|
| `src/pulse/pulseSessionBuffer.ts` | Downsample, set-window avg, by-exercise avg, build `HistoryPulse` |
| `src/session/setLog.ts` | Optional `averageBpm` on `SetLogEntry` |
| `src/domain/program.ts` | `HistorySetRecord.averageBpm?`, `HistoryPulse` on `HistoryEntry` |
| `src/ui/sessionEvaluation.ts` | Accept buffer/pulse; map set avg; attach `pulse` |
| `src/ui/sessionView.ts` / `sessionControls.ts` | Record samples; pass set avg into `appendSet` |
| `src/ui/app.ts` | Pass pulse into commit |
| `src/progress/historyFeed.ts` / `historyFeedPresent.ts` | Feed field + markup |
| `src/ui/historyView.ts` | Session pulse block when series present |
| `tests/pulse/pulseSessionBuffer.test.ts` | Buffer pure tests |
| `tests/ui/sessionEvaluation*.ts` / history present tests | Commit + UI |

---

### Task 1: Pure pulse session buffer

**Files:**
- Create: `src/pulse/pulseSessionBuffer.ts`
- Test: `tests/pulse/pulseSessionBuffer.test.ts`

**Produces:** `createPulseSessionBuffer`, `recordPulseSample`, `averageBpmInWindow`, `buildHistoryPulse`

- [x] **Step 1:** Failing tests — 1 Hz downsample keeps latest; window average; by-exercise; empty → undefined.
- [x] **Step 2:** Implement minimal buffer.
- [x] **Step 3:** `npx vitest run tests/pulse/pulseSessionBuffer.test.ts` green; commit.

---

### Task 2: Types + commitSessionEvaluation

**Files:**
- Modify: `src/session/setLog.ts`, `src/domain/program.ts`, `src/ui/sessionEvaluation.ts`
- Test: extend `tests/ui/sessionEvaluationSets.test.ts` (or new)

- [x] **Step 1:** Failing tests — commit with samples attaches `pulse` + set `averageBpm`; without samples omits both.
- [x] **Step 2:** Extend types; thread pulse into commit.
- [x] **Step 3:** Tests green; commit.

---

### Task 3: Session wiring

**Files:**
- Modify: `src/ui/sessionView.ts`, `src/ui/sessionControls.ts`, `src/ui/app.ts` (and handlers types as needed)

- [x] **Step 1:** Buffer lives for the open session; `onPulseBpm` records with phase/exerciseId.
- [x] **Step 2:** `completeSet` (non-skip) sets `averageBpm` from window when present.
- [x] **Step 3:** `onDone` / evaluation commit receives built `HistoryPulse`.
- [x] **Step 4:** Focused session tests green; commit.

---

### Task 4: History UI

**Files:**
- Modify: `src/progress/historyFeed.ts`, `src/progress/historyFeedPresent.ts`, `src/ui/historyView.ts`
- Test: present / feed tests

- [x] **Step 1:** Failing present test — meta includes `Avg pulse N`; session block when series exists.
- [x] **Step 2:** Implement markup.
- [x] **Step 3:** Tests green; commit.

---

### Task 5: Verify + PR prep

- [ ] Run focused Vitest suite for pulse/history/session evaluation.
- [ ] Comment on #184 with branch + acceptance checklist progress.
- [ ] Open PR to `mvp` when user asks (or after green).
