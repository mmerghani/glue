#!/bin/bash
set -euo pipefail

output="$(bash /Users/morgan/glue/install.sh --help)"

grep -Fq -- '--with-desktop-deps' <<<"$output"
grep -Fq -- 'Prepares glue-source/ for local desktop development' <<<"$output"
