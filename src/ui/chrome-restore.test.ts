import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import type { Tab } from '../core/types';
import { matchEntries, restoreTabs, type ClosedEntry } from './chrome-restore';

const NOW = 1_795_000_000_000;

/**
 * What Chrome 158 records when `closed` are removed in that order (checked with
 * a probe extension): one entry per tab, newest first, with the URL, the index
 * the tab had at that moment (earlier removals shift it) and windowId 0. Only the
 * last 25 are kept. Entry ids are `s<tab id>` so a test can tell whose is whose.
 */
function chromeEntries(strip: readonly Tab[], closed: readonly Tab[], at = NOW): ClosedEntry[] {
  const windows = new Map<number, number[]>();
  for (const t of [...strip].sort((a, b) => a.index - b.index)) windows.set(t.windowId, [...(windows.get(t.windowId) ?? []), t.id]);
  const entries = closed.map((t): ClosedEntry => {
    const ids = windows.get(t.windowId)!;
    const index = ids.indexOf(t.id);
    ids.splice(index, 1);
    return { sessionId: `s${t.id}`, url: t.url, index, windowId: 0, lastModified: Math.floor(at / 1000) };
  });
  return entries.reverse().slice(0, 25);
}

function fakeChrome(entries: readonly ClosedEntry[]) {
  const calls = { restored: [] as string[], created: [] as string[], grouped: 0 };
  vi.stubGlobal('chrome', {
    sessions: {
      MAX_SESSION_RESULTS: 25,
      getRecentlyClosed: async () => entries.map((e) => ({ lastModified: e.lastModified, tab: { sessionId: e.sessionId, url: e.url, index: e.index, windowId: e.windowId } })),
      restore: async (id: string) => void calls.restored.push(id),
    },
    tabs: {
      create: async (p: { url: string; windowId?: number }) => {
        calls.created.push(p.url);
        return { id: 1000 + calls.created.length, windowId: p.windowId ?? 1 };
      },
      group: async () => void calls.grouped++,
    },
  });
  return calls;
}

const tab = (id: number, url: string, windowId = 1, index = id - 1, groupId = -1): Tab => ({
  id, windowId, index, title: url, url, active: false, pinned: false, audible: false, discarded: false, groupId, lastAccessed: 0,
});

/** Up to three windows of tabs drawn from three URLs (so many copies), and a closing order over some of them. */
const scenario = fc
  .array(fc.tuple(fc.integer({ min: 1, max: 3 }), fc.constantFrom('https://a.test/', 'https://b.test/', 'https://c.test/x')), { minLength: 1, maxLength: 40 })
  .chain((specs) => {
    const counters = new Map<number, number>();
    const strip = specs.map(([w, url], i) => {
      const index = counters.get(w) ?? 0;
      counters.set(w, index + 1);
      return tab(i + 1, url, w, index);
    });
    return fc.tuple(fc.constant(strip), fc.shuffledSubarray(strip, { minLength: 1 }));
  });

afterEach(() => vi.unstubAllGlobals());

describe('matchEntries', () => {
  it('gives each closed copy its own entry (same URL, its index at close, its turn), whatever the windows and positions', () => {
    fc.assert(
      fc.property(scenario, ([strip, closed]) => {
        const entries = chromeEntries(strip, closed);
        const own = matchEntries(closed, entries, NOW);
        const remembered = new Set(entries.map((e) => e.sessionId));
        return closed.every((t) => (remembered.has(`s${t.id}`) ? own.get(t.id) === `s${t.id}` : !own.has(t.id)));
      }),
    );
  });

  it('never uses an entry from before the close, even with the same URL', () => {
    const strip = [tab(1, 'https://a.test/'), tab(2, 'https://a.test/'), tab(3, 'https://b.test/')];
    const older: ClosedEntry = { sessionId: 'old', url: 'https://a.test/', index: 1, windowId: 0, lastModified: Math.floor((NOW - 60_000) / 1000) };
    const entries = [...chromeEntries(strip, [strip[1]!]), older];
    expect(matchEntries([strip[1]!, strip[0]!], entries, NOW)).toEqual(new Map([[2, 's2']]));
  });
});

describe('restoreTabs', () => {
  it('brings back every closed tab exactly once, each from its own entry, past the 25 sessions remembers', async () => {
    await fc.assert(
      fc.asyncProperty(scenario, async ([strip, closed]) => {
        const entries = chromeEntries(strip, closed);
        const calls = fakeChrome(entries);
        const { count, fresh } = await restoreTabs(closed, NOW);
        const remembered = closed.filter((t) => entries.some((e) => e.sessionId === `s${t.id}`));
        return (
          count === closed.length &&
          calls.restored.length + calls.created.length === closed.length &&
          new Set(calls.restored).size === calls.restored.length &&
          [...calls.restored].sort().join() === remembered.map((t) => `s${t.id}`).sort().join() &&
          fresh === calls.created.length &&
          calls.restored.length <= 25
        );
      }),
    );
  });

  it('restores whole tabs last-closed first, so each goes back at the index it closed from', async () => {
    const strip = [tab(1, 'https://a.test/'), tab(2, 'https://d.test/'), tab(3, 'https://b.test/'), tab(4, 'https://d.test/')];
    const closed = [strip[1]!, strip[3]!];
    const calls = fakeChrome(chromeEntries(strip, closed));
    await restoreTabs(closed, NOW);
    expect(calls.restored).toEqual(['s4', 's2']);
  });

  it('puts reopened tabs back into their tab group', async () => {
    const closed = Array.from({ length: 30 }, (_, i) => tab(i, `https://x.test/${i}`, 1, i, 7));
    const calls = fakeChrome(chromeEntries(closed, closed));
    const result = await restoreTabs(closed, NOW);
    expect(result).toEqual({ count: 30, fresh: 5 });
    expect(calls.grouped).toBe(5);
  });
});
