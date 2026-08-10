#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
GLUE_SOURCE_DIR="$REPO_DIR/glue-source"
ICON_PNG="$GLUE_SOURCE_DIR/electron/assets/logo-macos.png"
ICON_ICNS="$GLUE_SOURCE_DIR/electron/assets/logo-macos.icns"
PUBLIC_ASSETS=(
  "$GLUE_SOURCE_DIR/public/logo-32.png"
  "$GLUE_SOURCE_DIR/public/logo-256.png"
  "$GLUE_SOURCE_DIR/public/favicon.png"
  "$GLUE_SOURCE_DIR/public/icons/icon-512x512.png"
)
BACKUP_DIR="$(mktemp -d)"
BEFORE_TIMES_FILE="$BACKUP_DIR/before-times.txt"

cleanup() {
  while IFS= read -r asset; do
    backup_path="$BACKUP_DIR$asset"
    if [ -f "$backup_path" ]; then
      mkdir -p "$(dirname "$asset")"
      cp -p "$backup_path" "$asset"
    else
      rm -f "$asset"
    fi
  done < <(printf '%s\n' "$ICON_PNG" "$ICON_ICNS" "${PUBLIC_ASSETS[@]}")

  rm -rf "$BACKUP_DIR"
}

backup_asset() {
  asset="$1"
  backup_path="$BACKUP_DIR$asset"

  if [ -f "$asset" ]; then
    mkdir -p "$(dirname "$backup_path")"
    cp -p "$asset" "$backup_path"
  fi
}

mtime_or_zero() {
  asset="$1"

  if [ -f "$asset" ]; then
    stat -f '%m' "$asset"
  else
    echo 0
  fi
}

trap cleanup EXIT

for asset in "$ICON_PNG" "$ICON_ICNS" "${PUBLIC_ASSETS[@]}"; do
  backup_asset "$asset"
  printf '%s\t%s\n' "$asset" "$(mtime_or_zero "$asset")" >> "$BEFORE_TIMES_FILE"
done

rm -f "$GLUE_SOURCE_DIR/public/logo-32.png" "$GLUE_SOURCE_DIR/public/icons/icon-512x512.png"

sleep 1

(
  cd "$GLUE_SOURCE_DIR"
  node public/generate-logo-assets.js
  node electron/scripts/generate-macos-icon.js
)

test -s "$ICON_PNG"
test -s "$ICON_ICNS"
test -s "$GLUE_SOURCE_DIR/public/logo-32.png"
test -s "$GLUE_SOURCE_DIR/public/icons/icon-512x512.png"

while IFS=$'\t' read -r asset before_mtime; do
  test -s "$asset"
  after_mtime="$(mtime_or_zero "$asset")"
  [ "$after_mtime" -gt "$before_mtime" ]
done < "$BEFORE_TIMES_FILE"
