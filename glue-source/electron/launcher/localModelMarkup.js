function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getSelectedLocalModelView(state) {
  const models = (state && state.availableLocalModels) || [];
  const selectedId = ((state && state.desktopSettings) || {}).selectedLocalModel || (models[0] && models[0].id) || '';
  const selected = models.find((model) => model.id === selectedId) || models[0] || { id: '', label: '' };

  return {
    models,
    selectedId: selected.id || '',
    selectedLabel: selected.label || '',
  };
}

export function buildLocalModelMarkup(state) {
  const view = getSelectedLocalModelView(state);
  return '<div class="cc-model-list">' + view.models.map((model) =>
    '<label class="cc-model-choice">' +
      '<input type="radio" name="selected-local-model" data-cc-setting="selectedLocalModel" value="' + escapeHtml(model.id) + '"' + (model.id === view.selectedId ? ' checked' : '') + '>' +
      '<span class="cc-model-name">' + escapeHtml(model.label) + '</span>' +
    '</label>'
  ).join('') + '</div>' +
  '<div class="cc-note">Selected model: ' + escapeHtml(view.selectedLabel) + '</div>';
}
