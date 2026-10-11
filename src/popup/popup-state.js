import {
  extractDomain,
  duplicateGroups,
  countDuplicatesByUrl,
  groupTabsByDomain,
  findDuplicates,
  queryTabs,
  browseTabs,
  sortDomainGroups,
  sortAudibleFirst,
} from '../engine/queries.js';
import { scopedTabs, duplicateTargets, isBrowserUrl } from '../engine/policy.js';
import {
  createInitialPopupMachineState,
  getBrowseView,
  isDuplicateReviewMode,
  transitionPopupMachine
} from './popup-machine.js';

const DEFAULT_SECTION_EXPANSION = {
  media: true,
  duplicates: true,
  allTabs: true
};

export function makeItemId(type, id = '') {
  return `${type}:${id}`;
}

export function makeTabItemId(zone, tabId, domain = '') {
  const context = zone === 'domain' ? `domain:${domain}` : zone;
  return makeItemId('tab', `${context}:${tabId}`);
}

function domainItemId(domain) {
  return makeItemId('domain', domain);
}

function actionItemId(action, domain = '') {
  return makeItemId('action', `${action}:${domain}`);
}

function isValidWindowId(windowId) {
  return Number.isFinite(windowId) && windowId >= 0;
}

function cloneSet(value) {
  return new Set(value || []);
}

function cloneMap(value) {
  return new Map(value || []);
}

function cloneState(state) {
  return {
    ...state,
    browser: {
      ...state.browser,
      tabs: cloneMap(state.browser.tabs)
    },
    scope: { ...state.scope },
    view: { ...state.view },
    ui: {
      ...state.ui,
      machine: { ...(state.ui?.machine || createInitialPopupMachineState({ defaultBrowseView: state.view?.type })) }
    },
    search: { ...state.search },
    navigation: { ...state.navigation },
    expansion: {
      sections: { ...state.expansion.sections },
      domainIds: cloneSet(state.expansion.domainIds),
      collapsedDomainIds: cloneSet(state.expansion.collapsedDomainIds)
    },
    selection: {
      tabIds: cloneSet(state.selection.tabIds),
      anchorTabId: state.selection.anchorTabId
    },
    sort: { ...state.sort },
    filters: { ...state.filters }
  };
}

export function createInitialPopupState({
  currentWindowOnly = false,
  focusedWindowId = null,
  defaultBrowseView = 'tabs',
  defaultSearchMode = 'contains',
  sectionStates = {},
  domainSectionStates = {}
} = {}) {
  const domainIds = Object.entries(domainSectionStates)
    .filter(([, expanded]) => expanded !== false)
    .map(([domain]) => domain);
  const collapsedDomainIds = Object.entries(domainSectionStates)
    .filter(([, expanded]) => expanded === false)
    .map(([domain]) => domain);

  return {
    browser: {
      tabs: new Map(),
      focusedWindowId,
      snapshotLoaded: false
    },
    scope: currentWindowOnly && isValidWindowId(focusedWindowId)
      ? { type: 'window', windowId: focusedWindowId }
      : { type: 'all', windowId: null },
    view: {
      type: defaultBrowseView === 'domains' ? 'domains' : 'tabs'
    },
    ui: {
      machine: createInitialPopupMachineState({ defaultBrowseView })
    },
    search: {
      query: '',
      field: 'all',
      mode: defaultSearchMode || 'contains'
    },
    navigation: {
      cursorId: null,
      focusZone: 'search'
    },
    expansion: {
      sections: { ...DEFAULT_SECTION_EXPANSION, ...sectionStates },
      domainIds: new Set(domainIds),
      collapsedDomainIds: new Set(collapsedDomainIds)
    },
    selection: {
      tabIds: new Set(),
      anchorTabId: null
    },
    sort: {
      tabs: 'default',
      duplicate: 'default',
      domainSection: 'name',
      ageDirection: 'old',
      domainNameDirection: 'az',
      domainCountDirection: 'most'
    },
    filters: {
      domain: null
    },
    duplicateReviewOpen: false
  };
}

export function serializeExpansion(state) {
  const domainSectionStates = {};
  for (const domain of state.expansion.domainIds) {
    domainSectionStates[domain] = true;
  }
  for (const group of getLargeDomainGroups(state)) {
    domainSectionStates[group.domain] = isDomainExpanded(state, group.domain);
  }

  return {
    sectionStates: { ...state.expansion.sections },
    domainSectionStates
  };
}

export function getTabs(state) {
  return Array.from(state.browser.tabs.values());
}

export function getTab(state, tabId) {
  return state.browser.tabs.get(Number(tabId)) || null;
}

export function getScopedTabs(state) {
  return scopedTabs(getTabs(state), state.scope);
}

export function getUrlCounts(state) {
  return countDuplicatesByUrl(getScopedTabs(state), state.matchMode || 'exact');
}

export function getDuplicateTabs(state) {
  return findDuplicates(getScopedTabs(state), state.matchMode || 'exact');
}

export function getDuplicateGroups(state) {
  const groups = duplicateGroups(getScopedTabs(state), state.matchMode).map(({ url, tabs }) => ({
    url, tabs: tabs.slice(1), representative: tabs[1], totalCount: tabs.length,
    actionableCount: duplicateTargets(tabs, state, state.browser.focusedWindowId).length
  }));

  if (state.sort.duplicate === 'title') {
    groups.sort((a, b) => (a.representative.title || '').localeCompare(b.representative.title || ''));
  } else if (state.sort.duplicate === 'domain') {
    groups.sort((a, b) => (extractDomain(a.url) || '').localeCompare(extractDomain(b.url) || ''));
  }

  return groups;
}

export function getDomainGroups(state) {
  return groupTabsByDomain(getScopedTabs(state));
}

export function getVisibleTabs(state) {
  return browseTabs(getScopedTabs(state), { domain: state.filters.domain,
    sort: state.sort.tabs, ageDirection: state.sort.ageDirection, matchMode: state.matchMode });
}

export function getPlayingTabs(state) {
  return getScopedTabs(state).filter(tab => tab.audible);
}

export function getLargeDomainGroups(state) {
  const groups = getDomainGroups(state)
    .filter(group => group.tabs.filter(tab => tab.url && !isBrowserUrl(tab.url)).length >= 3)
    .map(group => ({
      ...group,
      tabs: group.tabs.filter(tab => tab.url && !isBrowserUrl(tab.url))
    }));

  return sortDomainGroups(groups, state.sort);
}

export function getSearchResults(state) {
  return queryTabs(getScopedTabs(state), state.search);
}

export function getSearchResultTabIds(state) {
  return getSearchResults(state).map(result => result.tab.id);
}

export function getVisibleNavigationItems(state) {
  const items = [
    { id: makeItemId('view', 'tabs'), type: 'view', view: 'tabs' },
    { id: makeItemId('view', 'domains'), type: 'view', view: 'domains' }
  ];

  if (state.search.query.trim()) {
    items.length = 0;
    for (const { tab } of getSearchResults(state)) {
      items.push({ id: makeTabItemId('search', tab.id), type: 'tab', tabId: tab.id, windowId: tab.windowId, zone: 'search' });
    }
    return items;
  }

  const playingTabs = getPlayingTabs(state);
  if (playingTabs.length > 0) {
    items.push({ id: makeItemId('section', 'media'), type: 'section', section: 'media' });
    if (state.expansion.sections.media) {
      for (const tab of playingTabs) {
        items.push({ id: makeTabItemId('media', tab.id), type: 'tab', tabId: tab.id, windowId: tab.windowId, section: 'media', zone: 'media' });
      }
    }
  }

  const duplicateTabs = getDuplicateTabs(state);
  if (duplicateTabs.length > 0) {
    items.push({ id: makeItemId('section', 'duplicates'), type: 'section', section: 'duplicates' });
    if (state.expansion.sections.duplicates && state.duplicateReviewOpen) {
      for (const group of getDuplicateGroups(state)) {
        items.push({ id: makeItemId('duplicate', group.url), type: 'duplicate', url: group.url });
      }
    }
  }

  if (state.duplicateReviewOpen) {
    return items;
  }

  if (state.view.type === 'tabs') {
    items.push({ id: makeItemId('section', 'allTabs'), type: 'section', section: 'allTabs' });
    if (state.expansion.sections.allTabs) {
      for (const tab of getVisibleTabs(state)) {
        items.push({ id: makeTabItemId('tabs', tab.id), type: 'tab', tabId: tab.id, windowId: tab.windowId, section: 'allTabs', zone: 'tabs' });
      }
    }
    return items;
  }

  for (const group of getLargeDomainGroups(state)) {
    items.push({ id: domainItemId(group.domain), type: 'domain', domain: group.domain });
    if (isDomainExpanded(state, group.domain)) {
      items.push({ id: actionItemId('move-domain', group.domain), type: 'action', action: 'move-domain', domain: group.domain });
      items.push({ id: actionItemId('close-domain', group.domain), type: 'action', action: 'close-domain', domain: group.domain });
      for (const tab of sortAudibleFirst(group.tabs)) {
        items.push({ id: makeTabItemId('domain', tab.id, group.domain), type: 'tab', tabId: tab.id, windowId: tab.windowId, domain: group.domain, zone: 'domain' });
      }
    }
  }

  return items;
}

export function getSearchNavigationItems(state) {
  if (!state.search.query.trim()) return [];
  return getVisibleNavigationItems(state).filter(item => item.zone === 'search');
}

export function getSearchKeyboardNavigationAction(state, key, { searchInputFocused = false } = {}) {
  if (!state.search.query.trim()) return null;

  if (key === 'ArrowDown') return { type: 'NAVIGATE_SEARCH_NEXT' };
  if (key === 'ArrowUp') return { type: 'NAVIGATE_SEARCH_PREVIOUS' };
  if (!searchInputFocused && key === 'j') return { type: 'NAVIGATE_SEARCH_NEXT' };
  if (!searchInputFocused && key === 'k') return { type: 'NAVIGATE_SEARCH_PREVIOUS' };

  return null;
}

export function getCursorItem(state) {
  return getVisibleNavigationItems(state).find(item => item.id === state.navigation.cursorId) || null;
}

export function isDomainExpanded(state, domain) {
  return state.expansion.domainIds.has(domain) || !state.expansion.collapsedDomainIds.has(domain);
}

export function getTabsToCloseForAllDuplicates(state) {
  return duplicateTargets(getScopedTabs(state), state, state.browser.focusedWindowId);
}

function reconcileState(state, previousItems = []) {
  const scopedIds = new Set(getScopedTabs(state).map(tab => tab.id));
  state.selection.tabIds = new Set([...state.selection.tabIds].filter(id => scopedIds.has(id)));
  if (state.selection.anchorTabId != null && !state.selection.tabIds.has(state.selection.anchorTabId)) {
    state.selection.anchorTabId = null;
  }

  if (state.filters.domain && !getDomainGroups(state).some(group => group.domain === state.filters.domain)) {
    state.filters.domain = null;
  }

  if (state.browser.snapshotLoaded) {
    const largeDomains = new Set(getLargeDomainGroups(state).map(group => group.domain));
    state.expansion.domainIds = new Set([...state.expansion.domainIds].filter(domain => largeDomains.has(domain)));
    state.expansion.collapsedDomainIds = new Set([...state.expansion.collapsedDomainIds].filter(domain => largeDomains.has(domain)));
    for (const domain of largeDomains) {
      if (!state.expansion.collapsedDomainIds.has(domain)) {
        state.expansion.domainIds.add(domain);
      }
    }
  }

  const searching = Boolean(state.search.query.trim());
  const items = searching ? getSearchNavigationItems(state) : getVisibleNavigationItems(state);
  if (state.navigation.cursorId == null) {
    return state;
  }

  const currentIndex = items.findIndex(item => item.id === state.navigation.cursorId);
  if (currentIndex >= 0) {
    return state;
  }

  if (items.length === 0) {
    state.navigation.cursorId = null;
    state.navigation.focusZone = 'search';
    return state;
  }

  const removedPreviousIndex = previousItems.findIndex(item => item.id === state.navigation.cursorId);
  const index = removedPreviousIndex >= 0
    ? Math.min(removedPreviousIndex, items.length - 1)
    : 0;

  state.navigation.cursorId = items[index].id;
  return state;
}

function setTabs(state, tabs) {
  state.browser.tabs = new Map(tabs.filter(tab => Number.isFinite(tab.id)).map(tab => [tab.id, { ...tab }]));
}

export function reducePopupState(currentState, action) {
  const previousItems = getVisibleNavigationItems(currentState);
  const state = cloneState(currentState);

  switch (action.type) {
    case 'SET_SETTINGS':
      state.matchMode = action.settings.matchMode;
      state.keepTab = action.settings.keepTab;
      state.protectPinned = action.settings.protectPinned;
      state.protectGroups = action.settings.protectGroups;
      state.search.mode = action.settings.defaultSearchMode || state.search.mode;
      state.ui.machine = transitionPopupMachine(state.ui.machine, {
        type: 'SET_VIEW',
        view: action.settings.defaultBrowseView
      });
      state.view.type = getBrowseView(state.ui.machine);
      break;
    case 'SET_BROWSER_SNAPSHOT':
      setTabs(state, action.tabs || []);
      state.browser.snapshotLoaded = true;
      state.ui.machine = transitionPopupMachine(state.ui.machine, { type: 'SNAPSHOT_LOADED' });
      if (isValidWindowId(action.focusedWindowId)) {
        state.browser.focusedWindowId = action.focusedWindowId;
      }
      break;
    case 'SET_EXPANSION': {
      state.expansion.sections = {
        ...state.expansion.sections,
        ...(action.sectionStates || {})
      };
      const domains = action.domainSectionStates || {};
      state.expansion.domainIds = new Set(
        Object.entries(domains).filter(([, expanded]) => expanded !== false).map(([domain]) => domain)
      );
      state.expansion.collapsedDomainIds = new Set(
        Object.entries(domains).filter(([, expanded]) => expanded === false).map(([domain]) => domain)
      );
      break;
    }
    case 'SET_SCOPE':
      state.scope = action.scope.type === 'window' && isValidWindowId(action.scope.windowId)
        ? { type: 'window', windowId: action.scope.windowId }
        : { type: 'all', windowId: null };
      break;
    case 'SET_VIEW':
      state.ui.machine = transitionPopupMachine(state.ui.machine, { type: 'SET_VIEW', view: action.view });
      state.view.type = getBrowseView(state.ui.machine);
      break;
    case 'SET_SEARCH_QUERY':
      state.search.query = action.query || '';
      state.ui.machine = transitionPopupMachine(state.ui.machine, {
        type: 'SEARCH_CHANGED',
        query: state.search.query
      });
      break;
    case 'CLEAR_SEARCH':
      state.search.query = '';
      state.search.field = 'all';
      state.search.mode = action.defaultMode || state.search.mode;
      state.navigation.focusZone = 'search';
      state.navigation.cursorId = null;
      state.ui.machine = transitionPopupMachine(state.ui.machine, { type: 'CLEAR_SEARCH' });
      state.view.type = getBrowseView(state.ui.machine);
      break;
    case 'SET_SEARCH_FIELD':
      state.search.field = action.field === 'url' || action.field === 'title' ? action.field : 'all';
      break;
    case 'SET_SEARCH_MODE':
      state.search.mode = action.mode || state.search.mode;
      break;
    case 'SET_DOMAIN_FILTER':
      state.filters.domain = action.domain || null;
      break;
    case 'OPEN_DOMAIN_FILTER':
    case 'CLOSE_DOMAIN_FILTER':
      state.ui.machine = transitionPopupMachine(state.ui.machine, { type: action.type });
      break;
    case 'SET_DUPLICATE_REVIEW':
      state.ui.machine = transitionPopupMachine(state.ui.machine, {
        type: action.open ? 'REVIEW_DUPLICATES' : 'EXIT_DUPLICATES_REVIEW'
      });
      state.duplicateReviewOpen = isDuplicateReviewMode(state.ui.machine);
      if (state.duplicateReviewOpen) state.expansion.sections.duplicates = true;
      break;
    case 'TOGGLE_SECTION':
      state.expansion.sections[action.section] = !state.expansion.sections[action.section];
      break;
    case 'TOGGLE_DOMAIN':
      if (isDomainExpanded(state, action.domain)) {
        state.expansion.domainIds.delete(action.domain);
        state.expansion.collapsedDomainIds.add(action.domain);
      } else {
        state.expansion.domainIds.add(action.domain);
        state.expansion.collapsedDomainIds.delete(action.domain);
      }
      break;
    case 'EXPAND_DOMAIN':
      state.expansion.domainIds.add(action.domain);
      state.expansion.collapsedDomainIds.delete(action.domain);
      break;
    case 'COLLAPSE_DOMAIN':
      state.expansion.domainIds.delete(action.domain);
      state.expansion.collapsedDomainIds.add(action.domain);
      break;
    case 'SET_SORT':
      if (action.area === 'tabs') {
        if (action.sort === 'age' && state.sort.tabs === 'age') {
          state.sort.ageDirection = state.sort.ageDirection === 'old' ? 'new' : 'old';
        } else if (action.sort === 'age') {
          state.sort.ageDirection = 'old';
        }
        state.sort.tabs = action.sort;
      } else if (action.area === 'duplicates') {
        state.sort.duplicate = action.sort;
      } else if (action.area === 'domains') {
        if (action.sort === 'name' && state.sort.domainSection === 'name') {
          state.sort.domainNameDirection = state.sort.domainNameDirection === 'az' ? 'za' : 'az';
        } else if (action.sort === 'name') {
          state.sort.domainNameDirection = 'az';
        }
        if (action.sort === 'count' && state.sort.domainSection === 'count') {
          state.sort.domainCountDirection = state.sort.domainCountDirection === 'most' ? 'few' : 'most';
        } else if (action.sort === 'count') {
          state.sort.domainCountDirection = 'most';
        }
        state.sort.domainSection = action.sort;
      }
      break;
    case 'SET_CURSOR':
      state.navigation.cursorId = action.cursorId;
      state.navigation.focusZone = action.focusZone || 'content';
      break;
    case 'NAVIGATE_FIRST': {
      const items = getVisibleNavigationItems(state);
      const item = items[0];
      state.navigation.cursorId = item?.id || null;
      state.navigation.focusZone = item ? 'content' : 'search';
      break;
    }
    case 'NAVIGATE_LAST': {
      const items = getVisibleNavigationItems(state);
      const item = items[items.length - 1];
      state.navigation.cursorId = item?.id || null;
      state.navigation.focusZone = item ? 'content' : 'search';
      break;
    }
    case 'NAVIGATE_NEXT':
    case 'NAVIGATE_PREVIOUS': {
      const items = getVisibleNavigationItems(state);
      if (items.length === 0) break;
      const currentIndex = items.findIndex(item => item.id === state.navigation.cursorId);
      const baseIndex = currentIndex >= 0 ? currentIndex : (action.type === 'NAVIGATE_NEXT' ? -1 : items.length);
      const delta = action.type === 'NAVIGATE_NEXT' ? 1 : -1;
      const nextIndex = Math.min(Math.max(baseIndex + delta, 0), items.length - 1);
      state.navigation.cursorId = items[nextIndex].id;
      state.navigation.focusZone = 'content';
      break;
    }
    case 'NAVIGATE_SEARCH_NEXT':
    case 'NAVIGATE_SEARCH_PREVIOUS': {
      const items = getSearchNavigationItems(state);
      if (items.length === 0) break;
      const currentIndex = items.findIndex(item => item.id === state.navigation.cursorId);
      const isNext = action.type === 'NAVIGATE_SEARCH_NEXT';
      if (!isNext && currentIndex === 0) {
        state.navigation.cursorId = null;
        state.navigation.focusZone = 'search';
        break;
      }
      if (isNext && currentIndex === items.length - 1) {
        state.navigation.cursorId = null;
        state.navigation.focusZone = 'search';
        break;
      }
      const baseIndex = currentIndex >= 0 ? currentIndex : (isNext ? -1 : items.length);
      const delta = isNext ? 1 : -1;
      const nextIndex = Math.min(Math.max(baseIndex + delta, 0), items.length - 1);
      state.navigation.cursorId = items[nextIndex].id;
      state.navigation.focusZone = 'content';
      break;
    }
    case 'NAVIGATE_PARENT': {
      const item = getCursorItem(state);
      if (item?.domain) {
        state.navigation.cursorId = domainItemId(item.domain);
      } else if (item?.section) {
        state.navigation.cursorId = makeItemId('section', item.section);
      }
      state.navigation.focusZone = 'content';
      break;
    }
    case 'NAVIGATE_CHILD': {
      const item = getCursorItem(state);
      if (item?.type === 'domain') {
        state.expansion.domainIds.add(item.domain);
        state.expansion.collapsedDomainIds.delete(item.domain);
      } else if (item?.type === 'section') {
        state.expansion.sections[item.section] = true;
      } else if (item?.type === 'view') {
        state.view.type = item.view;
      }
      break;
    }
    case 'TOGGLE_SELECTION': {
      const tabId = Number(action.tabId);
      if (state.selection.tabIds.has(tabId)) {
        state.selection.tabIds.delete(tabId);
      } else if (getScopedTabs(state).some(tab => tab.id === tabId)) {
        state.selection.tabIds.add(tabId);
        state.selection.anchorTabId = tabId;
      }
      if (state.selection.tabIds.size === 0) state.selection.anchorTabId = null;
      break;
    }
    case 'CLEAR_SELECTION':
      state.selection.tabIds.clear();
      state.selection.anchorTabId = null;
      break;
    case 'TAB_CREATED':
    case 'TAB_UPDATED':
    case 'TAB_MOVED':
    case 'TAB_ATTACHED':
    case 'TAB_REPLACED':
      if (action.tab?.id != null) state.browser.tabs.set(action.tab.id, { ...action.tab });
      break;
    case 'TAB_REMOVED':
    case 'TAB_DETACHED':
      state.browser.tabs.delete(Number(action.tabId));
      state.selection.tabIds.delete(Number(action.tabId));
      break;
    case 'WINDOW_FOCUS_CHANGED':
      if (!isValidWindowId(action.windowId)) break;
      state.browser.focusedWindowId = action.windowId;
      if (state.scope.type === 'window') {
        state.scope.windowId = action.windowId;
      }
      break;
    default:
      break;
  }

  return reconcileState(state, previousItems);
}
