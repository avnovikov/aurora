# Rest banter + countdown redesign

## Goal

Make longer rests feel coached: a short funny mid-rest line, **Get ready** earlier, and a full count from five — without changing the big on-screen countdown.

## Decisions

- End-cluster always uses the new timing when there is room (not gated on 30s).
- Mid-rest banter only when rest **> 30** seconds.
- Mid-rest **banter is voice-only**. End-cluster (`get_ready` / count / `go`) may still paint into `[data-rest-cue]` as today. Hero seconds stay the main visual.
- Next work is a **timed hold** (`timedNext`): get ready (if rest ≥ 10), **no** 5→1 count, go at 0. Banter still fires when rest > 30.
- Piper + Northern English male for new WAVs (same pack as existing coach lines).

## Behaviour

Schedule is computed once at rest start via `cueSchedule(remainingSeconds, { timedNext, random })`, same as today.

| When | Cue |
|------|-----|
| `remainingSeconds > 30` | One `rest_banter` variant at `ceil(remainingSeconds / 2)` seconds left |
| `remainingSeconds >= 10` | `get_ready` at **10** seconds left |
| `remainingSeconds >= 1` and not `timedNext` | Count **5 → 1** (only seconds that fit: `min(5, floor(remainingSeconds))` down to 1) |
| Always (when voice schedule runs) | `go` at **0** |

### Short rests

- Rest **≤ 30**: no banter; get ready @ 10 if ≥ 10; count from 5 when not timed next.
- Rest **&lt; 10**: no get ready; count truncated; go at 0.
- Rest **&lt; 1**: go only (existing edge).

### Mute / silent rests

Unchanged: `withVoice: false` (e.g. cool-down station gaps) builds an empty schedule. Settings mute still blocks playback in `coachVoice`.

### On-screen

`[data-rest-cue]` must **not** show banter text. Only existing end-cluster kinds that already paint (`get_ready` / `count` / `go`) may appear there — or keep painting those as today. Banter is spoken only.

## Copy (`rest_banter` variants)

Tone: calm pro-coach + light Scouse, not slapstick. Pick one at random per rest.

1. “Still here? Good — shake it out.”
2. “Resting hard is a skill, that.”
3. “Breathe. The next set’s not going anywhere.”
4. “Halfway through the sit-about. You’re winning.”

Existing `get_ready`, `five`–`one`, and `go` lines / assets are reused. **Five.** is now part of the rest count (get ready no longer occupies second 5).

## Modules

- `src/voice/restCue.ts` — extend `RestCueKind` with `rest_banter`; rewrite schedule as above; update `COUNT_IDS` to include 5 → `five`.
- `src/voice/lines.ts` — add `rest_banter` to `CoachLineId` + four variants + asset keys.
- `src/ui/sessionRest.ts` — `restCueText` skips `rest_banter` so voice-only holds; timer already speaks full schedule.
- `scripts/prebuild-voice.sh` — bake new banter WAVs with Piper northern.
- `public/voice/*.wav` — commit generated assets for the four variants.
- `tests/voice/restCue.test.ts` — replace get-ready-at-5 contract with the table above.

## Test contract (examples)

- 90s, not timed → banter @ 45, get_ready @ 10, counts 5–1, go @ 0; no event at 5 that is get_ready.
- 30s, not timed → **no** banter; get_ready @ 10; counts 5–1; go.
- 8s, not timed → no get_ready; counts at 5–1 (all fit); go.
- 3s, not timed → no get_ready; counts at 3–1 only; go.
- 90s, `timedNext` → banter @ 45, get_ready @ 10, **no** counts, go @ 0.
- 9s, `timedNext` → no banter, no get_ready, go @ 0.

## Out of scope

- Changing rest durations or planner defaults.
- On-screen funny copy or mid-rest UI chrome.
- Work-hold halfway cues (already separate).
- Continuous coaching through the whole rest.
