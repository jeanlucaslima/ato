import { describe, expect, it } from 'vitest';
import {
  createInitialPopupState,
  getCursorItem,
  getDuplicateTabs,
  getLargeDomainGroups,
  getScopedTabs,
  getSearchResultTabIds,
  getSearchNavigationItems,
  getTabsToCloseForAllDuplicates,
  getVisibleNavigationItems,
  isDomainExpanded,
  makeItemId,
  makeTabItemId,
  reducePopupState
} from './popup-state.js';

function withTabs(tabs, options = {}) {
  let state = createInitialPopupState({
    focusedWindowId: 1,
    currentWindowOnly: false,
    defaultBrowseView: options.view || 'tabs',
    defaultSearchMode: 'contains'
  });
  state = reducePopupState(state, {
    type: 'SET_SETTINGS',
    settings: {
      matchMode: 'exact',
      keepTab: 'oldest',
      protectPinned: true,
      protectGroups: false,
      defaultBrowseView: options.view || 'tabs',
      defaultSearchMode: 'contains'
    }
  });
  return reducePopupState(state, { type: 'SET_BROWSER_SNAPSHOT', tabs, focusedWindowId: 1 });
}

function expectUniqueNavigationIds(state) {
  const ids = getVisibleNavigationItems(state).map(item => item.id);
  expect(new Set(ids).size).toBe(ids.length);
}

const tabs = [
  { id: 1, windowId: 1, title: 'Alpha', url: 'https://a.test/one', active: true },
  { id: 2, windowId: 1, title: 'Beta', url: 'https://b.test/two' },
  { id: 3, windowId: 2, title: 'Alpha copy', url: 'https://a.test/one' },
  { id: 4, windowId: 2, title: 'Gamma', url: 'https://g.test/three' }
];

describe('popup state scope', () => {
  it('switches all windows to current window and invalidates selection/cursor', () => {
    let state = withTabs(tabs);
    state = reducePopupState(state, { type: 'TOGGLE_SELECTION', tabId: 3 });
    state = reducePopupState(state, { type: 'SET_CURSOR', cursorId: makeTabItemId('tabs', 3) });

    state = reducePopupState(state, { type: 'SET_SCOPE', scope: { type: 'window', windowId: 1 } });

    expect(getScopedTabs(state).map(tab => tab.id)).toEqual([1, 2]);
    expect([...state.selection.tabIds]).toEqual([]);
    expect(getCursorItem(state)?.id).not.toBe(makeTabItemId('tabs', 3));
  });

  it('switches current window back to all windows', () => {
    let state = withTabs(tabs);
    state = reducePopupState(state, { type: 'SET_SCOPE', scope: { type: 'window', windowId: 1 } });
    state = reducePopupState(state, { type: 'SET_SCOPE', scope: { type: 'all' } });

    expect(getScopedTabs(state).map(tab => tab.id)).toEqual([1, 2, 3, 4]);
  });

  it('tracks the focused window while current-window scope is active', () => {
    let state = withTabs(tabs);
    state = reducePopupState(state, { type: 'SET_SCOPE', scope: { type: 'window', windowId: 1 } });
    state = reducePopupState(state, { type: 'WINDOW_FOCUS_CHANGED', windowId: 2 });

    expect(state.scope).toEqual({ type: 'window', windowId: 2 });
    expect(getScopedTabs(state).map(tab => tab.id)).toEqual([3, 4]);
  });

  it('ignores WINDOW_ID_NONE while current-window scope is active', () => {
    let state = withTabs(tabs);
    state = reducePopupState(state, { type: 'SET_SCOPE', scope: { type: 'window', windowId: 1 } });
    state = reducePopupState(state, { type: 'WINDOW_FOCUS_CHANGED', windowId: -1 });

    expect(state.browser.focusedWindowId).toBe(1);
    expect(state.scope).toEqual({ type: 'window', windowId: 1 });
    expect(getScopedTabs(state).map(tab => tab.id)).toEqual([1, 2]);

    state = reducePopupState(state, { type: 'WINDOW_FOCUS_CHANGED', windowId: 2 });

    expect(state.browser.focusedWindowId).toBe(2);
    expect(state.scope).toEqual({ type: 'window', windowId: 2 });
    expect(getScopedTabs(state).map(tab => tab.id)).toEqual([3, 4]);
  });

  it('keeps all-window scope while tracking valid focused-window changes', () => {
    let state = withTabs(tabs);

    state = reducePopupState(state, { type: 'WINDOW_FOCUS_CHANGED', windowId: -1 });
    expect(state.scope).toEqual({ type: 'all', windowId: null });
    expect(state.browser.focusedWindowId).toBe(1);

    state = reducePopupState(state, { type: 'WINDOW_FOCUS_CHANGED', windowId: 2 });
    expect(state.scope).toEqual({ type: 'all', windowId: null });
    expect(state.browser.focusedWindowId).toBe(2);
  });

  it('does not create current-window scope from an invalid snapshot focus', () => {
    let state = withTabs(tabs);
    state = reducePopupState(state, { type: 'SET_SCOPE', scope: { type: 'window', windowId: -1 } });

    expect(state.scope).toEqual({ type: 'all', windowId: null });
  });

  it('does not replace focused-window metadata from an invalid snapshot focus', () => {
    let state = withTabs(tabs);

    state = reducePopupState(state, { type: 'SET_BROWSER_SNAPSHOT', tabs, focusedWindowId: -1 });

    expect(state.browser.focusedWindowId).toBe(1);
  });

  it('does not initialize current-window scope from an invalid focused window', () => {
    const state = createInitialPopupState({ currentWindowOnly: true, focusedWindowId: -1 });

    expect(state.scope).toEqual({ type: 'all', windowId: null });
  });
});

describe('popup search and navigation', () => {
  it('derives search results from the scoped snapshot', () => {
    let state = withTabs(tabs);
    state = reducePopupState(state, { type: 'SET_SCOPE', scope: { type: 'window', windowId: 1 } });
    state = reducePopupState(state, { type: 'SET_SEARCH_QUERY', query: 'Alpha' });

    expect(getSearchResultTabIds(state)).toEqual([1]);
  });

  it('uses the unified cursor for result navigation and clearing search', () => {
    let state = withTabs(tabs);
    state = reducePopupState(state, { type: 'SET_SEARCH_QUERY', query: 'Alpha' });
    state = reducePopupState(state, { type: 'NAVIGATE_NEXT' });

    expect(getCursorItem(state)?.id).toBe(makeItemId('view', 'tabs'));

    state = reducePopupState(state, { type: 'NAVIGATE_NEXT' });
    expect(getCursorItem(state)?.id).toBe(makeItemId('view', 'domains'));

    state = reducePopupState(state, { type: 'NAVIGATE_NEXT' });
    expect(getCursorItem(state)?.id).toBe(makeTabItemId('search', 1));

    state = reducePopupState(state, { type: 'CLEAR_SEARCH', defaultMode: 'contains' });
    expect(state.search.query).toBe('');
    expect(state.navigation.cursorId).toBeNull();
  });

  it('keeps cursor identity when sorting and falls back after removal', () => {
    let state = withTabs(tabs);
    state = reducePopupState(state, { type: 'SET_CURSOR', cursorId: makeTabItemId('tabs', 2) });
    state = reducePopupState(state, { type: 'SET_SORT', area: 'tabs', sort: 'title' });
    expect(getCursorItem(state)?.id).toBe(makeTabItemId('tabs', 2));

    state = reducePopupState(state, { type: 'TAB_REMOVED', tabId: 2 });
    expect(getCursorItem(state)?.id).not.toBe(makeTabItemId('tabs', 2));
    expect(getCursorItem(state)).toBeTruthy();
  });

  it('uses search-only ArrowUp semantics from the first result', () => {
    let state = withTabs(tabs);
    state = reducePopupState(state, { type: 'SET_SEARCH_QUERY', query: 'Alpha' });
    const firstResult = getSearchNavigationItems(state)[0];

    state = reducePopupState(state, { type: 'SET_CURSOR', cursorId: firstResult.id });
    state = reducePopupState(state, { type: 'NAVIGATE_SEARCH_PREVIOUS' });

    expect(state.navigation.cursorId).toBeNull();
    expect(state.navigation.focusZone).toBe('search');
  });

  it('keeps view controls out of ArrowDown and ArrowUp search-result navigation', () => {
    let state = withTabs(tabs);
    state = reducePopupState(state, { type: 'SET_SEARCH_QUERY', query: 'Alpha' });

    state = reducePopupState(state, { type: 'NAVIGATE_SEARCH_NEXT' });
    expect(getCursorItem(state)?.id).toBe(makeTabItemId('search', 1));

    state = reducePopupState(state, { type: 'NAVIGATE_SEARCH_NEXT' });
    expect(getCursorItem(state)?.id).toBe(makeTabItemId('search', 3));

    state = reducePopupState(state, { type: 'NAVIGATE_SEARCH_PREVIOUS' });
    expect(getCursorItem(state)?.id).toBe(makeTabItemId('search', 1));
  });
});

describe('popup domains', () => {
  const domainTabs = [
    { id: 1, windowId: 1, title: 'A1', url: 'https://a.test/1' },
    { id: 2, windowId: 1, title: 'A2', url: 'https://a.test/2' },
    { id: 3, windowId: 1, title: 'A3', url: 'https://a.test/3' },
    { id: 4, windowId: 1, title: 'B1', url: 'https://b.test/1' }
  ];

  it('expands, collapses, and navigates child to parent from state', () => {
    let state = withTabs(domainTabs, { view: 'domains' });
    expect(getLargeDomainGroups(state).map(group => group.domain)).toEqual(['a.test']);
    expect(isDomainExpanded(state, 'a.test')).toBe(true);

    state = reducePopupState(state, { type: 'COLLAPSE_DOMAIN', domain: 'a.test' });
    expect(isDomainExpanded(state, 'a.test')).toBe(false);
    expect(getVisibleNavigationItems(state).some(item => item.id === makeTabItemId('domain', 1, 'a.test'))).toBe(false);

    state = reducePopupState(state, { type: 'EXPAND_DOMAIN', domain: 'a.test' });
    state = reducePopupState(state, { type: 'SET_CURSOR', cursorId: makeTabItemId('domain', 2, 'a.test') });
    state = reducePopupState(state, { type: 'NAVIGATE_PARENT' });
    expect(getCursorItem(state)?.id).toBe(makeItemId('domain', 'a.test'));
  });

  it('preserves persisted collapsed domains loaded before the browser snapshot', () => {
    let state = createInitialPopupState({ focusedWindowId: 1, defaultBrowseView: 'domains' });

    state = reducePopupState(state, {
      type: 'SET_EXPANSION',
      domainSectionStates: { 'a.test': false }
    });

    expect(isDomainExpanded(state, 'a.test')).toBe(false);

    state = reducePopupState(state, { type: 'SET_BROWSER_SNAPSHOT', tabs: domainTabs, focusedWindowId: 1 });

    expect(getLargeDomainGroups(state).map(group => group.domain)).toEqual(['a.test']);
    expect(isDomainExpanded(state, 'a.test')).toBe(false);
    expect(getVisibleNavigationItems(state).some(item => item.id === makeTabItemId('domain', 1, 'a.test'))).toBe(false);
  });

  it('preserves persisted expanded domains loaded before the browser snapshot', () => {
    let state = createInitialPopupState({ focusedWindowId: 1, defaultBrowseView: 'domains' });

    state = reducePopupState(state, {
      type: 'SET_EXPANSION',
      domainSectionStates: { 'a.test': true }
    });
    state = reducePopupState(state, { type: 'SET_BROWSER_SNAPSHOT', tabs: domainTabs, focusedWindowId: 1 });

    expect(isDomainExpanded(state, 'a.test')).toBe(true);
    expect(getVisibleNavigationItems(state).some(item => item.id === makeTabItemId('domain', 1, 'a.test'))).toBe(true);
  });
});

describe('popup navigation identity', () => {
  it('assigns unique item IDs when an audible tab also appears in All Tabs', () => {
    let state = withTabs([
      { id: 1, windowId: 1, title: 'Alpha', url: 'https://a.test/one', active: true, audible: true },
      { id: 2, windowId: 1, title: 'Beta', url: 'https://b.test/two' }
    ]);

    const tabItems = getVisibleNavigationItems(state).filter(item => item.type === 'tab' && item.tabId === 1);

    expect(tabItems.map(item => item.id)).toEqual([
      makeTabItemId('media', 1),
      makeTabItemId('tabs', 1)
    ]);
    expect(new Set(tabItems.map(item => item.tabId))).toEqual(new Set([1]));
    expectUniqueNavigationIds(state);

    state = reducePopupState(state, { type: 'SET_CURSOR', cursorId: makeTabItemId('media', 1) });
    expect(getCursorItem(state)).toMatchObject({ id: makeTabItemId('media', 1), tabId: 1, zone: 'media' });

    state = reducePopupState(state, { type: 'NAVIGATE_NEXT' });
    expect(getCursorItem(state)).toMatchObject({ id: makeItemId('section', 'duplicates') });
  });

  it('assigns unique item IDs for search and domain tab contexts', () => {
    let state = withTabs([
      { id: 1, windowId: 1, title: 'Alpha', url: 'https://a.test/one', active: true },
      { id: 2, windowId: 1, title: 'Alpha two', url: 'https://a.test/two' },
      { id: 3, windowId: 1, title: 'Alpha three', url: 'https://a.test/three' }
    ], { view: 'domains' });

    expect(getVisibleNavigationItems(state).filter(item => item.type === 'tab').map(item => item.id)).toEqual([
      makeTabItemId('domain', 1, 'a.test'),
      makeTabItemId('domain', 2, 'a.test'),
      makeTabItemId('domain', 3, 'a.test')
    ]);
    expectUniqueNavigationIds(state);

    state = reducePopupState(state, { type: 'SET_SEARCH_QUERY', query: 'Alpha' });
    expect(getSearchNavigationItems(state).map(item => item.id)).toEqual([
      makeTabItemId('search', 1),
      makeTabItemId('search', 2),
      makeTabItemId('search', 3)
    ]);
    expectUniqueNavigationIds(state);
  });
});

describe('popup selection and chrome events', () => {
  it('removes externally deleted selected tabs', () => {
    let state = withTabs(tabs);
    state = reducePopupState(state, { type: 'TOGGLE_SELECTION', tabId: 2 });
    state = reducePopupState(state, { type: 'TAB_REMOVED', tabId: 2 });

    expect([...state.selection.tabIds]).toEqual([]);
  });

  it('removes selection when a selected tab leaves current scope', () => {
    let state = withTabs(tabs);
    state = reducePopupState(state, { type: 'SET_SCOPE', scope: { type: 'window', windowId: 1 } });
    state = reducePopupState(state, { type: 'TOGGLE_SELECTION', tabId: 2 });
    state = reducePopupState(state, { type: 'TAB_MOVED', tab: { ...tabs[1], windowId: 2 } });

    expect([...state.selection.tabIds]).toEqual([]);
  });

  it('updates created, updated, moved, attached, detached, and replaced tabs', () => {
    let state = withTabs(tabs);
    state = reducePopupState(state, { type: 'TAB_CREATED', tab: { id: 5, windowId: 1, url: 'https://new.test', title: 'New' } });
    state = reducePopupState(state, { type: 'TAB_UPDATED', tab: { id: 5, windowId: 1, url: 'https://new.test/updated', title: 'Updated' } });
    state = reducePopupState(state, { type: 'TAB_MOVED', tab: { id: 5, windowId: 2, url: 'https://new.test/updated', title: 'Updated' } });
    state = reducePopupState(state, { type: 'TAB_ATTACHED', tab: { id: 5, windowId: 1, url: 'https://new.test/updated', title: 'Updated' } });
    state = reducePopupState(state, { type: 'TAB_DETACHED', tabId: 5 });
    state = reducePopupState(state, { type: 'TAB_REPLACED', tab: { id: 6, windowId: 1, url: 'https://replacement.test', title: 'Replacement' } });

    expect(getScopedTabs(state).map(tab => tab.id)).toContain(6);
    expect(getScopedTabs(state).map(tab => tab.id)).not.toContain(5);
  });
});

describe('popup action targets', () => {
  it('duplicate cleanup uses the active scope', () => {
    let state = withTabs(tabs);
    expect(getDuplicateTabs(state).map(tab => tab.id)).toEqual([3]);
    expect(getTabsToCloseForAllDuplicates(state).map(tab => tab.id)).toEqual([3]);

    state = reducePopupState(state, { type: 'SET_SCOPE', scope: { type: 'window', windowId: 1 } });
    expect(getDuplicateTabs(state)).toEqual([]);
    expect(getTabsToCloseForAllDuplicates(state)).toEqual([]);
  });
});
