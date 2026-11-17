#!/usr/bin/env bash
# Bake coach lines with Piper northern English male (en_GB-northern_english_male-medium).
# Copy: calm pro coach + light Scouse colour. Keep in sync with src/voice/lines.ts.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/voice"
MODEL="${AURORA_PIPER_MODEL:-$ROOT/.voice-train/models/en_GB-northern_english_male-medium.onnx}"
PIPER_BIN="${AURORA_PIPER_BIN:-$ROOT/.voice-train/venv/bin/piper}"

if [[ ! -x "$PIPER_BIN" ]]; then
  if command -v piper >/dev/null 2>&1; then
    PIPER_BIN="$(command -v piper)"
  else
    echo "piper not found. Set AURORA_PIPER_BIN or install into .voice-train/venv." >&2
    exit 1
  fi
fi

if [[ ! -f "$MODEL" ]]; then
  echo "Piper model missing: $MODEL" >&2
  echo "Set AURORA_PIPER_MODEL to en_GB-northern_english_male-medium.onnx" >&2
  exit 1
fi

mkdir -p "$OUT"
# Which model baked each line, rewritten whole on every run so one run = one
# voice. tests/voice/voicePack.test.ts checks it against src/voice/lines.ts.
MANIFEST="$ROOT/data/voice-manifest.tsv"
printf 'assetKey\tmodel\ttext\n' > "$MANIFEST"

bake_line() {
  local key="$1"
  local text="$2"
  local wav="$OUT/$key.wav"
  echo "Baking $key: $text"
  printf '%s\n' "$text" | "$PIPER_BIN" -m "$MODEL" -f "$wav"
  printf '%s\t%s\t%s\n' "$key" "$(basename "$MODEL")" "$text" >> "$MANIFEST"
}

# Keep in sync with ALL_COACH_LINES in src/voice/lines.ts
bake_line get_ready "Get ready..."
bake_line get_ready_b "Coming up, mate — reset your stance."
bake_line get_ready_c "Next set in a few — breathe."
bake_line five "Five."
bake_line four "Four."
bake_line three "Three."
bake_line two "Two."
bake_line one "One."
bake_line go "Go."
bake_line go_b "You've got this."
bake_line go_c "Nice and controlled — go."
bake_line halfway "Halfway there, mate."
bake_line halfway_b "That's half — hold it there."
bake_line halfway_c "Halfway, love. Nice and steady."
bake_line halfway_d "Halfway — keep the reps coming."
bake_line pulse_not_readable "Pulse not reading — check the strap, mate."
bake_line pulse_not_readable_b "Can't see your pulse. Tighten the band."
bake_line session_start "Morning. Soft start, then we graft."
bake_line session_start_b "Ready when you are, mate."
bake_line session_start_c "Let's get moving — nice and steady."
bake_line warmup_done "Warmup done. Real work next."
bake_line warmup_done_b "Body's awake. Time for the main sets."
bake_line change_side "Change side, mate."
bake_line change_side_b "Other side when you're ready."
bake_line set_logged "Set in the bank. Nice one."
bake_line set_logged_b "Good set — shake it out."
bake_line set_logged_c "Logged. Take the rest."
bake_line session_done "Session done. Sound work today."
bake_line session_done_b "That's you finished — recover well."
bake_line session_done_c "Nice session. Cup of tea?"

echo "Wrote $(ls -1 "$OUT"/*.wav | wc -l | tr -d ' ') wav files to $OUT via $(basename "$MODEL")"
