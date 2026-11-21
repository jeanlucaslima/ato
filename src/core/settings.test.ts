import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CHOICES, DEFAULT_SETTINGS, fromLegacy, hasLegacy, policyOf, readSettings, type Settings } from './settings';

const validSettings: fc.Arbitrary<Settings> = fc.record({
  keep: fc.constantFrom(...CHOICES.keep),
  match: fc.constantFrom(...CHOICES.match),
  protectPinned: fc.boolean(),
  protectGroups: fc.boolean(),
  view: fc.constantFrom(...CHOICES.view),
  scope: fc.constantFrom(...CHOICES.scope),
  theme: fc.constantFrom(...CHOICES.theme),
  badge: fc.constantFrom(...CHOICES.badge),
  badgeColor: fc.constantFrom(...CHOICES.badgeColor),
});

function isValid(s: Settings): boolean {
  const keys = Object.keys(DEFAULT_SETTINGS).sort();
  return (
    JSON.stringify(Object.keys(s).sort()) === JSON.stringify(keys) &&
    Object.entries(CHOICES).every(([k, allowed]) => (allowed as readonly unknown[]).includes(s[k as keyof Settings])) &&
    typeof s.protectPinned === 'boolean' &&
    typeof s.protectGroups === 'boolean'
  );
}

describe('readSettings', () => {
  it('gives the defaults for missing or non-object data', () => {
    for (const raw of [undefined, null, 42, 'dark', []]) expect(readSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });

  it('reads the old dark/light theme names', () => {
    expect(readSettings({ theme: 'dark' }).theme).toBe('graphite');
    expect(readSettings({ theme: 'light' }).theme).toBe('paper');
  });

  it('keeps valid fields and defaults the invalid ones', () => {
    expect(readSettings({ keep: 'newest', theme: 'disco', protectPinned: 'yes', scope: 'current' })).toEqual({
      ...DEFAULT_SETTINGS,
      keep: 'newest',
      scope: 'current',
    });
  });

  it('always returns complete, valid settings, whatever was stored', () => {
    fc.assert(fc.property(fc.anything(), (raw) => isValid(readSettings(raw))));
    fc.assert(fc.property(fc.dictionary(fc.constantFrom(...Object.keys(DEFAULT_SETTINGS), 'other'), fc.anything()), (raw) => isValid(readSettings(raw))));
  });

  it('round-trips valid settings through storage unchanged', () => {
    fc.assert(fc.property(validSettings, (s) => {
          expect(readSettings(JSON.parse(JSON.stringify(s)))).toEqual(s);
        }));
  });
});

describe('policyOf', () => {
  it('carries the duplicate rules over', () => {
    fc.assert(
      fc.property(validSettings, (s) => {
        const p = policyOf(s);
        return p.keep === s.keep && p.protectPinned === s.protectPinned && p.protectGroups === s.protectGroups;
      }),
    );
  });
});

describe('fromLegacy (settings saved by 2.x)', () => {
  it('carries over what 2.x users chose', () => {
    const s = fromLegacy({ theme: 'ivory', matchMode: 'ignoreQueryAndHash', keepTab: 'newest', protectPinned: false, protectGroups: true, showBadge: true, badgeMode: 'allTabs', badgeColor: '#DC2626', currentWindowOnly: true, defaultBrowseView: 'domains', fontFamily: 'inter', debugLogging: true });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, theme: 'paper', match: 'ignoreBoth', keep: 'newest', protectPinned: false, protectGroups: true, badge: 'all', badgeColor: '#dc2626', scope: 'current', view: 'sites' });
    expect(fromLegacy({ showBadge: false, badgeMode: 'duplicates' }).badge).toBe('off');
  });

  it('always yields valid settings, whatever was stored', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.constantFrom('theme', 'matchMode', 'keepTab', 'protectPinned', 'showBadge', 'badgeMode', 'badgeColor', 'currentWindowOnly', 'defaultBrowseView'), fc.anything()), (raw) => {
        const s = fromLegacy(raw);
        return Object.entries(CHOICES).every(([k, allowed]) => (allowed as readonly unknown[]).includes(s[k as keyof Settings]));
      }),
    );
  });

  it('only kicks in when 2.x keys are there', () => {
    expect(hasLegacy({})).toBe(false);
    expect(hasLegacy({ keepTab: 'oldest' })).toBe(true);
  });
});
