import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildLocalModelEnvironment,
  getLocalModelOptions,
  isReusableCloudCliServer,
  LocalServerController,
  renderDotEnvFile,
  resolveLocalModelConfig,
} from './localServer.js';

test('resolveLocalModelConfig uses the default local model and standard run.sh path', () => {
  const config = resolveLocalModelConfig({}, '/Users/tester');

  assert.deepEqual(config, {
    modelId: 'mlx-community/gemma-4-e4b-it-4bit',
    baseUrl: 'http://127.0.0.1:8000',
    port: 8000,
    runScriptPath: '/Users/tester/claude-code-local/run.sh',
    logPath: path.join(os.tmpdir(), 'glue-desktop-model-server.log'),
  });
});

test('resolveLocalModelConfig prefers an explicit desktop model override', () => {
  const config = resolveLocalModelConfig(
    {
      GLUE_DESKTOP_MODEL: 'mlx-community/gemma-4-12B-it-4bit',
    },
    '/Users/tester',
  );

  assert.equal(config.modelId, 'mlx-community/gemma-4-12B-it-4bit');
});

test('resolveLocalModelConfig prefers the selected local model over environment defaults', () => {
  const config = resolveLocalModelConfig(
    {
      GLUE_DESKTOP_MODEL: 'mlx-community/gemma-4-e4b-it-4bit',
    },
    '/Users/tester',
    'mlx-community/gemma-4-12B-it-4bit',
  );

  assert.equal(config.modelId, 'mlx-community/gemma-4-12B-it-4bit');
});

test('buildLocalModelEnvironment maps one model id to all required Claude env vars', () => {
  const env = buildLocalModelEnvironment('mlx-community/Qwen3.5-9B-MLX-4bit');

  assert.equal(env.ANTHROPIC_BASE_URL, 'http://127.0.0.1:8000');
  assert.equal(env.ANTHROPIC_API_KEY, 'not-needed');
  assert.equal(env.ANTHROPIC_MODEL, 'mlx-community/Qwen3.5-9B-MLX-4bit');
  assert.equal(env.ANTHROPIC_DEFAULT_OPUS_MODEL, 'mlx-community/Qwen3.5-9B-MLX-4bit');
  assert.equal(env.ANTHROPIC_DEFAULT_SONNET_MODEL, 'mlx-community/Qwen3.5-9B-MLX-4bit');
  assert.equal(env.ANTHROPIC_DEFAULT_HAIKU_MODEL, 'mlx-community/Qwen3.5-9B-MLX-4bit');
  assert.equal(env.CLAUDE_CODE_SUBAGENT_MODEL, 'mlx-community/Qwen3.5-9B-MLX-4bit');
  assert.equal(env.CLAUDE_CODE_MAX_OUTPUT_TOKENS, '16384');
  assert.equal(env.DISABLE_TELEMETRY, '1');
});

test('renderDotEnvFile emits stable KEY=value lines for the backend runtime', () => {
  const dotEnv = renderDotEnvFile({
    B_KEY: 'second',
    A_KEY: 'first',
  });

  assert.equal(dotEnv, 'A_KEY=first\nB_KEY=second\n');
});


test('getLocalModelOptions returns only downloaded configured models when present', async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'glue-local-models-'));
  const runScriptPath = path.join(homeDir, 'claude-code-local', 'run.sh');
  const hubPath = path.join(homeDir, '.cache', 'huggingface', 'hub');

  await fs.mkdir(path.dirname(runScriptPath), { recursive: true });
  await fs.writeFile(runScriptPath, [
    '#!/bin/bash',
    'MODEL_IDS=(',
    '  "mlx-community/gemma-4-e4b-it-4bit"',
    '  "mlx-community/gemma-4-12B-it-4bit"',
    ')',
    '',
  ].join('\n'), 'utf8');
  await fs.mkdir(path.join(hubPath, 'models--mlx-community--gemma-4-12B-it-4bit'), { recursive: true });

  const models = await getLocalModelOptions(homeDir);

  assert.deepEqual(models, [
    {
      id: 'mlx-community/gemma-4-12B-it-4bit',
      label: 'gemma-4-12B-it-4bit',
    },
  ]);
});

test('desktop settings persist the selected local model', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'glue-settings-'));
  const settingsPath = path.join(tempDir, 'desktop-settings.json');
  const runScriptPath = path.join(tempDir, 'claude-code-local', 'run.sh');
  const hubPath = path.join(tempDir, '.cache', 'huggingface', 'hub');

  await fs.mkdir(path.dirname(runScriptPath), { recursive: true });
  await fs.writeFile(runScriptPath, [
    '#!/bin/bash',
    'MODEL_IDS=(',
    '  "mlx-community/gemma-4-e4b-it-4bit"',
    '  "mlx-community/gemma-4-12B-it-4bit"',
    ')',
    '',
  ].join('\n'), 'utf8');
  await fs.mkdir(path.join(hubPath, 'models--mlx-community--gemma-4-e4b-it-4bit'), { recursive: true });
  await fs.mkdir(path.join(hubPath, 'models--mlx-community--gemma-4-12B-it-4bit'), { recursive: true });

  const controller = new LocalServerController({
    appRoot: '/tmp/glue-app',
    settingsPath,
    homeDir: tempDir,
  });

  await controller.saveDesktopSettings({
    ...controller.getSettings(),
    selectedLocalModel: 'mlx-community/gemma-4-12B-it-4bit',
  });

  const reloaded = new LocalServerController({
    appRoot: '/tmp/glue-app',
    settingsPath,
    homeDir: tempDir,
  });
  await reloaded.loadDesktopSettings();

  assert.equal(reloaded.getSettings().selectedLocalModel, 'mlx-community/gemma-4-12B-it-4bit');
});

test('ensureLocalServer reuses the in-flight startup work', async () => {
  const controller = new LocalServerController({
    appRoot: '/tmp/glue-app',
    settingsPath: '/tmp/glue-settings.json',
  });

  let calls = 0;
  controller.resolveLocalServerUrl = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 25));
    return 'http://localhost:3001';
  };

  const [first, second] = await Promise.all([
    controller.ensureLocalServer(),
    controller.ensureLocalServer(),
  ]);

  assert.equal(first, 'http://localhost:3001');
  assert.equal(second, 'http://localhost:3001');
  assert.equal(calls, 1);
});

test('isReusableCloudCliServer rejects a stale dev server that redirects to Vite', async (t) => {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', installMode: 'git' }));
      return;
    }

    res.writeHead(302, { Location: 'http://localhost:5173' });
    res.end('redirecting');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const { port } = server.address();
  assert.equal(await isReusableCloudCliServer(`http://127.0.0.1:${port}`), false);
});

test('isReusableCloudCliServer accepts a healthy production local server', async (t) => {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', installMode: 'npm' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>Glue</title>');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const { port } = server.address();
  assert.equal(await isReusableCloudCliServer(`http://127.0.0.1:${port}`), true);
});
