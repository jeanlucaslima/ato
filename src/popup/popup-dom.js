function requireElement(root, id) {
  const element = root.getElementById(id);
  if (!element) {
    throw new Error(`Missing popup element #${id}`);
  }
  return element;
}

function requireSelector(root, selector) {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing popup element ${selector}`);
  }
  return element;
}

export function getPopupElements(root = document) {
  return {
    totalTabsEl: requireElement(root, 'total-tabs'),
    duplicateCountEl: requireElement(root, 'duplicate-count'),
    domainCountEl: requireElement(root, 'domain-count'),
    statsSummaryEl: requireElement(root, 'stats-summary'),
    duplicateListEl: requireElement(root, 'duplicate-list'),
    allTabsListEl: requireElement(root, 'all-tabs-list'),
    emptyStateEl: requireElement(root, 'empty-state'),
    closeAllBtn: requireElement(root, 'close-all-btn'),
    reviewDuplicatesBtn: requireElement(root, 'review-duplicates-btn'),
    exitDuplicatesReviewBtn: requireElement(root, 'exit-duplicates-review-btn'),
    domainFilterInputEl: requireElement(root, 'domain-filter-input'),
    domainFilterClearEl: requireElement(root, 'domain-filter-clear'),
    domainFilterDropdownEl: requireElement(root, 'domain-filter-dropdown'),
    sortButtonsEl: requireElement(root, 'sort-buttons'),
    duplicatesSortButtonsEl: requireElement(root, 'duplicates-sort-buttons'),
    undoDuplicatesBtn: requireElement(root, 'undo-duplicates-btn'),
    undoRowEl: requireElement(root, 'undo-row'),
    undoMessageEl: requireElement(root, 'undo-message'),
    pinnedWarningEl: requireElement(root, 'pinned-warning'),
    pinnedSkipCountEl: requireElement(root, 'pinned-skip-count'),
    browserWarningEl: requireElement(root, 'browser-warning'),
    browserSkipCountEl: requireElement(root, 'browser-skip-count'),
    optionsBtn: requireElement(root, 'options-btn'),
    scopeBtn: requireElement(root, 'scope-btn'),
    scopeLabel: requireElement(root, 'scope-label'),
    globalSearchInputEl: requireElement(root, 'global-search-input'),
    globalSearchClearEl: requireElement(root, 'global-search-clear'),
    searchResultsCountEl: requireElement(root, 'search-results-count'),
    searchModeChipEl: requireElement(root, 'search-mode-chip'),
    searchModeChipLabelEl: requireElement(root, 'search-mode-chip-label'),
    searchModeChipRemoveEl: requireElement(root, 'search-mode-chip-remove'),
    searchFieldControlsEl: requireElement(root, 'search-field-controls'),
    searchPrecisionControlsEl: requireElement(root, 'search-precision-controls'),
    duplicatesHeaderEl: requireElement(root, 'duplicates-header'),
    duplicatesContentEl: requireElement(root, 'duplicates-content'),
    duplicatesSectionCountEl: requireElement(root, 'duplicates-section-count'),
    domainSectionsContainer: requireElement(root, 'domain-sections-container'),
    domainSortBarEl: requireElement(root, 'domain-sort-bar'),
    domainSortButtonsEl: requireElement(root, 'domain-sort-buttons'),
    searchResultsContainerEl: requireElement(root, 'search-results-container'),
    searchResultsListEl: requireElement(root, 'search-results-list'),
    searchResultsSectionCountEl: requireElement(root, 'search-results-section-count'),
    searchEmptyStateEl: requireElement(root, 'search-empty-state'),
    closeSearchResultsBtn: requireElement(root, 'close-search-results-btn'),
    moveSearchResultsBtn: requireElement(root, 'move-search-results-btn'),
    browseTabsEl: requireSelector(root, '.browse-tabs'),
    browseTabButtons: root.querySelectorAll('.browse-tab'),
    duplicatesSummaryPrimaryEl: requireElement(root, 'duplicates-summary-primary'),
    duplicatesSummarySecondaryEl: requireElement(root, 'duplicates-summary-secondary')
  };
}
