import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { applyOverrides, keptReason, planDuplicates, protection, stillClosable, tabsToClose, type DuplicatePolicy } from './duplicates';
import { duplicateKey } from './tabs';
import type { Tab } from './types';

const URLS = ['https://a.test/', 'https://a.test/?q=2', 'https://a.test/#top', 'https://b.test/x', 'http://c.test/?q=1', 'file:///tmp/f.txt', 'chrome://settings/', 'about:blank', ''];

/** Arbitrary browser state: unique ids, small URL pool so duplicates are common. */
const tabsArb = fc
  .array(
    fc.record({
      windowId: fc.integer({ min: 1, max: 3 }),
      url: fc.constantFrom(...URLS),
      active: fc.boolean(),
      pinned: fc.boolean(),
      audible: fc.boolean(),
      groupId: fc.constantFrom(-1, -1, 7),
      splitViewId: fc.constantFrom(-1, -1, -1, 3),
    }),
    { maxLength: 24 },
  )
  .map((rows) =>
    rows.map(
      (r, i): Tab => ({
        id: i + 1,
        index: i,
        title: r.url,
        discarded: false,
        lastAccessed: 0,
        ...r,
      }),
    ),
  );

const policyArb = fc.record<DuplicatePolicy>({
  keep: fc.constantFrom('oldest', 'newest'),
  protectPinned: fc.boolean(),
  protectGroups: fc.boolean(),
  match: fc.constantFrom('exact' as const, 'ignoreHash' as const, 'ignoreQuery' as const, 'ignoreBoth' as const),
});

const overridesArb = fc
  .array(fc.tuple(fc.integer({ min: 1, max: 24 }), fc.constantFrom('keep' as const, 'close' as const)))
  .map((pairs) => new Map(pairs));

/** Plans as the UI produces them: planned, then adjusted by the user in review. */
const plannedArb = fc.tuple(tabsArb, policyArb, overridesArb).map(([tabs, policy, overrides]) => ({
  tabs,
  policy,
  sets: applyOverrides(planDuplicates(tabs, policy), overrides, policy),
}));

describe('duplicate cleanup safety rules', () => {
  it('never closes the active tab of any window', () => {
    fc.assert(fc.property(plannedArb, ({ sets }) => tabsToClose(sets).every((t) => !t.active)));
  });

  it('never closes a tab that is playing audio', () => {
    fc.assert(fc.property(plannedArb, ({ sets }) => tabsToClose(sets).every((t) => !t.audible)));
  });

  it('keeps at least one tab in every set', () => {
    fc.assert(fc.property(plannedArb, ({ sets }) => sets.every((s) => s.copies.some((c) => c.decision.action === 'keep'))));
  });

  it('only closes real duplicates', () => {
    fc.assert(
      fc.property(plannedArb, ({ tabs, sets, policy }) =>
        tabsToClose(sets).every((t) => {
          const key = duplicateKey(t, policy.match);
          return key !== null && tabs.filter((o) => duplicateKey(o, policy.match) === key).length >= 2;
        }),
      ),
    );
  });

  it('never closes a tab in a split view', () => {
    fc.assert(fc.property(plannedArb, ({ sets }) => tabsToClose(sets).every((t) => t.splitViewId === -1)));
  });

  it('never closes protected tabs', () => {
    fc.assert(fc.property(plannedArb, ({ sets, policy }) => tabsToClose(sets).every((t) => protection(t, policy) === null)));
  });

  it('keeps exactly one copy when nothing in the set is protected and the user changed nothing', () => {
    fc.assert(
      fc.property(tabsArb, policyArb, (tabs, policy) =>
        planDuplicates(tabs, policy)
          .filter((s) => s.copies.every((c) => protection(c.tab, policy) === null))
          .every((s) => s.copies.filter((c) => c.decision.action === 'keep').length === 1),
      ),
    );
  });

  it('accounts for every copy exactly once', () => {
    fc.assert(
      fc.property(plannedArb, ({ tabs, sets }) => {
        const ids = sets.flatMap((s) => s.copies.map((c) => c.tab.id));
        return new Set(ids).size === ids.length && ids.every((id) => tabs.some((t) => t.id === id));
      }),
    );
  });
});

describe('planDuplicates', () => {
  const tab = (id: number, extra: Partial<Tab> = {}): Tab => ({
    id,
    windowId: 1,
    index: id,
    title: 't',
    url: 'https://x.test/',
    active: false,
    pinned: false,
    audible: false,
    discarded: false,
    groupId: -1,
    lastAccessed: 0,
    ...extra,
  });

  it('keeps the current tab instead of the oldest (issue #49)', () => {
    const [set] = planDuplicates([tab(1), tab(2, { active: true }), tab(3)], { keep: 'oldest', protectPinned: true, protectGroups: false, match: 'exact' });
    expect(set?.copies.map((c) => [c.tab.id, c.decision.action])).toEqual([
      [1, 'close'],
      [2, 'keep'],
      [3, 'close'],
    ]);
  });

  it('honours keep = newest', () => {
    const [set] = planDuplicates([tab(1), tab(2), tab(3)], { keep: 'newest', protectPinned: false, protectGroups: false, match: 'exact' });
    expect(set?.copies.map((c) => c.decision.action)).toEqual(['close', 'close', 'keep']);
  });

  it('ignores an override that would leave a set with nothing kept', () => {
    const policy: DuplicatePolicy = { keep: 'oldest', protectPinned: false, protectGroups: false, match: 'exact' };
    const plan = planDuplicates([tab(1), tab(2)], policy);
    const [set] = applyOverrides(plan, new Map([[1, 'close']]), policy);
    expect(set?.copies.map((c) => c.decision.action)).toEqual(['keep', 'close']);
  });
});

/**
 * The close runs on a fresh read of Chrome, after the 180 ms animation: by then
 * the planned survivor may be gone, or any copy may show another page.
 */
const recheckArb = fc.tuple(tabsArb, policyArb, fc.boolean()).chain(([tabs, policy, cleanup]) =>
  fc.record({
    policy: fc.constant(policy),
    cleanup: fc.constant(cleanup),
    asked: fc.constant(tabsToClose(planDuplicates(tabs, policy)).map((t) => t.id)),
    // Some tabs close (survivors included), some navigate, before the close runs.
    fresh: fc.tuple(fc.subarray(tabs.map((t) => t.id)), fc.array(fc.tuple(fc.constantFrom(0, ...tabs.map((t) => t.id)), fc.constantFrom(...URLS)), { maxLength: 6 })).map(([gone, moves]) =>
      tabs.filter((t) => !gone.includes(t.id)).map((t) => moves.reduce((x, [id, url]) => (id === x.id ? { ...x, url } : x), t)),
    ),
  }),
);

describe('the last check before a duplicate cleanup (stillClosable with cleanup)', () => {
  it('every page a cleanup closes still has a copy open afterwards, whatever closed or navigated since', () => {
    fc.assert(
      fc.property(recheckArb, ({ policy, asked, fresh }) => {
        const { closable } = stillClosable(fresh, asked, policy, true);
        const closing = new Set(closable.map((t) => t.id));
        return closable.every((t) => {
          const key = duplicateKey(t, policy.match);
          return key !== null && fresh.some((o) => !closing.has(o.id) && duplicateKey(o, policy.match) === key);
        });
      }),
    );
  });

  it('keeps no more than it must: one copy of a page left without any, nothing where a copy stays', () => {
    fc.assert(
      fc.property(recheckArb, ({ policy, asked, fresh }) => {
        const before = stillClosable(fresh, asked, policy, false);
        const after = stillClosable(fresh, asked, policy, true);
        const closing = new Set(after.closable.map((t) => t.id));
        const spared = before.closable.filter((t) => !closing.has(t.id));
        const keys = spared.map((t) => duplicateKey(t, policy.match)).filter((k) => k !== null);
        return (
          after.closable.every((t) => before.closable.includes(t)) &&
          after.kept.length === before.kept.length + spared.length &&
          new Set(keys).size === keys.length &&
          spared.every((t) => {
            const key = duplicateKey(t, policy.match);
            return key === null || !fresh.some((o) => !before.closable.includes(o) && duplicateKey(o, policy.match) === key);
          })
        );
      }),
    );
  });

  it('the copy left is the one policy.keep picks among those asked', () => {
    const t = (id: number): Tab => ({ id, windowId: 1, index: id, title: '', url: 'https://a.test/', active: false, pinned: false, audible: false, discarded: false, groupId: -1, lastAccessed: 0 });
    const base: DuplicatePolicy = { keep: 'oldest', protectPinned: true, protectGroups: true, match: 'exact' };
    expect(stillClosable([t(2), t(3), t(4)], [2, 3, 4], base, true).kept.map((x) => x.id)).toEqual([2]);
    expect(stillClosable([t(2), t(3), t(4)], [2, 3, 4], { ...base, keep: 'newest' }, true).kept.map((x) => x.id)).toEqual([4]);
  });

  it('without cleanup (closing a site, a window, a selection) nothing extra is kept', () => {
    fc.assert(
      fc.property(recheckArb, ({ policy, asked, fresh }) => {
        const { closable, kept } = stillClosable(fresh, asked, policy, false);
        return kept.every((t) => protection(t, policy) !== null) && closable.length + kept.length === fresh.filter((t) => asked.includes(t.id)).length;
      }),
    );
  });
});

describe('keptReason', () => {
  const t = (over: Partial<Tab>): Tab => ({ id: 1, windowId: 2, index: 0, title: '', url: 'https://a.test/', active: false, pinned: false, audible: false, discarded: false, groupId: -1, lastAccessed: 0, ...over });
  const policy: DuplicatePolicy = { keep: 'oldest', protectPinned: true, protectGroups: true, match: 'exact' };

  it('names the protection, or the last copy a cleanup kept', () => {
    expect(keptReason(t({ audible: true }), policy, false)).toBe('playing');
    expect(keptReason(t({ active: true }), policy, false)).toBe('current');
    expect(keptReason(t({}), policy, false)).toBe('copy');
  });

  it('in a focused-only close, a current tab that is also pinned is kept as pinned', () => {
    expect(keptReason(t({ active: true, pinned: true }), policy, true)).toBe('pinned');
    expect(keptReason(t({ active: true }), policy, true)).toBe('current');
  });
});
