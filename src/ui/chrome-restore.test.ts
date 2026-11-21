import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import type { Tab } from '../core/types';
import { restoreTabs } from './chrome-restore';

/** A `chrome` that remembers the last 25 closed tabs, like Chrome's sessions. */
function fakeChrome(closed: readonly Tab[]) {
  const remembered = closed.slice(-25).reverse().map((t, i) => ({ tab: { url: t.url, sessionId: `s${i}` } }));
  const calls = { restored: [] as string[], created: [] as string[], grouped: 0 };
  const api = {
    sessions: {
      MAX_SESSION_RESULTS: 25,
      getRecentlyClosed: async () => remembered,
      restore: async (id: string) => void calls.restored.push(id),
    },
    tabs: {
      create: async (p: { url: string; windowId?: number }) => {
        calls.created.push(p.url);
        return { id: 1000 + calls.created.length, windowId: p.windowId ?? 1 };
      },
      group: async () => void calls.grouped++,
    },
  };
  vi.stubGlobal('chrome', api);
  return calls;
}

const tab = (i: number, url: string, groupId = -1): Tab => ({
  id: i, windowId: 1, index: i, title: url, url, active: false, pinned: false, audible: false, discarded: false, groupId, lastAccessed: 0,
});

afterEach(() => vi.unstubAllGlobals());

describe('restoreTabs', () => {
  it('brings back every closed tab exactly once, past the 25 sessions remembers', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom('https://a.test/', 'https://b.test/', 'https://c.test/x'), { maxLength: 60 }), async (urls) => {
        const closed = urls.map((u, i) => tab(i, u));
        const calls = fakeChrome(closed);
        const { count, fresh } = await restoreTabs(closed);
        return (
          count === closed.length &&
          calls.restored.length + calls.created.length === closed.length &&
          new Set(calls.restored).size === calls.restored.length &&
          fresh === calls.created.length &&
          calls.restored.length <= 25
        );
      }),
    );
  });

  it('puts reopened tabs back into their tab group', async () => {
    const closed = Array.from({ length: 30 }, (_, i) => tab(i, `https://x.test/${i}`, 7));
    const calls = fakeChrome(closed);
    const result = await restoreTabs(closed);
    expect(result).toEqual({ count: 30, fresh: 5 });
    expect(calls.grouped).toBe(5);
  });
});
