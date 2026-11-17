# Design: Capture rep-set duration + mid-next-set coach cue

**As** an athlete logging rep work sets, **I want** each set’s elapsed time stored (from work-screen open to finish), **and** a brief trainer cue mid-way through the next set of that move when the last set ran past two minutes, **so that** pace is remembered and slow grinding gets a timely nudge.

## Decisions

| Topic | Choice |
|-------|--------|
| Which sets | **Rep** work sets only (not timed holds, not warm-up / cool-down) |
| Clock start | When the **work screen for that set** appears |
| Clock stop | **Swipe**, **Log set**, or **Couldn't finish** |
| Skip set | No duration stored (field omitted / undefined) |
| Persist | `durationSeconds` on `SetLogEntry` |
| Mid-session UI | None required beyond the voice/coach line |
| Slow trigger | Absolute: finished set `durationSeconds > 120` |
| Cue timing | On the **next set of the same exercise**, at **½ of that exercise’s rolling average** duration |
| Average | Stored on `ExerciseMemory`; updated only when a duration is logged |
| Cold start | If average unavailable / too few samples (< 2), cue delay falls back to **60s** (½ of the 2‑minute threshold) |
| Approach | Persist + rolling average + one-shot armed cue (Approach 2) |

## Behaviour

### 1. Stamp and measure

1. When the session paints a **rep** work set (phase `work`, not a hold), set `setStartedAtMs = Date.now()` on the active work state (or equivalent session field).
2. Reset the stamp when advancing to the next set of the same exercise or a new exercise’s first set.
3. On `completeSet` for swipe / Log set / Couldn't finish:
   - `durationSeconds = max(0, floor((now - setStartedAtMs) / 1000))`
   - Pass into `appendSet`
4. On Skip: do not set `durationSeconds`.

### 2. Rolling average

After a successful duration log for `exerciseId`:

- Read memory; update:
  - `setDurationSampleCount` (integer ≥ 0)
  - `avgSetDurationSeconds` (integer seconds)
- Incremental mean:  
  `avg' = round((avg * n + duration) / (n + 1))`, then `n' = n + 1`.
- Skip / missing duration / holds: no update.

### 3. Arm slow-set cue

When a rep set is logged with `durationSeconds > 120`:

- Arm `pendingSlowSetCueExerciseId = exerciseId` for this session (replace any prior arm).
- Do **not** speak yet.

### 4. Fire mid next set

When a **rep** work screen opens for `exerciseId === pendingSlowSetCueExerciseId`:

1. Compute delay = `max(1, floor(avgSetDurationSeconds / 2))` if `setDurationSampleCount >= 2` and avg is defined; else **60**.
2. Start a one-shot timer for that delay.
3. On fire: `speakCoachLine("set_pace_nudge")` (new id); clear the pending arm; clear the timer handle.
4. If the set completes (any stop reason) before the timer: cancel timer; **clear the arm** (cue was for this next set only — miss it rather than defer forever).
5. At most one speak per arm.

### 5. Coach copy

New `CoachLineId` (e.g. `set_pace_nudge`) with 2–3 variants in the existing Scouse/calm coach voice, e.g.:

- “Last set ran long — keep these crisp.”
- “Over two minutes last time — smoother tempo, mate.”

Not the hold `halfway` line. Prebuild assets via the usual voice script when implementing.

## Data

```ts
// SetLogEntry
durationSeconds?: number; // present for timed finishes; absent on skip

// ExerciseMemory
avgSetDurationSeconds?: number;
setDurationSampleCount?: number;
```

Older logs / memories without these fields remain valid.

## Modules

- `src/session/setLog.ts` — optional `durationSeconds` on entry; validate non-negative when present
- `src/ui/sessionControls.ts` / `sessionView` / `sessionState` — stamp start; pass duration into `appendSet`; arm / schedule / cancel cue
- `src/session/history.ts` + `src/domain/types.ts` — average fields + updater
- `src/voice/lines.ts` (+ voice prebuild) — `set_pace_nudge`
- Tests: duration on complete/fail, omit on skip; average update; cue arms after >120s; fires at half-average; cancelled if set ends early; holds never stamp

## Edge cases

- Resume mid-session: if work screen is shown again, restamp start (don’t credit background time across rest).
- Rest between sets: clock is per work appearance, not including rest.
- First sets ever: fallback 60s delay still applies once a >120s set arms a cue.
- Couldn't finish with long duration still arms the cue (same >120 rule).
- Hold exercises: no `durationSeconds`, no average update, no arm from this feature.

## Out of scope

- Progress / Library charts of set duration
- Cue on a later training day (only next set **this session**)
- Comparing to average for the **trigger** (trigger stays absolute > 2 min)
- Editing duration after the fact

## Why this shape

Persisting duration is the foundation. The absolute 2‑minute trigger is simple and matches the product call. Using half the rolling average for “middle of the next set” makes the nudge land while the athlete is still working, without a visible mid-set UI.
