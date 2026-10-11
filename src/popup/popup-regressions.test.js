import { expect, it } from 'vitest';
import { createInitialPopupState, reducePopupState, getTabsToCloseForAllDuplicates,
  getCursorItem, makeTabItemId } from './popup-state.js';

it('preserves the focused window active duplicate, not another window active tab (#49)', () => {
  let state = createInitialPopupState();
  state = reducePopupState(state, { type: 'SET_BROWSER_SNAPSHOT', focusedWindowId: 2, tabs: [
    { id: 1, windowId: 1, active: true, url: 'https://other.test' },
    { id: 2, windowId: 2, url: 'https://same.test' },
    { id: 3, windowId: 2, active: true, url: 'https://same.test' },
    { id: 4, windowId: 2, url: 'https://same.test' }
  ] });
  expect(getTabsToCloseForAllDuplicates(state).map(tab => tab.id)).toEqual([2, 4]);
});

it('does not leak into browse controls when the last search result disappears (#48)', () => {
  let state = createInitialPopupState();
  state = reducePopupState(state, { type: 'SET_BROWSER_SNAPSHOT', tabs: [
    { id: 7, windowId: 1, title: 'Needle', url: 'https://example.test' }
  ] });
  state = reducePopupState(state, { type: 'SET_SEARCH_QUERY', query: 'Needle' });
  state = reducePopupState(state, { type: 'SET_CURSOR', cursorId: makeTabItemId('search', 7) });
  state = reducePopupState(state, { type: 'TAB_REMOVED', tabId: 7 });
  expect(getCursorItem(state)).toBeNull();
  expect(state.navigation.focusZone).toBe('search');
});
