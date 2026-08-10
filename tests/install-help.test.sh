#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

output="$(bash "$REPO_DIR/install.sh" --help)"

grep -Fq -- '--with-desktop-deps' <<<"$output"
grep -Fq -- 'Prepares glue-source/ for local desktop development' <<<"$output"
grep -Fq -- 'This can take several minutes depending on your internet speed and model size.' <<<"$output"
