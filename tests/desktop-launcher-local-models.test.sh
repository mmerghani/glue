#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
MAIN_JS="$REPO_DIR/glue-source/electron/main.js"

if ! grep -Fq -- 'availableLocalModels: localState.availableLocalModels,' "$MAIN_JS"; then
  echo "Desktop launcher state is missing availableLocalModels" >&2
  exit 1
fi
