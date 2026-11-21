/**
 * Bring closed tabs back, any number of them. Chrome's `sessions` remembers the
 * last 25 closed tabs and restores them whole (back/forward history included);
 * the rest are reopened by URL where they were: same window and position,
 * pinned as before, back in their tab group if it still exists.
 *
 * Runs in the service worker (see `worker.ts`): restoring can close the popup
 * (Chrome focuses what it brings back), and the worker carries on regardless.
 */
import type { Tab } from '../core/types';

export interface Restored {
  /** Tabs that came back. */
  count: number;
  /** Of those, reopened by URL: without their back/forward history. */
  fresh: number;
}

/** Message the popup sends the worker; the reply is a `Restored`. */
export const RESTORE_MESSAGE = 'ato:restore';

export async function restoreTabs(tabs: readonly Tab[]): Promise<Restored> {
  const recent = (await chrome.sessions.getRecentlyClosed({ maxResults: chrome.sessions.MAX_SESSION_RESULTS }))
    .flatMap((s) => (s.tab?.sessionId ? [s.tab] : []));
  let count = 0;
  let fresh = 0;
  // In original order, so positions (index) land where they were.
  for (const tab of [...tabs].sort((a, b) => a.windowId - b.windowId || a.index - b.index)) {
    const i = recent.findIndex((s) => s.url === tab.url);
    const session = i >= 0 ? recent.splice(i, 1)[0] : undefined;
    try {
      if (session?.sessionId) await chrome.sessions.restore(session.sessionId);
      else {
        await reopen(tab);
        fresh++;
      }
      count++;
    } catch {
      // A tab that can't come back (its URL is no longer allowed, say) is skipped.
    }
  }
  return { count, fresh };
}

async function reopen(tab: Tab): Promise<void> {
  const props = { url: tab.url, pinned: tab.pinned, active: false };
  let created: chrome.tabs.Tab;
  try {
    created = await chrome.tabs.create({ ...props, windowId: tab.windowId, index: tab.index });
  } catch {
    created = await chrome.tabs.create(props); // its window is gone: use the current one
  }
  if (tab.groupId !== -1 && created.id !== undefined && created.windowId === tab.windowId) {
    // Back into its group if the group is still there; otherwise it stays ungrouped.
    await chrome.tabs.group({ groupId: tab.groupId, tabIds: [created.id] }).catch(() => undefined);
  }
}
