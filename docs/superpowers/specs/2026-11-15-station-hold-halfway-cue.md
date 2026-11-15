# Station hold halfway cue

## Goal

On timed warm-up and cool-down stations, speak a short coach line at the midpoint of the hold (e.g. “Halfway there, mate.”).

## Scope

- Warm-up and cool-down stations only (same `startStationHold` path).
- Not work holds (no auto timer yet).

## Behaviour

- `holdSeconds` must be a non-negative integer (fractional values are rejected).
- Holds **under 6 seconds** skip the cue (too short).
- Otherwise one event at `ceil(holdSeconds / 2)` seconds remaining.
- Spoken once via `speakExactLine`; optional on-screen line under the countdown.
- Line id `halfway` with Scouse variants; prebuilt WAV when assets exist, else TTS fallback.

## Modules

- `src/voice/holdCue.ts` — pure schedule (mirrors rest cues)
- `src/voice/lines.ts` — `halfway` lines
- `src/ui/sessionWarmup.ts` — fire cue during the hold tick
- `scripts/prebuild-voice.sh` — bake WAVs

## Update (2026-11-16)

- Per-side stations get no halfway line: they already pause halfway and say "Change side".
- Lines are baked with Piper (en_GB northern_english_male) like the rest of the pack: "Halfway there, mate.", "That's half — hold it there.", "Halfway, love. Nice and steady."
