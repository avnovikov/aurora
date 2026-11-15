#!/usr/bin/env bash
# Bake male en-GB coach lines with macOS `say` (Daniel).
# No true Scouse system voice on macOS — copy is Scouse; delivery is calm British male.
# Re-run after editing src/voice/lines.ts texts (keep assetKey list in sync below).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/voice"
VOICE="${AURORA_SAY_VOICE:-Daniel}"
RATE="${AURORA_SAY_RATE:-145}"
mkdir -p "$OUT"

say_line() {
  local key="$1"
  local text="$2"
  local tmp
  tmp="$(mktemp -t aurora-voice).aiff"
  echo "Baking $key ($VOICE @ $RATE): $text"
  say -v "$VOICE" -r "$RATE" "$text" -o "$tmp"
  afconvert -f WAVE -d LEI16 "$tmp" "$OUT/$key.wav"
  rm -f "$tmp"
}

say_line get_ready "Get ready..."
say_line get_ready_b "Get ready, mate."
say_line get_ready_c "Nearly on, la. Get ready."
say_line five "Five."
say_line four "Four."
say_line three "Three."
say_line two "Two."
say_line one "One."
say_line go "Go on, mate."
say_line go_b "Go! You've got this."
say_line go_c "Right, off you pop."
say_line pulse_not_readable "Pulse not readable, mate."
say_line pulse_not_readable_b "Can't see your pulse. Check the strap, la."
say_line session_start "Morning, mate. Let's get into it."
say_line session_start_b "Rassvet's up. Soft start, then we graft."
say_line warmup_done "Warmup done. Time for the real work, mate."
say_line set_logged "Set in the bank. Nice one."
say_line session_done "Session done, mate. Sound."
say_line session_done_b "That's you finished. Cup of tea?"

echo "Wrote $(ls -1 "$OUT"/*.wav | wc -l | tr -d ' ') wav files to $OUT"
