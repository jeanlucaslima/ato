import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { BADGE_MAX, badgeFor, badgeText } from './badge';
import { planDuplicates, tabsToClose } from './duplicates';
import { BADGE_COLORS, DEFAULT_SETTINGS, policyOf, type Settings } from './settings';
import type { Tab } from './types';

const URLS = ['https://a.test/', 'https://b.test/x', 'chrome://newtab/', ''];

const tabsArb = fc
  .array(
    fc.record({
      windowId: fc.integer({ min: 1, max: 3 }),
      url: fc.constantFrom(...URLS),
      active: fc.boolean(),
      pinned: fc.boolean(),
      audible: fc.boolean(),
      groupId: fc.constantFrom(-1, -1, 4),
    }),
    { maxLength: 30 },
  )
  .map((rows) => rows.map((r, i): Tab => ({ id: i + 1, index: i, title: r.url, discarded: false, lastAccessed: i, ...r })));

const settingsArb = fc.record<Settings>({
  ...Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([k, v]) => [k, fc.constant(v)])),
  keep: fc.constantFrom('oldest', 'newest'),
  protectPinned: fc.boolean(),
  protectGroups: fc.boolean(),
  badge: fc.constantFrom('duplicates', 'all', 'off'),
  badgeColor: fc.constantFrom(...BADGE_COLORS),
} as never);

describe('badgeFor', () => {
  it('in duplicates mode, shows what the popup would close, hidden at zero', () => {
    fc.assert(
      fc.property(tabsArb, settingsArb, (tabs, s) => {
        const settings = { ...s, badge: 'duplicates' as const };
        const extra = tabsToClose(planDuplicates(tabs, policyOf(settings))).length;
        expect(badgeFor(tabs, settings).text).toBe(extra === 0 ? '' : String(extra));
      }),
    );
  });

  it('in all-tabs mode, always shows the tab count; off shows nothing', () => {
    fc.assert(
      fc.property(tabsArb, settingsArb, (tabs, s) => {
        expect(badgeFor(tabs, { ...s, badge: 'all' }).text).toBe(String(tabs.length));
        expect(badgeFor(tabs, { ...s, badge: 'off' }).text).toBe('');
      }),
    );
  });

  it('wears the chosen color', () => {
    fc.assert(fc.property(tabsArb, settingsArb, (tabs, s) => badgeFor(tabs, s).color === s.badgeColor));
  });

  it('caps long counts so they fit', () => {
    expect(badgeText(BADGE_MAX)).toBe('999');
    expect(badgeText(BADGE_MAX + 1)).toBe('999+');
  });
});
