#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

output="$(bash "$REPO_DIR/install.sh" --help)"

grep -Fq -- '--with-desktop-deps' <<<"$output"
grep -Fq -- 'Prepares glue-source/ for local desktop development' <<<"$output"
grep -Fq -- 'The default starter model is about 5GB. Larger models take longer.' <<<"$output"
grep -Fq -- 'This download only happens once per model.' <<<"$output"
