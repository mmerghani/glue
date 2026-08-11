import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLocalModelMarkup, getSelectedLocalModelView } from './localModelMarkup.js';

test('getSelectedLocalModelView keeps the selected downloaded model', () => {
  const view = getSelectedLocalModelView({
    availableLocalModels: [
      { id: 'mlx-community/gemma-4-e4b-it-4bit', label: 'gemma-4-e4b-it-4bit' },
      { id: 'mlx-community/gemma-4-12B-it-4bit', label: 'gemma-4-12B-it-4bit' },
    ],
    desktopSettings: {
      selectedLocalModel: 'mlx-community/gemma-4-12B-it-4bit',
    },
  });

  assert.equal(view.selectedId, 'mlx-community/gemma-4-12B-it-4bit');
  assert.equal(view.selectedLabel, 'gemma-4-12B-it-4bit');
});

test('buildLocalModelMarkup renders explicit visible labels for each available model', () => {
  const markup = buildLocalModelMarkup({
    availableLocalModels: [
      { id: 'mlx-community/gemma-4-e4b-it-4bit', label: 'gemma-4-e4b-it-4bit' },
      { id: 'mlx-community/gemma-4-12B-it-4bit', label: 'gemma-4-12B-it-4bit' },
    ],
    desktopSettings: {
      selectedLocalModel: 'mlx-community/gemma-4-12B-it-4bit',
    },
  });

  assert.match(markup, /gemma-4-e4b-it-4bit/);
  assert.match(markup, /gemma-4-12B-it-4bit/);
  assert.match(markup, /data-cc-setting="selectedLocalModel"/);
  assert.match(markup, /checked/);
});
