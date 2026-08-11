# Local Model Launcher Design

**Goal:** Let Glue desktop users choose a local downloaded model directly from the launcher before starting Local Glue, without auto-starting the local server on app launch and without changing `glue cli` behavior.

## Scope

- Stop automatic local model backend startup during desktop app launch.
- Keep the local launcher card visible with a “starts on demand” state until the user explicitly opens Local Glue.
- Add a local model selector directly on the launcher’s Local servers card.
- Persist the selected local desktop model in desktop settings.
- Start the local server with that selected model when the user clicks `Open Local Glue` or `Open in browser`.
- Do not change command-line `glue cli` behavior.
- Do not attempt to hot-switch an already running local server to a new model.

## Current Behavior

- `electron/main.js` calls `localServer.ensureLocalServer()` during app startup, which causes the background local server startup.
- `electron/localServer.js` defaults to `mlx-community/gemma-4-e4b-it-4bit` via `DEFAULT_LOCAL_MODEL_ID`.
- The launcher Local servers card in `electron/launcher/launcher.js` has no visible model selector, so the user cannot choose a local model before startup.

## Design

### Startup Behavior

- Remove the eager local startup from app launch.
- App launch should only compute launcher state, not start the backend.
- The Local servers card should continue to show `Starts on demand` until a local action is triggered.

### Model Source

- Reuse the local model list source already established in Glue/launcher-related code where possible.
- Only show local downloaded models in this launcher selector.
- Do not show Anthropic/cloud models in the launcher’s local model selector.

### Launcher UI

- Add a visible model dropdown directly on the Local server card.
- Default selection should come from persisted desktop settings if available.
- If no saved choice exists, default to the current existing local default model so behavior remains predictable.

### Persistence

- Store the selected local model in the existing desktop settings file/path already used by the Electron app.
- Loading the app should restore the last selected local model into the launcher UI without starting the server.

### Launch Behavior

- When the user clicks `Open Local Glue` or `Open in browser`, the launcher passes the selected local model into the local server start path.
- If a compatible local server is already running, the app may reuse it, but the design does not require any new auto-restart or model switching logic.
- If the running server uses a different model, keep behavior simple and do not attempt an automatic model swap in this first fix.

## Non-Goals

- No changes to `glue cli` or standalone terminal workflows.
- No hot-switching of a running backend model.
- No new modal wizard or multi-step startup flow.
- No provider-wide refactor for codex/opencode/cloud integrations.
