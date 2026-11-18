#!/usr/bin/env bash
# Build Vite dist/ and rsync to Aurora Lightsail (never ks-ui-app).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_DIR="/var/www/aurora"
DRY_RUN=0

usage() {
  echo "Usage: AURORA_HOST=user@host $0 [--dry-run]" >&2
  echo "  AURORA_HOST  SSH target (required). May be host only; defaults user ubuntu." >&2
  exit 1
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $arg" >&2; usage ;;
  esac
done

if [[ -z "${AURORA_HOST:-}" ]]; then
  echo "Error: AURORA_HOST is empty. Set e.g. export AURORA_HOST=ubuntu@1.2.3.4" >&2
  exit 1
fi

SSH_TARGET="$AURORA_HOST"
if [[ "$SSH_TARGET" != *@* ]]; then
  SSH_TARGET="ubuntu@${SSH_TARGET}"
fi

if [[ "$SSH_TARGET" == *ks-ui-app* ]]; then
  echo "Error: refusing to deploy to ks-ui-app. Use a dedicated Aurora Lightsail host." >&2
  exit 1
fi

cd "$ROOT"
echo "Building production bundle..."
npm run build

RSYNC_OPTS=(-avz --delete)
if [[ "$DRY_RUN" -eq 1 ]]; then
  RSYNC_OPTS+=(--dry-run)
  echo "Dry run: no files will be changed on the server."
fi

echo "Syncing dist/ → ${SSH_TARGET}:${REMOTE_DIR}/"
rsync "${RSYNC_OPTS[@]}" dist/ "${SSH_TARGET}:${REMOTE_DIR}/"

if [[ "$DRY_RUN" -eq 0 ]]; then
  echo "Deploy complete."
fi