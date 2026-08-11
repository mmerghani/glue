import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  GLUE_LOCAL_ALLOWED_TOOLS,
  GLUE_WRITE_IN_PARTS_GUIDANCE,
  mapCliOptionsToSDK,
  resolveClaudeMcpConfig,
} from '@/modules/providers/list/claude/claude-runtime.provider.js';

test('mapCliOptionsToSDK applies Glue local hardening defaults in local model mode', () => {
  const sdkOptions = mapCliOptionsToSDK({
    env: {
      ...process.env,
      HOME: '/Users/tester',
      GLUE_LOCAL_MODEL_MODE: '1',
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:8000',
    },
    toolsSettings: {
      allowedTools: ['Task'],
      disallowedTools: [],
      skipPermissions: false,
    },
  });

  assert.deepEqual(sdkOptions.tools, GLUE_LOCAL_ALLOWED_TOOLS);
  assert.equal(sdkOptions.allowedTools.includes('Task'), true);
  for (const tool of GLUE_LOCAL_ALLOWED_TOOLS) {
    assert.equal(sdkOptions.allowedTools.includes(tool), true);
  }
  assert.deepEqual(sdkOptions.systemPrompt, {
    type: 'preset',
    preset: 'claude_code',
    append: GLUE_WRITE_IN_PARTS_GUIDANCE,
  });
});

test('resolveClaudeMcpConfig prefers claude-code-local mcp-local.json in local model mode', async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'glue-claude-runtime-'));
  const claudeCodeLocalDir = path.join(homeDir, 'claude-code-local');
  const claudeDir = path.join(homeDir, '.claude');

  await mkdir(claudeCodeLocalDir, { recursive: true });
  await mkdir(claudeDir, { recursive: true });
  await writeFile(
    path.join(claudeCodeLocalDir, 'mcp-local.json'),
    JSON.stringify({
      mcpServers: {
        browser: {
          command: 'npx',
          args: ['-y', '@playwright/mcp@latest'],
        },
      },
    }),
    'utf8',
  );
  await writeFile(
    path.join(claudeDir, '.claude.json'),
    JSON.stringify({
      mcpServers: {
        shouldNotLoad: {
          command: 'echo',
          args: ['nope'],
        },
      },
    }),
    'utf8',
  );

  try {
    const config = await resolveClaudeMcpConfig(
      '/tmp/project',
      {
        GLUE_LOCAL_MODEL_MODE: '1',
        HOME: homeDir,
      },
      homeDir,
    );

    assert.deepEqual(config, {
      strictMcpConfig: true,
      mcpServers: {
        browser: {
          command: 'npx',
          args: ['-y', '@playwright/mcp@latest'],
        },
      },
    });
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});
