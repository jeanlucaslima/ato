import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import type { Tab } from '../core/types';
import { matchEntries, restoreTabs, sessionsOf, type ClosedEntry } from './chrome-restore';

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

/** `refuse`: session ids Chrome won't restore; `unopenable`: URLs it won't open; `unlisted`: sessions can't be read. */
interface Failures {
  refuse?: ReadonlySet<string>;
  unopenable?: ReadonlySet<string>;
  unlisted?: boolean;
}

function fakeChrome(entries: readonly ClosedEntry[], fail: Failures = {}) {
  const calls = { restored: [] as string[], created: [] as string[], grouped: 0 };
  vi.stubGlobal('chrome', {
    sessions: {
      MAX_SESSION_RESULTS: 25,
      getRecentlyClosed: async () => {
        if (fail.unlisted) throw new Error('sessions unavailable');
        return entries.map((e) => ({ lastModified: e.lastModified, tab: { sessionId: e.sessionId, url: e.url, index: e.index, windowId: e.windowId } }));
      },
      restore: async (id: string) => {
        if (fail.refuse?.has(id)) throw new Error(`Invalid session id: "${id}".`);
        calls.restored.push(id);
      },
    },
    tabs: {
      create: async (p: { url: string; windowId?: number }) => {
        if (fail.unopenable?.has(p.url)) throw new Error('Cannot open that URL');
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
    expect(result).toEqual({ count: 30, fresh: 5, failed: [] });
    expect(calls.grouped).toBe(5);
  });
});

/** Unrelated tabs closed (outside ATO) after `closed`: their entries go on top, newer. */
function closedSince(strip: readonly Tab[], closed: readonly Tab[], later: readonly Tab[]): ClosedEntry[] {
  const all = chromeEntries(strip, [...closed, ...later]);
  return all.map((e) => (later.some((t) => e.sessionId === `s${t.id}`) ? { ...e, lastModified: e.lastModified + 20 } : e));
}

describe('undo after tabs closed outside ATO since', () => {
  // The two copies of a.test have different histories (their own entries s1, s2).
  const strip = [tab(1, 'https://a.test/', 1, 2), tab(2, 'https://a.test/', 2, 2), tab(3, 'https://a.test/', 3, 2), tab(4, 'https://a.test/', 1, 3)];

  it('content alone is ambiguous: matching without pinned sessions picks a newer same-URL entry (reproduced)', () => {
    // ATO closed 1 then 2; then the user closed 3 (same URL, same index) in another window.
    const entries = closedSince(strip, [strip[0]!, strip[1]!], [strip[2]!]);
    expect(Object.fromEntries(matchEntries([strip[0]!, strip[1]!], entries, NOW))).not.toEqual({ 1: 's1', 2: 's2' });
  });

  it('sessions pinned right after the close bring each copy back from its own entry, never the unrelated one', async () => {
    const closed = [strip[0]!, strip[1]!];
    fakeChrome(chromeEntries(strip, closed));
    const pinned = await sessionsOf(closed, NOW);
    expect(pinned).toEqual({ 1: 's1', 2: 's2' });
    const calls = fakeChrome(closedSince(strip, closed, [strip[2]!, strip[3]!]));
    expect(await restoreTabs(closed, NOW, pinned)).toEqual({ count: 2, fresh: 0, failed: [] });
    expect(calls.restored).toEqual(['s2', 's1']);
  });

  it('whatever closes since, in any window and position, each tab comes back from its own entry or by URL, never from another', async () => {
    await fc.assert(
      fc.asyncProperty(
        scenario.chain(([strip, closed]) => fc.tuple(fc.constant(strip), fc.constant(closed), fc.shuffledSubarray(strip.filter((t) => !closed.includes(t))))),
        async ([strip, closed, later]) => {
          fakeChrome(chromeEntries(strip, closed));
          const pinned = await sessionsOf(closed, NOW);
          const entries = closedSince(strip, closed, later);
          const calls = fakeChrome(entries);
          const { count, fresh, failed } = await restoreTabs(closed, NOW, pinned);
          const still = closed.filter((t) => entries.some((e) => e.sessionId === `s${t.id}`));
          return (
            count === closed.length &&
            failed.length === 0 &&
            [...calls.restored].sort().join() === still.map((t) => `s${t.id}`).sort().join() &&
            fresh === closed.length - still.length
          );
        },
      ),
    );
  });
});

describe('restore that fails part-way', () => {
  const strip = [tab(1, 'https://a.test/'), tab(2, 'https://b.test/'), tab(3, 'https://a.test/'), tab(4, 'https://c.test/')];

  it('a session that restores comes back whole', async () => {
    const calls = fakeChrome(chromeEntries(strip, [strip[1]!]));
    expect(await restoreTabs([strip[1]!], NOW)).toEqual({ count: 1, fresh: 0, failed: [] });
    expect(calls).toMatchObject({ restored: ['s2'], created: [] });
  });

  it('a matched session Chrome refuses is reopened by URL', async () => {
    const calls = fakeChrome(chromeEntries(strip, [strip[1]!]), { refuse: new Set(['s2']) });
    expect(await restoreTabs([strip[1]!], NOW)).toEqual({ count: 1, fresh: 1, failed: [] });
    expect(calls).toMatchObject({ restored: [], created: ['https://b.test/'] });
  });

  it('some whole, some by URL, one not at all: each counted once, the failure reported', async () => {
    const closed = [strip[0]!, strip[1]!, strip[2]!, strip[3]!];
    const calls = fakeChrome(chromeEntries(strip, closed), { refuse: new Set(['s1', 's4']), unopenable: new Set(['https://c.test/']) });
    expect(await restoreTabs(closed, NOW)).toEqual({ count: 3, fresh: 1, failed: [strip[3]] });
    expect(calls).toMatchObject({ restored: ['s3', 's2'], created: ['https://a.test/'] });
  });

  it('if Chrome can’t list its sessions, every tab is reopened by URL', async () => {
    const calls = fakeChrome([], { unlisted: true });
    expect(await restoreTabs([strip[0]!, strip[1]!], NOW)).toEqual({ count: 2, fresh: 2, failed: [] });
    expect(calls.created).toEqual(['https://a.test/', 'https://b.test/']);
  });

  it('every tab ends exactly one way (whole, by URL, or failed) whatever Chrome refuses', async () => {
    const urls = ['https://a.test/', 'https://b.test/', 'https://c.test/x'];
    await fc.assert(
      fc.asyncProperty(
        scenario.chain(([strip, closed]) => fc.tuple(fc.constant(strip), fc.constant(closed), fc.subarray(closed.map((t) => `s${t.id}`)), fc.subarray(urls))),
        async ([strip, closed, refused, unopenable]) => {
          const entries = chromeEntries(strip, closed);
          const calls = fakeChrome(entries, { refuse: new Set(refused), unopenable: new Set(unopenable) });
          const { count, fresh, failed } = await restoreTabs(closed, NOW);
          const whole = closed.filter((t) => entries.some((e) => e.sessionId === `s${t.id}`) && !refused.includes(`s${t.id}`));
          const rest = closed.filter((t) => !whole.includes(t));
          const expectFailed = rest.filter((t) => unopenable.includes(t.url));
          return (
            [...calls.restored].sort().join() === whole.map((t) => `s${t.id}`).sort().join() &&
            [...calls.created].sort().join() === rest.filter((t) => !unopenable.includes(t.url)).map((t) => t.url).sort().join() &&
            fresh === calls.created.length &&
            count === whole.length + fresh &&
            count + failed.length === closed.length &&
            JSON.stringify(failed.map((t) => t.id)) === JSON.stringify(expectFailed.map((t) => t.id))
          );
        },
      ),
    );
  });
});
