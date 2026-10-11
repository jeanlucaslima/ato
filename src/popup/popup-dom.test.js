import { describe, expect, it, vi } from 'vitest';
import { getPopupElements } from './popup-dom.js';

const REQUIRED_IDS = [
  'total-tabs',
  'duplicate-count',
  'domain-count',
  'stats-summary',
  'duplicate-list',
  'all-tabs-list',
  'empty-state',
  'close-all-btn',
  'review-duplicates-btn',
  'exit-duplicates-review-btn',
  'domain-filter-input',
  'domain-filter-clear',
  'domain-filter-dropdown',
  'sort-buttons',
  'duplicates-sort-buttons',
  'undo-duplicates-btn',
  'undo-row',
  'undo-message',
  'pinned-warning',
  'pinned-skip-count',
  'browser-warning',
  'browser-skip-count',
  'options-btn',
  'scope-btn',
  'scope-label',
  'global-search-input',
  'global-search-clear',
  'search-results-count',
  'search-mode-chip',
  'search-mode-chip-label',
  'search-mode-chip-remove',
  'search-field-controls',
  'search-precision-controls',
  'duplicates-header',
  'duplicates-content',
  'duplicates-section-count',
  'all-tabs-header',
  'all-tabs-content',
  'all-tabs-section-count',
  'domain-sections-container',
  'domain-sort-bar',
  'domain-sort-buttons',
  'search-results-container',
  'search-results-list',
  'search-results-section-count',
  'search-empty-state',
  'close-search-results-btn',
  'move-search-results-btn',
  'duplicates-summary-primary',
  'duplicates-summary-secondary'
];

function createRoot({ missingId = null, browseTabsEl = {} } = {}) {
  const elements = new Map(REQUIRED_IDS.map(id => [id, { id }]));
  if (missingId) elements.delete(missingId);

  return {
    getElementById: vi.fn(id => elements.get(id) || null),
    querySelector: vi.fn(selector => selector === '.browse-tabs' ? browseTabsEl : null),
    querySelectorAll: vi.fn(selector => selector === '.browse-tab' ? [{ dataset: { view: 'tabs' } }] : [])
  };
}

describe('popup DOM lookup', () => {
  it('returns all popup elements from the document root', () => {
    const root = createRoot();

    const elements = getPopupElements(root);

    expect(elements.totalTabsEl.id).toBe('total-tabs');
    expect(elements.browseTabsEl).toBeTruthy();
    expect(elements.browseTabButtons).toHaveLength(1);
  });

  it('fails fast when a required id is missing', () => {
    const root = createRoot({ missingId: 'total-tabs' });

    expect(() => getPopupElements(root)).toThrow('Missing popup element #total-tabs');
  });

  it('fails fast when the browse tabs container is missing', () => {
    const root = createRoot({ browseTabsEl: null });

    expect(() => getPopupElements(root)).toThrow('Missing popup element .browse-tabs');
  });
});
