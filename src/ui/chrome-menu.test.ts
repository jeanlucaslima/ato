import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { protection } from '../core/duplicates';
import { DEFAULT_SETTINGS, policyOf } from '../core/settings';
import type { Tab } from '../core/types';
import { pendingUndo, undoClose } from './chrome-close';
import { closeFromMenu, MENU } from './chrome-menu';

afterEach(() => vi.unstubAllGlobals());

type Flip = 'active' | 'audible' | 'split' | 'pinned' | 'group';
const flip = (t: Tab, f: Flip): Tab => (f === 'active' ? { ...t, active: true } : f === 'audible' ? { ...t, audible: true } : f === 'split' ? { ...t, splitViewId: 4 } : f === 'pinned' ? { ...t, pinned: true } : { ...t, groupId: 9 });

const URLS = ['https://a.test/', 'https://a.test/x', 'https://b.test/'];
const caseArb = fc
  .array(fc.record({ windowId: fc.integer({ min: 1, max: 2 }), url: fc.constantFrom(...URLS), pinned: fc.boolean() }), { minLength: 2, maxLength: 16 })
  .map((rows) => {
    const seen = new Map<number, number>();
    return rows.map((r, i): Tab => {
      const index = seen.get(r.windowId) ?? 0;
      seen.set(r.windowId, index + 1);
      return { id: i + 1, index, title: r.url, active: index === 0, audible: false, discarded: false, groupId: -1, lastAccessed: i, ...r };
    });
  })
  .chain((tabs) =>
    fc.record({
      tabs: fc.constant(tabs),
      clicked: fc.constantFrom(...tabs),
      item: fc.constantFrom(MENU.duplicates.id, MENU.site.id),
      flips: fc.array(fc.tuple(fc.constantFrom(...tabs.map((t) => t.id)), fc.constantFrom<Flip>('active', 'audible', 'split', 'pinned', 'group')), { maxLength: 4 }),
    }),
  );

/** Chrome whose tabs change (`flips`) after the menu reads them and before the close reads them again. */
function fakeChrome(start: Tab[], flips: [number, Flip][]) {
  let tabs = start;
  let reads = 0;
  let entries: { sessionId: string; tab: Tab; index: number }[] = [];
  const store = new Map<string, unknown>();
  const removed: number[] = [];
  const restored: string[] = [];
  vi.stubGlobal('chrome', {
    tabs: {
      query: async () => {
        if (++reads === 2) for (const [id, f] of flips) tabs = tabs.map((t) => (t.id === id ? flip(t, f) : t));
        return tabs.map((t) => ({ ...t }));
      },
      remove: async (ids: number[]) => {
        for (const id of ids) {
          const tab = tabs.find((t) => t.id === id)!;
          entries = [{ sessionId: `s${id}`, tab, index: tabs.filter((t) => t.windowId === tab.windowId && t.index < tab.index).length }, ...entries];
          tabs = tabs.filter((t) => t.id !== id);
          removed.push(id);
        }
      },
    },
    sessions: {
      MAX_SESSION_RESULTS: 25,
      getRecentlyClosed: async () => entries.slice(0, 25).map((e) => ({ lastModified: Math.floor(Date.now() / 1000), tab: { sessionId: e.sessionId, url: e.tab.url, index: e.index, windowId: 0 } })),
      restore: async (id: string) => {
        const e = entries.find((x) => x.sessionId === id)!;
        entries = entries.filter((x) => x !== e);
        tabs = [...tabs, e.tab];
        restored.push(id);
      },
    },
    storage: {
      session: {
        get: async (k: string) => (store.has(k) ? { [k]: store.get(k) } : {}),
        set: async (items: Record<string, unknown>) => void Object.entries(items).forEach(([k, v]) => store.set(k, structuredClone(v))),
        remove: async (k: string) => void store.delete(k),
      },
    },
  });
  return { removed, restored, now: () => tabs };
}

describe('right-click menu close', () => {
  it('never closes the clicked tab or a tab protected by the time it closes; undo brings each back exactly once', async () => {
    await fc.assert(
      fc.asyncProperty(caseArb, async ({ tabs, clicked, item, flips }) => {
        const chromeState = fakeChrome(tabs, flips);
        const policy = policyOf(DEFAULT_SETTINGS);
        const fresh = new Map(tabs.map((t) => [t.id, flips.reduce((x, [id, f]) => (id === x.id ? flip(x, f) : x), t)]));
        await closeFromMenu(item, clicked.id, async () => DEFAULT_SETTINGS);
        const safe = chromeState.removed.every((id) => id !== clicked.id && protection(fresh.get(id)!, policy) === null);
        const offer = await pendingUndo();
        if (chromeState.removed.length === 0) return safe && offer === null;
        if (!offer || offer.tabs.length !== chromeState.removed.length) return false;
        await undoClose(offer.tabs, offer.closedAt);
        return (
          safe &&
          [...chromeState.restored].sort().join() === chromeState.removed.map((id) => `s${id}`).sort().join() &&
          chromeState.removed.every((id) => chromeState.now().filter((t) => t.id === id).length === 1) &&
          (await pendingUndo()) === null
        );
      }),
    );
  });
});

describe('"Close duplicates of this tab" when the clicked tab closes first', () => {
  it('leaves one copy open on Chrome’s current state; "Close other tabs from this site" still closes them all', async () => {
    const t = (id: number, url: string, index: number): Tab => ({ id, windowId: 1, index, url, title: url, active: index === 0, pinned: false, audible: false, discarded: false, groupId: -1, lastAccessed: id });
    for (const [item, left] of [[MENU.duplicates.id, 1], [MENU.site.id, 0]] as const) {
      let tabs = [t(1, 'https://h.test/', 0), t(2, 'https://a.test/', 1), t(3, 'https://a.test/', 2), t(4, 'https://a.test/', 3)];
      let reads = 0;
      vi.stubGlobal('chrome', {
        tabs: {
          query: async () => {
            // The menu reads, then the clicked tab (2) is closed before the close path reads again.
            if (++reads === 2) tabs = tabs.filter((x) => x.id !== 2);
            return tabs.map((x) => ({ ...x }));
          },
          remove: async (ids: number[]) => void (tabs = tabs.filter((x) => !ids.includes(x.id))),
        },
        sessions: { MAX_SESSION_RESULTS: 25, getRecentlyClosed: async () => [] },
        storage: { session: { set: async () => undefined } },
      });
      await closeFromMenu(item, 2, async () => DEFAULT_SETTINGS);
      expect([item, tabs.filter((x) => x.url === 'https://a.test/').length]).toEqual([item, left]);
    }
  });
});
