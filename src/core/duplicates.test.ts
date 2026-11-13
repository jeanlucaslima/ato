import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { applyOverrides, planDuplicates, protection, tabsToClose, type DuplicatePolicy } from './duplicates';
import { duplicateKey } from './tabs';
import type { Tab } from './types';

const URLS = ['https://a.test/', 'https://b.test/x', 'http://c.test/?q=1', 'file:///tmp/f.txt', 'chrome://settings/', 'about:blank', ''];

/** Arbitrary browser state: unique ids, small URL pool so duplicates are common. */
const tabsArb = fc
  .array(
    fc.record({
      windowId: fc.integer({ min: 1, max: 3 }),
      url: fc.constantFrom(...URLS),
      active: fc.boolean(),
      pinned: fc.boolean(),
      groupId: fc.constantFrom(-1, -1, 7),
    }),
    { maxLength: 24 },
  )
  .map((rows) =>
    rows.map(
      (r, i): Tab => ({
        id: i + 1,
        index: i,
        title: r.url,
        audible: false,
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

  it('keeps at least one tab in every set', () => {
    fc.assert(fc.property(plannedArb, ({ sets }) => sets.every((s) => s.copies.some((c) => c.decision.action === 'keep'))));
  });

  it('only closes real duplicates', () => {
    fc.assert(
      fc.property(plannedArb, ({ tabs, sets }) =>
        tabsToClose(sets).every((t) => {
          const key = duplicateKey(t);
          return key !== null && tabs.filter((o) => duplicateKey(o) === key).length >= 2;
        }),
      ),
    );
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
    const [set] = planDuplicates([tab(1), tab(2, { active: true }), tab(3)], { keep: 'oldest', protectPinned: true, protectGroups: false });
    expect(set?.copies.map((c) => [c.tab.id, c.decision.action])).toEqual([
      [1, 'close'],
      [2, 'keep'],
      [3, 'close'],
    ]);
  });

  it('honours keep = newest', () => {
    const [set] = planDuplicates([tab(1), tab(2), tab(3)], { keep: 'newest', protectPinned: false, protectGroups: false });
    expect(set?.copies.map((c) => c.decision.action)).toEqual(['close', 'close', 'keep']);
  });

  it('ignores an override that would leave a set with nothing kept', () => {
    const policy: DuplicatePolicy = { keep: 'oldest', protectPinned: false, protectGroups: false };
    const plan = planDuplicates([tab(1), tab(2)], policy);
    const [set] = applyOverrides(plan, new Map([[1, 'close']]), policy);
    expect(set?.copies.map((c) => c.decision.action)).toEqual(['keep', 'close']);
  });
});
