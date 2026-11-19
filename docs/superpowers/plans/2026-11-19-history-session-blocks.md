# History session blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** History tab shows one block per finished session (header + rolled-up exercise lines with optional avg BPM); legacy summaries unchanged.

**Architecture:** Pure `buildHistorySessionBlocks` derives blocks from `HistoryEntry[]` + filter; present helpers render HTML; `historyView` switches to blocks. Set-level `buildHistoryFeed` stays for Library.

**Tech Stack:** TypeScript, Vitest, existing History/Progress present patterns.

**Spec:** `docs/superpowers/specs/2026-11-19-history-session-blocks-design.md`  
**Depends on:** #184 pulse / `averageBpm` (this branch stacks on `feature/184-session-pulse-history`).

## Global Constraints

- British English UI
- Legacy sessions (no `sets[]`): keep summary lines; no fabricated rollups
- Progress tab unchanged; Library set feed unchanged
- Omit avg BPM when no samples (no zeros)

---

### Task 1: Session block builder

**Files:**
- Create: `src/progress/historySessionBlocks.ts`
- Test: `tests/progress/historySessionBlocks.test.ts`

**Produces:**
- `buildHistorySessionBlocks({ history, graph, filter? }) → { blocks, hasLegacyOnly }`
- Types: `HistorySessionBlock`, `HistoryExerciseRollup`

- [ ] **Step 1:** Failing tests — rollup order/reps; byExercise BPM preference; set averageBpm fallback; exercise/pattern filter; legacy body unchanged; newest-first sessions
- [ ] **Step 2:** Implement builder
- [ ] **Step 3:** Vitest green

### Task 2: Present + History view

**Files:**
- Modify: `src/progress/historyFeedPresent.ts`
- Modify: `src/ui/historyView.ts`
- Modify: `src/style.css` (session block spacing)
- Test: `tests/progress/historySessionBlocksPresent.test.ts`

- [ ] **Step 1:** Failing present tests — header `name · when · assessment`; exercise `reps / …` + optional avg; pulse series inside block; empty copy
- [ ] **Step 2:** Implement HTML + wire `renderHistoryView` (h1 “Sessions”; drop top-level `sessionPulsesHtml` stack)
- [ ] **Step 3:** Vitest + smell green

### Task 3: Docs / issue alignment

**Files:**
- Ensure: `docs/superpowers/specs/2026-11-19-history-session-blocks-design.md` on branch
- Touch: `README.md` / `docs/reference/aurora-shell-tabs.md` History one-liners if they still say set-only

- [ ] **Step 1:** Update History tab descriptions to session blocks
- [ ] **Step 2:** Focused vitest + `npm run smell`
