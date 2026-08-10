# macOS-Only Desktop Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repo-root `Desktop Release` workflow build and publish only macOS assets for Glue.

**Architecture:** Keep the root GitHub Actions entry point so GitHub discovers the workflow, but remove the Windows job and all Windows-specific publish checks from that root workflow. Add a focused regression test that fails if the root workflow starts referencing Windows again.

**Tech Stack:** GitHub Actions YAML, shell regression test, GitHub CLI verification

---

### Task 1: Lock the Root Workflow to macOS

**Files:**
- Create: `tests/desktop-release-workflow.test.sh`
- Modify: `.github/workflows/desktop-release.yml`
- Test: `tests/desktop-release-workflow.test.sh`

- [ ] **Step 1: Write the failing test**

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
WORKFLOW="$REPO_DIR/.github/workflows/desktop-release.yml"

grep -Fq -- 'build-macos:' "$WORKFLOW"
if grep -Fq -- 'build-windows:' "$WORKFLOW"; then
  echo "Unexpected Windows job in root Desktop Release workflow" >&2
  exit 1
fi
if grep -Fq -- 'SHASUMS256-windows.txt' "$WORKFLOW"; then
  echo "Unexpected Windows release asset checks in root Desktop Release workflow" >&2
  exit 1
fi
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash tests/desktop-release-workflow.test.sh`
Expected: FAIL with `Unexpected Windows job in root Desktop Release workflow`

- [ ] **Step 3: Write minimal implementation**

```yaml
publish:
  name: Publish desktop release
  needs:
    - resolve-release
    - build-macos
```

Also remove the entire `build-windows` job and the Windows-only verification lines from `.github/workflows/desktop-release.yml`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bash tests/desktop-release-workflow.test.sh`
Expected: PASS with no output

- [ ] **Step 5: Validate the workflow syntax**

Run: `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/desktop-release.yml"); puts "yaml-ok"'`
Expected: `yaml-ok`

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/desktop-release.yml tests/desktop-release-workflow.test.sh docs/superpowers/plans/2026-08-10-macos-only-desktop-release.md
git commit -m "ci: make desktop release macos only"
```
