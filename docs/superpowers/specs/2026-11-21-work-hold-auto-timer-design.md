# Work-hold auto timer (halfway + 5–1 + hold_done)

## Goal

Work items with `effort === "hold"` auto-start a countdown when the set appears. Cue **halfway** (when long enough), count **5, 4, 3, 2, 1**, speak **hold_done**, then **auto-log completed** and advance.

Branch from **`origin/dev`**; PR targets **`dev`**. Issue **#243**.

## Decisions

- **Approach A:** Extend `holdCueSchedule` (opt-in countdown + hold_done) and add a work-hold runner patterned on `startStationHold`. Stations stay halfway-only.
- **Auto-complete at 0:** call existing `completeSet(..., "completed")` with `skipSetLoggedVoice` so `hold_done` is not followed by `set_logged`.
- **Early finish** (Log / Failed / Skip / swipe): clear the timer; no forced `hold_done`; normal set-logged / silent paths apply.
- **Rest before a hold:** unchanged (`timedNext` still skips 5–1 into the hold). Countdown lives **on the hold**.
- **Halfway + countdown overlap:** when countdown is on, schedule halfway only if mid-point is **> 5** (hold ≥ 11s). Shorter holds get countdown (+ done) without a cramped halfway.
- **Voice bank:** reuse existing `halfway` + count lines; add new `hold_done` variants (Stop there / Enough, lad / That’ll do / Done).

## Behaviour

| Moment | Voice / UI |
|--------|------------|
| Enter work hold set | Timer starts at prescribed seconds; hero ticks `s` |
| Mid-hold (hold ≥ 11s with countdown) | Halfway line once |
| Last 5s (truncated if shorter) | 5…1 |
| Clock → 0 | One `hold_done`, then auto-complete set |
| Mute | No speech (same as other cues) |
| Manual complete early | Clear timer; no remaining cues |

## Modules

- `src/voice/holdCue.ts` — options `includeCountdown`, `includeHoldDone`
- `src/voice/lines.ts` — `hold_done` + variants; `scripts/prebuild-voice.sh` + manifest + WAVs
- `src/ui/sessionWorkHold.ts` — tick / paint / speak / `onComplete`
- `src/ui/sessionView.ts` — start/clear work-hold timer on work phase
- `src/ui/sessionChalk.ts` — hold hero: ticking seconds + cue line
- `src/ui/sessionControls.ts` — `skipSetLoggedVoice` on auto-complete
- Tests: schedule; runner halfway → 5–1 → done → complete once; early clear

## Out of scope

- Cool-down / warmup station `hold_done` (separate follow-up from 2026-11-19 spec)
- Changing rest-before-hold cue policy
- Rep-set behaviour

## Acceptance criteria

- [ ] Own issue #243; branch from `origin/dev`; PR to `dev`
- [ ] Work hold timer auto-starts
- [ ] Halfway when mid > 5; else countdown + done only as scheduled
- [ ] 5–1 then `hold_done`, then auto-log completed
- [ ] Manual finish still works; early finish skips leftover cues
- [ ] Station halfway schedule unchanged when options off
- [ ] Voice pack in sync
