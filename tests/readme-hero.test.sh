#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
README="$REPO_DIR/README.md"

grep -Fq -- 'Run Claude Code locally with your own models.' "$README"
grep -Fq -- 'No_API_Key' "$README"
grep -Fq -- 'Desktop_UI' "$README"
grep -Fq -- 'Web_UI' "$README"
grep -Fq -- 'Real_tool_use' "$README"
grep -Fq -- '> First run downloads the selected local model once.' "$README"
