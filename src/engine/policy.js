import { duplicateGroups } from './queries.js';

/** Return tabs in an explicit window scope, or all windows. */
export function scopedTabs(tabs, scope = { type: 'all' }) {
  return scope.type === 'window' ? tabs.filter(tab => tab.windowId === scope.windowId) : tabs;
}

/** Active means active in the focused (or last-focused) browser window only. */
export function currentTab(tabs, focusedWindowId) {
  return tabs.find(tab => tab.windowId === focusedWindowId && tab.active) || null;
}

/** Preserve the existing internal-page policy; this is ATO policy, not an API restriction. */
export function isBrowserUrl(url) {
  return Boolean(url) && (url.startsWith('chrome://') || url.startsWith('edge://'));
}

/** Return the reason a tab cannot be batch-closed, or null. */
export function protectionReason(tab, settings = {}, currentTabId = null) {
  if (tab.id === currentTabId) return 'current';
  if (!tab.url || tab.pendingUrl) return 'loading';
  if (isBrowserUrl(tab.url)) return 'internal';
  if (settings.protectPinned && tab.pinned) return 'pinned';
  if (settings.protectGroups && tab.groupId != null && tab.groupId !== -1) return 'grouped';
  return null;
}

/** Current/protected tabs survive first; otherwise keep oldest/newest (existing tab-ID order). */
export function duplicateTargets(tabs, settings = {}, focusedWindowId = null) {
  const activeId = currentTab(tabs, focusedWindowId)?.id;
  return duplicateGroups(tabs, settings.matchMode).flatMap(group => {
    const sorted = [...group.tabs].sort((a, b) => settings.keepTab === 'newest' ? b.id - a.id : a.id - b.id);
    const protectedTabs = sorted.filter(tab => protectionReason(tab, settings, activeId));
    const survivorIds = new Set((protectedTabs.length ? protectedTabs : sorted.slice(0, 1)).map(tab => tab.id));
    return sorted.filter(tab => !survivorIds.has(tab.id));
  });
}
