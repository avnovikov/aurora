# Kettlebell “comrade” coach cue

## Goal

On kettlebell work (and the rest right after), occasionally swap the usual vocative (`mate` / `love`) for **comrade**, spoken with a heavier Russian-flavoured delivery — still the same Piper northern English male voice pack.

Own GitHub issue; implement in a dedicated worktree; PR **to `dev`**, branch **from `origin/dev`**.

## Decisions

- **Approach:** comrade lines live as extra variants in the shared `CoachLine` pools (`kettlebellOnly`), not as a post-pick text rewrite.
- **When:** kettlebell station work cues **and** the rest immediately after that set. Cleared when the next non-KB station starts.
- **Rarity:** about **1 in 5** picks for a given cue id hit a comrade variant when KB context is on (pool weighting).
- **Voice:** same model `en_GB-northern_english_male-medium`. Optional `bakeText` on `CoachLine` holds phonetic Piper input (e.g. `… kahm-rahd …`); `text` stays readable **comrade** for fallback TTS. Manifest + `voicePack` test compare `bakeText ?? text`.
- **Gate:** no separate `kettlebell` equipment id today (Settings “Dumbbell or kettlebell” is `dumbbell`). Detect KB moves via name/metadata helper (`/\bkettlebells?\b/i` on exercise name, plus any known KB ids if needed). **Dumbbell-named moves are out.**

## Behaviour

| Context | Comrade variants in pool? |
|---------|---------------------------|
| Current work exercise is kettlebell | Yes |
| Rest schedule started after that KB set | Yes (flag carried into rest speak path) |
| Non-KB work, its rest, pulse alerts, session start/done | No |

### Cue ids that gain a comrade twin

Only ids that already have a mate/love vocative in scope:

| Cue id | Display text (comrade twin) |
|--------|-----------------------------|
| `get_ready` | Coming up, comrade — reset your stance. |
| `halfway` | Halfway there, comrade. |
| `halfway` | Halfway, comrade. Nice and steady. |
| `change_side` | Change side, comrade. |
| `set_pace_nudge` | Over two minutes last time — smoother tempo, comrade. |
| `rest_go_on` | You seem rested, comrade. Want to go on? |
| `rest_extend` | Still up, comrade. Another 30. |

Phonetic spelling is fixed as ASCII **`kahm-rahd`** in each twin’s `bakeText` (same word everywhere). `prebuild-voice.sh` bakes `bakeText ?? text`; manifest stores that baked string; `voicePack.test.ts` asserts manifest text equals `bakeText ?? text`.

### Pool weighting

`CoachLine` gains `kettlebellOnly?: true` (and optional `bakeText?: string`) on comrade twins.

`pickLine(id, random, { kettlebellContext })`:

1. Start from `linesFor(id)`.
2. If `!kettlebellContext`, drop lines with `kettlebellOnly`.
3. If `kettlebellContext`, keep all lines; ensure P(pick is `kettlebellOnly`) ≈ **0.2** for that id (weight non-comrade slots and/or document an explicit weight table per id so seeded tests are stable).

`speakCoachLine` threads `kettlebellContext` into `pickLine`. Rest path (`restCue` / `sessionRest`) receives the flag from the set that just finished.

## Modules

- `src/voice/lines.ts` — variants, flag, weighted/`context`-aware `pickLine`
- `src/voice/coachVoice.ts` — pass context through `speakCoachLine`
- `src/voice/restCue.ts` + `src/ui/sessionRest.ts` — rest speak keeps KB flag
- Session work UI (`sessionView`, hold/change-side, controls, pace nudge) — set/clear context from current exercise
- `src/voice/kettlebellExercise.ts` (or similar) — `isKettlebellExercise(exercise): boolean`
- `scripts/prebuild-voice.sh`, `data/voice-manifest.tsv`, `public/voice/*.wav`
- `tests/voice/` — filter, ~20% rate with seeded random, helper unit tests

## Mute / fallback

Unchanged: settings mute blocks playback; missing WAV falls back to `speechSynthesis` with display `text` (includes “comrade”).

## Out of scope

- New `kettlebell` equipment id or Settings copy split
- Dumbbell (non-kettlebell) moves
- Changing rest timing, banter schedule, or non-vocative copy
- On-screen “comrade” chrome (voice-only)
- Mixing into unrelated WIP branches

## Acceptance criteria

- [ ] Own GitHub issue; branch from `origin/dev`; PR targets `dev`
- [ ] Non-KB sessions never select `kettlebellOnly` lines
- [ ] On KB work + following rest, comrade variants are eligible; seeded tests show ~20% pick rate per covered id
- [ ] New WAVs baked with same northern Piper model; `bakeText` phonetics for the vocative; manifest + `voicePack` use `bakeText ?? text`
- [ ] Mute and missing-asset fallback still work
