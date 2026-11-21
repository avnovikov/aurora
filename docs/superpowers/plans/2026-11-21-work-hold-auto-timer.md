# Work-hold auto timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-start work-hold timers with halfway, 5–1, hold_done, then auto-complete the set.

**Architecture:** Opt-in extensions on `holdCueSchedule`; new `sessionWorkHold` runner; wire from `sessionView` / chalk / `completeSet`.

**Tech Stack:** TypeScript, Vitest, existing coach voice pack.

## Global Constraints

- PR to `dev`; issue #243
- Station holds remain halfway-only (no countdown/hold_done unless options set)
- Skip `set_logged` when auto-completing after `hold_done`

---

### Task 1: Schedule + lines + voice

- [ ] Add `hold_done` lines; extend `holdCueSchedule` with `includeCountdown` / `includeHoldDone`
- [ ] Update holdCue tests; sync prebuild + manifest + WAVs
- [ ] Commit

### Task 2: Work-hold runner

- [ ] Add `sessionWorkHold.ts` + tests (tick cues, onComplete once, clear)
- [ ] Commit

### Task 3: Session wiring

- [ ] Chalk hold hero; view start/clear; `completeSet` skip voice option
- [ ] Focused Vitest; commit
