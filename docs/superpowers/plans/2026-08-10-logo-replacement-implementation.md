# Glue Logo Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current desktop and in-app Glue logo assets with files generated from `glue-source/public/glue logo white.png`.

**Architecture:** Keep every existing logo reference intact and swap only the underlying asset files. Update the icon-generation scripts so they use the provided PNG source image, then regenerate the public logo/icon files and macOS app icon files with the same filenames the app already references.

**Tech Stack:** Node.js, `sharp`, GitHub/Electron asset pipeline

---

### Task 1: Make the macOS icon generator use the provided Glue logo PNG

**Files:**
- Modify: `glue-source/electron/scripts/generate-macos-icon.js`
- Test: `tests/logo-asset-generation.test.sh`

- [ ] **Step 1: Write the failing test**

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

grep -Fq -- "glue logo white.png" "$REPO_DIR/glue-source/electron/scripts/generate-macos-icon.js"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash tests/logo-asset-generation.test.sh`
Expected: FAIL because `generate-macos-icon.js` still renders the old hardcoded SVG icon.

- [ ] **Step 3: Write minimal implementation**

```js
const sourceLogoPath = 'public/glue logo white.png';

async function renderPng(entrySize) {
  return sharp(sourceLogoPath)
    .resize(entrySize, entrySize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bash tests/logo-asset-generation.test.sh`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/logo-asset-generation.test.sh glue-source/electron/scripts/generate-macos-icon.js
git commit -m "build: source macos icon from glue white logo"
```

### Task 2: Add one script to regenerate all referenced public logo files from the same source

**Files:**
- Create: `glue-source/public/generate-logo-assets.js`
- Modify: `glue-source/package.json`
- Test: `tests/logo-asset-generation.test.sh`

- [ ] **Step 1: Extend the failing test**

```bash
grep -Fq -- "generate-logo-assets.js" "$REPO_DIR/glue-source/package.json"
grep -Fq -- "glue logo white.png" "$REPO_DIR/glue-source/public/generate-logo-assets.js"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash tests/logo-asset-generation.test.sh`
Expected: FAIL because the public logo asset generator does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
const source = path.join(__dirname, 'glue logo white.png');
const outputs = [
  ['logo-32.png', 32],
  ['logo-64.png', 64],
  ['logo-128.png', 128],
  ['logo-256.png', 256],
  ['logo-512.png', 512],
  ['favicon.png', 32],
  ['icons/icon-72x72.png', 72],
  ['icons/icon-96x96.png', 96],
  ['icons/icon-128x128.png', 128],
  ['icons/icon-144x144.png', 144],
  ['icons/icon-152x152.png', 152],
  ['icons/icon-192x192.png', 192],
  ['icons/icon-384x384.png', 384],
  ['icons/icon-512x512.png', 512],
];
```

Also add a package script such as:

```json
"logo:assets": "node public/generate-logo-assets.js && npm run desktop:icon:mac"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bash tests/logo-asset-generation.test.sh`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add glue-source/public/generate-logo-assets.js glue-source/package.json tests/logo-asset-generation.test.sh
git commit -m "build: add glue logo asset generator"
```

### Task 3: Regenerate the referenced asset files and verify outputs

**Files:**
- Modify: `glue-source/electron/assets/logo-macos.png`
- Modify: `glue-source/electron/assets/logo-macos.icns`
- Modify: `glue-source/public/logo-32.png`
- Modify: `glue-source/public/logo-64.png`
- Modify: `glue-source/public/logo-128.png`
- Modify: `glue-source/public/logo-256.png`
- Modify: `glue-source/public/logo-512.png`
- Modify: `glue-source/public/favicon.png`
- Modify: `glue-source/public/icons/icon-72x72.png`
- Modify: `glue-source/public/icons/icon-96x96.png`
- Modify: `glue-source/public/icons/icon-128x128.png`
- Modify: `glue-source/public/icons/icon-144x144.png`
- Modify: `glue-source/public/icons/icon-152x152.png`
- Modify: `glue-source/public/icons/icon-192x192.png`
- Modify: `glue-source/public/icons/icon-384x384.png`
- Modify: `glue-source/public/icons/icon-512x512.png`
- Test: `tests/logo-asset-generation.test.sh`

- [ ] **Step 1: Add output existence checks to the test**

```bash
for asset in \
  "$REPO_DIR/glue-source/electron/assets/logo-macos.png" \
  "$REPO_DIR/glue-source/electron/assets/logo-macos.icns" \
  "$REPO_DIR/glue-source/public/logo-32.png" \
  "$REPO_DIR/glue-source/public/logo-256.png" \
  "$REPO_DIR/glue-source/public/favicon.png" \
  "$REPO_DIR/glue-source/public/icons/icon-512x512.png"; do
  test -f "$asset"
done
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash tests/logo-asset-generation.test.sh`
Expected: FAIL until the new generation command is executed.

- [ ] **Step 3: Generate the replacement assets**

Run:

```bash
cd glue-source
npm run logo:assets
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bash tests/logo-asset-generation.test.sh`
Expected: PASS

- [ ] **Step 5: Verify the desktop package still builds**

Run:

```bash
cd glue-source
npm run desktop:stage
```

Expected: Exit code `0`

- [ ] **Step 6: Commit**

```bash
git add glue-source/electron/assets/logo-macos.png glue-source/electron/assets/logo-macos.icns glue-source/public/logo-32.png glue-source/public/logo-64.png glue-source/public/logo-128.png glue-source/public/logo-256.png glue-source/public/logo-512.png glue-source/public/favicon.png glue-source/public/icons/icon-72x72.png glue-source/public/icons/icon-96x96.png glue-source/public/icons/icon-128x128.png glue-source/public/icons/icon-144x144.png glue-source/public/icons/icon-152x152.png glue-source/public/icons/icon-192x192.png glue-source/public/icons/icon-384x384.png glue-source/public/icons/icon-512x512.png
git commit -m "feat: replace glue desktop and ui logo assets"
```
