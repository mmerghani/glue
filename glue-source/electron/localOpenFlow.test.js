import assert from 'node:assert/strict';
import test from 'node:test';

import { openLocalTarget } from './localOpenFlow.js';

test('manual local open waits for resolved target and never shows the startup placeholder', async () => {
  const calls = [];
  const pendingTarget = { kind: 'local', name: 'Local Glue', pending: true };
  const resolvedTarget = { kind: 'local', name: 'Local Glue', url: 'http://localhost:3001' };

  const result = await openLocalTarget({
    tabs: {
      getTab: () => null,
      upsertTarget: (target) => calls.push(['upsertTarget', target]),
    },
    localServer: {
      getLocalServerUrl: () => null,
      getPendingTarget: () => pendingTarget,
      getResolvedTarget: async () => {
        calls.push(['getResolvedTarget']);
        return resolvedTarget;
      },
    },
    desktopWindow: {
      showLocalStartupTarget: async () => {
        calls.push(['showLocalStartupTarget']);
      },
      emitDesktopState: () => calls.push(['emitDesktopState']),
      showTarget: async (target) => {
        calls.push(['showTarget', target]);
      },
    },
    setActiveTarget: (target) => calls.push(['setActiveTarget', target]),
    getDesktopState: () => ({ ok: true }),
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(calls.some(([name]) => name === 'showLocalStartupTarget'), false);
  assert.deepEqual(calls, [
    ['upsertTarget', pendingTarget],
    ['setActiveTarget', pendingTarget],
    ['emitDesktopState'],
    ['getResolvedTarget'],
    ['showTarget', resolvedTarget],
  ]);
});
