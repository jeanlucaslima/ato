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
  /** Tabs that couldn't come back either way (in the order they were closed). */
  failed: Tab[];
}

/** Message the popup sends the worker; the reply is a `Restored`. */
export const RESTORE_MESSAGE = 'ato:restore';

/** What a closed-tab entry of `chrome.sessions.getRecentlyClosed` tells us. */
export interface ClosedEntry {
  sessionId: string;
  url: string;
  /** Position when it closed. */
  index: number;
  /** Chrome 158 reports 0 here, not the tab's window; used only if it ever matches. */
  windowId: number;
  /** Seconds since the epoch. */
  lastModified: number;
}

/** Entries a few seconds older than the close still count (`lastModified` is in whole seconds). */
const CLOSE_SLACK_MS = 5000;

/**
 * Which session entry is each closed tab's own. `tabs` is the undo record, in
 * the order they were removed; `entries` come newest first, as Chrome gives them.
 *
 * Checked in Chrome 158: a closed tab's entry keeps its URL and its index at the
 * moment it closed (shifted down by tabs removed before it in the same window and
 * call), but not its window (`windowId` is 0). So a tab's own entry has its URL,
 * the index it had when its turn came, and sits at its place in the removal order.
 * Entries older than `closedAt` belong to earlier closes and are never used. Each
 * entry serves one tab at most; a tab with no entry gets none (it is reopened).
 */
export function matchEntries(tabs: readonly Tab[], entries: readonly ClosedEntry[], closedAt?: number): Map<number, string> {
  const usable = entries.filter((e) => closedAt === undefined || e.lastModified * 1000 >= closedAt - CLOSE_SLACK_MS);
  const pairs: { tab: number; entry: number; score: [number, number, number] }[] = [];
  tabs.forEach((tab, i) => {
    // Its index when removed: earlier removals left of it in its window shifted it.
    const atClose = tab.index - tabs.slice(0, i).filter((t) => t.windowId === tab.windowId && t.index < tab.index).length;
    // Removed i-th of n: the (n-1-i)-th newest entry, if nothing else closed since.
    const rank = tabs.length - 1 - i;
    usable.forEach((e, j) => {
      if (e.url !== tab.url) return;
      pairs.push({ tab: i, entry: j, score: [e.windowId === tab.windowId ? 0 : 1, Math.abs(e.index - atClose), Math.abs(j - rank)] });
    });
  });
  pairs.sort((a, b) => a.score[0] - b.score[0] || a.score[1] - b.score[1] || a.score[2] - b.score[2]);
  const byTab = new Map<number, string>();
  const used = new Set<number>();
  for (const p of pairs) {
    const tab = tabs[p.tab]!;
    if (byTab.has(tab.id) || used.has(p.entry)) continue;
    byTab.set(tab.id, usable[p.entry]!.sessionId);
    used.add(p.entry);
  }
  return byTab;
}

async function closedEntries(): Promise<ClosedEntry[]> {
  return (await chrome.sessions.getRecentlyClosed({ maxResults: chrome.sessions.MAX_SESSION_RESULTS })).flatMap((s): ClosedEntry[] =>
    s.tab?.sessionId && s.tab.url ? [{ sessionId: s.tab.sessionId, url: s.tab.url, index: s.tab.index, windowId: s.tab.windowId, lastModified: s.lastModified }] : [],
  );
}

/**
 * Restore `tabs` (in the order they were closed) closed at `closedAt` (epoch ms,
 * just before the close). Without `closedAt` any entry may match.
 */
export async function restoreTabs(tabs: readonly Tab[], closedAt?: number): Promise<Restored> {
  // If Chrome can't list its sessions, every tab is reopened by URL.
  const entries = await closedEntries().catch((): ClosedEntry[] => []);
  const own = matchEntries(tabs, entries, closedAt);
  let count = 0;
  let fresh = 0;
  const byUrl = tabs.filter((t) => !own.has(t.id));
  // Whole ones last-closed first, as ⇧⌘T does: each goes back at the index it
  // closed from, so the strip ends up as it was.
  for (const tab of [...tabs].reverse()) {
    const sessionId = own.get(tab.id);
    if (!sessionId) continue;
    try {
      await chrome.sessions.restore(sessionId);
      count++;
    } catch {
      // Chrome wouldn't restore it whole: reopen it by URL with the rest.
      byUrl.push(tab);
    }
  }
  // The rest by URL, in strip order, so positions (index) land where they were.
  const failed = new Set<number>();
  for (const tab of byUrl.sort((a, b) => a.windowId - b.windowId || a.index - b.index)) {
    try {
      await reopen(tab);
      fresh++;
      count++;
    } catch {
      // A tab that can't come back (its URL is no longer allowed, say) is reported.
      failed.add(tab.id);
    }
  }
  return { count, fresh, failed: tabs.filter((t) => failed.has(t.id)) };
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
