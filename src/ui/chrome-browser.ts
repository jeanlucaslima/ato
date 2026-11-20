/**
 * The real browser: `BrowserPort` over the `chrome.*` extension APIs.
 * Everything Chrome-specific stays in this file; the rest of the popup only
 * sees plain `Snapshot`s and `Tab`s.
 */
import type { Snapshot, Tab, TabGroup } from '../core/types';
import type { BrowserPort } from './browser';

/** Batch bursts of tab events (a page load fires several) into one refresh. */
const REFRESH_DEBOUNCE_MS = 120;

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

export class ChromeBrowser implements BrowserPort {
  async snapshot(): Promise<Snapshot> {
    const [tabs, groups, focused] = await Promise.all([
      chrome.tabs.query({ windowType: 'normal' }),
      chrome.tabGroups.query({}).catch(() => []),
      chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => undefined),
    ]);
    const now = Date.now();
    return {
      tabs: tabs.flatMap((t) => fromChromeTab(t, now) ?? []),
      groups: groups.map(fromChromeGroup),
      focusedWindowId: focused?.id ?? -1,
      now,
    };
  }

  subscribe(listener: () => void): () => void {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(listener, REFRESH_DEBOUNCE_MS);
    };
    const events: chrome.events.Event<(...args: never[]) => void>[] = [
      chrome.tabs.onCreated,
      chrome.tabs.onRemoved,
      chrome.tabs.onUpdated,
      chrome.tabs.onMoved,
      chrome.tabs.onActivated,
      chrome.tabs.onAttached,
      chrome.tabs.onDetached,
      chrome.tabs.onReplaced,
      chrome.windows.onFocusChanged,
      chrome.tabGroups.onCreated,
      chrome.tabGroups.onUpdated,
      chrome.tabGroups.onRemoved,
      chrome.tabGroups.onMoved,
    ];
    for (const event of events) event.addListener(changed);
    return () => {
      clearTimeout(timer);
      for (const event of events) event.removeListener(changed);
    };
  }

  async close(tabIds: number[]): Promise<Tab[]> {
    const ids = new Set(tabIds);
    const closing = (await this.snapshot()).tabs.filter((t) => ids.has(t.id));
    if (closing.length === 0) return [];
    await chrome.tabs.remove(closing.map((t) => t.id));
    return closing;
  }

  /**
   * Bring closed tabs back: through `sessions` when Chrome still remembers them
   * (keeps back/forward history; it remembers 25), otherwise by reopening the URL
   * where the tab was.
   */
  async restore(tabs: readonly Tab[]): Promise<number> {
    const recent = (await chrome.sessions.getRecentlyClosed({ maxResults: chrome.sessions.MAX_SESSION_RESULTS }))
      .flatMap((s) => (s.tab?.sessionId ? [s.tab] : []));
    let count = 0;
    for (const tab of tabs) {
      const i = recent.findIndex((s) => s.url === tab.url);
      const session = i >= 0 ? recent.splice(i, 1)[0] : undefined;
      try {
        if (session?.sessionId) await chrome.sessions.restore(session.sessionId);
        else await reopen(tab);
        count++;
      } catch {
        // A tab that can't come back (its URL is no longer allowed, say) is skipped.
      }
    }
    return count;
  }

  async activate(tabId: number): Promise<void> {
    const tab = await chrome.tabs.update(tabId, { active: true });
    if (tab) await chrome.windows.update(tab.windowId, { focused: true });
  }

  async discard(tabIds: number[]): Promise<void> {
    // Chrome refuses some tabs (active, already discarded); the rest still go.
    await Promise.all(tabIds.map((id) => chrome.tabs.discard(id).catch(() => undefined)));
  }

  async moveToNewWindow(tabIds: number[]): Promise<void> {
    const [first, ...rest] = tabIds;
    if (first === undefined) return;
    const win = await chrome.windows.create({ tabId: first, focused: false });
    if (rest.length > 0 && win?.id !== undefined) await chrome.tabs.move(rest, { windowId: win.id, index: -1 });
  }

  async setMuted(tabId: number, muted: boolean): Promise<void> {
    await chrome.tabs.update(tabId, { muted });
  }

  async openSettings(): Promise<void> {
    await chrome.runtime.openOptionsPage();
  }
}

async function reopen(tab: Tab): Promise<void> {
  const props = { url: tab.url, pinned: tab.pinned, active: false };
  try {
    await chrome.tabs.create({ ...props, windowId: tab.windowId, index: tab.index });
  } catch {
    await chrome.tabs.create(props); // its window is gone: use the current one
  }
}
