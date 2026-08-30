import {
  extractDomain,
  findDuplicates,
  normalizeUrl,
  searchTab,
  sortAudibleFirst,
  sortTabs
} from '../shared/tab-utils.js';

const DEFAULT_SECTION_EXPANSION = {
  media: true,
  duplicates: true,
  allTabs: true
};

export function makeItemId(type, id = '') {
  return `${type}:${id}`;
}

function tabItemId(tabId) {
  return makeItemId('tab', tabId);
}

function domainItemId(domain) {
  return makeItemId('domain', domain);
}

function actionItemId(action, domain = '') {
  return makeItemId('action', `${action}:${domain}`);
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
      focusedWindowId
    },
    scope: currentWindowOnly && focusedWindowId != null
      ? { type: 'window', windowId: focusedWindowId }
      : { type: 'all', windowId: null },
    view: {
      type: defaultBrowseView === 'domains' ? 'domains' : 'tabs'
    },
    search: {
      query: '',
      field: 'all',
      mode: defaultSearchMode || 'contains'
    },
    navigation: {
      cursorId: null,
      cursorIndex: -1,
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
  const tabs = getTabs(state);
  if (state.scope.type !== 'window') return tabs;
  return tabs.filter(tab => tab.windowId === state.scope.windowId);
}

export function getActiveTab(state) {
  return getScopedTabs(state).find(tab => tab.active) || getTabs(state).find(tab => tab.active) || null;
}

export function getUrlCounts(state) {
  const counts = new Map();
  for (const tab of getScopedTabs(state)) {
    if (!tab.url) continue;
    const url = normalizeUrl(tab.url, state.matchMode || 'exact');
    counts.set(url, (counts.get(url) || 0) + 1);
  }
  return counts;
}

export function getDuplicateTabs(state) {
  return findDuplicates(getScopedTabs(state), state.matchMode || 'exact');
}

export function getDuplicateGroups(state) {
  const duplicatesByUrl = new Map();
  for (const tab of getDuplicateTabs(state)) {
    const normalizedTabUrl = normalizeUrl(tab.url, state.matchMode || 'exact');
    if (!duplicatesByUrl.has(normalizedTabUrl)) duplicatesByUrl.set(normalizedTabUrl, []);
    duplicatesByUrl.get(normalizedTabUrl).push(tab);
  }

  const urlCounts = getUrlCounts(state);
  const groups = Array.from(duplicatesByUrl.entries()).map(([url, tabs]) => ({
    url,
    tabs,
    representative: tabs[0],
    totalCount: urlCounts.get(url) || tabs.length + 1
  }));

  if (state.sort.duplicate === 'title') {
    groups.sort((a, b) => (a.representative.title || '').localeCompare(b.representative.title || ''));
  } else if (state.sort.duplicate === 'domain') {
    groups.sort((a, b) => (extractDomain(a.url) || '').localeCompare(extractDomain(b.url) || ''));
  }

  return groups;
}

export function getDomainGroups(state) {
  const groups = new Map();
  for (const tab of getScopedTabs(state)) {
    if (!tab.url) continue;
    const domain = extractDomain(tab.url);
    if (!domain) continue;
    if (!groups.has(domain)) groups.set(domain, []);
    groups.get(domain).push(tab);
  }

  return Array.from(groups.entries())
    .map(([domain, tabs]) => ({ domain, tabs, count: tabs.length }))
    .sort((a, b) => b.count - a.count);
}

export function getVisibleTabs(state) {
  const urlCounts = getUrlCounts(state);
  let visibleTabs = getScopedTabs(state).filter(tab => tab.url && !isBrowserUrl(tab.url));

  if (state.filters.domain) {
    visibleTabs = visibleTabs.filter(tab => extractDomain(tab.url) === state.filters.domain);
  }

  return sortAudibleFirst(sortTabs(visibleTabs, state.sort.tabs, urlCounts, state.sort.ageDirection));
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

  groups.sort((a, b) => {
    const domainA = a.domain.replace(/^www\./, '');
    const domainB = b.domain.replace(/^www\./, '');
    switch (state.sort.domainSection) {
      case 'name':
        return state.sort.domainNameDirection === 'az'
          ? domainA.localeCompare(domainB)
          : domainB.localeCompare(domainA);
      case 'count': {
        const diff = state.sort.domainCountDirection === 'most'
          ? b.tabs.length - a.tabs.length
          : a.tabs.length - b.tabs.length;
        return diff || domainA.localeCompare(domainB);
      }
      case 'recent': {
        const recentA = a.tabs.reduce((max, tab) => Math.max(max, tab.lastAccessed || 0), 0);
        const recentB = b.tabs.reduce((max, tab) => Math.max(max, tab.lastAccessed || 0), 0);
        return recentB - recentA || domainA.localeCompare(domainB);
      }
      default:
        return domainA.localeCompare(domainB);
    }
  });

  return groups;
}

export function effectiveSearchQuery(state) {
  const query = state.search.query;
  if (state.search.field !== 'all' && query.trim()) {
    return `${state.search.field}:${query}`;
  }
  return query;
}

export function getSearchResults(state) {
  if (!state.search.query.trim()) return [];

  const forcedMode = state.search.mode === 'fuzzy' ? null : state.search.mode;
  const query = effectiveSearchQuery(state);
  return getScopedTabs(state)
    .map(tab => ({ tab, match: searchTab(query, tab, forcedMode) }))
    .filter(result => result.match)
    .sort((a, b) => b.match.score - a.match.score);
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
    for (const { tab } of getSearchResults(state)) {
      items.push({ id: tabItemId(tab.id), type: 'tab', tabId: tab.id, windowId: tab.windowId, zone: 'search' });
    }
    return items;
  }

  const playingTabs = getPlayingTabs(state);
  if (playingTabs.length > 0) {
    items.push({ id: makeItemId('section', 'media'), type: 'section', section: 'media' });
    if (state.expansion.sections.media) {
      for (const tab of playingTabs) {
        items.push({ id: tabItemId(tab.id), type: 'tab', tabId: tab.id, windowId: tab.windowId, zone: 'media' });
      }
    }
  }

  items.push({ id: makeItemId('section', 'duplicates'), type: 'section', section: 'duplicates' });
  if (state.expansion.sections.duplicates && state.duplicateReviewOpen) {
    for (const group of getDuplicateGroups(state)) {
      items.push({ id: makeItemId('duplicate', group.url), type: 'duplicate', url: group.url });
    }
  }

  if (state.duplicateReviewOpen) {
    return items;
  }

  if (state.view.type === 'tabs') {
    items.push({ id: makeItemId('section', 'allTabs'), type: 'section', section: 'allTabs' });
    if (state.expansion.sections.allTabs) {
      for (const tab of getVisibleTabs(state)) {
        items.push({ id: tabItemId(tab.id), type: 'tab', tabId: tab.id, windowId: tab.windowId, zone: 'tabs' });
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
        items.push({ id: tabItemId(tab.id), type: 'tab', tabId: tab.id, windowId: tab.windowId, domain: group.domain, zone: 'domain' });
      }
    }
  }

  return items;
}

export function getCursorItem(state) {
  return getVisibleNavigationItems(state).find(item => item.id === state.navigation.cursorId) || null;
}

export function isDomainExpanded(state, domain) {
  return state.expansion.domainIds.has(domain) || !state.expansion.collapsedDomainIds.has(domain);
}

export function getTabsForDomain(state, domain) {
  return getScopedTabs(state).filter(tab => extractDomain(tab.url) === domain);
}

export function getTabsForDuplicateUrl(state, url) {
  const normalizedUrl = normalizeUrl(url, state.matchMode || 'exact');
  return getScopedTabs(state).filter(tab => normalizeUrl(tab.url, state.matchMode || 'exact') === normalizedUrl);
}

export function getTabsToCloseForDuplicateUrl(state, url) {
  return chooseDuplicateTabsToClose(state, getTabsForDuplicateUrl(state, url));
}

export function getTabsToCloseForAllDuplicates(state) {
  const byUrl = new Map();
  for (const tab of getScopedTabs(state)) {
    if (!tab.url) continue;
    const url = normalizeUrl(tab.url, state.matchMode || 'exact');
    if (!byUrl.has(url)) byUrl.set(url, []);
    byUrl.get(url).push(tab);
  }

  return Array.from(byUrl.values()).flatMap(tabs => chooseDuplicateTabsToClose(state, tabs));
}

export function filterCloseableTabs(state, tabs, { protectActive = true } = {}) {
  const activeTabId = getActiveTab(state)?.id;
  return tabs.filter(tab => {
    if (!tab) return false;
    if (protectActive && tab.id === activeTabId) return false;
    if (state.protectPinned && tab.pinned) return false;
    if (state.protectGroups && tab.groupId !== -1 && tab.groupId !== undefined) return false;
    if (isBrowserUrl(tab.url)) return false;
    return true;
  });
}

export function selectTabIds(tabs) {
  return tabs.map(tab => tab.id).filter(id => Number.isFinite(id));
}

export function isBrowserUrl(url) {
  return Boolean(url) && (url.startsWith('chrome://') || url.startsWith('edge://'));
}

function chooseDuplicateTabsToClose(state, tabsWithUrl) {
  if (tabsWithUrl.length <= 1) return [];

  const activeTabId = getActiveTab(state)?.id;
  const sorted = [...tabsWithUrl].sort((a, b) =>
    state.keepTab === 'newest' ? b.id - a.id : a.id - b.id
  );

  const initial = sorted.some(tab => tab.id === activeTabId)
    ? sorted.filter(tab => tab.id !== activeTabId)
    : sorted.slice(1);

  return filterCloseableTabs(state, initial, { protectActive: false });
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

  const largeDomains = new Set(getLargeDomainGroups(state).map(group => group.domain));
  state.expansion.domainIds = new Set([...state.expansion.domainIds].filter(domain => largeDomains.has(domain)));
  state.expansion.collapsedDomainIds = new Set([...state.expansion.collapsedDomainIds].filter(domain => largeDomains.has(domain)));
  for (const domain of largeDomains) {
    if (!state.expansion.collapsedDomainIds.has(domain)) {
      state.expansion.domainIds.add(domain);
    }
  }

  const items = getVisibleNavigationItems(state);
  if (state.navigation.cursorId == null) {
    state.navigation.cursorIndex = -1;
    return state;
  }

  const currentIndex = items.findIndex(item => item.id === state.navigation.cursorId);
  if (currentIndex >= 0) {
    state.navigation.cursorIndex = currentIndex;
    return state;
  }

  if (items.length === 0) {
    state.navigation.cursorId = null;
    state.navigation.cursorIndex = -1;
    return state;
  }

  const fallbackIndex = Math.min(
    Math.max(state.navigation.cursorIndex, 0),
    items.length - 1
  );
  const removedPreviousIndex = previousItems.findIndex(item => item.id === state.navigation.cursorId);
  const index = removedPreviousIndex >= 0
    ? Math.min(removedPreviousIndex, items.length - 1)
    : fallbackIndex;

  state.navigation.cursorId = items[index].id;
  state.navigation.cursorIndex = index;
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
      state.view.type = action.settings.defaultBrowseView === 'domains' ? 'domains' : 'tabs';
      break;
    case 'SET_BROWSER_SNAPSHOT':
      setTabs(state, action.tabs || []);
      state.browser.focusedWindowId = action.focusedWindowId ?? state.browser.focusedWindowId;
      if (action.currentWindowOnly) {
        state.scope = { type: 'window', windowId: state.browser.focusedWindowId };
      }
      break;
    case 'SET_SCOPE':
      state.scope = action.scope.type === 'window'
        ? { type: 'window', windowId: action.scope.windowId }
        : { type: 'all', windowId: null };
      break;
    case 'SET_VIEW':
      state.view.type = action.view === 'domains' ? 'domains' : 'tabs';
      break;
    case 'SET_SEARCH_QUERY':
      state.search.query = action.query || '';
      break;
    case 'CLEAR_SEARCH':
      state.search.query = '';
      state.search.field = 'all';
      state.search.mode = action.defaultMode || state.search.mode;
      state.navigation.focusZone = 'search';
      state.navigation.cursorId = null;
      state.navigation.cursorIndex = -1;
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
    case 'SET_DUPLICATE_REVIEW':
      state.duplicateReviewOpen = Boolean(action.open);
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
      state.navigation.cursorIndex = getVisibleNavigationItems(state).findIndex(item => item.id === action.cursorId);
      state.navigation.focusZone = action.focusZone || 'content';
      break;
    case 'NAVIGATE_FIRST': {
      const items = getVisibleNavigationItems(state);
      const item = items[0];
      state.navigation.cursorId = item?.id || null;
      state.navigation.cursorIndex = item ? 0 : -1;
      state.navigation.focusZone = item ? 'content' : 'search';
      break;
    }
    case 'NAVIGATE_LAST': {
      const items = getVisibleNavigationItems(state);
      const item = items[items.length - 1];
      state.navigation.cursorId = item?.id || null;
      state.navigation.cursorIndex = item ? items.length - 1 : -1;
      state.navigation.focusZone = item ? 'content' : 'search';
      break;
    }
    case 'NAVIGATE_NEXT':
    case 'NAVIGATE_PREVIOUS': {
      const items = getVisibleNavigationItems(state);
      if (items.length === 0) break;
      const currentIndex = items.findIndex(item => item.id === state.navigation.cursorId);
      const baseIndex = currentIndex >= 0 ? currentIndex : state.navigation.cursorIndex;
      const delta = action.type === 'NAVIGATE_NEXT' ? 1 : -1;
      const nextIndex = Math.min(Math.max(baseIndex + delta, 0), items.length - 1);
      state.navigation.cursorId = items[nextIndex].id;
      state.navigation.cursorIndex = nextIndex;
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
      state.browser.focusedWindowId = action.windowId;
      break;
    default:
      break;
  }

  return reconcileState(state, previousItems);
}
