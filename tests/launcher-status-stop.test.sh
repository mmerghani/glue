#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

TMPDIR="$(mktemp -d)"
trap 'unset BASH_ENV; HOME=/Users/morgan; /bin/rm -rf "$TMPDIR" >/dev/null 2>&1 || true' EXIT

HOME="$TMPDIR/home"
FAKEBIN="$TMPDIR/fakebin"
STATE_DIR="$TMPDIR/state"
mkdir -p "$HOME/claude-code-local" "$HOME/.cache/huggingface/hub" "$FAKEBIN" "$STATE_DIR"

cat > "$HOME/claude-code-local/run.sh" <<'EOF'
#!/bin/bash
MODEL_IDS=(
  "mlx-community/gemma-4-e4b-it-4bit"
  "mlx-community/gemma-4-12B-it-4bit"
)
EOF
chmod +x "$HOME/claude-code-local/run.sh"

mkdir -p "$HOME/.cache/huggingface/hub/models--mlx-community--gemma-4-12B-it-4bit"

cat > "$FAKEBIN/lsof" <<'EOF'
#!/bin/bash
if [[ -f "$TEST_STATE_DIR/server-running" ]]; then
  echo "4242"
fi
EOF
chmod +x "$FAKEBIN/lsof"

cat > "$FAKEBIN/ps" <<'EOF'
#!/bin/bash
if [[ "$*" == *"4242"* ]]; then
  echo "/fake/vllm_mlx serve mlx-community/gemma-4-12B-it-4bit --port 8000 --timeout 600"
fi
EOF
chmod +x "$FAKEBIN/ps"

cat > "$FAKEBIN/kill" <<'EOF'
#!/bin/bash
echo "$*" >> "$TEST_STATE_DIR/kill.log"
rm -f "$TEST_STATE_DIR/server-running"
EOF
chmod +x "$FAKEBIN/kill"

cat > "$FAKEBIN/claude" <<'EOF'
#!/bin/bash
exit 0
EOF
chmod +x "$FAKEBIN/claude"

touch "$STATE_DIR/server-running"

export HOME TEST_STATE_DIR="$STATE_DIR" PATH="$FAKEBIN:$PATH"

help_output="$(bash "$REPO_DIR/launchers/glue" help)"
grep -Fq -- 'Usage: glue {cli|ui|status|stop|models|help}' <<<"$help_output"
grep -Fq -- 'stop     Stop the local server on port 8000' <<<"$help_output"

status_output="$(bash "$REPO_DIR/launchers/glue" status)"
grep -Fq -- '✅ Server: Running on port 8000' <<<"$status_output"
grep -Fq -- 'Active model: gemma-4-12B-it-4bit' <<<"$status_output"

stop_output="$(bash "$REPO_DIR/launchers/glue" stop)"
grep -Fq -- '🛑 Stopping local server on port 8000' <<<"$stop_output"
grep -Fq -- '✅ Local server stopped' <<<"$stop_output"
grep -Fq -- '4242' "$STATE_DIR/kill.log"
