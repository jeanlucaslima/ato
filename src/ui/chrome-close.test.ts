import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_POLICY, protection } from '../core/duplicates';
import { TABS } from '../dev/fixtures';
import { UNDO_OFFER_MS } from '../core/close-record';
import { duplicatesOf, othersFromSite } from '../core/tab-menu';
import type { Tab } from '../core/types';
import { ChromeBrowser } from './chrome-browser';
import { CLOSE_MESSAGE, closeTabs, pendingUndo, readCloseRequest, undoClose } from './chrome-close';

afterEach(() => vi.unstubAllGlobals());

describe('readCloseRequest', () => {
  it('accepts a well-formed request; anything else is refused', () => {
    expect(readCloseRequest({ type: CLOSE_MESSAGE, tabIds: [1, 2], policy: null })).toEqual({ tabIds: [1, 2], policy: null, cleanup: false });
    expect(readCloseRequest({ type: CLOSE_MESSAGE, tabIds: [1], policy: { match: 'ignoreQuery', keep: 'newest' }, cleanup: true })).toEqual({
      tabIds: [1],
      policy: { ...DEFAULT_POLICY, match: 'ignoreQuery', keep: 'newest' },
      cleanup: true,
    });
    expect(readCloseRequest({ type: CLOSE_MESSAGE, tabIds: [1], policy: { match: 'fuzzy', keep: 1 }, cleanup: 'yes' })).toEqual({ tabIds: [1], policy: DEFAULT_POLICY, cleanup: false });
    expect(readCloseRequest({ type: 'other', tabIds: [1], policy: null })).toBeNull();
    expect(readCloseRequest({ type: CLOSE_MESSAGE, tabIds: ['1'], policy: null })).toBeNull();
    expect(readCloseRequest({ type: CLOSE_MESSAGE, tabIds: [1] })).toBeNull();
    expect(readCloseRequest(null)).toBeNull();
  });

  it('a malformed policy falls back to protecting pinned and grouped tabs, never to less', () => {
    fc.assert(
      fc.property(fc.anything(), fc.anything(), (pinned, groups) => {
        const r = readCloseRequest({ type: CLOSE_MESSAGE, tabIds: [1], policy: { protectPinned: pinned, protectGroups: groups } });
        return r !== null && r.policy !== null && r.policy.protectPinned === (typeof pinned === 'boolean' ? pinned : true) && r.policy.protectGroups === (typeof groups === 'boolean' ? groups : true);
      }),
    );
  });
});

describe('one close path', () => {
  it('closeTabs (worker, menu) removes only tabs unprotected in Chrome right now', async () => {
    await fc.assert(
      fc.asyncProperty(fc.subarray(TABS.map((t) => t.id)), fc.subarray(TABS.map((t) => t.id)), async (ids, nowActive) => {
        const fresh = TABS.map((t) => (nowActive.includes(t.id) ? { ...t, active: true } : t));
        const removed: number[] = [];
        vi.stubGlobal('chrome', { tabs: { query: async () => fresh, remove: async (r: number[]) => void removed.push(...r) } });
        await closeTabs(ids, DEFAULT_POLICY);
        return removed.every((id) => ids.includes(id) && protection(fresh.find((t) => t.id === id)!, DEFAULT_POLICY) === null);
      }),
    );
  });

  it('the popup closes through the worker and reports its failure', async () => {
    const sendMessage = vi.fn(async () => ({ ok: true, closed: [TABS[3]], kept: [] }));
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    await expect(new ChromeBrowser().close([TABS[3]!.id], DEFAULT_POLICY)).resolves.toEqual({ closed: [TABS[3]], kept: [] });
    expect(sendMessage).toHaveBeenCalledWith({ type: CLOSE_MESSAGE, tabIds: [TABS[3]!.id], policy: DEFAULT_POLICY, cleanup: false });
    sendMessage.mockResolvedValueOnce({ ok: false, error: 'Tabs cannot be edited right now' } as never);
    await expect(new ChromeBrowser().close([TABS[3]!.id], DEFAULT_POLICY)).rejects.toThrow('Tabs cannot be edited right now');
  });
});

/**
 * A Chrome with tabs, sessions as Chrome 158 records them (one entry per closed
 * tab, newest first, index at close, windowId 0, the last 25) and session storage.
 */
function fakeChrome(start: readonly Tab[]) {
  let tabs = start.map((t) => ({ ...t }));
  let entries: { sessionId: string; tab: Tab; index: number; lastModified: number }[] = [];
  const store = new Map<string, unknown>();
  const restored: string[] = [];
  const created: string[] = [];
  /** What Chrome refuses: session ids it won't restore, URLs it won't open. */
  const refuse = { sessions: new Set<string>(), urls: new Set<string>() };
  vi.stubGlobal('chrome', {
    tabs: {
      query: async () => tabs.map((t) => ({ ...t })),
      remove: async (ids: number[]) => {
        for (const id of ids) {
          const tab = tabs.find((t) => t.id === id)!;
          const index = tabs.filter((t) => t.windowId === tab.windowId && t.index < tab.index).length;
          tabs = tabs.filter((t) => t.id !== id);
          entries = [{ sessionId: `s${id}`, tab, index, lastModified: Math.floor(Date.now() / 1000) }, ...entries].slice(0, 25);
        }
      },
      create: async (p: { url: string }) => {
        if (refuse.urls.has(p.url)) throw new Error('Cannot open that URL');
        created.push(p.url);
        return { id: 9999, windowId: 1 };
      },
      group: async () => undefined,
    },
    sessions: {
      MAX_SESSION_RESULTS: 25,
      getRecentlyClosed: async () => entries.map((e) => ({ lastModified: e.lastModified, tab: { sessionId: e.sessionId, url: e.tab.url, index: e.index, windowId: 0 } })),
      restore: async (id: string) => {
        if (refuse.sessions.has(id)) throw new Error(`Invalid session id: "${id}".`);
        const e = entries.find((x) => x.sessionId === id)!;
        entries = entries.filter((x) => x !== e);
        tabs.push(e.tab);
        restored.push(id);
      },
    },
    storage: {
      session: {
        get: async (key: string) => (store.has(key) ? { [key]: store.get(key) } : {}),
        set: async (items: Record<string, unknown>) => void Object.entries(items).forEach(([k, v]) => store.set(k, structuredClone(v))),
        remove: async (key: string) => void store.delete(key),
      },
    },
  });
  return { restored, created, refuse, open: () => tabs, store };
}

const URLS = ['https://a.test/', 'https://a.test/x', 'https://b.test/', 'https://b.test/y'];
const browserArb = fc
  .array(fc.record({ windowId: fc.integer({ min: 1, max: 3 }), url: fc.constantFrom(...URLS), pinned: fc.boolean(), audible: fc.boolean() }), { minLength: 2, maxLength: 20 })
  .map((rows) => {
    const seen = new Map<number, number>();
    return rows.map((r, i): Tab => {
      const index = seen.get(r.windowId) ?? 0;
      seen.set(r.windowId, index + 1);
      return { id: i + 1, index, title: r.url, active: index === 0, discarded: false, groupId: -1, lastAccessed: i, ...r };
    });
  });
const menuCase = browserArb.chain((tabs) => fc.record({ tabs: fc.constant(tabs), clicked: fc.constantFrom(...tabs), pick: fc.constantFrom(duplicatesOf, othersFromSite) }));
const menu = { source: 'menu' as const, message: (n: number) => `Closed ${n}` };

describe('undo for right-click closes', () => {
  it('a menu close is offered when the popup opens; undo brings each tab back exactly once, from its own entry, and is not offered again', async () => {
    await fc.assert(
      fc.asyncProperty(menuCase, async ({ tabs, clicked, pick }) => {
        const chromeState = fakeChrome(tabs);
        const ids = pick(clicked, tabs, DEFAULT_POLICY).map((t) => t.id);
        const { closed } = await closeTabs(ids, DEFAULT_POLICY, menu);
        const offer = await pendingUndo();
        if (closed.length === 0) return offer === null;
        if (!offer || offer.message !== `Closed ${closed.length}`) return false;
        await undoClose(offer.tabs, offer.closedAt);
        const back = [...chromeState.restored].sort();
        return (
          JSON.stringify(back) === JSON.stringify(closed.map((t) => `s${t.id}`).sort()) &&
          closed.every((t) => chromeState.open().filter((o) => o.id === t.id).length === 1) &&
          (await pendingUndo()) === null
        );
      }),
    );
  });

  it('is offered for a minute only, and never for a popup close (the popup offers its own)', async () => {
    fakeChrome(TABS);
    const { closedAt } = await closeTabs([TABS[3]!.id], null, menu);
    expect(await pendingUndo(closedAt! + UNDO_OFFER_MS - 1000)).not.toBeNull();
    expect(await pendingUndo(closedAt! + UNDO_OFFER_MS + 1)).toBeNull();
    await closeTabs([TABS[5]!.id], null);
    expect(await pendingUndo(closedAt!)).toBeNull();
  });

  it('a second close replaces the first record: undo brings back only the second', async () => {
    const chromeState = fakeChrome(TABS);
    await closeTabs([TABS[3]!.id, TABS[8]!.id], null, menu);
    await closeTabs([TABS[5]!.id], null, menu);
    const offer = await pendingUndo();
    expect(offer?.tabs.map((t) => t.id)).toEqual([TABS[5]!.id]);
    await undoClose(offer!.tabs, offer!.closedAt);
    expect(chromeState.restored).toEqual([`s${TABS[5]!.id}`]);
  });
});

describe('undo record after a partial restore', () => {
  const urlOf = (i: number) => TABS[i]!.url;
  it('keeps exactly the tabs that couldn’t come back, offers them again, and clears once they do', async () => {
    const chromeState = fakeChrome(TABS);
    const ids = [TABS[3]!.id, TABS[5]!.id, TABS[8]!.id];
    const { closed, closedAt } = await closeTabs(ids, null, menu);
    // TABS[3]: whole. TABS[5]: Chrome refuses its session, reopened by URL. TABS[8]: refused and can't be reopened.
    chromeState.refuse.sessions.add(`s${TABS[5]!.id}`).add(`s${TABS[8]!.id}`);
    chromeState.refuse.urls.add(urlOf(8));
    const first = await undoClose(closed, closedAt);
    expect(first).toEqual({ count: 2, fresh: 1, failed: [closed.find((t) => t.id === TABS[8]!.id)] });
    expect(chromeState.restored).toEqual([`s${TABS[3]!.id}`]);
    expect(chromeState.created).toEqual([urlOf(5)]);
    const offer = await pendingUndo();
    expect(offer?.tabs.map((t) => t.id)).toEqual([TABS[8]!.id]);
    expect(offer?.closedAt).toBe(closedAt);
    // Chrome allows it again: the retry brings it back whole and the record goes.
    chromeState.refuse.sessions.clear();
    chromeState.refuse.urls.clear();
    expect(await undoClose(offer!.tabs, offer!.closedAt)).toEqual({ count: 1, fresh: 0, failed: [] });
    expect(chromeState.restored).toContain(`s${TABS[8]!.id}`);
    expect(await pendingUndo()).toBeNull();
  });

  it('an undo of an older close leaves the newer record alone', async () => {
    fakeChrome(TABS);
    const older = await closeTabs([TABS[3]!.id], null, menu);
    const newer = await closeTabs([TABS[5]!.id], null, menu);
    await undoClose(older.closed, older.closedAt! - 1);
    expect((await pendingUndo())?.closedAt).toBe(newer.closedAt);
  });
});
