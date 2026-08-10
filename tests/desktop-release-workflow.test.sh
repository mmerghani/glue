#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
WORKFLOW="$REPO_DIR/.github/workflows/desktop-release.yml"

grep -Fq -- 'build-macos:' "$WORKFLOW"

if grep -Fq -- 'build-windows:' "$WORKFLOW"; then
  echo "Unexpected Windows job in root Desktop Release workflow" >&2
  exit 1
fi

if grep -Fq -- 'SHASUMS256-windows.txt' "$WORKFLOW"; then
  echo "Unexpected Windows release asset checks in root Desktop Release workflow" >&2
  exit 1
fi
