#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
CONFIG_TS="$REPO_DIR/glue-source/src/constants/config.ts"
LOCAL_SERVER_JS="$REPO_DIR/glue-source/electron/localServer.js"

if ! grep -Fq -- "window.cloudcliDesktop" "$CONFIG_TS"; then
  echo "Desktop frontend does not detect the Electron bridge for platform mode" >&2
  exit 1
fi

if ! grep -Fq -- "VITE_IS_PLATFORM: 'true'" "$LOCAL_SERVER_JS"; then
  echo "Desktop local server does not force platform mode" >&2
  exit 1
fi
