# Warmup / work Set X of Y Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shared hero set line: warmup multi-round shows Warmup → Set X of Y → name; work shows Set X of Y → name with the same set-line styling.

**Architecture:** Pure helper for warmup station-run X/Y; extend `heroHtml` with optional phase + set; one CSS class for the set line. Chalk-only UI change.

**Tech Stack:** TypeScript, Vitest, existing `sessionChalk` / `session.css`.

## Global Constraints

- PR targets `dev`; closes #255.
- No voice / strip / cool-down set line in this PR.
- TDD: failing tests before production code.

---

## File map

| File | Role |
|------|------|
| `src/ui/sessionStationSet.ts` (new) | `stationSetProgress(steps, index)` → `{ current, total } \| null` when total ≤ 1 |
| `tests/ui/sessionStationSet.test.ts` | Unit tests for run detection |
| `src/ui/sessionChalk.ts` | Wire set line into station + work heroes |
| `src/styles/session.css` | `.session-set` (or equivalent) shared style |
| `tests/ui/sessionChalkSetLine.test.ts` | Assert HTML copy for warmup multi/single + work |

---

### Task 1: Station-run helper

- [ ] Write failing tests for consecutive `stationId` runs (2+ shows X/Y; singleton null; per-side same id counts as rounds).
- [ ] Implement `stationSetProgress`.
- [ ] Run focused Vitest; pass.

### Task 2: Hero markup + CSS

- [ ] Failing chalk tests: multi-round warmup has Warmup + Set; single omits Set; work has Set without Work phase.
- [ ] Extend `heroHtml`; style `.session-set`; wire warmup/work.
- [ ] Run focused Vitest; pass.

### Task 3: Verify

- [ ] Run the new + related chalk tests.
- [ ] Stop for commit/PR only if the user asks.
