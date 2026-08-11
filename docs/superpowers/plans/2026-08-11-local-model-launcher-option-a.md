# Local Model Launcher Option A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the desktop app from auto-starting the local backend on launch, let the user pick a downloaded local model from the launcher, and start Local Glue only after an explicit launcher action.

**Architecture:** Keep `glue cli` untouched and confine the change to the Electron desktop layer. Persist a `selectedLocalModel` in desktop settings, expose a filtered list of downloaded local models to launcher state, and make launcher actions pass the chosen model into the existing local startup flow.

**Tech Stack:** Electron, Node.js, browser-side launcher JavaScript, `node:test`

---

### Task 1: Persist the selected local model in desktop settings

**Files:**
- Modify: `glue-source/electron/localServer.js`
- Test: `glue-source/electron/localServer.test.js`

- [ ] **Step 1: Write the failing tests**

```js
test('resolveLocalModelConfig prefers the selected local model over environment defaults', () => {
  const config = resolveLocalModelConfig(
    { GLUE_DESKTOP_MODEL: 'mlx-community/gemma-4-e4b-it-4bit' },
    '/Users/tester',
    'mlx-community/gemma-4-12B-it-4bit',
  );
  assert.equal(config.modelId, 'mlx-community/gemma-4-12B-it-4bit');
});

test('desktop settings persist the selected local model', async () => {
  await controller.saveDesktopSettings({
    ...controller.getSettings(),
    selectedLocalModel: 'mlx-community/gemma-4-12B-it-4bit',
  });
  await reloaded.loadDesktopSettings();
  assert.equal(reloaded.getSettings().selectedLocalModel, 'mlx-community/gemma-4-12B-it-4bit');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test electron/localServer.test.js`
Expected: FAIL because `LocalServerController` only stores booleans plus `themeMode`, and `resolveLocalModelConfig()` ignores any persisted desktop selection.

- [ ] **Step 3: Write minimal implementation**

```js
function getDefaultDesktopSettings() {
  return {
    keepLocalServerRunning: false,
    exposeLocalServerOnNetwork: false,
    themeMode: 'system',
    selectedLocalModel: DEFAULT_LOCAL_MODEL_ID,
  };
}

function resolveLocalModelConfig(env = process.env, homeDir = os.homedir(), selectedLocalModel = null) {
  const modelId = String(selectedLocalModel || env.GLUE_DESKTOP_MODEL || env.ANTHROPIC_MODEL || DEFAULT_LOCAL_MODEL_ID);
  return { modelId, baseUrl, port, runScriptPath, logPath };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test electron/localServer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add glue-source/electron/localServer.js glue-source/electron/localServer.test.js
git commit -m "feat: persist desktop local model selection"
```

### Task 2: Surface downloaded local models to the launcher

**Files:**
- Modify: `glue-source/electron/localServer.js`
- Modify: `glue-source/electron/main.js`
- Modify: `glue-source/electron/launcher/launcher.js`
- Modify: `glue-source/electron/launcher/launcher.css`
- Test: `glue-source/electron/localServer.test.js`

- [ ] **Step 1: Write the failing test for downloaded-model filtering**

```js
test('getLocalModelOptions returns only downloaded configured models when present', async () => {
  const models = await getLocalModelOptions(homeDir);
  assert.deepEqual(models, [
    { id: 'mlx-community/gemma-4-12B-it-4bit', label: 'gemma-4-12B-it-4bit' },
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test electron/localServer.test.js`
Expected: FAIL because no helper exists to parse `claude-code-local/run.sh` and filter Hugging Face cache entries for launcher use.

- [ ] **Step 3: Write minimal implementation**

```js
async function getLocalModelOptions(homeDir = os.homedir()) {
  const configuredIds = parseConfiguredLocalModelIds(await fs.readFile(runScriptPath, 'utf8'));
  const options = await Promise.all(configuredIds.map(async (modelId) => ({
    id: modelId,
    label: getLocalModelLabel(modelId),
    downloaded: await pathExists(path.join(hubPath, `models--${modelId.replace(/\//g, '--')}`)),
  })));
  return (options.some((option) => option.downloaded) ? options.filter((option) => option.downloaded) : options)
    .map(({ id, label }) => ({ id, label }));
}
```

Also expose the list from `main.js` through launcher state and render a `<select>` in the launcher card plus local settings surface.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test electron/localServer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add glue-source/electron/localServer.js glue-source/electron/localServer.test.js glue-source/electron/main.js glue-source/electron/launcher/launcher.js glue-source/electron/launcher/launcher.css
git commit -m "feat: show downloaded local models in launcher"
```

### Task 3: Remove background auto-start and bind launcher actions to the selected model

**Files:**
- Modify: `glue-source/electron/main.js`
- Modify: `glue-source/electron/preload.cjs`
- Modify: `glue-source/electron/launcher/launcher.js`
- Test: `glue-source/electron/localOpenFlow.test.js`

- [ ] **Step 1: Keep the open flow test green as the guardrail**

```js
test('manual local open waits for resolved target and never shows the startup placeholder', async () => {
  const result = await openLocalTarget({ tabs, localServer, desktopWindow, setActiveTarget, getDesktopState });
  assert.deepEqual(result, { ok: true });
});
```

- [ ] **Step 2: Run the targeted test before changing startup**

Run: `node --test electron/localOpenFlow.test.js electron/localServer.test.js`
Expected: PASS before the startup wiring change, giving a stable baseline for the manual-open path.

- [ ] **Step 3: Write minimal implementation**

```js
ipcMain.handle('cloudcli-desktop:open-local', async (_event, selectedLocalModel) => openLocalInDesktop(selectedLocalModel));
ipcMain.handle('cloudcli-desktop:open-local-web-ui', async (_event, selectedLocalModel) => openLocalWebUi(selectedLocalModel));

async function openLocalInDesktop(selectedLocalModel = null) {
  if (selectedLocalModel) {
    await localServer.updateDesktopSetting('selectedLocalModel', selectedLocalModel);
  }
  return openLocalTarget({ tabs, localServer, desktopWindow, setActiveTarget, getDesktopState });
}
```

Remove the bootstrap call to `autoOpenLocalOnLaunch()`, and make `copyLocalWebUrl()` require an already running local server instead of implicitly starting one.

- [ ] **Step 4: Run tests and staging verification**

Run: `node --test electron/localServer.test.js electron/localOpenFlow.test.js`
Expected: PASS

Run: `node --check electron/main.js && node --check electron/localServer.js && node --check electron/launcher/launcher.js && node --check electron/preload.cjs`
Expected: PASS

Run: `npm run desktop:stage`
Expected: PASS with `Prepared thin desktop app at .desktop-build/desktop-app`

- [ ] **Step 5: Commit**

```bash
git add glue-source/electron/main.js glue-source/electron/preload.cjs glue-source/electron/launcher/launcher.js glue-source/electron/launcher/launcher.css glue-source/electron/localServer.js
git commit -m "feat: add launcher local model selection"
```
