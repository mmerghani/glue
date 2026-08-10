#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
GLUE_SOURCE_DIR="$REPO_DIR/glue-source"
ICON_PNG="$GLUE_SOURCE_DIR/electron/assets/logo-macos.png"
ICON_ICNS="$GLUE_SOURCE_DIR/electron/assets/logo-macos.icns"

before_png_mtime=0
before_icns_mtime=0

if [ -f "$ICON_PNG" ]; then
  before_png_mtime="$(stat -f '%m' "$ICON_PNG")"
fi

if [ -f "$ICON_ICNS" ]; then
  before_icns_mtime="$(stat -f '%m' "$ICON_ICNS")"
fi

sleep 1

(
  cd "$GLUE_SOURCE_DIR"
  node electron/scripts/generate-macos-icon.js
)

test -s "$ICON_PNG"
test -s "$ICON_ICNS"

after_png_mtime="$(stat -f '%m' "$ICON_PNG")"
after_icns_mtime="$(stat -f '%m' "$ICON_ICNS")"

[ "$after_png_mtime" -gt "$before_png_mtime" ]
[ "$after_icns_mtime" -gt "$before_icns_mtime" ]
