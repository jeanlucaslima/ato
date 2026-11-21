/**
 * The real browser: `BrowserPort` over the `chrome.*` extension APIs.
 * Everything Chrome-specific stays in this file; the rest of the popup only
 * sees plain `Snapshot`s and `Tab`s.
 */
import type { DuplicatePolicy } from '../core/duplicates';
import type { Snapshot, Tab } from '../core/types';
import type { BrowserPort, CloseResult, UndoOffer } from './browser';
import { CLOSE_MESSAGE, closeTabs, pendingUndo, undoClose, type CloseReply } from './chrome-close';
import { RESTORE_MESSAGE, type Restored } from './chrome-restore';
import { fromChromeGroup, fromChromeTab } from './chrome-tab';

export { fromChromeGroup, fromChromeTab };

/** Batch bursts of tab events (a page load fires several) into one refresh. */
const REFRESH_DEBOUNCE_MS = 120;

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

  /**
   * Closing runs in the service worker, the same path as the right-click menu
   * (recheck, remove, record); here only if the worker can't be reached.
   */
  async close(tabIds: number[], policy: DuplicatePolicy | null, cleanup = false): Promise<CloseResult> {
    let reply: CloseReply | undefined;
    try {
      reply = (await chrome.runtime.sendMessage({ type: CLOSE_MESSAGE, tabIds, policy, cleanup })) as CloseReply | undefined;
    } catch {
      // No worker listening: close from here.
    }
    if (reply?.ok) return { closed: reply.closed, kept: reply.kept, closedAt: reply.closedAt };
    if (reply && !reply.ok) throw new Error(reply.error);
    return closeTabs(tabIds, policy, undefined, cleanup);
  }

  /** Undo runs in the service worker so it finishes even if the popup closes; here only if the worker can't be reached. */
  async restore(tabs: readonly Tab[], closedAt?: number): Promise<Restored> {
    try {
      const reply = (await chrome.runtime.sendMessage({ type: RESTORE_MESSAGE, tabs, closedAt })) as Restored | undefined;
      if (reply && typeof reply.count === 'number') return reply;
    } catch {
      // No worker listening: restore from here.
    }
    return undoClose(tabs, closedAt);
  }

  async pendingUndo(): Promise<UndoOffer | null> {
    return pendingUndo();
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

  async moveToWindow(tabIds: number[], windowId: number): Promise<void> {
    const { tabs, groups = [] } = await this.snapshot();
    const moving = new Set(tabIds);
    // A group whose every tab is moving goes as a group (tabs.move alone would ungroup them).
    const whole = groups.filter((g) => g.windowId !== windowId && tabs.some((t) => t.groupId === g.id) && tabs.every((t) => t.groupId !== g.id || moving.has(t.id)));
    const inWhole = new Set(whole.map((g) => g.id));
    for (const g of whole) await chrome.tabGroups.move(g.id, { windowId, index: -1 });
    const loose = tabs.filter((t) => moving.has(t.id) && t.windowId !== windowId && !inWhole.has(t.groupId)).map((t) => t.id);
    if (loose.length > 0) await chrome.tabs.move(loose, { windowId, index: -1 });
  }

  async focusWindow(windowId: number): Promise<void> {
    await chrome.windows.update(windowId, { focused: true });
  }

  async setMuted(tabId: number, muted: boolean): Promise<void> {
    await chrome.tabs.update(tabId, { muted });
  }

  async openSettings(): Promise<void> {
    await chrome.runtime.openOptionsPage();
  }
}
