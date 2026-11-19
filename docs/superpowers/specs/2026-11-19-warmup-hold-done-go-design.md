# Warmup hold-done + rest Go at zero

## Goal

When each **warmup** station timer finishes, speak a short Scouse stop/enough line. Fix rest voice so **Go** plays at **0 on every** voiced rest (today the 0-second cue is skipped, so Go often only seems to fire once).

Branch from **`origin/dev`**; PR targets **`dev`**.

**Slices:** Go-at-0 fix first — GitHub **#178**. Warmup `hold_done` is a separate follow-up issue after #178 merges.

## Decisions

- **Hold end cue:** new coach id `hold_done` with three random variants (same Piper northern English male pack).
- **Where `hold_done` fires:** every **warmup** timed station when the clock hits 0 (including swipe-to-finish). **Not** cool-down.
- **Go at 0:** in `sessionRest`, when `restLeft` reaches 0, speak the scheduled cue at 0 (normally `go`) **before** calling `finish()`, if voice is on and that second was not already spoken.
- **Work holds:** out of scope for implementation in this PR; documented as a **follow-up** below (real countdown + halfway + `hold_done`).

## Behaviour

| Moment | Voice |
|--------|--------|
| Warmup station clock → 0 | One `hold_done` line, then gap rest if any |
| Cool-down station clock → 0 | Silent (unchanged) |
| Voiced rest clock → 0 (warmup gap or work) | Speak scheduled `go` (or other at-0 cue), then end rest |
| Mute | No speech |
| Skip rest early (swipe) | No forced Go |

### `hold_done` copy

1. “Stop there, mate.”
2. “Enough, lad.”
3. “That’ll do.”

Pick one at random via existing `pickLine` / `speakCoachLine`.

## Root cause (Go once)

`startRestTimer`’s tick decrements `restLeft`, and when `restLeft <= 0` it calls `finish()` **without** running `speakRestCue(0, …)`. The schedule includes `go` at `atSecondsLeft: 0`, so that line never plays on a normal countdown. Fix: speak the at-0 cue (if present) immediately before finish.

## Modules

- `src/voice/lines.ts` — `hold_done` + three variants
- `scripts/prebuild-voice.sh`, `data/voice-manifest.tsv`, `public/voice/*.wav`
- `src/ui/sessionWarmup.ts` — speak `hold_done` when finishing a warmup station (`stationPhase === "warmup"`)
- `src/ui/sessionRest.ts` — speak scheduled cue at 0 before `finish()`
- Tests: warmup finish speaks `hold_done`; cool-down does not; rest timer speaks go at 0; mute still silent

## Follow-up (document only — not this PR)

**Work-area timed holds** today have **no** auto countdown (athlete logs the set; halfway cues are warmup/cool-down stations only — see `2026-11-15-station-hold-halfway-cue.md`).

Future story should:

1. Add a real countdown UI/timer for work items with `effort === "hold"`.
2. Reuse `holdCueSchedule` / halfway voice mid-hold (and change-side if ever applicable).
3. Speak `hold_done` when that work-hold clock hits 0 (same lines as warmup).
4. Keep rest **Go** at 0 (from this PR’s rest fix).

File a separate GitHub issue when picking that work up; link it here.

## Out of scope (this PR)

- Implementing the work-hold auto timer
- Cool-down `hold_done`
- Changing `set_logged` copy
- Rest timing / banter / get-ready schedule (except speaking the existing at-0 event)

## Acceptance criteria

- [ ] Own issue; branch from `origin/dev`; PR to `dev`
- [ ] Each warmup station end speaks one of the three `hold_done` lines (muted → silent)
- [ ] Cool-down station end does not speak `hold_done`
- [ ] Every voiced rest that schedules `go` at 0 actually speaks it when the clock hits 0
- [ ] WAVs + manifest + `voicePack` in sync
- [ ] Follow-up work-hold timer section remains in this spec (or linked issue) for later
