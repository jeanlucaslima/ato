import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { protection, type DuplicatePolicy } from './duplicates';
import { duplicatesOf, othersFromSite } from './tab-menu';
import { domainOf, duplicateKey } from './tabs';
import type { Tab } from './types';

const URLS = ['https://a.test/', 'https://a.test/x', 'https://b.test/x', 'http://a.test/', 'chrome://settings/', ''];

const tabsArb = fc
  .array(
    fc.record({
      windowId: fc.integer({ min: 1, max: 3 }),
      url: fc.constantFrom(...URLS),
      active: fc.boolean(),
      pinned: fc.boolean(),
      audible: fc.boolean(),
      groupId: fc.constantFrom(-1, -1, 7),
    }),
    { minLength: 1, maxLength: 24 },
  )
  .map((rows) => rows.map((r, i): Tab => ({ id: i + 1, index: i, title: r.url, discarded: false, lastAccessed: i, ...r })));

const policyArb = fc.record<DuplicatePolicy>({ keep: fc.constantFrom('oldest', 'newest'), protectPinned: fc.boolean(), protectGroups: fc.boolean() });

/** Browser state, a policy, and the tab that was right-clicked. */
const caseArb = fc.tuple(tabsArb, policyArb).chain(([tabs, policy]) => fc.nat(tabs.length - 1).map((i) => ({ tabs, policy, clicked: tabs[i]! })));

describe('tab menu safety rules', () => {
  for (const [name, pick] of [
    ['close duplicates of this tab', duplicatesOf],
    ['close other tabs from this site', othersFromSite],
  ] as const) {
    it(`${name}: never closes the right-clicked tab`, () => {
      fc.assert(fc.property(caseArb, ({ tabs, policy, clicked }) => pick(clicked, tabs, policy).every((t) => t.id !== clicked.id)));
    });

    it(`${name}: never closes a protected tab (current, playing, pinned, grouped)`, () => {
      fc.assert(fc.property(caseArb, ({ tabs, policy, clicked }) => pick(clicked, tabs, policy).every((t) => protection(t, policy) === null && !t.active && !t.audible)));
    });
  }

  it('close duplicates: only real copies of the clicked tab, and every unprotected one', () => {
    fc.assert(
      fc.property(caseArb, ({ tabs, policy, clicked }) => {
        const closing = new Set(duplicatesOf(clicked, tabs, policy).map((t) => t.id));
        const key = duplicateKey(clicked);
        return tabs.every((t) => {
          const copy = key !== null && t.id !== clicked.id && duplicateKey(t) === key;
          return closing.has(t.id) === (copy && protection(t, policy) === null);
        });
      }),
    );
  });

  it('close other tabs from this site: only that site', () => {
    fc.assert(
      fc.property(caseArb, ({ tabs, policy, clicked }) => othersFromSite(clicked, tabs, policy).every((t) => domainOf(t.url) === domainOf(clicked.url) && domainOf(t.url) !== '')),
    );
  });

  it('a tab with nothing comparable (new tab, settings) closes nothing', () => {
    const blank: Tab = { id: 1, windowId: 1, index: 0, title: '', url: 'chrome://newtab/', active: false, pinned: false, audible: false, discarded: false, groupId: -1, lastAccessed: 0 };
    const policy = { keep: 'oldest', protectPinned: true, protectGroups: true } as const;
    expect(duplicatesOf(blank, [blank, { ...blank, id: 2 }], policy)).toEqual([]);
  });
});
