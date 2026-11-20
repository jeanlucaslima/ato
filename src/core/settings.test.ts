import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CHOICES, DEFAULT_SETTINGS, policyOf, readSettings, type Settings } from './settings';

const validSettings: fc.Arbitrary<Settings> = fc.record({
  keep: fc.constantFrom(...CHOICES.keep),
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
