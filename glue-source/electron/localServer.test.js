import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildLocalModelEnvironment,
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
