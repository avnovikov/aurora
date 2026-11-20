#!/usr/bin/env bash
# Fail if a release APK still grants LOCATION or INTERNET (F-Droid / Cronos posture).
# Usage: scripts/verify-android-permissions.sh [path/to.apk]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APK="${1:-}"
if [[ -z "$APK" ]]; then
  APK="$(find "$ROOT/android/app/build/outputs/apk/release" -name '*.apk' 2>/dev/null | head -1 || true)"
fi
if [[ -z "$APK" || ! -f "$APK" ]]; then
  echo "error: release APK not found; build first or pass a path" >&2
  exit 2
fi

AAPT="${AAPT:-}"
if [[ -z "$AAPT" ]]; then
  AAPT="$(ls "$HOME/Library/Android/sdk/build-tools"/*/aapt 2>/dev/null | sort -V | tail -1 || true)"
fi
if [[ -z "$AAPT" ]]; then
  AAPT="$(command -v aapt || true)"
fi
if [[ -z "$AAPT" ]]; then
  echo "error: aapt not found (set AAPT= or install Android build-tools)" >&2
  exit 2
fi

DUMP="$("$AAPT" dump permissions "$APK")"
echo "$DUMP"

forbidden=(
  android.permission.ACCESS_COARSE_LOCATION
  android.permission.ACCESS_FINE_LOCATION
  android.permission.INTERNET
)
failed=0
for perm in "${forbidden[@]}"; do
  if echo "$DUMP" | grep -Fq "name='$perm'"; then
    echo "FAIL: APK still grants $perm" >&2
    failed=1
  fi
done

if ! echo "$DUMP" | grep -Fq "name='android.permission.BLUETOOTH_SCAN'"; then
  echo "FAIL: expected BLUETOOTH_SCAN for optional Pulse HR" >&2
  failed=1
fi

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi
echo "OK: no LOCATION/INTERNET; BLUETOOTH_SCAN present ($APK)"
