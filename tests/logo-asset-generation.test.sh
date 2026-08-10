#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

grep -Fq -- "glue logo white.png" "$REPO_DIR/glue-source/electron/scripts/generate-macos-icon.js"
