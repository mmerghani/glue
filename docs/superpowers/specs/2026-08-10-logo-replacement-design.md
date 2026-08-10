# Glue Logo Replacement Design

**Goal:** Replace the current dark-background Glue logo throughout the desktop app and current in-app UI surfaces using the provided `glue logo white.png`, without changing any logo references in code.

## Scope

- Replace the macOS desktop app icon assets so the dock/app/window icon uses the new white-background logo.
- Replace the current public UI logo assets that are already referenced by the launcher and in-app shell.
- Preserve the existing filenames so the app automatically picks up the new logo files without code changes where possible.
- Do not touch model selection, launcher behavior, or server logic.

## Current References

- Desktop window icon path: `glue-source/electron/main.js` uses `electron/assets/logo-macos.png` on macOS.
- macOS packaged app icon: `glue-source/package.json` points to `electron/assets/logo-macos.icns`.
- Launcher UI logo: `glue-source/electron/launcher/launcher.js` uses `public/logo-32.png`.
- App/web icon shell: `glue-source/index.html`, `public/manifest.json`, and `public/sw.js` use `public/favicon.png`, `public/logo-256.png`, and `public/icons/icon-*.png`.

## Design

### Asset Strategy

Use the provided `glue-source/public/glue logo white.png` as the source image and generate replacement PNG/icon outputs that overwrite the currently referenced filenames:

- `glue-source/electron/assets/logo-macos.png`
- `glue-source/electron/assets/logo-macos.icns`
- `glue-source/public/logo-32.png`
- `glue-source/public/logo-64.png`
- `glue-source/public/logo-128.png`
- `glue-source/public/logo-256.png`
- `glue-source/public/logo-512.png`
- `glue-source/public/favicon.png`
- `glue-source/public/icons/icon-72x72.png`
- `glue-source/public/icons/icon-96x96.png`
- `glue-source/public/icons/icon-128x128.png`
- `glue-source/public/icons/icon-144x144.png`
- `glue-source/public/icons/icon-152x152.png`
- `glue-source/public/icons/icon-192x192.png`
- `glue-source/public/icons/icon-384x384.png`
- `glue-source/public/icons/icon-512x512.png`

This keeps all existing references intact and avoids unnecessary code edits.

### Generation Approach

- Add or update a small asset-generation script that reads `glue logo white.png`.
- Use `sharp` to resize the source image into the existing PNG targets in `public`.
- Reuse the current macOS icon generation flow to build `logo-macos.png` and `logo-macos.icns` from the same source image instead of the old hardcoded SVG.

### Verification

- Confirm the generated filenames exist in the expected locations.
- Rebuild the macOS desktop package and verify the updated logo appears in the app icon and the in-app launcher/UI.
- Keep verification focused on asset replacement only.

## Non-Goals

- No new logo picker or runtime asset configuration.
- No refactor of the icon pipeline beyond switching the source image.
- No changes to model startup, active model detection, or desktop-server behavior.
