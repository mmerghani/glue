import assert from 'node:assert/strict';
import test from 'node:test';

import { isExpectedNavigationAbort } from './navigationErrors.js';

test('treats Electron ERR_ABORTED navigation errors as expected', () => {
  assert.equal(isExpectedNavigationAbort({ code: 'ERR_ABORTED', message: 'load failed' }), true);
  assert.equal(isExpectedNavigationAbort(new Error("ERR_ABORTED (-3) loading 'data:text/html,placeholder'")), true);
  assert.equal(isExpectedNavigationAbort(new Error('Failed to load http://127.0.0.1:3001')), false);
});
