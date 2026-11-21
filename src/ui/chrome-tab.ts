/** Chrome's tabs and groups as ATO sees them (plain `Tab` / `TabGroup`). */
import type { Tab, TabGroup } from '../core/types';

/** ATO's view of a Chrome tab, or `null` for one without an id (devtools, apps). */
export function fromChromeTab(t: chrome.tabs.Tab, now: number): Tab | null {
  if (t.id === undefined || t.id === chrome_TAB_ID_NONE) return null;
  const url = t.url || t.pendingUrl || '';
  return {
    id: t.id,
    windowId: t.windowId,
    index: t.index,
    title: t.title || url,
    url,
    favIconUrl: t.favIconUrl || undefined,
    active: t.active,
    pinned: t.pinned,
    audible: t.audible ?? false,
    muted: t.mutedInfo?.muted ?? false,
    discarded: t.discarded,
    // Not in @types/chrome yet (Chrome 140+).
    splitViewId: (t as chrome.tabs.Tab & { splitViewId?: number }).splitViewId ?? -1,
    groupId: t.groupId ?? -1,
    lastAccessed: t.lastAccessed ?? now,
  };
}

/** `chrome.tabs.TAB_ID_NONE`, inlined so this module loads outside the extension (tests). */
const chrome_TAB_ID_NONE = -1;

/** ATO's view of a Chrome tab group. */
export function fromChromeGroup(g: chrome.tabGroups.TabGroup): TabGroup {
  return { id: g.id, windowId: g.windowId, title: g.title ?? '', color: g.color as TabGroup['color'], collapsed: g.collapsed };
}
