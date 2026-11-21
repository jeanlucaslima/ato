import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_POLICY, protection } from '../core/duplicates';
import { TABS } from '../dev/fixtures';
import { ChromeBrowser } from './chrome-browser';
import { CLOSE_MESSAGE, closeTabs, readCloseRequest } from './chrome-close';

afterEach(() => vi.unstubAllGlobals());

describe('readCloseRequest', () => {
  it('accepts a well-formed request; anything else is refused', () => {
    expect(readCloseRequest({ type: CLOSE_MESSAGE, tabIds: [1, 2], policy: null })).toEqual({ tabIds: [1, 2], policy: null });
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
    expect(sendMessage).toHaveBeenCalledWith({ type: CLOSE_MESSAGE, tabIds: [TABS[3]!.id], policy: DEFAULT_POLICY });
    sendMessage.mockResolvedValueOnce({ ok: false, error: 'Tabs cannot be edited right now' } as never);
    await expect(new ChromeBrowser().close([TABS[3]!.id], DEFAULT_POLICY)).rejects.toThrow('Tabs cannot be edited right now');
  });
});
