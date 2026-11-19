# History session blocks — Design Spec

**Status:** Approved for planning (Approach 1; conversation 2026-11-19)  
**Date:** 2026-11-19  
**GitHub:** [#185](https://github.com/avnovikov/aurora/issues/185)  
**Depends on:** [#184](https://github.com/avnovikov/aurora/issues/184) — session pulse + set `averageBpm`  
**Locale:** British English UI  
**Related:** Progress/History IA ([2026-11-17-progress-profile-history-design.md](./2026-11-17-progress-profile-history-design.md)); session pulse ([2026-11-19-session-pulse-history-design.md](./2026-11-19-session-pulse-history-design.md))

## 1. Problem

History is a flat newest-first **set** feed (`exercise · Set N · reps · when`). Finished sessions already store `templateName`, `evaluation`, `completedAt`, and set rows (plus pulse from #184), but the tab does not show a readable session story.

Athletes expect:

```
Plan name · date/time · overall assessment
Exercise   20 / 25 / 30   avg bpm
Exercise   8 / 8 / 6      avg bpm
…
```

## 2. Goals

- History’s primary list is **one block per finished session** (newest first).
- Each block shows plan/session label, when, overall assessment, then **one line per exercise** with rolled-up completed reps and optional avg BPM.
- Keep Progress drill-in filters working against the new shape.
- Leave **legacy** history rows (no `sets[]`) as they render today.

## 3. Non-goals

- Progress tab redesign or pulse chip on Progress.
- Expandable set-by-set detail inside a session (Approach 2 — later if needed).
- Calendar-day grouping above sessions (Approach 3).
- Changing how sessions are stored or evaluated.
- Reworking Library “Logged sets” into full session blocks (Library stays exercise-scoped set detail).

## 4. Surfaces

### 4.1 History tab (change)

Replace the flat `<ol class="history-feed">` of set rows with session blocks.

**Session header**

- `templateName`
- `completedAt` (same `formatHistoryWhen` as today)
- Overall assessment via existing labels: Easy / On target / Difficult / Wiped

**Exercise lines** (sessions with `sets[]`)

- One row per distinct `exerciseId` in logged order (first appearance order in that session’s sets).
- Reps: completed reps for each set of that exercise, joined with ` / ` (e.g. `20 / 25 / 30`).
- Holds: use the same completed value the set feed already shows (no new hold formatting rules).
- Avg BPM: prefer `pulse.byExercise` average for that exercise; else mean of that exercise’s set `averageBpm` values when present; omit the avg fragment when neither exists.
- Exercise title remains tappable → Library detail when History is wired with `onOpenExercise`.

**Pulse series**

- When `pulse.series` exists, keep one compact series preview **inside** that session block (reuse #184 present helper).
- Remove the separate top-of-tab stack of pulse-only session sections once blocks include pulse.

**Empty / filter chrome**

- Empty copy stays set-oriented only if the filtered result has no sessions; prefer “No sessions yet” / “No matching sessions” language.
- Filter chip behaviour unchanged (exercise / pattern / clear).

### 4.2 Filtered History

- **Exercise filter:** only sessions that include that exercise; within each block, show only that exercise’s line (header still full session context).
- **Pattern filter:** sessions that include at least one exercise in the pattern; within each block, show only matching exercise lines.
- Sessions that match the filter only via legacy exercise ids still appear under §4.3.

### 4.3 Legacy sessions (unchanged)

If `sets` is missing or empty:

- Keep today’s legacy presentation: one row per exercise id with `N sets that session (summary) · when` (or the existing legacy feed row shape).
- Do **not** invent rolled-up `reps / reps` for legacy rows.
- Optional: wrap legacy rows under the same session header (`templateName · when · assessment`) for visual consistency, but the **body lines stay the current legacy summary**, not fake rollups.

### 4.4 Library detail

Out of scope for layout change. Continue using the set-level feed for one exercise.

### 4.5 Progress

Unchanged. Drill-ins still open History with the same filters.

## 5. Data / model

No new persistence. Derive session blocks from existing `HistoryEntry[]` (+ #184 `pulse` / `averageBpm`).

Suggested pure builder (name flexible):

```ts
type HistorySessionBlock = {
  sessionId: string; // completedAt + templateId or existing identity used by feed
  templateName: string;
  completedAt: string;
  evaluation: SessionEvaluation;
  exercises: HistoryExerciseRollup[];
  pulse?: HistoryPulse;
  legacy: boolean;
};

type HistoryExerciseRollup = {
  exerciseId: string;
  exerciseName: string;
  completedRepsBySet: number[]; // logged order
  averageBpm?: number;
};
```

Feed construction today flattens sets in `historyFeed.ts`. Add a session-block builder (new module or extend feed) used by `historyView.ts`. Keep set-row helpers for Library / tests that still need them.

## 6. Acceptance criteria

1. History shows session blocks newest-first with header `plan/session · when · assessment`.
2. For sessions with `sets[]`, each exercise appears once with `reps / reps / …` and optional avg BPM.
3. No strap / no samples → exercise lines omit avg BPM; no invented zeros.
4. Legacy sessions (no sets) keep current summary lines; no fabricated rollups.
5. Exercise and pattern filters still work as in §4.2.
6. Progress tab markup/behaviour unchanged.
7. Vitest: rollup order and reps joining; BPM preference; filter narrowing; legacy path untouched; present HTML includes header + rollup meta.

## 7. Risks

- Filtered blocks with a single exercise may look sparse; still show full session header so assessment context is not lost.
- #184 must land (or this branch stacks on it) before avg BPM appears in real device history.
- Headline copy: change History `h1` from “Logged sets” to something session-scoped (e.g. “Sessions”) when shipping blocks.
