# Glue Release Checklist

## Before Building

- Verify `./install.sh --help` still shows the supported installer options
- Verify `bash tests/install-help.test.sh` passes
- Verify `launchers/glue` still works with `bash launchers/glue help`
- Verify `README.md` no longer contains stale setup instructions for users
- Replace `<your-public-glue-repo-url>` in `README.md` with the real public repo URL before publishing
- Verify desktop startup still works from a clean app launch with no local server already running

## Choose Distribution Mode

Pick one or both:

- **Source only**: publish the repo and installer flow
- **DMG only**: publish the packaged desktop app
- **Recommended**: publish both source and DMG

## Build

```bash
cd glue-source
npm install
npm run desktop:dist:mac
```

## Verify Artifacts

- Confirm the DMG exists at `glue-source/release/desktop/glue-desktop-<version>-mac-arm64.dmg`
- Confirm the app bundle exists at `glue-source/release/desktop/mac-arm64/Glue.app`
- Install the DMG and launch Glue directly
- Confirm Local Glue auto-starts in the background and opens without the old startup placeholder screen
- Confirm manual `Open Local Glue` behaves the same way

## Smoke Test

- Run `glue status`
- Run `glue cli` from a random project folder
- Run `glue ui`
- Confirm the desktop app can chat against the local backend

## Release Notes

Make sure the public release notes mention:

- this is macOS Apple Silicon only
- the app is not code signed or notarized yet
- Glue depends on upstream `claude-code-local` for local model serving
- source install and DMG install are both available if you publish both
